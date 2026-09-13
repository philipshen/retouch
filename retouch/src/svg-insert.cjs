'use strict';
const MagicString=require('magic-string'),insertion=require('./html-insert.cjs');
const namespace='http://www.w3.org/2000/svg';
const presets=['rectangle','circle','ellipse','line','triangle','star'];
function pathShape(nodes,closed){
 const d=require('../shell/svg-path.js').serialize(nodes,closed);
 return d?'<path d="'+d+'" fill="'+(closed?'#a5b4fc':'none')+'" stroke="#6366f1" stroke-width="2"/>':null;
}
function drawnShape(preset,points){
 if(['polygon','polyline'].includes(preset)){
  const minimum=preset==='polygon'?3:2;
  if(!Array.isArray(points)||points.length<minimum*2||points.length>1024||points.length%2||points.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>100000))return null;
  const pairs=[];for(let i=0;i<points.length;i+=2)pairs.push(points[i]+','+points[i+1]);
  if(new Set(pairs).size<minimum)return null;
  return '<'+preset+' points="'+pairs.join(' ')+'" fill="'+(preset==='polygon'?'#a5b4fc':'none')+'" stroke="#6366f1" stroke-width="2"/>';
 }

 if(!Array.isArray(points)||points.length!==4||points.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>100000))return null;
 const [x1,y1,x2,y2]=points,x=Math.min(x1,x2),y=Math.min(y1,y2),w=Math.abs(x2-x1),h=Math.abs(y2-y1);
 if(w>100000||h>100000||(!w&&!h)||preset!=='line'&&(!w||!h))return null;
 if(['triangle','star'].includes(preset))return '<polygon points="'+require('../shell/svg-draw.js').geometry(preset,{x:x1,y:y1},{x:x2,y:y2}).points+'" fill="#a5b4fc"/>';
 const n=v=>String(Math.round(v*1000000)/1000000),fill=' fill="#a5b4fc"/>';
 return {rectangle:`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${fill}`,circle:`<circle cx="${n(x+w/2)}" cy="${n(y+h/2)}" r="${n(Math.min(w,h)/2)}"${fill}`,ellipse:`<ellipse cx="${n(x+w/2)}" cy="${n(y+h/2)}" rx="${n(w/2)}" ry="${n(h/2)}"${fill}`,line:`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="#6366f1" stroke-width="2"/>`}[preset]||null;
}
function shape(resolved,preset){
 let viewport=resolved.element.node;while(viewport&&!(viewport.namespaceURI===namespace&&viewport.tagName==='svg'))viewport=viewport.parentNode;
 const attr=name=>viewport?.attrs?.find(a=>a.name===name)?.value;
 const raw=(attr('viewBox')||'').trim().split(/[\s,]+/).map(Number);
 const dimension=name=>{const value=attr(name)||'';return /^(?:\d+\.?\d*|\.\d+)(?:px)?$/.test(value)&&parseFloat(value)>0&&parseFloat(value)<=100000?parseFloat(value):200;};
 const [x,y,w,h]=raw.length===4&&raw.every(n=>Number.isFinite(n)&&Math.abs(n)<=100000)&&raw[2]>0&&raw[3]>0?raw:[0,0,dimension('width'),dimension('height')];
 if(['triangle','star'].includes(preset))return drawnShape(preset,[x+w*.1,y+h*.1,x+w*.9,y+h*.9]);
 const n=value=>String(Math.round(value*1000000)/1000000),cx=n(x+w/2),cy=n(y+h/2);
 const fill=' fill="#a5b4fc"/>';
 return {rectangle:`<rect x="${n(x+w*.1)}" y="${n(y+h*.1)}" width="${n(w*.8)}" height="${n(h*.6)}"${fill}`,circle:`<circle cx="${cx}" cy="${cy}" r="${n(Math.min(w,h)*.3)}"${fill}`,ellipse:`<ellipse cx="${cx}" cy="${cy}" rx="${n(w*.4)}" ry="${n(h*.25)}"${fill}`,line:`<line x1="${n(x+w*.1)}" y1="${cy}" x2="${n(x+w*.9)}" y2="${cy}" stroke="#6366f1" stroke-width="${n(Math.min(w,h)*.02)}"/>`}[preset];
}
function describe(resolved){
 const el=resolved.element,svg=el.node.namespaceURI===namespace;
 if(!el.location.endTag)return null;
 if(svg?!['svg','g'].includes(el.tag):!insertion.describe(resolved).canInsert)return null;
 for(let node=el.node;node;node=node.parentNode)if(node.attrs?.some(a=>/^(?:v-for|v-if|x-for|x-if)$/.test(a.name)))return null;
 return {createsViewport:!svg,presets,pen:svg};
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),cap=describe(resolved);
 if(!cap||!presets.includes(op.preset)&&!['polygon','polyline','path'].includes(op.preset))return refuse('Select a content container, SVG canvas or group to add a shape.');
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the container.');
 if(['polygon','polyline'].includes(op.preset)&&op.points===undefined)return refuse('Place vector points before creating a line or polygon.');
 const drawn=op.preset==='path'?pathShape(op.nodes,op.closed):op.points===undefined?null:drawnShape(op.preset,op.points);
 if(op.preset==='path'&&(cap.createsViewport||!drawn))return refuse('Draw valid path anchors and handles inside an SVG canvas or group.');
 if(op.points!==undefined&&(cap.createsViewport||!drawn))return refuse('Draw a nonempty shape inside an existing SVG canvas or group.');
 const html=require('./adapters/html.cjs'),el=resolved.element,offset=el.location.endTag.startOffset;
 const opening=cap.createsViewport?'<svg width="200" height="200" viewBox="0 0 200 200" aria-label="Shapes">':'';
 const content=opening+(drawn||shape(resolved,op.preset))+(cap.createsViewport?'</svg>':'');
 const out=new MagicString(resolved.source);out.appendLeft(offset,content);const after=out.toString();
 const before=resolved.elements||html.collect(resolved.source,resolved.relPath).elements,next=html.collect(after,resolved.relPath).elements;
 const created=next.find(e=>e.location.startOffset===offset+opening.length),parent=next.find(e=>e.id===el.id),container=cap.createsViewport?next.find(e=>e.location.startOffset===offset):parent;
 if(next.length!==before.length+(cap.createsViewport?2:1)||!created||created.node.namespaceURI!==namespace||created.node.parentNode!==container?.node||cap.createsViewport&&container.node.parentNode!==parent?.node||before.some(e=>!next.some(n=>n.id===e.id&&n.tag===e.tag&&n.location.startOffset===e.location.startOffset+(e.location.startOffset>=offset?content.length:0))))return refuse('The shape would change the surrounding document structure.');
 return {ok:true,hash:html.contentHash(after),parentId:el.id,createdId:created.id,structural:true,edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={describe,plan,drawnShape,shape,pathShape,presets};
