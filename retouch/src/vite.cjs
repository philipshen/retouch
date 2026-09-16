'use strict';
const fs=require('node:fs'),path=require('node:path'),{once}=require('node:events');
const virtual='virtual:retouch-group-scale.jsx',resolvedVirtual='\0retouch-group-scale.jsx';
function retouch(options={}){
 if(options.adapter!==undefined&&!['react','vue'].includes(options.adapter))throw Error('[retouch] Choose the react or vue source adapter.');
 let config,sidecar,sourceAdapter;
 async function closeSidecar(){if(!sidecar)return;const active=sidecar;sidecar=null;active.retouchIndex.close();active.closeAllConnections();await new Promise(resolve=>active.close(resolve));}
 return {
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
   const renderer=options.adapter||(vuePlugins.length?'vue':'react');
   if(renderer==='vue'){
    if(vuePlugins.length!==1||!vuePlugins[0].api?.options)throw Error('[retouch] Vue editing needs one @vitejs/plugin-vue integration.');
    sourceAdapter=require('./adapters/vue.cjs').create({compilerOptions:()=>vuePlugins[0].api.options.template?.compilerOptions||{}});
   }else sourceAdapter=require('./adapter.cjs').getAdapter('react');
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
  resolveId(id){if(config?.command==='serve'&&sourceAdapter?.name==='react'&&id===virtual)return resolvedVirtual;},
  async load(id){if(config?.command!=='serve'||sourceAdapter?.name!=='react'||id!==resolvedVirtual)return null;const load=require('node:module').createRequire(path.join(config.root,'package.json')),vite=await import(require('node:url').pathToFileURL(load.resolve('vite')).href);if(typeof vite.transformWithOxc!=='function')throw Error('[retouch] The Vite plugin currently requires Vite 8.');const result=await vite.transformWithOxc(require('./react-group-scale-runtime.cjs').component(),'retouch-group-scale.jsx',{jsx:{runtime:'automatic',development:true},sourcemap:true});return {code:result.code,map:result.map};},
  transform(source,id,options){
   if(config?.command!=='serve'||options?.ssr||id.startsWith('\0')||id.includes('?')||!(sourceAdapter.name==='vue'?/\.vue$/i:/\.(jsx|tsx)$/).test(id))return null;
   if(id.split(path.sep).includes('node_modules'))return null;
   try{
    const real=fs.realpathSync(id),realRelative=path.relative(config.root,real);if(real.split(path.sep).includes('node_modules')||realRelative.startsWith('..'+path.sep)||path.isAbsolute(realRelative))return null;
    if(sourceAdapter.name==='vue')return sourceAdapter.stamp(source,real,config.root);
    const helper=path.join(path.dirname(real),'.retouch-group-scale.jsx'),runtime=require('./react-group-scale-runtime.cjs');if(fs.existsSync(helper))this.addWatchFile(helper);
    return require('./stamp.cjs').stamp(source,real,config.root,{groupScaleRuntime:virtual,redirectGroupScaleRuntime:fs.existsSync(helper)&&fs.readFileSync(helper,'utf8')===runtime.component()});
   }catch(error){this.warn('[retouch] Stamping skipped for '+id+': '+error.message);return null;}
  },
  handleHotUpdate(ctx){
   if(config?.command!=='serve'||sourceAdapter?.name!=='vue'||!sourceAdapter.matches(ctx.file)||ctx.file.split(path.sep).includes('node_modules'))return;
   let real;try{real=fs.realpathSync(ctx.file);}catch{return;}
   const relative=path.relative(config.root,real);
   if(real.split(path.sep).includes('node_modules')||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))return;
   // plugin-vue caches the template read during HMR and serves template query
   // modules from that cache. Keep its cache consistent with our pre-transform.
   const read=ctx.read;
   ctx.read=async()=>{const source=await read();try{return sourceAdapter.stamp(source,real,config.root)?.code||source;}catch(error){ctx.server?.config?.logger?.warn('[retouch] Stamping skipped for '+ctx.file+': '+error.message);return source;}};
  },
  closeBundle:closeSidecar
 };
}
module.exports={retouch};module.exports.default=retouch;
