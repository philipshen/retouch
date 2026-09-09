'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{arrange}=require('../shell/selection-layout.js');
const rects=[{left:20,top:40,width:40,height:30},{left:160,top:120,width:80,height:50},{left:350,top:240,width:60,height:70}];
test('selection alignment uses common bounds while preserving sizes and the other axis',()=>{
 for(const [mode,axis,position,size,fraction,line]of [['left','x','left','width',0,20],['center','x','left','width',.5,215],['right','x','left','width',1,410],['top','y','top','height',0,40],['middle','y','top','height',.5,175],['bottom','y','top','height',1,310]]){
  const deltas=arrange(rects,mode);for(let i=0;i<rects.length;i++){assert.equal(rects[i][position]+deltas[i][axis]+rects[i][size]*fraction,line);assert.equal(deltas[i][axis==='x'?'y':'x'],0);}
 }
});
test('distribution handles unordered different-sized layers and retains outer layers',()=>{
 assert.deepEqual(arrange(rects,'gap-x'),[{x:0,y:0},{x:5,y:0},{x:0,y:0}]);
 assert.deepEqual(arrange([rects[2],rects[0],rects[1]].map(r=>Object.create(r)),'gap-y'),[{x:0,y:0},{x:0,y:0},{x:0,y:10}]);
 assert.throws(()=>arrange(rects.slice(0,2),'gap-x'),/three/);assert.throws(()=>arrange(rects,'unknown'));assert.throws(()=>arrange([{...rects[0],width:0},rects[1]],'left'));assert.throws(()=>arrange([{...rects[0],left:NaN},rects[1]],'left'));
});
test('explicit layer and frame targets align to their bounds and can distribute across a frame',()=>{
 for(const mode of ['left','center','right','top','middle','bottom'])assert.deepEqual(arrange(rects,mode,rects[1])[1],{x:0,y:0});
 const parent={left:100,top:200,width:500,height:400};assert.deepEqual(arrange(rects,'left',parent),[{x:80,y:0},{x:-60,y:0},{x:-250,y:0}]);
 const distributed=arrange(rects,'gap-x',parent),positions=rects.map((r,i)=>r.left+distributed[i].x);assert.deepEqual(positions,[100,300,540]);assert.equal(positions[2]+rects[2].width,parent.left+parent.width);
 assert.equal(arrange(rects,'top',{...parent,height:0})[0].y,160);assert.throws(()=>arrange(rects,'left',{...parent,width:-1}));assert.throws(()=>arrange(rects,'left',{...parent,left:NaN}));
});
