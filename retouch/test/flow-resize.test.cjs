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
