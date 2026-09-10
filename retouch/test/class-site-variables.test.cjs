'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{compose,bindings}=require('../shell/class-site-variables.js');
test('class variable bindings preserve existing utilities and replace only their explicit property',()=>{
 const original='text-blue-500 font-bold hover:!text-red-500 md:w-8',bound=compose(original,'color','var(--accent)');assert.equal(bound,original+' ![color:var(--accent)]');assert.deepEqual(bindings(bound),{color:'var(--accent)'});
 const detached=compose(bound,'color','rgb(18, 52, 86)');assert.equal(detached,original+' ![color:rgb(18,_52,_86)]');assert.deepEqual(bindings(detached),{});assert.equal(compose(bound,'color',null),original);
});
test('class variables reject important ownership conflicts and unsupported source values',()=>{
 for(const value of ['!text-red-500','[all:unset]!','![background:red]'])assert.throws(()=>compose(value,'color','var(--accent)'),/important/);
 for(const value of ['var(--x);color:red','var(--x, red)','</style>'])assert.throws(()=>compose('','color',value),/Unsupported/);
 assert.throws(()=>compose('','unknown','var(--accent)'),/Unsupported/);assert.equal(compose('![color:var(--accent)] !font-bold','color',null),'!font-bold');
});
test('binding inspection includes only direct variable references in the projected scope',()=>{
 assert.deepEqual(bindings('md:![color:var(--tablet)] ![width:var(--size)] [fill:var(--paint)]! text-red-500'),{width:'var(--size)',fill:'var(--paint)'});
});
