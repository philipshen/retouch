'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),G=require('../shell/svg-stroke-gradient.js'),S=require('../shell/svg-stroke-alignment.js'),P=require('../shell/svg-path.js');
const input=()=>({type:'linearGradient',fields:{x1:'10%',x2:'90%',spreadMethod:'reflect'},stops:[{offset:'0',color:'#ff000080',opacity:'1'},{offset:'50%',color:'color(display-p3 0.2 0.6 0.8)',opacity:'.75'},{offset:'1',color:'blue',opacity:'0'}]});
test('retained gradients round-trip tiny offsets, inherited defaults and hard stops canonically',()=>{
 const value=input();value.stops[1].offset='0.00000001';value.stops[1].opacity='0.00000001';const normalized=G.normalize(value);assert.deepEqual(G.normalize(normalized),normalized);assert.equal(normalized.stops[1].offset,'1e-8');
 const hard=input();hard.stops[1].offset='1';const reverse=G.edit(hard,{action:'reverse'});assert.deepEqual(reverse.stops.map(s=>s.offset),['0','0','1']);assert.deepEqual(reverse.stops.map(s=>s.color),['blue','color(display-p3 0.2 0.6 0.8)','#ff000080']);
});
test('retained gradient edits preserve inactive coordinates and move stop color with its position',()=>{
 let value=G.edit(input(),{action:'setType',value:'radialGradient'});value=G.edit(value,{changes:{cx:'40%',r:'30%'}});value=G.edit(value,{action:'setType',value:'linearGradient'});assert.equal(value.fields.x1,'10%');assert.equal(value.fields.cx,'40%');
 value=G.edit(value,{action:'moveStop',stop:0,value:'.8'});assert.equal(value.stops[1].color,'#ff000080');assert.equal(value.stops[1].offset,'0.8');assert.equal(input().stops[0].offset,'0');
});
test('retained gradients reject contextual paints, invalid stops, foreign coordinates and identities',()=>{
 for(const color of ['currentColor','var(--paint)','url(#foreign)','CanvasText','inherit','light-dark(red,blue)']){const value=input();value.stops[0].color=color;assert.throws(()=>G.normalize(value));}
 for(const offset of [-1,1.1,NaN,Infinity,'20px',{},[],true]){const value=input();value.stops[0].offset=offset;assert.throws(()=>G.normalize(value));}
 for(const fields of [{r:'-1'},{x1:'100001'},{gradientUnits:'screen'},{spreadMethod:'none'},{href:'#foreign'},{gradientTransform:'rotate(20)'}])assert.throws(()=>G.normalize({...input(),fields}));
 for(const stops of [[],input().stops.slice(0,1),Array(65).fill(input().stops[0])])assert.throws(()=>G.normalize({...input(),stops}));
 assert.throws(()=>G.render(input(),'external'));assert.throws(()=>G.edit(input(),{action:'detach'}));
});
test('retained stroke renderer uses private gradient URLs without changing other paint or geometry',()=>{
 const base={document:P.parseCompound('M0 0L100 0L100 100L0 100Z'),fill:'red',stroke:'blue',width:8,position:'outside',gradients:{fill:input(),stroke:{...input(),type:'radialGradient'}}},model=S.normalize(base),id='rt-stroke-0123456789abcdef',html=S.render(base,id);
 assert.ok(html.includes('fill="url(#'+id+'-fill)"'));assert.ok(html.includes('stroke="url(#'+id+'-stroke)"'));assert.ok(html.includes('mask="url(#'+id+')"'));assert.ok(html.includes('stop-opacity="0.75"'));
 const solid=S.setPaint({...model,document:base.document},'fill','none');assert.equal(solid.gradients.fill,undefined);assert.deepEqual(solid.gradients.stroke,model.gradients.stroke);assert.equal(solid.stroke,'blue');assert.equal(solid.fill,'none');
});
