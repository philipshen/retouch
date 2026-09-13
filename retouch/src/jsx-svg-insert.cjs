'use strict';
const MagicString=require('magic-string'),ids=require('./id.cjs'),svg=require('./svg-insert.cjs'),{literal}=require('./jsx-svg-geometry.cjs');
const presets=svg.presets;
function viewport(resolved){const node=resolved.element.node;return (resolved.elements||ids.collectElements(resolved.source,resolved.relPath).elements).filter(e=>e.node.start<=node.start&&e.node.end>=node.end).reverse().find(e=>['svg','foreignObject'].includes(ids.jsxElementName(e.node)));}
function describe(resolved){
 const node=resolved.element.node,tag=ids.jsxElementName(node);
 const canvas=['svg','g'].includes(tag)&&ids.jsxElementName(viewport(resolved)?.node||node)==='svg';
 if(!canvas&&!require('./native-insert.cjs').describe({...resolved,elements:resolved.elements||ids.collectElements(resolved.source,resolved.relPath).elements},'react').canInsert)return null;
 if(node.openingElement.attributes.some(a=>a.type==='JSXSpreadAttribute'||['children','dangerouslySetInnerHTML'].includes(a.name?.name)))return null;
 return {createsViewport:!canvas,presets,pen:canvas};
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),cap=describe(resolved);
 if(!cap||!presets.includes(op.preset)&&!['polygon','polyline','path'].includes(op.preset))return refuse('Select a native JSX content container, SVG canvas or group without spread or children props.');
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the SVG container.');
 if(['polygon','polyline'].includes(op.preset)&&op.points===undefined)return refuse('Place vector points before creating a line or polygon.');
 const drawn=op.preset==='path'?svg.pathShape(op.nodes,op.closed):op.points===undefined?null:svg.drawnShape(op.preset,op.points);if(op.preset==='path'&&(cap.createsViewport||!drawn))return refuse('Draw valid path anchors and handles.');if(op.points!==undefined&&(cap.createsViewport||!drawn))return refuse('Draw a nonempty shape with bounded SVG coordinates.');
 const view=viewport(resolved)?.node,attrs=(view?.openingElement.attributes||[]).filter(a=>a.type==='JSXAttribute').map(a=>({name:a.name.name,value:literal(a)})).filter(a=>a.value!==undefined&&a.value!==null);
 const opening=cap.createsViewport?'<svg width="200" height="200" viewBox="0 0 200 200" aria-label="Shapes">':'';
 const content=opening+(drawn||svg.shape({element:{node:{tagName:'svg',namespaceURI:'http://www.w3.org/2000/svg',attrs:cap.createsViewport?[]:attrs}}},op.preset)).replace(/stroke-width=/g,'strokeWidth=')+(cap.createsViewport?'</svg>':'');
 const node=resolved.element.node,selfClosing=node.openingElement.selfClosing,offset=selfClosing?node.openingElement.end-2:node.closingElement.start;
 const prefix=selfClosing?'>':'',suffix=selfClosing?'</'+ids.jsxElementName(node)+'>':'',insertion=prefix+content+suffix,out=new MagicString(resolved.source);
 if(selfClosing)out.overwrite(offset,node.openingElement.end,insertion);else out.appendLeft(offset,insertion);
 const after=out.toString(),before=resolved.elements||ids.collectElements(resolved.source,resolved.relPath).elements,next=ids.collectElements(after,resolved.relPath).elements,created=next.find(e=>e.node.start===offset+prefix.length+opening.length),parent=next.find(e=>e.id===resolved.element.id),container=cap.createsViewport?next.find(e=>e.node.start===offset+prefix.length):parent,delta=insertion.length-(selfClosing?2:0);
 if(next.length!==before.length+(cap.createsViewport?2:1)||!created||!container?.node.children.includes(created.node)||cap.createsViewport&&!parent?.node.children.includes(container.node)||before.some(e=>!next.some(n=>n.id===e.id&&ids.jsxElementName(n.node)===ids.jsxElementName(e.node)&&n.node.start===e.node.start+(e.node.start>=offset?delta:0))))return refuse('The insertion would change surrounding JSX structure.');
 return {ok:true,hash:ids.contentHash(after),parentId:parent.id,createdId:created.id,structural:true,edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={describe,plan};
