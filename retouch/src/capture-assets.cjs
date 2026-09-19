'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),parse5=require('parse5'),{rewrite}=require('./capture-css-urls.cjs'),{sanitize}=require('./capture-sanitize.cjs');
const extensions={'text/css':'.css','image/png':'.png','image/jpeg':'.jpg','image/gif':'.gif','image/webp':'.webp','image/avif':'.avif','image/svg+xml':'.svg','image/x-icon':'.ico','image/vnd.microsoft.icon':'.ico','font/woff':'.woff','font/woff2':'.woff2','font/ttf':'.ttf','font/otf':'.otf','application/font-woff':'.woff'};
const svgResources=new Set(['image','feImage','use','linearGradient','radialGradient','pattern','textPath','filter','clipPath','mask']);
const paintAttributes=new Set(['fill','stroke','clip-path','filter','mask','marker-start','marker-mid','marker-end','cursor']);
async function bounded(promise,milliseconds){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Asset download timed out.')),milliseconds);})]);}finally{clearTimeout(timer);}}
async function localize({html,fontFaces=[],baseURL,directory,context,page}){
 const tree=parse5.parse(html),warnings=new Set(),records=new Map(),unresolved=new Set(),deadline=Date.now()+60000;let downloaded=0,savedBytes=0;
 const absolute=(value,base)=>{if(!value||value.startsWith('#')||value.startsWith('data:'))return value;try{return new URL(value,base).href;}catch{return value;}};
 const head=tree.childNodes.find(node=>node.tagName==='html')?.childNodes.find(node=>node.tagName==='head');
 if(fontFaces.length&&head){const css=fontFaces.filter(face=>typeof face.css==='string'&&typeof face.base==='string').map(face=>rewrite(face.css,url=>absolute(url,face.base))).join('\n').replace(/</g,'\\3c ');head.childNodes.push({nodeName:'style',tagName:'style',attrs:[],namespaceURI:'http://www.w3.org/1999/xhtml',parentNode:head,childNodes:[{nodeName:'#text',value:css}]});}
 async function localizeTree(root,base,insideAsset,ancestors){
  const references=[],urls=new Set(),failures=new Set();
  const track=value=>{const url=absolute(value,base);if(/^(https?:|blob:)/.test(url))urls.add(url);return url;};
  function visit(node){
   for(const attr of node.attrs||[]){if(attr.name==='style'||node.namespaceURI==='http://www.w3.org/2000/svg'&&paintAttributes.has(attr.name)){attr.value=rewrite(attr.value,track);references.push({node:attr,key:'value',css:true});}
    else if(attr.name==='src'&&node.tagName==='img'||attr.name==='href'&&svgResources.has(node.tagName)){attr.value=track(attr.value);references.push({node:attr,key:'value'});}}
   if(node.tagName==='style')for(const child of node.childNodes||[])if(child.nodeName==='#text'){child.value=rewrite(child.value,track);references.push({node:child,key:'value',css:true});}
   for(const child of node.childNodes||[])visit(child);
  }
  visit(root);const replacements=new Map();
  for(const url of urls){const address=new URL(url),fragment=address.hash;address.hash='';const asset=await save(address.href,ancestors);if(asset)replacements.set(url,(insideAsset?'data:'+asset.mime+';base64,'+fs.readFileSync(path.join(directory,asset.path)).toString('base64'):'./capture-assets/'+path.basename(asset.path))+fragment);else{failures.add(url);unresolved.add(url);}}
  for(const reference of references)reference.node[reference.key]=reference.css?rewrite(reference.node[reference.key],url=>replacements.get(url)||url):replacements.get(reference.node[reference.key])||reference.node[reference.key];
  return [...failures];
 }
 async function save(url,ancestors){
  if(ancestors.has(url)){warnings.add('A cyclic SVG dependency remains remote.');return null;}
  if(records.has(url)){const record=records.get(url);return record.status==='saved'?record:null;}
  if(ancestors.size>=16){warnings.add('Some SVG dependencies remain remote because the nesting limit was reached.');return null;}
  if(Date.now()>=deadline){warnings.add('Some assets remain remote because the one-minute download limit was reached.');return null;}
  if(records.size>=256){warnings.add('Some assets remain remote because the 256-asset limit was reached.');return null;}
  const record={url,status:'loading'};records.set(url,record);
  try{
   let bytes,type,charset='utf-8',finalURL=url;
   if(url.startsWith('blob:')){
    const loaded=await bounded(page.evaluate(async url=>{const response=await fetch(url,{signal:AbortSignal.timeout(10000)}),blob=await response.blob();if(blob.size>10*1024*1024)throw Error('Asset exceeds 10 MiB.');const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return {type:blob.type,data:btoa(binary)};},url),Math.max(1,Math.min(10000,deadline-Date.now())));type=loaded.type;bytes=Buffer.from(loaded.data,'base64');downloaded+=bytes.length;
   }else{
    const cookies=await context.cookies(url),headers={referer:baseURL};if(cookies.length)headers.cookie=cookies.map(cookie=>cookie.name+'='+cookie.value).join('; ');
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(Math.max(1,Math.min(10000,deadline-Date.now())))});if(!response.ok){await response.body?.cancel();throw Error('HTTP '+response.status);}
    finalURL=response.url; charset=/charset\s*=\s*[\"']?([^;\s\"']+)/i.exec(response.headers.get('content-type')||'')?.[1]||'utf-8';type=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;downloaded+=chunk.length;if(size>10*1024*1024||downloaded>100*1024*1024)throw Error('Asset download limit exceeded.');chunks.push(chunk);}bytes=Buffer.concat(chunks);
   }
   let extension=extensions[type];if(!extension){const magic=bytes.subarray(0,4).toString('latin1');extension=({'wOFF':'.woff','wOF2':'.woff2','OTTO':'.otf','\x00\x01\x00\x00':'.ttf'})[magic];}if(!extension)throw Error('Unsupported asset type '+(type||'unknown'));
   if(downloaded>100*1024*1024)throw Error('Asset download limit exceeded.');
   if(extension==='.css'){
    const textNode={nodeName:'#text',value:new TextDecoder(charset).decode(bytes).replace(/^\s*@charset\s+["'][^"']+["']\s*;/i,'')},style={tagName:'style',childNodes:[textNode]};
    const chain=new Set(ancestors);chain.add(url);chain.add(finalURL);const failures=await localizeTree(style,finalURL,true,chain);if(failures.length)record.unresolvedDependencies=failures;bytes=Buffer.from(textNode.value);
   }
   if(extension==='.svg'){
    const svg=parse5.parseFragment(sanitize(bytes.toString('utf8'),{fragment:true,baseURL:finalURL}));if(!/^\s*<svg\b/.test(parse5.serialize(svg)))throw Error('Invalid SVG image.');
    const chain=new Set(ancestors);chain.add(url);chain.add(finalURL);const failures=await localizeTree(svg,finalURL,true,chain);if(failures.length)record.unresolvedDependencies=failures;bytes=Buffer.from(parse5.serialize(svg));
   }
   if(bytes.length>10*1024*1024||savedBytes+bytes.length>100*1024*1024)throw Error('Saved asset size limit exceeded.');
   // Embedded dependencies keep SVG resources portable even when <use> resolves
   // relative URLs against the containing HTML document rather than the SVG.
   const name=crypto.createHash('sha256').update(bytes).digest('hex')+extension,relative='capture-assets/'+name;fs.mkdirSync(path.join(directory,'capture-assets'),{recursive:true});fs.writeFileSync(path.join(directory,relative),bytes);savedBytes+=bytes.length;Object.assign(record,{path:relative,mime:type||({'.woff':'font/woff','.woff2':'font/woff2','.otf':'font/otf','.ttf':'font/ttf'})[extension],bytes:bytes.length,status:'saved'});return record;
  }catch(error){Object.assign(record,{status:'remote',reason:error.message});warnings.add('Some assets could not be saved and still depend on the original site.');return null;}
 }
 await localizeTree(tree,baseURL,false,new Set());
 return {html:parse5.serialize(tree),assets:[...records.values()],unresolvedReferences:[...unresolved],warnings:[...warnings]};
}
module.exports={localize};
