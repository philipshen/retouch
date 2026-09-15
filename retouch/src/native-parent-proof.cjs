'use strict';
const parse5=require('parse5');
const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
// Compare browser-parsed subtrees in their old and proposed ancestor contexts.
// Markers exist only in this in-memory projection, never in the source edit.
function prove(resolved,roots,destination,language){
 const react=language==='react',elements=resolved.elements,keys=new Map();let serial=0;
 const node=e=>react?e.node:e,tag=n=>react?n.openingElement.name.name:n.tag;
 const start=e=>react?e.node.start:e.tagStart,end=e=>react?e.node.end:e.closeEnd;
 const key=n=>{if(!keys.has(n))keys.set(n,String(serial++));return keys.get(n);};
 const ancestors=e=>elements.filter(a=>a!==e&&a.kind==='host'&&start(a)<start(e)&&end(a)>=end(e)).sort((a,b)=>start(a)-start(b));
 const escape=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
 const open=n=>{const name=tag(n),encoding=react?n.openingElement.attributes.find(a=>a.name?.name==='encoding')?.value?.value:n.attributes?.find(a=>a.name==='encoding')?.value;return '<'+name+' data-rt-parent-proof="'+key(n)+'"'+(typeof encoding==='string'?' encoding="'+escape(encoding)+'"':'')+'>';};
 const close=n=>voids.has(tag(n).toLowerCase())?'':'</'+tag(n)+'>';
 const subtree=n=>open(n)+(react?n.children.filter(c=>c.type==='JSXElement'):n.children).map(subtree).join('')+close(n);
 const wrap=(chain,content)=>chain.map(e=>open(node(e))).join('')+content+[...chain].reverse().map(e=>close(node(e))).join('');
 function parse(markup){
  const found=new Map();
  function visit(n,parent){const id=n.attrs?.find(a=>a.name==='data-rt-parent-proof')?.value;if(id!==undefined){if(found.has(id))throw Error('The browser duplicates a layer in this nesting.');found.set(id,{parent,tag:n.tagName,namespace:n.namespaceURI});parent=id;}for(const child of n.childNodes||[])visit(child,parent);}
  visit(parse5.parse(markup),null);return found;
 }
 const baseline=new Map();
 for(const root of roots){const parsed=parse(wrap(ancestors(root),subtree(node(root)))),rootKey=key(node(root));
  function capture(n){const id=key(n),entry=parsed.get(id);if(!entry)throw Error('A source layer does not survive browser parsing.');baseline.set(id,{...entry,root:id===rootKey});for(const child of react?n.children.filter(c=>c.type==='JSXElement'):n.children)capture(child);}
  capture(node(root));
 }
 const destinationKey=key(node(destination)),after=parse(wrap([...ancestors(destination),destination],roots.map(e=>subtree(node(e))).join('')));
 if(!after.has(destinationKey))throw Error('The destination does not survive browser parsing.');
 for(const [id,before]of baseline){const next=after.get(id),expected=before.root?destinationKey:before.parent;if(!next||next.parent!==expected||next.tag!==before.tag||next.namespace!==before.namespace)throw Error('The browser would change the moved layer tree. Choose another container.');}
 return true;
}
module.exports={prove};
