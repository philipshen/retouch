'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{parse,flip,token}=require('../shell/flip.js'),{valid}=require('../shell/html-css-values.js');
test('Flips preserve scale magnitude, other axes and browser-normalized percentages',()=>{
 assert.deepEqual(parse('none'),[1,1]);assert.equal(flip('none','x'),'-1 1');assert.equal(flip('2','y'),'2 -2');assert.equal(flip('-2 3 4','x'),'2 3 4');assert.equal(flip('50% 200% 300%','y'),'0.5 -2 3');assert.equal(flip('1e-3 2','x'),'-0.001 2');assert.equal(flip(flip('2 3','x'),'x'),'2 3');
});
test('Unsupported computed scales and invalid axes are refused',()=>{
 for(const value of ['',null,'calc(1 + 1)','var(--scale)','1 2 3 4','Infinity 1','1e999 1','10001 1','1;display:none'])assert.equal(parse(value),null);
 assert.equal(flip('1 2','z'),null);assert.equal(flip('none','horizontal'),null);
});
test('Scale utility replacement preserves unrelated transform and custom classes',()=>{
 for(const value of ['scale-100','-scale-x-50','scale-y-[1.5]','scale-z-200','scale-(--zoom)','[scale:-1_1]'])assert.ok(token(value),value);
 for(const value of ['transform-gpu','rotate-90','translate-x-2','md:scale-50','scale-card','scale-heading'])assert.equal(token(value),false,value);
});
test('HTML scale authoring accepts bounded numeric axes and reset only',()=>{
 for(const value of [null,'-1 1','2 -3 4','1e-3 2'])assert.ok(valid('scale',value),String(value));
 for(const value of ['none','1','1 2 3 4','Infinity 1','10001 1','1; color:red'])assert.equal(valid('scale',value),false,value);
});
test('HTML scoped flips retain inline declarations and refuse important inline scale',()=>{
 const html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs');
 for(const priority of ['', '!important']){
  const attribute='style="scale:2 3'+priority+';color:red"',source='<html><head></head><body><h1 '+attribute+'>Heading</h1></body></html>',resolved={source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(el=>el.tag==='h1')};
  const result=css.plan(resolved,{property:'scale',value:'-2 3',width:768});
  if(priority){assert.equal(result.ok,false);assert.match(result.reason,/important inline/);assert.equal(result.edits,undefined);}
  else{assert.ok(result.ok,result.reason);assert.ok(result.edits[0].after.includes(attribute));assert.ok(result.edits[0].after.includes('scale:-2 3 !important;'));}
 }
});
test('Selection reflection maps every layer corner across the shared bounds, including rotation and signed scale',()=>{
 const {selectionPlan}=require('../shell/flip.js');
 const points=(g,scale,origin)=>{const radians=g.rotation*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians),[sx,sy]=parse(scale),[ox,oy]=origin;return [[0,0],[g.width,0],[0,g.height],[g.width,g.height]].map(([x,y])=>({x:g.layoutLeft+ox+(x-ox)*sx*c-(y-oy)*sy*s,y:g.layoutTop+oy+(x-ox)*sx*s+(y-oy)*sy*c}));};
 const measure=(g,scale,origin)=>{const corners=points(g,scale,origin),left=Math.min(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y));return {geometry:g,scale,origin,rect:{left,top,width:Math.max(...corners.map(p=>p.x))-left,height:Math.max(...corners.map(p=>p.y))-top}};};
 const members=[measure({x:20,y:40,layoutLeft:120,layoutTop:90,width:80,height:50,rotation:30},'1.5 .75',[0,0]),measure({x:160,y:140,layoutLeft:210,layoutTop:200,width:90,height:70,rotation:-20},'-.8 1.2',[20,10])];
 for(const axis of ['x','y']){
  const planned=selectionPlan(members,axis),edge=axis==='x'?'left':'top',size=axis==='x'?'width':'height',sum=Math.min(...members.map(m=>m.rect[edge]))+Math.max(...members.map(m=>m.rect[edge]+m.rect[size]));
  const reflected=planned.map((next,i)=>{const old=members[i].geometry,g={...next.geometry,layoutLeft:old.layoutLeft+next.geometry.x-old.x,layoutTop:old.layoutTop+next.geometry.y-old.y};return measure(g,next.scale,members[i].origin);});
  reflected.forEach((member,i)=>points(member.geometry,member.scale,member.origin).forEach((point,j)=>{const original=points(members[i].geometry,members[i].scale,members[i].origin)[j];for(const coordinate of ['x','y'])assert.ok(Math.abs(point[coordinate]-(coordinate===axis?sum-original[coordinate]:original[coordinate]))<1e-9);}));
  selectionPlan(reflected,axis).forEach((next,i)=>{for(const key of ['x','y','width','height','rotation'])assert.ok(Math.abs(next.geometry[key]-members[i].geometry[key])<1e-9);assert.deepEqual(parse(next.scale),parse(members[i].scale));});
 }
 assert.throws(()=>selectionPlan(members,'z'));assert.throws(()=>selectionPlan(members.slice(0,1),'x'));
});
