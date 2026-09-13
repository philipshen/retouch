'use strict';
const MagicString=require('magic-string'),svg=require('./svg-insert.cjs'),native=require('./native-insert.cjs');
const presets=['rectangle','circle','ellipse','line'];
function viewport(el){for(let node=el;node;node=node.parent){if(node.dynamicTag||node.tag==='foreignobject')return null;if(node.tag==='svg')return node;}return null;}
function describe(resolved){
 const el=resolved.element;
 if(el.kind!=='host'||el.dynamicTag||el.generatedImage)return null;
 const canvas=['svg','g'].includes(el.tag)&&viewport(el);
 if(canvas?!native.liquidContainer(resolved,true).canInsert:!native.describe(resolved,'liquid').canInsert)return null;
 return {createsViewport:!canvas,presets,pen:!!canvas};
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),cap=describe(resolved);
 if(!cap||!presets.includes(op.preset)&&!['polygon','polyline','path'].includes(op.preset))return refuse('Select a content container, SVG canvas or group to add a shape.');
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the container.');
 if(['polygon','polyline'].includes(op.preset)&&op.points===undefined)return refuse('Place vector points before creating a line or polygon.');
 const drawn=op.preset==='path'?svg.pathShape(op.nodes,op.closed):op.points===undefined?null:svg.drawnShape(op.preset,op.points);
 if(op.preset==='path'&&(cap.createsViewport||!drawn))return refuse('Draw valid path anchors and handles inside an SVG canvas or group.');
 if(op.points!==undefined&&(cap.createsViewport||!drawn))return refuse('Draw a nonempty shape inside an existing SVG canvas or group.');
 const el=resolved.element,view=viewport(el),attrs=(view?.attributes||[]).map(a=>({name:a.name==='viewbox'?'viewBox':a.name,value:a.value}));
 const opening=cap.createsViewport?'<svg width="200" height="200" viewBox="0 0 200 200" aria-label="Shapes">':'';
 const content=opening+(drawn||svg.shape({element:{node:{tagName:'svg',namespaceURI:'http://www.w3.org/2000/svg',attrs}}},op.preset))+(cap.createsViewport?'</svg>':'');
 const offset=el.closeStart,out=new MagicString(resolved.source);out.appendLeft(offset,content);
 const after=out.toString(),adapter=require('./adapters/liquid.cjs'),before=resolved.elements||adapter.collect(resolved.source,resolved.relPath).elements,next=adapter.collect(after,resolved.relPath).elements;
 const created=next.find(e=>e.tagStart===offset+opening.length),parent=next.find(e=>e.id===el.id),container=cap.createsViewport?next.find(e=>e.tagStart===offset):parent;
 if(next.length!==before.length+(cap.createsViewport?2:1)||!created||created.parent!==container||cap.createsViewport&&container.parent!==parent||before.some(e=>!next.some(n=>n.id===e.id&&n.tag===e.tag&&n.kind===e.kind&&n.tagStart===e.tagStart+(e.tagStart>=offset?content.length:0))))return refuse('The insertion would change surrounding Liquid source layer identities.');
 return {ok:true,hash:adapter.contentHash(after),parentId:parent.id,createdId:created.id,structural:true,edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={describe,plan};
