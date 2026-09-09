'use strict';
// Structural edits operate on complete literal sibling ranges. Never splice a
// conditional, rendered loop, component invocation, or mixed text boundary.
const {parseSource, contentHash} = require('./id.cjs');
const traverse = require('@babel/traverse').default;
const unsafeTags = new Set(['script','style','template','html','head','body']);
const types = new Set(['duplicateElement', 'pasteElement', 'deleteElement', 'moveElement']);
const refuse = reason => ({ok:false,refused:true,reason});
function reactRange(resolved) {
  let target;
  traverse(parseSource(resolved.source), {JSXElement(p) {
    if(p.node.start===resolved.element.node.start) {target=p;p.stop();}
  }});
  if(!target || !['JSXElement','JSXFragment'].includes(target.parent.type)) throw Error('Select a literal child element, not a component root or expression.');
  for(let p=target.parentPath;p;p=p.parentPath) {
    if(p.type==='JSXExpressionContainer') throw Error('Elements rendered by expressions cannot be structurally edited.');
  }
  const literal = n => n.type==='JSXElement' && n.openingElement.name.type==='JSXIdentifier' && /^[a-z]/.test(n.openingElement.name.name) && !unsafeTags.has(n.openingElement.name.name) &&
    n.openingElement.attributes.every(a=>a.type==='JSXAttribute' && (!a.value || a.value.type==='StringLiteral')) &&
    n.children.every(c=>c.type==='JSXText'||literal(c));
  const children=target.parent.children;
  if(children.some(n=>n.type==='JSXText'?n.value.trim()!=='':!literal(n))) throw Error('Structural editing requires literal native siblings without expressions or mixed text.');
  const items=children.filter(n=>n.type==='JSXElement').map(n=>({start:n.start,end:n.end,selected:n.start===target.node.start}));
  items.parentId=resolved.elements?.find(e=>e.node.start===target.parent.start)?.id || null;
  return items;
}
function liquidRange(resolved) {
  const node=resolved.element;
  if(node.kind!=='host'||node.dynamicTag||node.generatedImage||!node.parent) throw Error('Select a literal HTML child inside a parent element.');
  // Control tags before the selection can enclose its parent despite the HTML
  // tokenizer ignoring Liquid syntax. Reject only open enclosing control scopes.
  const scopes=[];
  for(const m of resolved.source.slice(0,node.tagStart).matchAll(/\{%-?\s*(\w+)[\s\S]*?-?%\}/g)) {
    if(['if','unless','for','tablerow','case','capture','form','paginate','raw','comment'].includes(m[1])) scopes.push(m[1]);
    else if(m[1].startsWith('end')) scopes.pop();
  }
  if(scopes.length) throw Error('Elements inside Liquid control scopes cannot be structurally edited.');
  const parent=node.parent;
  for(let ancestor=parent;ancestor;ancestor=ancestor.parent) {
    if(unsafeTags.has(ancestor.tag) && ancestor.tag!=='body' && ancestor.tag!=='html' || /\s(?:x-for|v-for|v-if|x-if)\s*=/i.test(resolved.source.slice(ancestor.tagStart,ancestor.openEnd))) throw Error('Elements inside client-rendered templates cannot be structurally edited.');
  }
  if(parent.closeStart==null) throw Error('The parent markup is incomplete.');
  const inner=resolved.source.slice(parent.openEnd,parent.closeStart);
  if(/\{[%{]/.test(inner)) throw Error('Structural editing requires literal HTML siblings without Liquid expressions.');
  const complete = n => n.kind==='host' && !n.dynamicTag && !unsafeTags.has(n.tag) && Number.isInteger(n.closeEnd) && n.children.every(complete);
  if(!parent.children.every(complete)) throw Error('Structural editing requires complete literal HTML siblings.');
  const ranges=parent.children.map(n=>({start:n.tagStart,end:n.closeEnd,selected:n===node}));
  let cursor=parent.openEnd;
  for(const r of ranges) {
    if(!Number.isInteger(r.end)||r.end>parent.closeStart||resolved.source.slice(cursor,r.start).trim()) throw Error('Structural editing requires complete siblings without mixed text or comments.');
    cursor=r.end;
  }
  if(resolved.source.slice(cursor,parent.closeStart).trim()) throw Error('Structural editing requires siblings without mixed text.');
  ranges.parentId=parent.id || null;
  return ranges;
}
function htmlRange(resolved) {
  const selected=resolved.element.node,parent=selected.parentNode;
  const parentLocation=parent?.sourceCodeLocation;
  if(!parentLocation?.startTag||!parentLocation.endTag)throw Error('Select a child inside an explicitly closed HTML parent.');
  for(let ancestor=parent;ancestor;ancestor=ancestor.parentNode){
    if(unsafeTags.has(ancestor.tagName)&&!['body','html'].includes(ancestor.tagName))throw Error('This parent is not a design layer.');
    if(ancestor.attrs?.some(a=>/^(?:v-for|v-if|x-for|x-if)$/.test(a.name)))throw Error('This parent is rendered by a template.');
  }
  const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  function complete(node){
    if(node.nodeName==='#text')return true;
    return node.namespaceURI==='http://www.w3.org/1999/xhtml'&&!unsafeTags.has(node.tagName)&&node.sourceCodeLocation?.startTag&&(node.sourceCodeLocation.endTag||voids.has(node.tagName))&&(node.childNodes||[]).every(complete);
  }
  const items=[];let cursor=parentLocation.startTag.endOffset;
  for(const node of parent.childNodes||[]){
    if(node.nodeName==='#text'&&!node.value.trim())continue;
    if(!complete(node)||!node.tagName)throw Error('Structural editing requires complete literal siblings without mixed text or comments.');
    const loc=node.sourceCodeLocation;
    if(loc.startOffset<cursor||resolved.source.slice(cursor,loc.startOffset).trim())throw Error('The parsed HTML does not match a contiguous sibling region.');
    items.push({start:loc.startOffset,end:loc.endOffset,selected:node===selected});cursor=loc.endOffset;
  }
  if(resolved.source.slice(cursor,parentLocation.endTag.startOffset).trim())throw Error('The parent has untracked markup.');
  items.parentId=resolved.elements?.find(e=>e.node===parent)?.id||null;
  return items;
}
function ranges(resolved,language) {return language==='react'?reactRange(resolved):language==='html'?htmlRange(resolved):liquidRange(resolved);}
function duplicateAllowed(source,range,language) {return !/\s(?:id|key|ref)\s*=/i.test(source.slice(range.start,range.end)) && !(language==='html'&&/\sdata-rt-(?:style|css)\s*=/i.test(source.slice(range.start,range.end)));}
function describe(resolved,language) {
  try {
    const items=ranges(resolved,language),index=items.findIndex(r=>r.selected);
    if(index<0) throw Error('The source element could not be located.');
    return {parentId:items.parentId,canPaste:true,canDuplicate:duplicateAllowed(resolved.source,items[index],language),canDelete:true,canMoveBefore:index>0,canMoveAfter:index<items.length-1,reason:null};
  } catch(error) {return {parentId:null,canPaste:false,canDuplicate:false,canDelete:false,canMoveBefore:false,canMoveAfter:false,reason:error.message};}
}
function planOp(resolved,op,language) {
  if(op.fileHash && op.fileHash!==resolved.hash) return refuse('The file changed. Re-select the element before editing.');
  try {
    const items=ranges(resolved,language),index=items.findIndex(r=>r.selected),source=resolved.source;
    if(index<0) throw Error('The source element could not be located.');
    const node=items[index],chunk=source.slice(node.start,node.end);
    let next;
    if(op.type==='duplicateElement'||op.type==='pasteElement') {
      let copied=node;
      if(op.type==='pasteElement') {
        if(typeof op.copiedHash!=='string'||op.copiedHash!==resolved.hash) throw Error('The copied source changed. Copy the element again.');
        const element=resolved.elements.find(e=>e.id===op.copiedId);
        const start=language==='react'?element?.node?.start:language==='html'?element?.node?.sourceCodeLocation?.startOffset:element?.tagStart;
        copied=items.find(r=>r.start===start);
        if(!copied) throw Error('Paste requires a copied literal sibling in the same source parent.');
      }
      if(!duplicateAllowed(source,copied,language)) throw Error('Duplicating this element would duplicate an authored identity or a linked element style.');
      const previous=items[index-1];
      const gap=previous?source.slice(previous.end,node.start):'\n'+(source.slice(0,node.start).match(/(?:^|\n)([ \t]*)$/)?.[1]||'');
      next=source.slice(0,node.end)+gap+source.slice(copied.start,copied.end)+source.slice(node.end);
    } else if(op.type==='deleteElement') {
      next=source.slice(0,node.start)+source.slice(node.end);
    } else if(op.type==='moveElement') {
      const to=op.direction==='before'?index-1:op.direction==='after'?index+1:op.direction==='first'?0:op.direction==='last'?items.length-1:-1;
      if(to<0||to>=items.length||to===index) throw Error('There is no sibling in that direction.');
      const chunks=items.map(r=>source.slice(r.start,r.end));
      chunks.splice(index,1);chunks.splice(to,0,chunk);
      next=source.slice(0,items[0].start);
      items.forEach((r,i)=>{next+=chunks[i]+source.slice(r.end,items[i+1]?.start??source.length);});
    } else throw Error('Unknown structural operation.');
    if(language==='react') parseSource(next);
    return {ok:true,hash:contentHash(next),structural:true,parentId:items.parentId,edits:[{file:resolved.file,before:source,after:next}]};
  } catch(error) {return refuse(error.message);}
}
module.exports={types,describe,planOp};
