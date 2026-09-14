'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),geometry=require('../shell/svg-path.js'),{combine}=require('../shell/svg-boolean.js'),paper=require('paper');
const rectangle=(x,y,w,h)=>`M${x} ${y}h${w}v${h}h${-w}Z`;
test('all boolean operations match independent rectangle occupancy and preserve untouched contours',()=>{
 for(const [operation,expected] of [['union',(a,b)=>a||b],['subtract',(a,b)=>a&&!b],['intersect',(a,b)=>a&&b],['exclude',(a,b)=>a!==b]]){
  const document=geometry.parseCompound(rectangle(0,0,100,100)+' '+rectangle(50,20,100,100)+' M200 0L210 20'),before=JSON.stringify(document),result=combine(document,0,1,operation);assert.ok(result.ok,result.reason);assert.equal(JSON.stringify(document),before);assert.deepEqual(result.subpaths.at(-1),document.subpaths.at(-1));
  const scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));try{const shape=new scope.CompoundPath({pathData:geometry.serializeCompound({subpaths:result.subpaths.slice(0,-1)}),insert:false});for(let x=-5;x<160;x+=10)for(let y=-5;y<130;y+=10)assert.equal(shape.contains([x,y]),expected(x>0&&x<100&&y>0&&y<100,x>50&&x<150&&y>20&&y<120),operation+' '+x+','+y);}finally{scope.remove();}
 }
});
test('booleans retain curves, handle holes, arc conversion and empty intersections',()=>{
 const curved=geometry.parseCompound('M0 50A50 50 0 0 1 100 50A50 50 0 0 1 0 50Z '+rectangle(25,25,50,50));for(const op of ['union','subtract','intersect','exclude']){const result=combine(curved,0,1,op);assert.ok(result.ok,result.reason);assert.ok(geometry.serializeCompound(result));if(op!=='intersect')assert.ok(result.subpaths.some(part=>part.nodes.some(node=>node.in||node.out)));}
 const apart=geometry.parseCompound(rectangle(0,0,10,10)+' '+rectangle(20,20,10,10));assert.equal(combine(apart,0,1,'intersect').ok,false);apart.subpaths.push(geometry.parse('M50 50L60 60'));const empty=combine(apart,0,1,'intersect');assert.ok(empty.ok);assert.deepEqual(empty.subpaths,[apart.subpaths[2]]);
 for(const [from,to,op] of [[0,0,'union'],[-1,1,'union'],[0,1,'bad'],[0,2,'union']])assert.equal(combine(apart,from,to,op).ok,false);
});

test('curved boolean regions match analytic circle and rectangle occupancy without retaining scopes',()=>{
 const scopes=Object.keys(paper.PaperScope._scopes).length;
 for(const [operation,expected] of [['union',(a,b)=>a||b],['subtract',(a,b)=>a&&!b],['intersect',(a,b)=>a&&b],['exclude',(a,b)=>a!==b]]){
  const document=geometry.parseCompound('M0 50A50 50 0 0 1 100 50A50 50 0 0 1 0 50Z '+rectangle(25,25,80,80)),result=combine(document,0,1,operation);assert.ok(result.ok,result.reason);assert.equal(Object.keys(paper.PaperScope._scopes).length,scopes);
  const scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));try{const shape=new scope.CompoundPath({pathData:geometry.serializeCompound(result),insert:false});for(let x=-4;x<115;x+=9)for(let y=-4;y<115;y+=9){const distance=Math.hypot(x-50,y-50);if(Math.abs(distance-50)<.02||[25,105].includes(x)||[25,105].includes(y))continue;assert.equal(shape.contains([x,y]),expected(distance<50,x>25&&x<105&&y>25&&y<105),operation+' '+x+','+y);}}finally{scope.remove();}
 }
 assert.equal(Object.keys(paper.PaperScope._scopes).length,scopes);
});
