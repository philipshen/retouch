'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),parse5=require('parse5'),{rewrite}=require('./capture-css-urls.cjs'),{sanitize}=require('./capture-sanitize.cjs');
const extensions={'image/png':'.png','image/jpeg':'.jpg','image/gif':'.gif','image/webp':'.webp','image/avif':'.avif','image/svg+xml':'.svg','image/x-icon':'.ico','image/vnd.microsoft.icon':'.ico','font/woff':'.woff','font/woff2':'.woff2','font/ttf':'.ttf','font/otf':'.otf','application/font-woff':'.woff'};
async function bounded(promise,milliseconds){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Asset download timed out.')),milliseconds);})]);}finally{clearTimeout(timer);}}
async function localize({html,fontFaces=[],baseURL,directory,context,page}){
 const tree=parse5.parse(html),references=[],urls=new Set(),warnings=new Set(),assets=[];let total=0;
 const absolute=(value,base=baseURL)=>{if(!value||value.startsWith('#')||value.startsWith('data:'))return value;try{return new URL(value,base).href;}catch{return value;}};
 const track=(value,base)=>{const url=absolute(value,base);if(/^(https?:|blob:)/.test(url))urls.add(url);return url;};
 const head=tree.childNodes.find(node=>node.tagName==='html')?.childNodes.find(node=>node.tagName==='head');
 if(fontFaces.length&&head){const css=fontFaces.filter(face=>typeof face.css==='string'&&typeof face.base==='string').map(face=>rewrite(face.css,url=>absolute(url,face.base))).join('\n').replace(/</g,'\\3c ');head.childNodes.push({nodeName:'style',tagName:'style',attrs:[],namespaceURI:'http://www.w3.org/1999/xhtml',parentNode:head,childNodes:[{nodeName:'#text',value:css}]});}
 function visit(node){
  for(const attr of node.attrs||[]){if(attr.name==='style'){attr.value=rewrite(attr.value,track);references.push({node:attr,key:'value',css:true});}
   else if(attr.name==='src'&&node.tagName==='img'||attr.name==='href'&&['image','feImage'].includes(node.tagName)){attr.value=track(attr.value);references.push({node:attr,key:'value'});}}
  if(node.tagName==='style')for(const child of node.childNodes||[])if(child.nodeName==='#text'){child.value=rewrite(child.value,track);references.push({node:child,key:'value',css:true});}
  for(const child of node.childNodes||[])visit(child);
 }
 visit(tree);const replacements=new Map(),deadline=Date.now()+60000;
 for(const url of urls){
  if(Date.now()>=deadline){warnings.add('Some assets remain remote because the one-minute download limit was reached.');break;}
  if(assets.length>=256){warnings.add('Some assets remain remote because the 256-asset limit was reached.');break;}
  try{
   let bytes,type;
   if(url.startsWith('blob:')){
    const loaded=await bounded(page.evaluate(async url=>{const response=await fetch(url,{signal:AbortSignal.timeout(10000)}),blob=await response.blob();if(blob.size>10*1024*1024)throw Error('Asset exceeds 10 MiB.');const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return {type:blob.type,data:btoa(binary)};},url),Math.max(1,Math.min(10000,deadline-Date.now())));type=loaded.type;bytes=Buffer.from(loaded.data,'base64');
   }else{
    const cookies=await context.cookies(url),headers={referer:baseURL};if(cookies.length)headers.cookie=cookies.map(cookie=>cookie.name+'='+cookie.value).join('; ');
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(Math.max(1,Math.min(10000,deadline-Date.now())))});if(!response.ok){await response.body?.cancel();throw Error('HTTP '+response.status);}
    type=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>10*1024*1024||total+size>100*1024*1024)throw Error('Asset download limit exceeded.');chunks.push(chunk);}bytes=Buffer.concat(chunks);
   }
   let extension=extensions[type];if(!extension){const magic=bytes.subarray(0,4).toString('latin1');extension=({'wOFF':'.woff','wOF2':'.woff2','OTTO':'.otf','\x00\x01\x00\x00':'.ttf'})[magic];}if(!extension)throw Error('Unsupported asset type '+(type||'unknown'));
   if(total+bytes.length>100*1024*1024)throw Error('Asset download limit exceeded.');
   if(extension==='.svg'){
    const svg=parse5.parseFragment(sanitize(bytes.toString('utf8'),{fragment:true,baseURL:url}));let external=false;
    const inspect=value=>{const resolved=absolute(value,url);if(/^(https?:|blob:)/.test(resolved))external=true;return resolved;};
    function inspectSVG(node){for(const attr of node.attrs||[])if(attr.name==='style')attr.value=rewrite(attr.value,inspect);else if(attr.name==='href')attr.value=inspect(attr.value);if(node.tagName==='style')for(const child of node.childNodes||[])if(child.nodeName==='#text')child.value=rewrite(child.value,inspect);for(const child of node.childNodes||[])inspectSVG(child);}
    inspectSVG(svg);const clean=parse5.serialize(svg);if(!/^\s*<svg\b/.test(clean))throw Error('Invalid SVG image.');if(external)warnings.add('An SVG image still contains external references.');bytes=Buffer.from(clean);
   }
   if(bytes.length>10*1024*1024||total+bytes.length>100*1024*1024)throw Error('Saved asset size limit exceeded.');
   const name=crypto.createHash('sha256').update(bytes).digest('hex')+extension,relative='capture-assets/'+name;fs.mkdirSync(path.join(directory,'capture-assets'),{recursive:true});fs.writeFileSync(path.join(directory,relative),bytes);total+=bytes.length;replacements.set(url,'./'+relative);assets.push({url,path:relative,bytes:bytes.length,status:'saved'});
  }catch(error){assets.push({url,status:'remote',reason:error.message});warnings.add('Some assets could not be saved and still depend on the original site.');}
 }
 for(const reference of references)reference.node[reference.key]=reference.css?rewrite(reference.node[reference.key],url=>replacements.get(url)||url):replacements.get(reference.node[reference.key])||reference.node[reference.key];
 return {html:parse5.serialize(tree),assets,warnings:[...warnings]};
}
module.exports={localize};
