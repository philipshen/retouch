'use strict';
const MagicString=require('magic-string'),insertion=require('./html-insert.cjs');
const namespace='http://www.w3.org/2000/svg';
const presets=['rectangle','circle','ellipse','line'];
function shape(resolved,preset){
 let viewport=resolved.element.node;while(viewport&&!(viewport.namespaceURI===namespace&&viewport.tagName==='svg'))viewport=viewport.parentNode;
 const attr=name=>viewport?.attrs?.find(a=>a.name===name)?.value;
 const raw=(attr('viewBox')||'').trim().split(/[\s,]+/).map(Number);
 const dimension=name=>{const value=attr(name)||'';return /^(?:\d+\.?\d*|\.\d+)(?:px)?$/.test(value)&&parseFloat(value)>0&&parseFloat(value)<=100000?parseFloat(value):200;};
 const [x,y,w,h]=raw.length===4&&raw.every(n=>Number.isFinite(n)&&Math.abs(n)<=100000)&&raw[2]>0&&raw[3]>0?raw:[0,0,dimension('width'),dimension('height')];
 const n=value=>String(Math.round(value*1000000)/1000000),cx=n(x+w/2),cy=n(y+h/2);
 const fill=' fill="#a5b4fc"/>';
 return {rectangle:`<rect x="${n(x+w*.1)}" y="${n(y+h*.1)}" width="${n(w*.8)}" height="${n(h*.6)}"${fill}`,circle:`<circle cx="${cx}" cy="${cy}" r="${n(Math.min(w,h)*.3)}"${fill}`,ellipse:`<ellipse cx="${cx}" cy="${cy}" rx="${n(w*.4)}" ry="${n(h*.25)}"${fill}`,line:`<line x1="${n(x+w*.1)}" y1="${cy}" x2="${n(x+w*.9)}" y2="${cy}" stroke="#6366f1" stroke-width="${n(Math.min(w,h)*.02)}"/>`}[preset];
}
function describe(resolved){
 const el=resolved.element,svg=el.node.namespaceURI===namespace;
 if(!el.location.endTag)return null;
 if(svg?!['svg','g'].includes(el.tag):!insertion.describe(resolved).canInsert)return null;
 for(let node=el.node;node;node=node.parentNode)if(node.attrs?.some(a=>/^(?:v-for|v-if|x-for|x-if)$/.test(a.name)))return null;
 return {createsViewport:!svg,presets};
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),cap=describe(resolved);
 if(!cap||!presets.includes(op.preset))return refuse('Select a content container, SVG canvas or group to add a shape.');
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the container.');
 const html=require('./adapters/html.cjs'),el=resolved.element,offset=el.location.endTag.startOffset;
 const opening=cap.createsViewport?'<svg width="200" height="200" viewBox="0 0 200 200" aria-label="Shapes">':'';
 const content=opening+shape(resolved,op.preset)+(cap.createsViewport?'</svg>':'');
 const out=new MagicString(resolved.source);out.appendLeft(offset,content);const after=out.toString();
 const before=resolved.elements||html.collect(resolved.source,resolved.relPath).elements,next=html.collect(after,resolved.relPath).elements;
 const created=next.find(e=>e.location.startOffset===offset+opening.length),parent=next.find(e=>e.id===el.id),container=cap.createsViewport?next.find(e=>e.location.startOffset===offset):parent;
 if(next.length!==before.length+(cap.createsViewport?2:1)||!created||created.node.namespaceURI!==namespace||created.node.parentNode!==container?.node||cap.createsViewport&&container.node.parentNode!==parent?.node||before.some(e=>!next.some(n=>n.id===e.id&&n.tag===e.tag&&n.location.startOffset===e.location.startOffset+(e.location.startOffset>=offset?content.length:0))))return refuse('The shape would change the surrounding document structure.');
 return {ok:true,hash:html.contentHash(after),parentId:el.id,createdId:created.id,structural:true,edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={describe,plan};
