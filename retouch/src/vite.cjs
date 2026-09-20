'use strict';
const fs=require('node:fs'),path=require('node:path'),{once}=require('node:events');
const virtual='virtual:retouch-group-scale.jsx',resolvedVirtual='\0retouch-group-scale.jsx';
const vueStylePrefix='virtual:retouch-vue-css/';
function retouch(options={}){
 if(options.adapter!==undefined&&!['react','vue','svelte'].includes(options.adapter))throw Error('[retouch] Choose the react, vue, or svelte source adapter.');
 let config,sidecar,sourceAdapter;const vueStyleModules=new Map(),vueSourceRevisions=new Map(),svelteSnapshots=new Map();
 function vueStyleFile(id){
  const key=id.replace(/^\0/,'').split('?')[0];if(!key.startsWith(vueStylePrefix)||!key.endsWith('.css'))return null;
  const encoded=key.slice(vueStylePrefix.length,-4);if(!/^[A-Za-z0-9_-]+$/.test(encoded))return null;
  const relative=Buffer.from(encoded,'base64url').toString('utf8');if(Buffer.from(relative).toString('base64url')!==encoded||!relative.endsWith('.vue'))return null;
  try{const file=fs.realpathSync(path.resolve(config.root,relative)),rel=path.relative(config.root,file);if(rel.startsWith('..'+path.sep)||path.isAbsolute(rel)||file.split(path.sep).includes('node_modules'))return null;return {file,relative:rel.split(path.sep).join('/')};}catch{return null;}
 }
 async function closeSidecar(){if(!sidecar)return;const active=sidecar;sidecar=null;active.retouchIndex.close();active.closeAllConnections();await new Promise(resolve=>active.close(resolve));}
 const plugin={
  name:'vite-plugin-retouch',apply:'serve',enforce:'pre',
  configResolved(value){
   config=value;if(value.command!=='serve')return;
   let decodedBase;try{decodedBase=decodeURIComponent(value.base);}catch{throw Error('[retouch] Vite base must be a valid local URL path.');}
   if(!value.base.startsWith('/')||value.base.startsWith('//')||/[?#\\]/.test(value.base)||!value.base.endsWith('/')||new URL(value.base,'http://localhost').pathname!==value.base)throw Error('[retouch] Vite base must be a normalized local URL path.');
   if(/^\/rt(?:\/|$)/.test(decodedBase))throw Error('[retouch] Vite base conflicts with the reserved /rt editor path.');
   if(value.server.host&& !['localhost','127.0.0.1'].includes(value.server.host))throw Error('[retouch] Run the editor on a loopback Vite host.');
   const root=fs.realpathSync(value.root),publicDir=value.publicDir===undefined?path.join(value.root,'public'):value.publicDir;
   config={...value,root,publicDir:publicDir?path.resolve(root,path.relative(value.root,publicDir)):null};
   const vuePlugins=(value.plugins||[]).filter(plugin=>plugin.name==='vite:vue');
   const sveltePlugins=(value.plugins||[]).filter(plugin=>plugin.name==='vite-plugin-svelte');
   const renderer=options.adapter||(sveltePlugins.length?'svelte':vuePlugins.length?'vue':'react');
   if(!options.adapter&&sveltePlugins.length&&vuePlugins.length)throw Error('[retouch] Choose a source adapter for this mixed-framework project.');
   if(renderer==='vue'){
    if(vuePlugins.length!==1||!vuePlugins[0].api?.options)throw Error('[retouch] Vue editing needs one @vitejs/plugin-vue integration.');
    sourceAdapter=require('./adapters/vue.cjs').create({compilerOptions:()=>vuePlugins[0].api.options.template?.compilerOptions||{},styleModule:relative=>vueStylePrefix+Buffer.from(relative).toString('base64url')+'.css'});
   }else{if(renderer==='svelte'&&sveltePlugins.length!==1)throw Error('[retouch] Svelte editing needs one @sveltejs/vite-plugin-svelte integration.');sourceAdapter=require('./adapter.cjs').getAdapter(renderer);}
  },
  async configureServer(server){
   require('./installation.cjs').check();
   const adapter={...sourceAdapter,assets:config.publicDir?{...sourceAdapter.assets,directory:path.relative(config.root,config.publicDir),urlPrefix:config.base}:undefined};
   sidecar=require('./server.cjs').startServer({appRoot:config.root,port:0,adapter,rendering:{reloadOnServerRestart:true},quiet:true});
   if(!sidecar.listening)await once(sidecar,'listening');
   if(process.env.RETOUCH_SESSION_URL){try{await require('./session-client.cjs').notifyConnected(config.root);}catch(error){await closeSidecar();throw error;}}
   server.middlewares.use((req,res,next)=>{
    // The editor owns /rt independently of Vite's public base. Deep editor URLs
    // already map to the full application pathname in the shared shell.
    if(require('./vite-assets.cjs').serve(req,res,{root:config.root,publicDir:config.publicDir,base:config.base,headers:config.server.headers}))return;
    const initial=(req.url||'').match(/^\/rt\/?(\?.*)?$/);
    if(config.base!=='/'&&initial){res.writeHead(307,{location:'/rt'+config.base+(initial[1]||''),'cache-control':'no-store'});res.end();return;}
    if(/^\/rt(?:\/|\?|$)/.test(req.url||''))sidecar.emit('request',req,res);else next();
   });
   server.httpServer?.once('listening',()=>{const address=server.httpServer.address();if(address&&typeof address==='object')server.config.logger.info('[retouch] Open http://localhost:'+address.port+'/rt'+(config.base==='/'?'':config.base));});
  },
  resolveId(id){if(config?.command!=='serve')return;if(sourceAdapter?.name==='svelte'&&id==='virtual:retouch-svelte-source')return '\0retouch-svelte-source';if(sourceAdapter?.name==='react'&&id===virtual)return resolvedVirtual;if(sourceAdapter?.name==='vue'&&id.startsWith(vueStylePrefix)&&vueStyleFile(id))return '\0'+id;},
  async load(id){
   if(config?.command!=='serve')return null;
   if(sourceAdapter?.name==='svelte'&&id==='\0retouch-svelte-source')return require('./svelte-hmr.cjs').runtime();
   if(sourceAdapter?.name==='vue'&&id.startsWith('\0'+vueStylePrefix)){
    const target=vueStyleFile(id);if(!target)return null;
    this.addWatchFile(target.file);if(!vueStyleModules.has(target.file))vueStyleModules.set(target.file,new Set());vueStyleModules.get(target.file).add(id);
    return require('./vue-css.cjs').stylesheet(fs.readFileSync(target.file,'utf8'),target.relative);
   }
   if(sourceAdapter?.name!=='react'||id!==resolvedVirtual)return null;const load=require('node:module').createRequire(path.join(config.root,'package.json')),vite=await import(require('node:url').pathToFileURL(load.resolve('vite')).href);if(typeof vite.transformWithOxc!=='function')throw Error('[retouch] The Vite plugin currently requires Vite 8.');const result=await vite.transformWithOxc(require('./react-group-scale-runtime.cjs').component(),'retouch-group-scale.jsx',{jsx:{runtime:'automatic',development:true},sourcemap:true});return {code:result.code,map:result.map};
  },
  transform(source,id,options){
   if(config?.command!=='serve'||options?.ssr||id.startsWith('\0')||id.includes('?')||!sourceAdapter.matches(id))return null;
   if(id.split(path.sep).includes('node_modules'))return null;
   try{
    const real=fs.realpathSync(id),realRelative=path.relative(config.root,real);if(real.split(path.sep).includes('node_modules')||realRelative.startsWith('..'+path.sep)||path.isAbsolute(realRelative))return null;
    if(sourceAdapter.name==='svelte'){if(!svelteSnapshots.has(real))svelteSnapshots.set(real,require('./svelte-source.cjs').textSnapshot(source,realRelative.split(path.sep).join('/')));return sourceAdapter.stamp(source,real,config.root,{runtime:true});}
    if(sourceAdapter.name==='vue'){vueSourceRevisions.set(id,sourceAdapter.contentHash(source));return sourceAdapter.stamp(source,real,config.root);}
    const helper=path.join(path.dirname(real),'.retouch-group-scale.jsx'),runtime=require('./react-group-scale-runtime.cjs');if(fs.existsSync(helper))this.addWatchFile(helper);
    return require('./stamp.cjs').stamp(source,real,config.root,{groupScaleRuntime:virtual,redirectGroupScaleRuntime:fs.existsSync(helper)&&fs.readFileSync(helper,'utf8')===runtime.component()});
   }catch(error){this.warn('[retouch] Stamping skipped for '+id+': '+error.message);return null;}
  },
  hotUpdate:{order:'pre',async handler(ctx){
   if(sourceAdapter?.name!=='svelte'||this.environment?.config.consumer!=='client'||!sourceAdapter.matches(ctx.file))return;
   let file;try{file=fs.realpathSync(ctx.file);}catch{return;}const before=svelteSnapshots.get(file);if(!before)return;
   const relative=path.relative(config.root,file).split(path.sep).join('/');let next;try{next=require('./svelte-source.cjs').textSnapshot(await ctx.read(),relative);}catch{return;}
   svelteSnapshots.set(file,next);if(before.signature!==next.signature)return;if(before.revision===next.revision)return [];
   this.environment.hot.send({type:'custom',event:'retouch:svelte-source',data:{file:relative,revision:next.revision,texts:next.texts,styleIds:next.styling?.ids||{},css:next.styling?.css||null}});return [];
  }},
  async handleHotUpdate(ctx){
   if(config?.command!=='serve'||sourceAdapter?.name!=='vue'||!sourceAdapter.matches(ctx.file)||ctx.file.split(path.sep).includes('node_modules'))return;
   let real;try{real=fs.realpathSync(ctx.file);}catch{return;}
   const relative=path.relative(config.root,real);
   if(real.split(path.sep).includes('node_modules')||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))return;
   // plugin-vue caches the template read during HMR and serves template query
   // modules from that cache. Keep its cache consistent with our pre-transform.
   const read=ctx.read;
   ctx.read=async()=>{const source=await read();try{return sourceAdapter.stamp(source,real,config.root)?.code||source;}catch(error){ctx.server?.config?.logger?.warn('[retouch] Stamping skipped for '+ctx.file+': '+error.message);return source;}};
   // Keep the CSS module independent of Vue's component module. Its stable src
   // lets Vue classify simultaneous template/style edits as a rerender, while
   // Vite replaces the stylesheet through its own CSS HMR boundary.
   for(const id of vueStyleModules.get(real)||[]){const module=ctx.server.moduleGraph.getModuleById(id);if(module)await ctx.server.reloadModule(module);}
  },
  closeBundle:closeSidecar
 };
 return [plugin,{name:'retouch-vue-source-hmr',apply:'serve',enforce:'post',transform(code,id,options){
  if(config?.command!=='serve'||sourceAdapter?.name!=='vue'||options?.ssr||id.includes('?')||!id.endsWith('.vue'))return null;
  const revision=vueSourceRevisions.get(id);if(!revision)return null;
  return require('./vue-hmr.cjs').transform(code,fs.realpathSync(id),revision);
 }}];
}
module.exports={retouch};module.exports.default=retouch;
