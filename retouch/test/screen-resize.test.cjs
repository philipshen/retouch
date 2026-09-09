'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{widthAtRight,heightAtDelta,preserveAspect}=require('../shell/screen-resize.js');
test('Screen edge resizing inverts centered and overflowing canvas layout at each zoom',()=>{
 for(const scale of [.25,.5,1,1.5,2])for(const width of [240,390,768,1440,7680]){const canvas=900,pad=scale===1?0:24,extent=Math.max(canvas,width*scale+pad*2),right=(extent+width*scale)/2;assert.equal(widthAtRight(right,canvas,scale),width);}
 assert.equal(widthAtRight(-1000,900,.5),240);assert.equal(widthAtRight(100000,900,.5),7680);
});

test('Screen height dragging uses one vertical delta in viewport pixels and bounds the result',()=>{
 for(const scale of [.25,.5,1,1.5,2]){assert.equal(heightAtDelta(800,100*scale,scale),900);assert.equal(heightAtDelta(800,-100*scale,scale),700);}
 assert.equal(heightAtDelta(800,-10000,1),240);assert.equal(heightAtDelta(800,10000,1),7680);
});

test('Corner ratio locking follows the dominant change and bounds both dimensions together',()=>{
 assert.deepEqual(preserveAspect(600,810,400,800),{width:600,height:1200});
 assert.deepEqual(preserveAspect(410,1000,400,800),{width:500,height:1000});
 assert.deepEqual(preserveAspect(240,240,400,800),{width:240,height:480});
 assert.deepEqual(preserveAspect(7680,7680,400,800),{width:3840,height:7680});
 for(const [w,h]of [[390,844],[1440,900],[240,7680]])for(const [nw,nh]of [[240,240],[7680,7680],[500,700]]){const next=preserveAspect(nw,nh,w,h);assert.ok(next.width>=240&&next.width<=7680&&next.height>=240&&next.height<=7680);assert.ok(Math.abs(next.width-next.height*w/h)<=1);}
});
