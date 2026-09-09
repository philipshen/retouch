'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{widthAtRight}=require('../shell/screen-resize.js');
test('Screen edge resizing inverts centered and overflowing canvas layout at each zoom',()=>{
 for(const scale of [.25,.5,1,1.5,2])for(const width of [240,390,768,1440,7680]){const canvas=900,pad=scale===1?0:24,extent=Math.max(canvas,width*scale+pad*2),right=(extent+width*scale)/2;assert.equal(widthAtRight(right,canvas,scale),width);}
 assert.equal(widthAtRight(-1000,900,.5),240);assert.equal(widthAtRight(100000,900,.5),7680);
});
