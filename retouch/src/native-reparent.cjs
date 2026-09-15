'use strict';
const MagicString=require('magic-string');
// Move exact source slices, then prove every original layer and parent survived.
function plan(resolved,op,language){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the layers.');
  const react=language==='react',adapter=require('./adapters/'+language+'.cjs'),structure=require('./structure.cjs'),elements=resolved.elements;
  const start=e=>react?e.node.start:e.tagStart,end=e=>react?e.node.end:e.closeEnd,contains=(a,b)=>start(a)<=start(b)&&end(a)>=end(b);
  const ids=op.type==='reparentElement'?[resolved.element.id]:op.ids;
  if(!Array.isArray(ids)||ids.length<1||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(resolved.element.id))return refuse('Choose distinct layers in the same source file.');
  const selected=ids.map(id=>elements.find(e=>e.id===id));if(selected.some(e=>!e||e.kind!=='host'))return refuse('Choose native layers in the same source file.');
  const roots=selected.filter(e=>!selected.some(other=>other!==e&&contains(other,e))).sort((a,b)=>start(a)-start(b));
  const target=elements.find(e=>e.id===op.destinationId),position=op.position??'inside';
  if(!target||target.kind!=='host'||!['inside','before','after'].includes(position))return refuse('Choose a native destination in the same source file.');
  if(roots.some(e=>contains(e,target)))return refuse('The destination cannot belong to a selected subtree.');
  const parentOf=e=>react?elements.find(p=>p.node.children?.includes(e.node)):e.parent;
  const destination=position==='inside'?target:parentOf(target);if(!destination)return refuse('The destination parent has no source identity.');
  const tag=e=>react?e.node.openingElement.name.name:e.tag;
  const ancestors=e=>elements.filter(a=>a!==e&&contains(a,e));
  if(roots.some(root=>ancestors(root).some(a=>['svg','math'].includes(tag(a))))||ancestors(destination).some(a=>tag(a)==='math'))return refuse('Move vector layers within their original vector canvas.');
  if([destination,...ancestors(destination)].some(e=>tag(e)==='form')&&roots.some(root=>elements.some(e=>contains(root,e)&&tag(e)==='form')))return refuse('A form cannot be nested inside another form.');
  if(!react){
   const scopes=[];
   for(const token of resolved.source.slice(0,start(destination)).matchAll(/\{%-?\s*([\s\S]*?)-?%\}/g)){
    const body=token[1].trim(),statements=/^liquid(?:\s|$)/.test(body)?body.replace(/^liquid\s*/,'').split(/\r?\n/):[body];
    for(const statement of statements){const name=statement.trim().split(/\s+/)[0];if(['raw','comment'].includes(scopes.at(-1))){if(name==='end'+scopes.at(-1))scopes.pop();continue;}if(['if','unless','for','tablerow','case','capture','form','paginate','raw','comment'].includes(name))scopes.push(name);else if(name.startsWith('end'))scopes.pop();}
   }
   if(scopes.length)return refuse('The destination is inside a Liquid control scope.');
  }
  const capability=require('./native-insert.cjs').describe({...resolved,element:destination},language);if(!capability.canInsert)return refuse(capability.insertReason);
  // Existing range guards exclude conditional/loop scopes and client templates.
  if(parentOf(destination))structure.ranges({...resolved,element:destination},language);
  if(react){let unsafe=false;require('@babel/traverse').default(require('./id.cjs').parseSource(resolved.source),{JSXElement(p){if(p.node.start!==start(destination))return;for(let a=p.parentPath;a;a=a.parentPath)if(a.type==='JSXExpressionContainer')unsafe=true;}});if(unsafe)return refuse('The destination is rendered by an expression.');}
  const ranges=roots.map(element=>{const range=structure.ranges({...resolved,element},language).find(r=>r.selected);if(!range)throw Error('A selected source range is incomplete.');return {...range,element};});
  const selfClosing=position==='inside'&&react&&destination.node.openingElement.selfClosing;
  let offset;
  if(position==='inside')offset=react?(selfClosing?destination.node.openingElement.end-2:destination.node.closingElement.start):destination.closeStart;
  else {const anchor=structure.ranges({...resolved,element:target},language).find(r=>r.selected);if(!anchor)throw Error('The destination range is incomplete.');offset=position==='before'?anchor.start:anchor.end;}
  const common=elements.filter(e=>contains(e,destination)&&roots.every(root=>contains(e,root))).sort((a,b)=>start(b)-start(a))[0];if(!common)return refuse('The layers have no shared source parent.');
  const source=resolved.source,prefix=selfClosing?'>':'',chunks=ranges.map(r=>source.slice(r.start,r.end)),suffix=selfClosing?'</'+destination.node.openingElement.name.name+'>':'',insertion=prefix+chunks.join('')+suffix;
  const removals=ranges.map(r=>({start:r.start,end:r.end}));if(selfClosing)removals.push({start:offset,end:offset+2});
  const beforeOffset=removals.filter(r=>r.end<=offset).reduce((n,r)=>n+r.end-r.start,0),movedStarts=[];let cursor=offset-beforeOffset+prefix.length;
  for(const chunk of chunks){movedStarts.push(cursor);cursor+=chunk.length;}
  const out=new MagicString(source);for(const r of removals)out.remove(r.start,r.end);out.appendLeft(offset,insertion);const after=out.toString();
  if(after===source)return refuse('The layers are already in that position.');
  const final=adapter.collect(after,resolved.relPath).elements,mapping=new Map(),used=new Set();
  for(const old of elements){const at=start(old),index=ranges.findIndex(r=>at>=r.start&&at<r.end),nextStart=index>=0?movedStarts[index]+at-ranges[index].start:at-removals.filter(r=>r.end<=at).reduce((n,r)=>n+r.end-r.start,0)+(at>=offset?insertion.length:0),next=final.find(e=>start(e)===nextStart&&e.kind===old.kind);if(!next||used.has(next.id))return refuse('A layer lost its source identity during the move.');mapping.set(old.id,next.id);used.add(next.id);}
  if(used.size!==final.length)return refuse('The move changed the source layer structure.');
  const mapped=e=>final.find(next=>next.id===mapping.get(e.id)),newParent=mapped(destination),moved=roots.map(mapped),children=react?newParent.node.children.filter(n=>n.type==='JSXElement'):newParent.children;
  const index=children.indexOf(react?moved[0].node:moved[0]);if(index<0||moved.some((e,i)=>children[index+i] !== (react?e.node:e)))return refuse('The moved layers changed parent or source order.');
  return {ok:true,hash:adapter.contentHash(after),structural:true,parentId:mapping.get(common.id),destinationId:newParent.id,movedId:moved[0].id,selectionIds:moved.map(e=>e.id),rootCount:roots.length,sourceIdMap:[...mapping].filter(([a,b])=>a!==b),edits:[{file:resolved.file,before:source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={plan};
