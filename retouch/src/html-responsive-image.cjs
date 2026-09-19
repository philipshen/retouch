'use strict';
const MagicString=require('magic-string'),{parse}=require('./capture-srcset.cjs');
const attr=(node,name)=>node.attrs?.find(item=>item.name===name)?.value??null;
function inspect(resolved){
 const image=resolved.element.node;if(image.tagName!=='img')return null;
 const picture=image.parentNode?.tagName==='picture'?image.parentNode:null;
 if(!picture&&attr(image,'srcset')===null)return null;
 if(picture&&picture.childNodes.filter(node=>node.tagName==='img').length!==1)throw Error('Choose a picture with one image fallback.');
 const eligible=new Set((resolved.elements||require('./adapters/html.cjs').collect(resolved.source,resolved.relPath).elements).map(element=>element.location.startOffset));
 const nodes=picture?picture.childNodes.slice(0,picture.childNodes.indexOf(image)).filter(node=>node.tagName==='source'):[];
 if([image,...nodes].some(node=>!eligible.has(node.sourceCodeLocation?.startOffset)))throw Error('Responsive image attributes are duplicated or ambiguous.');
 const sources=[image,...nodes].map((node,index)=>({index:index-1,src:attr(node,'src'),srcset:attr(node,'srcset'),sizes:attr(node,'sizes'),media:attr(node,'media'),type:attr(node,'type')}));
 const candidates=[{key:'fallback',url:attr(image,'src')||'',label:'Fallback image',sourceIndex:-1,attribute:'src'}];
 for(const source of sources)for(const [index,candidate]of parse(source.srcset||'',{locations:true}).entries())candidates.push({key:source.index+':'+index,url:candidate.url,label:(source.index<0?'Image':'Source '+(source.index+1)+(source.media?' · '+source.media:''))+' · '+(candidate.descriptors.join(' ')||'1x')+(source.type?' · '+source.type:''),sourceIndex:source.index,attribute:'srcset',start:candidate.start,end:candidate.end,media:source.media});
 if(candidates.length>256)throw Error('This image has too many responsive candidates to edit.');
 return {picture:!!picture,sources,candidates,nodes:[image,...nodes]};
}
function describe(resolved){try{const state=inspect(resolved);if(!state)return null;const {nodes,...descriptor}=state;return descriptor;}catch(error){return {reason:error.message,candidates:[]};}}
function finish(resolved,out){
 const after=out.toString(),html=require('./adapters/html.cjs'),beforeElements=html.collect(resolved.source,resolved.relPath).elements,nextElements=html.collect(after,resolved.relPath).elements;
 if(beforeElements.length!==nextElements.length||beforeElements.some((element,index)=>element.id!==nextElements[index].id||element.tag!==nextElements[index].tag))return {ok:false,refused:true,reason:'The image edit changes document structure.'};
 return {ok:true,hash:html.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
}
function planSource(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(!op.fileHash||op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the image.');
  const state=inspect(resolved);
  if(!Number.isInteger(op.sourceIndex)||!state?.sources.some(source=>source.index===op.sourceIndex))return refuse('Choose an available responsive image source.');
  if(!op.changes||typeof op.changes!=='object'||Array.isArray(op.changes)||!Object.keys(op.changes).length)return refuse('Choose source settings to change.');
  const node=state.nodes[op.sourceIndex+1],out=new MagicString(resolved.source),location=node.sourceCodeLocation;
  for(const [name,value]of Object.entries(op.changes)){
   if(!['media','sizes','type'].includes(name)||op.sourceIndex===-1&&name!=='sizes')return refuse('This setting does not belong to the selected image source.');
   if(value!==null&&(typeof value!=='string'||value.length>4096||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)))return refuse('Use source settings of at most 4,096 characters without control characters.');
   if(value===attr(node,name))continue;
   const token=location.attrs?.[name];
   if(value===null){if(token)out.remove(token.startOffset,token.endOffset);continue;}
   const replacement=name+'="'+value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')+'"';
   if(token)out.overwrite(token.startOffset,token.endOffset,replacement);else out.appendLeft(location.startTag.startOffset+1+node.tagName.length,' '+replacement);
  }
  return finish(resolved,out);
 }catch(error){return refuse(error.message);}
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(!op.fileHash||op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the image.');
  const state=inspect(resolved),candidate=state?.candidates.find(candidate=>candidate.key===op.candidate);if(!candidate)return refuse('Choose an available image candidate.');
  if(typeof op.src!=='string'||!op.src||/[\x00-\x20\x7f]/.test(op.src)||op.src.endsWith(','))return refuse('Use an image URL with spaces and trailing commas percent-encoded.');
  if(!['http:','https:'].includes(new URL(op.src,'https://retouch.local/').protocol))return refuse('Unsupported image URL scheme.');
  if(candidate.url===op.src)return {ok:true,hash:resolved.hash,edits:[]};
  const node=state.nodes[candidate.sourceIndex+1],old=attr(node,candidate.attribute)||'',value=candidate.attribute==='src'?op.src:old.slice(0,candidate.start)+op.src+old.slice(candidate.end),location=node.sourceCodeLocation,token=location.attrs?.[candidate.attribute];
  const escaped=value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'),replacement=candidate.attribute+'="'+escaped+'"',out=new MagicString(resolved.source);
  if(token)out.overwrite(token.startOffset,token.endOffset,replacement);else out.appendLeft(location.startTag.startOffset+1+node.tagName.length,' '+replacement);
  return finish(resolved,out);
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan,planSource};
