'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{constrained,geometry}=require('../shell/svg-draw.js');
test('Drawing constraints preserve anchors in every quadrant and combine with center drawing',()=>{
 for(const sx of [-1,1])for(const sy of [-1,1]){
  const a={x:20,y:30},b={x:20+sx*50,y:30+sy*10};
  assert.deepEqual(constrained('rectangle',a,b),[a,b]);
  const square=geometry('rectangle',...constrained('rectangle',a,b,{shiftKey:true}));assert.equal(square.width,50);assert.equal(square.height,50);
  const center=geometry('ellipse',...constrained('ellipse',a,b,{altKey:true}));assert.deepEqual(center,{cx:20,cy:30,rx:50,ry:10});
  const circle=geometry('ellipse',...constrained('ellipse',a,b,{shiftKey:true,altKey:true}));assert.deepEqual(circle,{cx:20,cy:30,rx:50,ry:50});
 }
});
test('Constrained lines snap to 45-degree increments while preserving radial distance',()=>{
 for(const angle of [-170,-110,-80,-15,10,35,80,120,175]){
  const radians=angle*Math.PI/180,a={x:10,y:20},b={x:10+100*Math.cos(radians),y:20+100*Math.sin(radians)};
  const [start,end]=constrained('line',a,b,{shiftKey:true}),dx=end.x-start.x,dy=end.y-start.y;
  assert.ok(Math.abs(Math.hypot(dx,dy)-100)<1e-8);assert.ok(Math.abs(Math.atan2(dy,dx)/(Math.PI/4)-Math.round(Math.atan2(dy,dx)/(Math.PI/4)))<1e-8);
  const [c,d]=constrained('line',a,b,{shiftKey:true,altKey:true});assert.ok(Math.abs((c.x+d.x)/2-a.x)<1e-8);assert.ok(Math.abs((c.y+d.y)/2-a.y)<1e-8);
 }
});

test('Arrows point toward the drag endpoint and keep symmetric bounded heads in every direction',()=>{
 for(const [dx,dy]of [[100,0],[-100,0],[0,100],[0,-100],[50,30],[-50,-30],[1,.5]]){
  const a={x:20,y:30},b={x:20+dx,y:30+dy};
  const points=geometry('arrow',a,b).points.split(' ').map(pair=>pair.split(',').map(Number));
  assert.deepEqual(points[0],[a.x,a.y]);assert.deepEqual(points[1],[b.x,b.y]);assert.deepEqual(points[3],points[1]);
  const [left,right]=[points[2],points[4]],length=Math.hypot(dx,dy);
  assert.ok((left[0]-b.x)*dx+(left[1]-b.y)*dy<0,'head stays behind the endpoint');
  assert.ok(Math.abs(Math.hypot(left[0]-b.x,left[1]-b.y)-Math.hypot(right[0]-b.x,right[1]-b.y))<.000002);
  assert.ok(Math.hypot(left[0]-b.x,left[1]-b.y)<length,'short arrows retain a shorter head');
  assert.deepEqual(constrained('arrow',a,b,{shiftKey:true,altKey:true}),constrained('line',a,b,{shiftKey:true,altKey:true}));
 }
});
