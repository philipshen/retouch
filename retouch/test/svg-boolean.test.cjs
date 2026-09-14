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

test('whole-shape booleans preserve evenodd and nonzero holes under affine transforms',()=>{
 const combineShapes=require('../shell/svg-boolean.js').combineShapes,outer=rectangle(0,0,100,100),inner=rectangle(25,25,50,50);
 for(const fillRule of ['evenodd','nonzero'])for(const matrix of [[1,0,0,1,0,0],[1.5,.2,.3,.8,40,-10],[-1,0,0,1,120,0]])for(const [operation,expected] of [['union',(a,b)=>a||b],['subtract',(a,b)=>a&&!b],['intersect',(a,b)=>a&&b],['exclude',(a,b)=>a!==b]]){
  const operands=[{document:geometry.parseCompound(outer+' '+inner),fillRule,matrix},{document:geometry.parseCompound(rectangle(40,-10,40,120)),matrix}],before=JSON.stringify(operands),result=combineShapes(operands,operation);assert.ok(result.ok,result.reason);assert.equal(JSON.stringify(operands),before);assert.equal(result.fillRule,'nonzero');
  const scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));try{const shape=new scope.CompoundPath({pathData:result.empty?'':geometry.serializeCompound(result.document),fillRule:result.fillRule,insert:false});for(let x=-7;x<110;x+=11)for(let y=-7;y<110;y+=11){if([0,25,40,75,80,100].includes(x)||[0,25,75,100].includes(y))continue;const a=x>0&&x<100&&y>0&&y<100&&!(fillRule==='evenodd'&&x>25&&x<75&&y>25&&y<75),b=x>40&&x<80&&y>-10&&y<110,p=[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]];assert.equal(shape.contains(p),expected(a,b),JSON.stringify({fillRule,matrix,operation,x,y}));}}finally{scope.remove();}
 }
});
test('whole-shape booleans support multiple operands, empty results, bounds and immutable rejection',()=>{
 const combineShapes=require('../shell/svg-boolean.js').combineShapes,make=x=>({document:geometry.parseCompound(rectangle(x,0,10,10))}),operands=[make(0),make(20),make(40)];
 const union=combineShapes(operands,'union');assert.ok(union.ok);assert.equal(union.document.subpaths.length,3);const empty=combineShapes(operands,'intersect');assert.ok(empty.ok);assert.equal(empty.empty,true);assert.deepEqual(empty.document,{subpaths:[]});
 for(const changed of [[make(0)],Array.from({length:101},()=>make(0)),[make(0),{...make(20),fillRule:'invalid'}],[make(0),{...make(20),matrix:[1,0,0,0,0,0]}],[make(0),{document:geometry.parseCompound('M0 0L10 10')}],[make(0),{...make(20),matrix:[1,0,0,1,100000,0]}]]){const before=JSON.stringify(changed);assert.equal(combineShapes(changed,'union').ok,false);assert.equal(JSON.stringify(changed),before);}
 const clockwise=geometry.parseCompound(rectangle(0,0,100,100)+' M25 25v50h50v-50Z'),result=combineShapes([{document:clockwise},{document:geometry.parseCompound(rectangle(200,0,10,10))}],'union');assert.ok(result.ok);const scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));try{const shape=new scope.CompoundPath({pathData:geometry.serializeCompound(result.document),insert:false});assert.equal(shape.contains([50,50]),false);assert.equal(shape.contains([10,10]),true);}finally{scope.remove();}
});

test('transformed arc operands match analytic elliptical regions with independent shape transforms',()=>{
 const combineShapes=require('../shell/svg-boolean.js').combineShapes,matrix=[1.6,.3,.4,.7,20,-15],det=matrix[0]*matrix[3]-matrix[1]*matrix[2],circle=geometry.parseCompound('M0 50A50 50 0 0 1 100 50A50 50 0 0 1 0 50Z'),box=geometry.parseCompound(rectangle(75,10,70,65));
 for(const [operation,expected] of [['union',(a,b)=>a||b],['subtract',(a,b)=>a&&!b],['intersect',(a,b)=>a&&b],['exclude',(a,b)=>a!==b]]){
  const result=combineShapes([{document:circle,matrix},{document:box}],operation);assert.ok(result.ok,result.reason);const scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));try{const shape=new scope.CompoundPath({pathData:geometry.serializeCompound(result.document),insert:false});for(let x=3;x<230;x+=8)for(let y=-8;y<120;y+=8){const dx=x-matrix[4],dy=y-matrix[5],localX=(matrix[3]*dx-matrix[2]*dy)/det,localY=(-matrix[1]*dx+matrix[0]*dy)/det,distance=Math.hypot(localX-50,localY-50);if(Math.abs(distance-50)<.05||[75,145].includes(x)||[10,75].includes(y))continue;assert.equal(shape.contains([x,y]),expected(distance<50,x>75&&x<145&&y>10&&y<75),operation+' '+x+','+y);}}finally{scope.remove();}
 }
 for(const operand of [{document:circle,fillRule:''},{document:circle,matrix:false},{document:circle,matrix:[100000,0,0,100000,0,0]}])assert.equal(combineShapes([operand,{document:box}],'union').ok,false);
});
