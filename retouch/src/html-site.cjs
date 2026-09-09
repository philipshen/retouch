'use strict';
const fs=require('node:fs'),path=require('node:path');
const html=require('./adapters/html.cjs'),css=require('./html-css.cjs');
const types={'.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.avif':'image/avif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf'};
const reason='Use the CSS properties panel for this HTML document. Utility class editing is unavailable.';
function start({root,port=9400,quiet=false}){
 root=fs.realpathSync(root);
 if(!fs.statSync(root).isDirectory())throw Error('Choose an HTML web directory.');
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port.');
 const adapter={...html,describe:r=>({...html.describe(r),...css.describe(r),classNameDynamic:true,classNameReason:reason}),planOp:(r,op)=>op.type==='setCSS'?css.plan(r,op):op.type==='setClasses'?{ok:false,refused:true,reason}:html.planOp(r,op)};
 function serveSite(req,res){
  const fail=(status,message)=>{res.writeHead(status,{'content-type':'text/plain'});res.end(message);};
  if(!['GET','HEAD'].includes(req.method))return fail(405,'method not allowed');
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return fail(400,'invalid path');}
  const parts=pathname.split('/');
  if(pathname.includes('\\')||pathname.includes('\0')||parts.some(p=>p.startsWith('.')||['node_modules','package.json','package-lock.json'].includes(p)))return fail(403,'not available');
  let file=path.join(root,...parts.filter(Boolean));
  try{
   if(fs.statSync(file).isDirectory())file=path.join(file,fs.existsSync(path.join(file,'index.html'))?'index.html':'index.htm');
   file=fs.realpathSync(file);
   if(!file.startsWith(root+path.sep))return fail(403,'outside web directory');
   const type=types[path.extname(file).toLowerCase()];if(!type||!fs.statSync(file).isFile())return fail(404,'not found');
   let body=fs.readFileSync(file);
   if(html.matches(file))body=Buffer.from(html.stamp(body.toString('utf8'),file,root)?.code||body);
   res.writeHead(200,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'SAMEORIGIN'});
   res.end(req.method==='HEAD'?undefined:body);
  }catch(err){return fail(err.code==='ENOENT'?404:500,err.code==='ENOENT'?'not found':'could not serve file');}
 }
 return require('./server.cjs').startServer({appRoot:root,port,adapter,serveSite,rendering:{reloadAfterWrite:true,revalidateStyles:true},quiet});
}
module.exports={start};
