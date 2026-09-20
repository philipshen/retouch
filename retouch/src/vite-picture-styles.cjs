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
module.exports={discover};
