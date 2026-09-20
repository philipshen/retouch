'use strict';
const fs=require('node:fs'),path=require('node:path'),postcss=require('postcss');
const component=require('./svelte-picture-styles.cjs'),stylesheet=require('./picture-stylesheet.cjs'),urls=require('./capture-css-urls.cjs');
// The caller supplies stylesheet entrypoints discovered from the application.
// This plans their local import closure; it does not establish that the supplied
// entrypoints cover every stylesheet which can affect the rendered document.
function plan(resolved,{source=resolved.source,files=[]}={}){
 const root=fs.realpathSync(resolved.appRoot),queue=[],seen=new Set(),edits=[];let inputSize=0,outputSize=0;
 function enqueue(value){
  if(typeof value!=='string'||/[\0?#]/.test(value))throw Error('The stylesheet path is invalid.');
  const file=path.resolve(root,value),relative=path.relative(root,file);
  if(!relative||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||file.split(path.sep).includes('node_modules'))throw Error('A stylesheet is outside the editable project.');
  if(!/\.(?:svelte|css)$/i.test(file))throw Error('This stylesheet format needs its own source adapter.');
  if(seen.has(file))return;
  if(seen.size>=256)throw Error('The picture imports too many stylesheets.');
  seen.add(file);queue.push(file);
 }
 enqueue(resolved.file);for(const file of files)enqueue(file);
 for(let index=0;index<queue.length;index++){
  const file=queue[index],stat=fs.statSync(file);
  if(!stat.isFile()||stat.size>2*1024*1024||inputSize+stat.size>20*1024*1024)throw Error('The picture stylesheets are too large.');
  if(fs.realpathSync(file)!==file)throw Error('A stylesheet follows a symbolic link.');
  const bytes=fs.readFileSync(file);new TextDecoder('utf-8',{fatal:true}).decode(bytes);const before=bytes.toString('utf8');inputSize+=stat.size;
  if(file===resolved.file&&before!==resolved.source)throw Error('The selected component changed. Re-select the image.');
  const current=file===resolved.file?source:before,relative=path.relative(root,file).split(path.sep).join('/');
  function resolveImport(params){
   const references=[];urls.rewrite('@import '+params+';',value=>{references.push(value);return value;});
   const reference=references[0];
   if(!reference||/^(?:[a-z][a-z\d+.-]*:|\/|~|#)/i.test(reference)||/[?\\\0]/.test(reference))throw Error('Picture stylesheet imports need relative local CSS paths.');
   const target=path.resolve(path.dirname(file),decodeURIComponent(reference));
   if(!/\.css$/i.test(target))throw Error('A stylesheet import needs a local CSS source file.');
   enqueue(target);
  }
  let after;
  if(/\.svelte$/i.test(file))after=component.plan({file,relPath:relative,source:before},{source:current,resolveImport}).source;
  else{
   const parsed=postcss.parse(current);parsed.walkAtRules(rule=>{
    if(rule.name.toLowerCase()==='import')resolveImport(rule.params);
    if(rule.name.toLowerCase()==='charset'&&!/^\s*["']utf-8["']\s*$/i.test(rule.params))throw Error('Only UTF-8 stylesheets can be adapted.');
   });after=stylesheet.transform(current);
  }
  outputSize+=Buffer.byteLength(after);if(outputSize>20*1024*1024)throw Error('The adapted picture stylesheets are too large.');
  edits.push({file,before,after});
 }
 return {source:edits[0].after,edits};
}
module.exports={plan};
