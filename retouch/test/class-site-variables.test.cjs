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

test('selection variable edits preserve other scopes and retain per-layer detach values',()=>{
 const {selectionClasses}=require('../shell/class-site-variables.js'),infos=[{id:'a',className:'text-blue-500 md:font-bold hover:text-red-500'},{id:'b',className:'bg-white md:opacity-50'}];
 const bound=selectionClasses(infos,'md:',[{color:'var(--accent)'},{color:'var(--accent)'}]);assert.equal(bound.a,'text-blue-500 hover:text-red-500 md:font-bold md:![color:var(--accent)]');assert.equal(bound.b,'bg-white md:opacity-50 md:![color:var(--accent)]');
 const saved=infos.map(info=>({...info,className:bound[info.id]})),detached=selectionClasses(saved,'md:',[{color:'#123456'},{color:'#008844'}]);assert.match(detached.a,/md:!\[color:#123456\]/);assert.match(detached.b,/md:!\[color:#008844\]/);
 const partial=selectionClasses(saved,'md:',[{color:null},{}]);assert.equal(partial.b,bound.b);assert.equal(partial.a.includes('var('),false);
 assert.throws(()=>selectionClasses([{...infos[0],className:'md:!text-red-500'},infos[1]],'md:',[{color:'var(--accent)'},{color:'var(--accent)'}]),/important/);
});

test('local variable definitions coexist with bindings and preserve alias identifiers',()=>{
 const defined=compose('font-bold','--accent_color','#ff8800'),bound=compose(defined,'color','var(--accent_color)'),updated=compose(bound,'--accent_color','#0088ff');assert.match(updated,/!\[--accent_color:#0088ff\]/);assert.match(updated,/!\[color:var\(--accent_color\)\]/);
 assert.deepEqual(bindings(compose(updated,'--alias','var(--accent_color)')),{'--accent_color':'#0088ff',color:'var(--accent_color)','--alias':'var(--accent_color)'});
 assert.throws(()=>compose('','--loop','var(--loop)'),/Unsupported/);
});

test('class aliases refuse local and inherited cycles before producing a selection map',()=>{
 assert.throws(()=>compose('![--a:var(--b)]','--b','var(--a)'),/cycle.*--a.*--b/);
 assert.equal(compose('![--a:var(--b)]','--b','24px').includes('![--b:24px]'),true);
 const {selectionClasses}=require('../shell/class-site-variables.js');assert.throws(()=>selectionClasses([{id:'a',className:'![--a:var(--b)]'}],'md:',[{'--b':'var(--a)'}],['![--a:var(--b)]']),/cycle/);
});
