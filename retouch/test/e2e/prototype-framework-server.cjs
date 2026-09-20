'use strict';
// Compile actual JSX and Vue templates, then serve their live client runtime.
// This fixture verifies source metadata through the renderer, not a DOM mock.
const fs=require('node:fs'),path=require('node:path');
module.exports=function({root,renderer,fixture,minifyCSS=false}){
 const adapter=require('../../src/adapters/'+renderer+'.cjs'),esbuild=require(require.resolve('esbuild',{paths:[process.env.RT_BUILD_FIXTURE||fixture]}));
 const extension=renderer==='react'?'jsx':'vue',runtimePaths=[path.join(process.env.RT_BUILD_FIXTURE||fixture,'node_modules'),path.join(__dirname,'../../node_modules')];
 return require('../../src/server.cjs').startServer({appRoot:root,adapter,port:0,quiet:true,rendering:{},serveSite:async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost'),pageName=url.pathname==='/prototype-bundle.js'?(url.searchParams.get('page')||(url.searchParams.has('next')?'next':'index')):(url.pathname==='/'?'index':path.basename(url.pathname,'.html')),next=pageName==='next';if(!/^[a-z0-9-]+$/.test(pageName)){res.statusCode=404;res.end();return;}const file=path.join(root,pageName+'.'+extension);if(!fs.existsSync(file)){res.statusCode=404;res.end();return;}
   if(url.pathname==='/prototype-bundle.js'){
    const entry=renderer==='react'?`import React from 'react';import {createRoot} from 'react-dom/client';import App from ${JSON.stringify(file)};setTimeout(()=>createRoot(document.getElementById('site')).render(React.createElement(App)),100);`:`import {createApp} from 'vue';import App from ${JSON.stringify(file)};setTimeout(()=>createApp(App).mount('#site'),100);`;
    const result=await esbuild.build({stdin:{contents:entry,resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',nodePaths:runtimePaths,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'retouch-source',setup(build){build.onLoad({filter:/\.(jsx|vue)$/},async args=>{
     const source=fs.readFileSync(args.path,'utf8'),stamped=adapter.stamp(source,args.path,root).code;
     if(renderer==='react')return {contents:stamped,loader:'jsx',resolveDir:root};
     const compiler=require('@vue/compiler-sfc'),parsed=compiler.parse(stamped),compiled=compiler.compileScript(parsed.descriptor,{id:'prototype-fixture',inlineTemplate:true});return {contents:compiled.content,loader:'js',resolveDir:root};
    });}}]});res.setHeader('content-type','application/javascript');res.end(result.outputFiles[0].text);return;
   }
   const blocks=renderer==='vue'?require('@vue/compiler-sfc').parse(fs.readFileSync(file,'utf8')).descriptor.styles.filter(style=>!style.scoped).map(style=>style.content):[],styles=minifyCSS&&blocks.length?'<style>'+esbuild.transformSync(blocks.join('\n'),{loader:'css',minify:true}).code+'</style>':blocks.map(css=>'<style>'+css+'</style>').join('');
   res.setHeader('content-type','text/html');res.end('<!doctype html><title>'+(next?'Next':'Start')+'</title><style>body{padding:24px;font:16px system-ui}#card{position:sticky;top:0;padding:24px;background:#eef3ff}#bottom{margin-top:1500px}.long-page{height:2400px}</style>'+styles+'<div id="site"></div><script src="/prototype-bundle.js'+'?page='+pageName+'"></script>');
  }catch(error){res.statusCode=500;res.end(error.message);}
 }});
};
