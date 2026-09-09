'use strict';
const MagicString=require('magic-string'),ids=require('./id.cjs'),svg=require('./svg-insert.cjs'),{literal}=require('./jsx-svg-geometry.cjs');
const presets=['rectangle','circle','ellipse','line'];
function viewport(resolved){const node=resolved.element.node;return (resolved.elements||ids.collectElements(resolved.source,resolved.relPath).elements).filter(e=>e.node.start<=node.start&&e.node.end>=node.end).reverse().find(e=>['svg','foreignObject'].includes(ids.jsxElementName(e.node)));}
function describe(resolved){
 const node=resolved.element.node,tag=ids.jsxElementName(node);
 if(!['svg','g'].includes(tag)||!node.closingElement||ids.jsxElementName(viewport(resolved)?.node||node)!=='svg')return null;
 if(node.openingElement.attributes.some(a=>a.type==='JSXSpreadAttribute'||['children','dangerouslySetInnerHTML'].includes(a.name?.name)))return null;
 return {createsViewport:false,presets,pen:true};
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(!describe(resolved)||!presets.includes(op.preset)&&!['polygon','polyline','path'].includes(op.preset))return refuse('Select an explicitly closed JSX SVG canvas or group without spread or children props.');
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the SVG container.');
 if(['polygon','polyline'].includes(op.preset)&&op.points===undefined)return refuse('Place vector points before creating a line or polygon.');
 const drawn=op.preset==='path'?svg.pathShape(op.nodes,op.closed):op.points===undefined?null:svg.drawnShape(op.preset,op.points);if(op.preset==='path'&&!drawn)return refuse('Draw valid path anchors and handles.');if(op.points!==undefined&&!drawn)return refuse('Draw a nonempty shape with bounded SVG coordinates.');
 const view=viewport(resolved).node,attrs=view.openingElement.attributes.filter(a=>a.type==='JSXAttribute').map(a=>({name:a.name.name,value:literal(a)})).filter(a=>a.value!==undefined&&a.value!==null);
 const content=(drawn||svg.shape({element:{node:{tagName:'svg',namespaceURI:'http://www.w3.org/2000/svg',attrs}}},op.preset)).replace(/stroke-width=/g,'strokeWidth=');
 const node=resolved.element.node,offset=node.closingElement.start,out=new MagicString(resolved.source);out.appendLeft(offset,content);const after=out.toString(),before=resolved.elements||ids.collectElements(resolved.source,resolved.relPath).elements,next=ids.collectElements(after,resolved.relPath).elements,created=next.find(e=>e.node.start===offset),parent=next.find(e=>e.id===resolved.element.id);
 if(next.length!==before.length+1||!created||!parent?.node.children.includes(created.node)||before.some(e=>!next.some(n=>n.id===e.id&&ids.jsxElementName(n.node)===ids.jsxElementName(e.node)&&n.node.start===e.node.start+(e.node.start>=offset?content.length:0))))return refuse('The insertion would change surrounding JSX structure.');
 return {ok:true,hash:ids.contentHash(after),parentId:parent.id,createdId:created.id,structural:true,edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={describe,plan};
