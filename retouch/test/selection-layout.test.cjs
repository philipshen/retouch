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
test('exact gaps retain spatial order and keep the first or chosen layer fixed',()=>{
 const {setSpacing,gaps}=require('../shell/selection-layout.js');
 assert.deepEqual(setSpacing(rects,'x',25),[{x:0,y:0},{x:-75,y:0},{x:-160,y:0}]);
 assert.deepEqual(setSpacing(rects,'x',25,{anchor:1}),[{x:75,y:0},{x:0,y:0},{x:-85,y:0}]);
 assert.deepEqual(setSpacing(rects,'y',10,{anchor:2}),[{x:0,y:100},{x:0,y:60},{x:0,y:0}]);
 assert.deepEqual(setSpacing(rects,'x',25,{start:0}),[{x:-20,y:0},{x:-95,y:0},{x:-180,y:0}]);
 assert.deepEqual(setSpacing(rects,'x',-10),[{x:0,y:0},{x:-110,y:0},{x:-230,y:0}]);
 assert.deepEqual(gaps([rects[2],rects[0],rects[1]].map(r=>Object.create(r)),'x').values,[100,110]);
});
test('exact spacing rejects nonfinite values, invalid references and order reversal',()=>{
 const {setSpacing}=require('../shell/selection-layout.js');for(const gap of [NaN,Infinity,100001,-40])assert.throws(()=>setSpacing(rects,'x',gap));
 for(const options of [{anchor:-1},{anchor:3},{anchor:1.5},{start:NaN}])assert.throws(()=>setSpacing(rects,'x',10,options));assert.throws(()=>setSpacing(rects,'z',10));
 assert.deepEqual(setSpacing(rects.slice(0,2),'x',25),[{x:0,y:0},{x:-75,y:0}]);
});
test('individual gaps preserve untouched spacing and anchor either side of the changed gap',()=>{
 const {setGaps}=require('../shell/selection-layout.js');
 assert.deepEqual(setGaps(rects,'x',[125,110]),[{x:0,y:0},{x:25,y:0},{x:25,y:0}]);
 assert.deepEqual(setGaps(rects,'x',[100,130]),[{x:0,y:0},{x:0,y:0},{x:20,y:0}]);
 assert.deepEqual(setGaps(rects,'x',[125,110],{anchor:1}),[{x:-25,y:0},{x:0,y:0},{x:0,y:0}]);
 assert.deepEqual(setGaps([rects[2],rects[0],rects[1]],'x',[100,130],{anchor:0}),[{x:0,y:0},{x:-20,y:0},{x:-20,y:0}]);
 assert.deepEqual(setGaps(rects,'y',[60,70],{start:0}),[{x:0,y:-40},{x:0,y:-30},{x:0,y:-30}]);
 assert.deepEqual(setGaps(rects,'x',[100,-79]),[{x:0,y:0},{x:0,y:0},{x:-189,y:0}]);
});
test('gap vectors reject invalid counts and changes that reverse order while retaining existing overlap',()=>{
 const {setGaps}=require('../shell/selection-layout.js');
 for(const values of [null,[],Array(2),[1],[1,2,3],[1,NaN],[Infinity,2],[-40,110],[100,-80]])assert.throws(()=>setGaps(rects,'x',values));
 const overlapping=[{left:0,top:0,width:50,height:10},{left:0,top:20,width:20,height:10},{left:100,top:40,width:20,height:10}];
 assert.deepEqual(setGaps(overlapping,'x',[-50,90]),[{x:0,y:0},{x:0,y:0},{x:10,y:0}]);
});

test('frame alignment moves each sibling group as a unit on all six edges and centers',()=>{
 const {alignGroups}=require('../shell/selection-layout.js'),a={left:10,top:20,width:500,height:400},b={left:600,top:300,width:200,height:150},frames=[a,a,b];
 for(const [mode,axis,pos,size,fraction]of [['left','x','left','width',0],['center','x','left','width',.5],['right','x','left','width',1],['top','y','top','height',0],['middle','y','top','height',.5],['bottom','y','top','height',1]]){
  const result=alignGroups(rects,mode,frames);assert.equal(result[0][axis],result[1][axis]);
  for(const [frame,indices]of [[a,[0,1]],[b,[2]]]){const start=Math.min(...indices.map(i=>rects[i][pos]+result[i][axis])),end=Math.max(...indices.map(i=>rects[i][pos]+result[i][axis]+rects[i][size]));assert.equal(start+(end-start)*fraction,frame[pos]+frame[size]*fraction);}
  for(const delta of result)assert.equal(delta[axis==='x'?'y':'x'],0);
 }
 assert.throws(()=>alignGroups(rects,'gap-x',frames));assert.throws(()=>alignGroups(rects,'left',[a]));assert.throws(()=>alignGroups(rects,'left',[a,a,{...b,width:NaN}]));
});
