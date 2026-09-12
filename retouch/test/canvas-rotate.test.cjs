const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('../shell/canvas-rotate.js');
test('rotation unwraps crossing the atan2 seam in either direction',()=>{assert.equal(R.difference(-179,179),2);assert.equal(R.difference(179,-179),-2);assert.equal(R.angle(0,1,{x:0,y:0}),90);});
test('rotation snaps absolute angles and respects the existing source field range',()=>{assert.equal(R.value(-10,32,true),15);assert.equal(R.value(350,40),360);assert.equal(R.value(-350,-40),-360);assert.equal(R.value(30,.126),30.13);});
