'use strict';
const MagicString=require('magic-string'),crypto=require('node:crypto'),html=require('./adapters/html.cjs');
const namespace='http://www.w3.org/2000/svg',attr=(e,name)=>e.node.attrs.find(a=>a.name===name)?.value;
function releaseContext(r){
 const group=r.element;if(group.tag!=='g'||attr(group,'data-rt-mask-group')===undefined||group.node.attrs.some(a=>!['data-rt-mask-group','data-rt-name'].includes(a.name)))return null;
 if((group.node.childNodes||[]).some(n=>!n.tagName&&(n.nodeName!=='#text'||n.value.trim())))return null;
 const children=(group.node.childNodes||[]).filter(n=>n.tagName),elements=r.elements||html.collect(r.source,r.relPath).elements,definition=elements.find(e=>e.node===children[0]),content=elements.find(e=>e.node===children[1]),parent=elements.find(e=>e.node===group.node.parentNode);
 if(children.length!==2||definition?.tag!=='mask'||content?.tag!=='g'||!parent||attr(content,'data-rt-mask-content')!==''||attr(content,'mask')!=='url(#'+attr(definition,'id')+')'||!/^rt-mask-[a-f0-9]{16}$/.test(attr(definition,'id')||'')||content.node.attrs.some(a=>!['mask','data-rt-mask-content'].includes(a.name)))return null;
 if(definition.node.attrs.some(a=>!['id','mask-type','maskContentUnits'].includes(a.name))||r.source.split(attr(definition,'id')).length!==3)return null;
 if([group,definition,content].some(e=>!e.location.endTag))return null;
 if(!require('./svg-delete.cjs').describe({...r,elements,element:group}))return null;
 const roots=elements.filter(e=>e.node.parentNode===definition.node||e.node.parentNode===content.node);if(!roots.length)return null;
 return {group,definition,content,parent,roots,elements};
}
function plan(r,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(op.fileHash!==r.hash)return refuse('The file changed. Re-select the mask layers.');
 const elements=r.elements||html.collect(r.source,r.relPath).elements,out=new MagicString(r.source);let parent,roots,removed=[],insertions=[],cuts=[],wrapperStart;
 if(op.type==='createSVGMask'){
  if(!Array.isArray(op.ids)||op.ids.length<2||op.ids.length>100||new Set(op.ids).size!==op.ids.length||!op.ids.includes(r.element.id))return refuse('Select two to 100 sibling SVG layers.');
  roots=op.ids.map(id=>elements.find(e=>e.id===id));if(roots.some(e=>!e))return refuse('All mask layers must resolve in one source file.');roots.sort((a,b)=>a.location.startOffset-b.location.startOffset);
  parent=elements.find(e=>e.node===roots[0].node.parentNode);
  if(!parent||parent.node.namespaceURI!==namespace||roots.some(e=>e.node.parentNode!==parent.node||e.node.namespaceURI!==namespace||!['g','svg','rect','circle','ellipse','path','polygon','polyline','line','text','image','use'].includes(e.tag)||!require('./svg-delete.cjs').describe({...r,elements,element:e})))return refuse('Choose complete sibling SVG graphics outside rendered templates.');
  if(op.maskId!==roots[0].id)return refuse('The bottom layer in the selection must be the mask shape.');
  const siblings=(parent.node.childNodes||[]).filter(n=>n.tagName),positions=roots.map(e=>siblings.indexOf(e.node));if(positions.some((n,i)=>n!==positions[0]+i))return refuse('Select consecutive layers to mask without reordering other artwork.');
  const start=roots[0].location.startOffset,maskEnd=roots[0].location.endOffset,end=roots.at(-1).location.endOffset;
  let id;do{id='rt-mask-'+crypto.randomBytes(8).toString('hex');}while(r.source.includes(id));
  const mode=op.mode??'alpha';if(!['alpha','luminance'].includes(mode))return refuse('Choose an alpha or luminance mask.');
  insertions=[{at:start,text:'<g data-rt-mask-group="" data-rt-name="Mask group"><mask id="'+id+'" mask-type="'+mode+'" maskContentUnits="userSpaceOnUse">'},{at:maskEnd,text:'</mask><g data-rt-mask-content="" mask="url(#'+id+')">'},{at:end,text:'</g></g>'}];for(const edit of insertions)out.appendLeft(edit.at,edit.text);wrapperStart=start;
 }else if(op.type==='releaseSVGMask'){
  const c=releaseContext({...r,elements});if(!c)return refuse('Select a Retouch mask group with unchanged wrapper structure.');({parent,roots}=c);removed=[c.group,c.definition,c.content];
  cuts=[{start:c.group.location.startOffset,end:c.definition.location.startTag.endOffset},{start:c.definition.location.endTag.startOffset,end:c.content.location.startTag.endOffset},{start:c.content.location.endTag.startOffset,end:c.group.location.endOffset}];for(const cut of cuts)out.remove(cut.start,cut.end);
 }else return refuse('Choose create mask or release mask.');
 const after=out.toString(),next=html.collect(after,r.relPath).elements,retained=elements.filter(e=>!removed.includes(e)),mapping=new Map(),shifted=offset=>offset+insertions.filter(e=>e.at<=offset).reduce((n,e)=>n+e.text.length,0)-cuts.filter(e=>e.end<=offset).reduce((n,e)=>n+e.end-e.start,0);
 if(next.length!==retained.length+(insertions.length?3:0))return refuse('Masking would change surrounding source structure.');
 for(const old of retained){const fresh=next.find(e=>e.location.startOffset===shifted(old.location.startOffset)&&e.tag===old.tag&&e.node.namespaceURI===old.node.namespaceURI);if(!fresh)return refuse('An existing layer could not be preserved.');mapping.set(old.node,fresh);}
 const wrapper=insertions.length?next.find(e=>e.location.startOffset===wrapperStart&&attr(e,'data-rt-mask-group')===''):null;
 if(insertions.length&&!wrapper)return refuse('The mask group could not be created.');
 for(const old of retained){const fresh=mapping.get(old.node),expected=roots.includes(old)?(wrapper?next.find(e=>e.node.parentNode===wrapper.node&&e.tag===(old===roots[0]?'mask':'g')):mapping.get(parent.node)):mapping.get(old.node.parentNode);if(expected&&fresh.node.parentNode!==expected.node)return refuse('Masking would move unrelated content.');}
 return {ok:true,hash:html.contentHash(after),structural:true,parentId:mapping.get(parent.node).id,selectionIds:wrapper?[wrapper.id]:roots.map(e=>mapping.get(e.node).id),sourceIdMap:retained.flatMap(e=>mapping.get(e.node).id===e.id?[]:[[e.id,mapping.get(e.node).id]]),removedSourceIds:removed.map(e=>e.id),edits:[{file:r.file,before:r.source,after}]};
}
module.exports={plan,describe:r=>{
 const group=releaseContext(r);if(group)return {canRelease:true,maskIds:group.roots.filter(e=>e.node.parentNode===group.definition.node).map(e=>e.id)};
 const e=r.element,cap=require('./svg-delete.cjs').describe(r),result=cap&&e.node.parentNode?.namespaceURI===namespace&&['g','svg','rect','circle','ellipse','path','polygon','polyline','line','text','image','use'].includes(e.tag)?{canCreate:true,parentId:cap.parentId}:{};
 for(let parent=e.node.parentNode;parent;parent=parent.parentNode){const owner=r.elements?.find(item=>item.node===parent);if(owner&&releaseContext({...r,element:owner})){result.ownerId=owner.id;break;}}
 return Object.keys(result).length?result:null;
}};
