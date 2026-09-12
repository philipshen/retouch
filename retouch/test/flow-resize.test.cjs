const {test}=require('node:test'),assert=require('node:assert/strict'),{flowHandles}=require('../shell/flow-resize.js');
test('flow resize follows inline and block growth in horizontal, vertical and sideways writing',()=>{
 assert.deepEqual(flowHandles(),['e','s','se']);assert.deepEqual(flowHandles({direction:'rtl'}),['w','s','sw']);
 assert.deepEqual(flowHandles({writingMode:'vertical-rl'}),['w','s','sw']);assert.deepEqual(flowHandles({writingMode:'vertical-rl',direction:'rtl'}),['w','n','nw']);
 assert.deepEqual(flowHandles({writingMode:'vertical-lr'}),['e','s','se']);assert.deepEqual(flowHandles({writingMode:'sideways-lr'}),['e','n','ne']);
});
test('reversed flex axes and end-aligned grid items grow from their retained edge',()=>{
 assert.deepEqual(flowHandles({display:'flex',flexDirection:'row-reverse'}),['w','s','sw']);assert.deepEqual(flowHandles({display:'flex',flexDirection:'column-reverse'}),['e','n','ne']);
 assert.deepEqual(flowHandles({display:'flex',flexDirection:'column',alignItems:'flex-end'}),['w','s','sw']);
 assert.deepEqual(flowHandles({display:'grid',justifyItems:'end',alignItems:'end'}),['w','n','nw']);assert.deepEqual(flowHandles({display:'grid',justifyItems:'end'},{justifySelf:'start'}),['e','s','se']);
});

test('proportional flow resizing corrects to browser-resolved minimum and maximum bounds',()=>{
 const {ratioCorrection}=require('../shell/flow-resize.js'),base={width:224,height:84};
 const maximum=ratioCorrection(base,{width:324,height:121.5},{width:324,height:94});assert.ok(Math.abs(maximum.width-224*94/84)<1e-10);assert.equal(maximum.height,94);
 assert.deepEqual(ratioCorrection(base,{width:124,height:46.5},{width:204,height:46.5}),{width:204,height:76.5});
 assert.equal(ratioCorrection(base,{width:250.666666,height:94},{width:250.65625,height:94}),null);
 assert.throws(()=>ratioCorrection(base,{width:224,height:84},{width:300,height:70}),/bounds/);
});
