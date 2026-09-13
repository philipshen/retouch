'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{movement,targets}=require('../shell/svg-snapping.js');
test('SVG drag axis locking follows document axes through rotated parents',()=>{
 assert.deepEqual(movement([0,2,-3,0,0,0],10,2,true),{x:0,y:20,lock:'y'});
 assert.deepEqual(movement([0,2,-3,0,0,0],2,10,true),{x:-30,y:0,lock:'x'});
 assert.deepEqual(movement([1,0,0,1,0,0],3,4,false),{x:3,y:4});
});
test('SVG snapping excludes self, definitions and hidden siblings, and includes lines',()=>{
 const box={left:10,top:10,width:20,height:20,right:30,bottom:30},w={innerWidth:500,innerHeight:500,getComputedStyle:el=>({display:el.hidden?'none':'block',visibility:'visible'})};
 const node=(localName,extra={})=>({localName,contains:()=>false,getBoundingClientRect:()=>box,...extra}),target=node('rect');target.ownerDocument={defaultView:w};target.ownerSVGElement=node('svg');target.parentElement={children:[target,node('defs'),node('rect',{hidden:true}),node('line',{getBoundingClientRect:()=>({...box,width:0,right:10})}),node('circle')]};
 const result=targets(target);assert.equal(result.length,3);assert.equal(result[0].container,true);assert.equal(result[1].width,0);
});

test('SVG selection snapping excludes selected siblings, ancestors and descendants',()=>{
 const box={left:10,top:10,width:20,height:20,right:30,bottom:30},w={innerWidth:500,innerHeight:500,getComputedStyle:()=>({display:'block',visibility:'visible'})},node=()=>({localName:'g',contains:()=>false,getBoundingClientRect:()=>box}),target=node(),selected=node(),ancestor=node(),child=node(),other=node();
 selected.contains=el=>el===child;ancestor.contains=el=>el===selected;target.ownerDocument={defaultView:w};target.parentElement={children:[target,selected,ancestor,child,other]};
 assert.equal(targets(target,[target,selected]).length,1);
});
