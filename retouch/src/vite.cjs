'use strict';
const fs=require('node:fs'),path=require('node:path'),{once}=require('node:events');
const virtual='virtual:retouch-group-scale.jsx',resolvedVirtual='\0retouch-group-scale.jsx';
function retouch(){
 let config,sidecar;
 return {
  name:'vite-plugin-react-retouch',apply:'serve',enforce:'pre',
  configResolved(value){
   config=value;if(value.command!=='serve')return;
   if(value.base!=='/')throw Error('[retouch] Vite integration currently requires base: "/".');
   if(value.server.host&& !['localhost','127.0.0.1'].includes(value.server.host))throw Error('[retouch] Run the editor on a loopback Vite host.');
   config={...value,root:fs.realpathSync(value.root)};
  },
  async configureServer(server){
   require('./installation.cjs').check();
   sidecar=require('./server.cjs').startServer({appRoot:config.root,port:0,adapter:require('./adapter.cjs').getAdapter('react'),quiet:true});
   if(!sidecar.listening)await once(sidecar,'listening');
   server.middlewares.use((req,res,next)=>{if(/^\/rt(?:\/|\?|$)/.test(req.url||''))sidecar.emit('request',req,res);else next();});
   server.httpServer?.once('listening',()=>{const address=server.httpServer.address();if(address&&typeof address==='object')server.config.logger.info('[retouch] Open http://localhost:'+address.port+'/rt');});
  },
  resolveId(id){if(config?.command==='serve'&&id===virtual)return resolvedVirtual;},
  async load(id){if(config?.command!=='serve'||id!==resolvedVirtual)return null;const load=require('node:module').createRequire(path.join(config.root,'package.json')),vite=await import(require('node:url').pathToFileURL(load.resolve('vite')).href);if(typeof vite.transformWithOxc!=='function')throw Error('[retouch] The Vite plugin currently requires Vite 8.');const result=await vite.transformWithOxc(require('./react-group-scale-runtime.cjs').component(),'retouch-group-scale.jsx',{jsx:{runtime:'automatic',development:true},sourcemap:true});return {code:result.code,map:result.map};},
  transform(source,id,options){
   if(config?.command!=='serve'||options?.ssr||id.startsWith('\0')||id.includes('?')||! /\.(jsx|tsx)$/.test(id))return null;
   if(id.split(path.sep).includes('node_modules'))return null;
   try{
    const real=fs.realpathSync(id),realRelative=path.relative(config.root,real);if(real.split(path.sep).includes('node_modules')||realRelative.startsWith('..'+path.sep)||path.isAbsolute(realRelative))return null;
    const helper=path.join(path.dirname(real),'.retouch-group-scale.jsx'),runtime=require('./react-group-scale-runtime.cjs');if(fs.existsSync(helper))this.addWatchFile(helper);
    return require('./stamp.cjs').stamp(source,real,config.root,{groupScaleRuntime:virtual,redirectGroupScaleRuntime:fs.existsSync(helper)&&fs.readFileSync(helper,'utf8')===runtime.component()});
   }catch(error){this.warn('[retouch] Stamping skipped for '+id+': '+error.message);return null;}
  },
  async closeBundle(){if(!sidecar)return;const active=sidecar;sidecar=null;active.retouchIndex.close();active.closeAllConnections();await new Promise(resolve=>active.close(resolve));}
 };
}
module.exports={retouch};module.exports.default=retouch;
