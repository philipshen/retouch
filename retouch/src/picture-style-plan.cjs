'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),parse5=require('parse5'),MagicString=require('magic-string'),postcss=require('postcss');
const stylesheet=require('./picture-stylesheet.cjs'),urls=require('./capture-css-urls.cjs'),integrity=require('./stylesheet-integrity.cjs');
const ORIGIN='https://retouch-project.invalid',MAX_FILE=2*1024*1024,MAX_TOTAL=20*1024*1024;
const attr=(node,name)=>node.attrs?.find(item=>item.name===name)?.value;
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

// Isolate the adapted dependency graph for this document. Original shared files
// stay intact, including integrity-verified references from other pages.
function plan(resolved,{source=resolved.source}={}){
 const duplicates=[],tree=parse5.parse(source,{sourceCodeLocationInfo:true,onParseError:error=>{if(error.code==='duplicate-attribute')duplicates.push(error.startOffset);}}),nodes=[];
 function walk(parent){for(const node of parent.childNodes||[]){if(node.tagName)nodes.push(node);walk(node);}}walk(tree);
 const documentURL=new URL('/'+resolved.relPath.split(path.sep).map(encodeURIComponent).join('/'),ORIGIN),baseNode=nodes.find(node=>node.tagName==='base'&&attr(node,'href')!==undefined),base=new URL(baseNode?attr(baseNode,'href'):documentURL.href,documentURL);
 const root=resolved.appRoot?fs.realpathSync(resolved.appRoot):null,queue=[],records=new Map(),links=[],inlines=[],out=new MagicString(source);let total=0,outputSize=0;
 function local(reference,relative){
  const url=new URL(reference,relative);
  if(url.origin!==ORIGIN||url.protocol!=='https:'||url.username||url.password)throw Error('Picture layout preservation needs a local copy of every stylesheet.');
  if(!root)throw Error('The project root is required to adapt linked stylesheets.');
  const pathname=decodeURIComponent(url.pathname);if(pathname.includes('\0')||pathname.includes('\\'))throw Error('The stylesheet path is invalid.');
  const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)||file.split(path.sep).includes('node_modules'))throw Error('The stylesheet is outside the editable project.');
  return {file,url};
 }
 function enqueue(reference,relative){
  const item=local(reference,relative);if(records.has(item.file))return item.file;
  if(records.size>=256)throw Error('The page imports too many stylesheets.');
  records.set(item.file,item);queue.push(item);return item.file;
 }
 function adapt(css,url){
  const size=Buffer.byteLength(css);total+=size;if(size>MAX_FILE||total>MAX_TOTAL)throw Error('The page stylesheets are too large to adapt.');
  const dependencies=[];
  postcss.parse(css).walkAtRules(rule=>{
   if(rule.name.toLowerCase()==='charset'&&!/^\s*["']utf-8["']\s*$/i.test(rule.params))throw Error('Only UTF-8 stylesheets can be adapted.');
   if(rule.name.toLowerCase()!=='import')return;
   const references=[];urls.rewrite('@import '+rule.params+';',value=>{references.push(value);return value;});
   if(!references.length)throw Error('A stylesheet import could not be resolved.');
   dependencies.push(enqueue(references[0],url));
  });
  const after=stylesheet.transform(css);outputSize+=Buffer.byteLength(after);if(outputSize>MAX_TOTAL)throw Error('The adapted page stylesheets are too large.');
  return {before:css,after,dependencies,url};
 }
 for(const node of nodes){
  const rel=(attr(node,'rel')||'').toLowerCase().split(/\s+/);
  if(node.tagName==='link'&&(rel.includes('stylesheet')||rel.includes('preload')&&attr(node,'as')?.toLowerCase()==='style')&&attr(node,'href')!==undefined){
   const location=node.sourceCodeLocation;if(!location?.attrs?.href||duplicates.some(offset=>offset>=location.startOffset&&offset<location.startTag.endOffset))throw Error('A stylesheet link has ambiguous attributes.');
   links.push({node,file:enqueue(attr(node,'href'),base)});
  }
  if(node.tagName!=='style'||attr(node,'data-rt-css')!==undefined||attr(node,'type')&&!/^text\/css$/i.test(attr(node,'type').trim()))continue;
  const location=node.sourceCodeLocation;if(!location?.endTag)throw Error('An inline stylesheet has no explicit closing tag.');
  const start=location.startTag.endOffset,end=location.endTag.startOffset;inlines.push({...adapt(source.slice(start,end),base),start,end});
 }
 for(let index=0;index<queue.length;index++){
  const item=queue[index],stat=fs.statSync(item.file);
  if(!stat.isFile()||stat.size>MAX_FILE||stat.size+total>MAX_TOTAL)throw Error('A linked stylesheet is not a bounded regular file.');
  if(fs.realpathSync(item.file)!==item.file)throw Error('The stylesheet follows a symbolic link.');
  const bytes=fs.readFileSync(item.file);new TextDecoder('utf-8',{fatal:true}).decode(bytes);Object.assign(item,adapt(bytes.toString('utf8'),item.url));
 }
 const changed=new Set(queue.filter(item=>item.before!==item.after).map(item=>item.file));let grew=true;
 while(grew){grew=false;for(const item of queue)if(!changed.has(item.file)&&item.dependencies.some(file=>changed.has(file))){changed.add(item.file);grew=true;}}
 const fingerprint=crypto.createHash('sha256').update(resolved.relPath).update('\0').update(source);for(const item of queue)fingerprint.update('\0').update(path.relative(root,item.file)).update('\0').update(item.before);
 const suffix=fingerprint.digest('hex').slice(0,16);
 for(const item of queue)if(changed.has(item.file))item.copy=path.join(path.dirname(item.file),path.basename(item.file)+'.retouch-'+suffix+'.css');
 function reference(value,url){
  const target=local(value,url),copy=records.get(target.file)?.copy;if(!copy)return value;
  const pathname='/'+path.relative(root,copy).split(path.sep).map(encodeURIComponent).join('/'),relative=value.startsWith('/')?pathname:path.posix.relative(new URL('.',url).pathname,pathname);
  return relative+target.url.search+target.url.hash;
 }
 function imports(item){
  const ast=postcss.parse(item.after);ast.walkAtRules(rule=>{if(rule.name.toLowerCase()!=='import')return;let first=true,changed=false;const text=urls.rewrite('@import '+rule.params+';',value=>{if(!first)return value;first=false;const next=reference(value,item.url);changed=next!==value;return next;});if(changed)rule.params=postcss.parse(text).first.params;});return ast.toString();
 }
 function finish(item){const after=imports(item);outputSize+=Buffer.byteLength(after)-Buffer.byteLength(item.after);if(outputSize>MAX_TOTAL)throw Error('The adapted page stylesheets are too large.');return after;}
 const edits=queue.map(item=>({file:item.file,before:item.before,after:item.before}));let inlineChanged=false,linksChanged=false;
 for(const item of queue)if(item.copy){
  item.after=finish(item);let before=null;
  if(fs.existsSync(item.copy)){if(fs.realpathSync(item.copy)!==item.copy||!fs.statSync(item.copy).isFile()||fs.statSync(item.copy).size>MAX_TOTAL)throw Error('The generated stylesheet path is unavailable.');before=fs.readFileSync(item.copy,'utf8');if(before!==item.after)throw Error('A generated stylesheet already exists with different content.');}
  edits.push({file:item.copy,before,after:item.after});
 }
 for(const item of inlines){const after=finish(item);if(after!==item.before){out.overwrite(item.start,item.end,after);inlineChanged=true;}}
 for(const {node,file}of links){
  const item=records.get(file),prior=attr(node,'integrity'),nextIntegrity=prior===undefined?undefined:integrity.rewrite(prior,item.before,item.copy?item.after:item.before);
  for(const [name,value]of [['href',reference(attr(node,'href'),base)],['integrity',nextIntegrity]])if(value!==undefined&&value!==attr(node,name)){const location=node.sourceCodeLocation.attrs[name];out.overwrite(location.startOffset,location.endOffset,name+'="'+escape(value)+'"');linksChanged=true;}
 }
 const after=out.toString();return {ok:true,source:after,inlineChanged,inlineRefresh:inlineChanged,linksChanged,linked:queue.length,edits:[{file:resolved.file,before:resolved.source,after},...edits]};
}
module.exports={plan};
