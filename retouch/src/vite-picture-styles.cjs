'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// The client graph resolves JavaScript imports and aliases to source files.
// It does not enumerate document links, injected styles or unloaded routes.
function discover(server,{root}){
 const graph=server.environments?server.environments.client?.moduleGraph:server.moduleGraph;
 if(!graph?.idToModuleMap?.values)throw Error('The Vite client module graph is unavailable.');
 root=fs.realpathSync(root);const files=new Set(),records=new Set();let count=0;
 for(const module of graph.idToModuleMap.values()){
  if(++count>20000)throw Error('The Vite module graph is too large to inspect.');
  const id=module.id||'',file=module.file||'',clean=id.split('?')[0];
  const style=module.type==='css'||/\.(?:css|scss|sass|less|styl|stylus|pcss|postcss)$/i.test(file||clean)||/[?&](?:type=style|lang\.(?:css|scss|sass|less))(?:&|$)/i.test(id);
  if(!style&&!/\.svelte$/i.test(file||clean))continue;
  if(!file||file.includes('\0')||!path.isAbsolute(file))throw Error('A generated stylesheet has no editable source file.');
  const relative=path.relative(root,file);
  if(!relative||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||file.split(path.sep).includes('node_modules'))throw Error('A loaded stylesheet is outside the editable project.');
  if(!/\.(?:css|svelte)$/i.test(file))throw Error('A loaded stylesheet needs another source adapter.');
  if(/\.css$/i.test(file)&&(/\.module\.css$/i.test(file)||/[?&](?:inline|raw|url|module)(?:=|&|$)/.test(id)))throw Error('CSS modules and imported CSS values need a separate picture adaptation.');
  if(fs.realpathSync(file)!==file||!fs.statSync(file).isFile())throw Error('A loaded stylesheet is not a regular project source file.');
  files.add(file);records.add(id+'\0'+file);
  if(files.size>256)throw Error('The client imports too many stylesheet sources.');
 }
 return {files:[...files].sort(),fingerprint:crypto.createHash('sha256').update([...records].sort().join('\n')).digest('hex'),coverage:'loaded-client-modules'};
}
async function validate(server,{root,documents}){
 const inventory=discover(server,{root}),graph=server.environments?server.environments.client.moduleGraph:server.moduleGraph,expected=new Map();
 const literal=(code,name)=>{const match=code?.match(new RegExp('(?:^|\\n)const '+name+' = ("(?:[^"\\\\]|\\\\.)*")'));return match?JSON.parse(match[1]):null;};
 for(const module of graph.idToModuleMap.values()){
  if(!inventory.files.includes(module.file))continue;
  let transformed=module.transformResult;
  if(!transformed&&(/\.css(?:\?|$)/i.test(module.id||'')||/[?&]type=style(?:&|$)/.test(module.id||''))){
   const environment=server.environments?.client||server;
   if(typeof environment.transformRequest==='function'&&module.url)transformed=await environment.transformRequest(module.url);
  }
  const id=literal(transformed?.code,'__vite__id'),text=literal(transformed?.code,'__vite__css');
  if(id!==null&&text!==null)expected.set('vite|'+id,text);
 }
 for(const file of inventory.files.filter(file=>/\.svelte$/i.test(file))){
  if(fs.statSync(file).size>2*1024*1024)throw Error('A component stylesheet source is too large.');
  const relative=path.relative(fs.realpathSync(root),file).split(path.sep).join('/');
  try{const {css}=require('./svelte-css.cjs').runtimeSnapshot(fs.readFileSync(file,'utf8'),relative);expected.set('managed|'+css.id,css.text);}catch{/* Unmapped managed styles refuse below. */}
 }
 if(!Array.isArray(documents)||!documents.length||documents.length>32)throw Error('Current preview stylesheet inventories are required.');
 let size=0;
 for(const document of documents){
  if(!document||!Array.isArray(document.issues)||!Array.isArray(document.sheets)||document.sheets.length>256)throw Error('The preview stylesheet inventory is invalid.');
  if(document.issues.length)throw Error(String(document.issues[0]));
  const seen=new Set();for(const sheet of document.sheets){
   if(!sheet||!['vite','managed'].includes(sheet.kind)||typeof sheet.id!=='string'||sheet.id.length>4096||(typeof sheet.text!=='string'&&!/^[a-f0-9]{64}$/.test(sheet.hash||'')))throw Error('The preview stylesheet entry is invalid.');
   size+=Buffer.byteLength(sheet.text||'');if(size>20*1024*1024)throw Error('The preview stylesheet inventory is too large.');
   const key=sheet.kind+'|'+sheet.id;if(seen.has(key))throw Error('A preview stylesheet has duplicate source owners.');seen.add(key);
   if(!expected.has(key)||(sheet.hash?crypto.createHash('sha256').update(expected.get(key)).digest('hex')!==sheet.hash:expected.get(key)!==sheet.text))throw Error('A preview stylesheet differs from its current Vite source. Wait for styles to settle.');
  }
 }
 return inventory;
}
module.exports={discover,validate};
