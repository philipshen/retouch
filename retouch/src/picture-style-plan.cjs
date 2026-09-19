'use strict';
const fs=require('node:fs'),path=require('node:path'),parse5=require('parse5'),MagicString=require('magic-string'),postcss=require('postcss');
const stylesheet=require('./picture-stylesheet.cjs'),urls=require('./capture-css-urls.cjs');
const ORIGIN='https://retouch-project.invalid',MAX_FILE=2*1024*1024,MAX_TOTAL=20*1024*1024;
const attr=(node,name)=>node.attrs?.find(item=>item.name===name)?.value;

// Plan only: callers combine these snapshots with their structural HTML edit in
// one transaction. No stylesheet is written while discovering the dependency graph.
function plan(resolved,{source=resolved.source}={}){
 const tree=parse5.parse(source,{sourceCodeLocationInfo:true}),nodes=[];
 function walk(parent){for(const node of parent.childNodes||[]){if(node.tagName)nodes.push(node);walk(node);}}
 walk(tree);
 const documentURL=new URL('/'+resolved.relPath.split(path.sep).map(encodeURIComponent).join('/'),ORIGIN),baseNode=nodes.find(node=>node.tagName==='base'&&attr(node,'href')!==undefined),base=new URL(baseNode?attr(baseNode,'href'):documentURL.href,documentURL);
 const root=resolved.appRoot?fs.realpathSync(resolved.appRoot):null,queue=[],seen=new Set(),edits=[],out=new MagicString(source);let total=0,outputSize=0,inlineChanged=false,inlineImports=false;
 function enqueue(reference,relative){
  const url=new URL(reference,relative);
  if(url.origin!==ORIGIN||!/^https:$/.test(url.protocol)||url.username||url.password)throw Error('Picture layout preservation needs a local copy of every stylesheet.');
  if(!root)throw Error('The project root is required to adapt linked stylesheets.');
  const pathname=decodeURIComponent(url.pathname);
  if(pathname.includes('\0')||pathname.includes('\\'))throw Error('The stylesheet path is invalid.');
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)||file.split(path.sep).includes('node_modules'))throw Error('The stylesheet is outside the editable project.');
  if(seen.has(file))return;
  if(seen.size>=256)throw Error('The page imports too many stylesheets.');
  seen.add(file);queue.push({file,url});
 }
 function adapt(css,url,inline=false){
  const size=Buffer.byteLength(css);total+=size;
  if(size>MAX_FILE||total>MAX_TOTAL)throw Error('The page stylesheets are too large to adapt.');
  const ast=postcss.parse(css);
  ast.walkAtRules(rule=>{
   if(rule.name.toLowerCase()==='charset'&&!/^\s*["']utf-8["']\s*$/i.test(rule.params))throw Error('Only UTF-8 stylesheets can be adapted.');
   if(rule.name.toLowerCase()!=='import')return;
   if(inline)inlineImports=true;
   const references=[];urls.rewrite('@import '+rule.params+';',value=>{references.push(value);return value;});
   if(!references.length)throw Error('A stylesheet import could not be resolved.');
   enqueue(references[0],url);
  });
  const after=stylesheet.transform(css);outputSize+=Buffer.byteLength(after);
  if(outputSize>MAX_TOTAL)throw Error('The adapted page stylesheets are too large.');
  return after;
 }
 for(const node of nodes){
  if(node.tagName==='link'&&(attr(node,'rel')||'').toLowerCase().split(/\s+/).includes('stylesheet')){
   if(attr(node,'href')===undefined)continue;
   if(attr(node,'integrity'))throw Error('Picture layout preservation does not yet support integrity-verified stylesheets.');
   enqueue(attr(node,'href'),base);
  }
  if(node.tagName!=='style'||attr(node,'data-rt-css')!==undefined||attr(node,'type')&&!/^text\/css$/i.test(attr(node,'type').trim()))continue;
  const location=node.sourceCodeLocation;
  if(!location?.endTag)throw Error('An inline stylesheet has no explicit closing tag.');
  const start=location.startTag.endOffset,end=location.endTag.startOffset,before=source.slice(start,end),after=adapt(before,base,true);
  if(after!==before){out.overwrite(start,end,after);inlineChanged=true;}
 }
 for(let index=0;index<queue.length;index++){
  const {file,url}=queue[index],stat=fs.statSync(file);
  if(!stat.isFile()||stat.size>MAX_FILE||stat.size+total>MAX_TOTAL)throw Error('A linked stylesheet is not a bounded regular file.');
  if(fs.realpathSync(file)!==file)throw Error('The stylesheet follows a symbolic link.');
  const bytes=fs.readFileSync(file);new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const before=bytes.toString('utf8'),after=adapt(before,url);
  // Include unchanged dependencies so the transaction checks every read snapshot.
  edits.push({file,before,after});
 }
 const after=out.toString();
 return {ok:true,source:after,inlineChanged,inlineRefresh:inlineChanged||inlineImports&&edits.some(edit=>edit.before!==edit.after),linked:queue.length,edits:[{file:resolved.file,before:resolved.source,after},...edits]};
}
module.exports={plan};
