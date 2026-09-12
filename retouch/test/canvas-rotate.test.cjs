const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('../shell/canvas-rotate.js');
test('rotation unwraps crossing the atan2 seam in either direction',()=>{assert.equal(R.difference(-179,179),2);assert.equal(R.difference(179,-179),-2);assert.equal(R.angle(0,1,{x:0,y:0}),90);});
test('rotation snaps absolute angles and respects the existing source field range',()=>{assert.equal(R.value(-10,32,true),15);assert.equal(R.value(350,40),360);assert.equal(R.value(-350,-40),-360);assert.equal(R.value(30,.126),30.13);});

test('corner hit regions follow the authored pivot and retain a ten pixel offset at every zoom',()=>{const g={layoutLeft:20,layoutTop:30,width:100,height:50,rotation:0,transformOrigin:'0px 0px'};assert.deepEqual(R.corners(g,.5),[{x:0,y:5},{x:70,y:5},{x:70,y:50},{x:0,y:50}]);const a=R.corners({...g,rotation:90})[1];assert.ok(Math.abs(a.x-30)<1e-9);assert.ok(Math.abs(a.y-140)<1e-9);assert.throws(()=>R.corners({...g,transformOrigin:'0px 0px 20px'}));});

test('resize handles and cursors follow the rotated local axes at canvas zoom',()=>{const g={layoutLeft:20,layoutTop:30,width:100,height:60,rotation:90,transformOrigin:'0px 0px'},east=R.resizeHandles(g,.5).find(p=>p.handle==='e');assert.ok(Math.abs(east.x+5)<1e-9);assert.ok(Math.abs(east.y-65)<1e-9);assert.equal(R.resizeCursor('e',90),'ns-resize');assert.equal(R.resizeCursor('n',30),'nesw-resize');assert.equal(R.resizeCursor('se',-45),'ew-resize');});


test('flipped resize handles follow signed scale without scaling their hit targets',()=>{
 const g={layoutLeft:20,layoutTop:30,width:100,height:60,rotation:0,transformOrigin:'25px 45px',scaleX:-1.5,scaleY:.75};
 const east=R.resizeHandles(g,.5).find(p=>p.handle==='e');
 assert.deepEqual(east,{handle:'e',x:-33.75,y:31.875});
 assert.equal(R.resizeCursor('se',0,-1,1),'nesw-resize');
 assert.equal(R.resizeCursor('se',0,1,1),'nwse-resize');
});


test('rotation corner hit areas follow signed scale with a fixed screen-space offset',()=>{
 for(const scaleX of [-1.5,.8])for(const scaleY of [-2,.75])for(const zoom of [.5,1,1.25])for(const rotation of [-120,0,30,90]){
  const g={layoutLeft:220,layoutTop:160,width:180,height:80,rotation,transformOrigin:'45px 60px',scaleX,scaleY};
  const handles=R.resizeHandles(g,zoom).filter(p=>p.handle.length===2),corners=R.corners(g,zoom);
  corners.forEach((p,i)=>{const edge=handles[i],a=rotation*Math.PI/180,dx=p.x-edge.x,dy=p.y-edge.y,localX=dx*Math.cos(a)+dy*Math.sin(a),localY=-dx*Math.sin(a)+dy*Math.cos(a);assert.ok(Math.abs(Math.abs(localX)-10)<1e-8);assert.ok(Math.abs(Math.abs(localY)-10)<1e-8);assert.equal(Math.sign(localX),(i===0||i===3?-1:1)*Math.sign(scaleX));assert.equal(Math.sign(localY),(i<2?-1:1)*Math.sign(scaleY));});
 }
});
