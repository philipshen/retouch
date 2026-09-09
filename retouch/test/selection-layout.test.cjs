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
