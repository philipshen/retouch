'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs');
const original='<html><head><style>.title{color:red}</style></head><body><h1 class="title">First</h1><h1 class="title">Second</h1></body></html>';
function resolve(source){return {source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(e=>e.tag==='h1')};}
function edit(source,width,value,property='width'){return css.plan(resolve(source),{width,value,property});}
test('HTML CSS stores isolated rules in ascending breakpoint order and resets individual properties',()=>{
 let source=edit(original,768,'320px').edits[0].after;
 source=edit(source,0,'240px').edits[0].after;
 assert.ok(source.indexOf('data-rt-width="0"')<source.indexOf('data-rt-width="768"'));
 assert.ok(source.includes('<style>.title{color:red}</style>'));
 assert.ok(source.includes('<h1 class="title">Second</h1>'));
 assert.equal((source.match(/data-rt-style="[a-f0-9]+" class=/g)||[]).length,1);
 assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{width:'240px'},768:{width:'320px'}});
 source=edit(source,768,'red','color').edits[0].after;
 source=edit(source,768,null).edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{width:'240px'},768:{color:'red'}});
 source=edit(source,768,null,'color').edits[0].after;
 assert.ok(!source.includes('data-rt-width="768"'));
 assert.deepEqual(html.collect(source,'index.html').elements.map(e=>e.id),html.collect(original,'index.html').elements.map(e=>e.id));
});
test('HTML CSS refuses injection, stale writes, conflicting identities and modified managed CSS',()=>{
 for(const value of ['2px;color:red','</style>','url(https://example.com)','var(--x)'])assert.equal(edit(original,0,value).refused,true);
 assert.equal(css.plan(resolve(original),{width:0,value:'2px',property:'width',fileHash:'stale'}).refused,true);
 assert.equal(edit(original.replace('class="title"','style="width: 3px !important"'),0,'4px').refused,true);
 const source=edit(original,0,'240px').edits[0].after;
 assert.equal(edit(source.replace('width:240px','width:250px'),0,'260px').refused,true);
 const marker=/data-rt-style="[a-f0-9]+"/.exec(source)[0];
 assert.equal(edit(source.replace('<h1 class=',`<h1 ${marker} class=`),0,'260px').refused,true);
});

test('HTML CSS reset without an override is inert and refuses an identity owned elsewhere',()=>{
 assert.deepEqual(edit(original,0,null).edits,[]);
 const id=resolve(original).element.id;
 assert.equal(edit(original.replace('<h1 class="title">Second',`<h1 data-rt-style="${id}" class="title">Second`),0,'200px').refused,true);
});

test('CSS spacing supports shorthand and signed margins but refuses malformed or invalid lengths',()=>{
 for(const [property,value] of [['padding','8px 12px 16px 20px'],['gap','1rem 2rem'],['margin','-8px auto'],['letter-spacing','-0.02em'],['line-height','1.5'],['max-height','none']])assert.equal(css.valid(property,value),true,property+' '+value);
 for(const [property,value] of [['padding','8'],['padding','-8px'],['gap','1px 2px 3px'],['width','normal'],['letter-spacing','5%'],['border-width','2%'],['color','#12345'],['margin','1px;display:none']])assert.equal(css.valid(property,value),false,property+' '+value);
});
test('CSS shorthand replaces prior edge overrides and later edges win in the rendered declaration order',()=>{
 let source=edit(original,0,'8px 12px','padding').edits[0].after;
 source=edit(source,0,'20px','padding-left').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules[0],{padding:'8px 12px','padding-left':'20px'});
 source=edit(source,0,'4px','padding').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules[0],{padding:'4px'});
 source=edit(source,0,'8px','gap').edits[0].after;
 source=edit(source,0,'20px','column-gap').edits[0].after;
 assert.ok(source.indexOf('gap:8px')<source.indexOf('column-gap:20px'));
 const id=resolve(source).element.id,values=css.describe(resolve(source)).cssRules[0];
 const legacy=source.replace(css.rule(id,0,values),css.rule(id,0,values,true));
 assert.deepEqual(css.describe(resolve(legacy)).cssRules[0],values);
 assert.equal(edit(legacy,0,'30px','column-gap').ok,true);

});
test('CSS important shorthand conflicts are refused while reset remains available',()=>{
 for(const [inline,prop]of [['padding:1px !important','padding-left'],['padding-left:1px !important','padding'],['border-top:1px solid red !important','border-width'],['all:initial !important','width'],['font:12px serif !important','font-size']])assert.equal(edit(original.replace('class="title"',`style="${inline}"`),0,'2px',prop).refused,true,inline);
 let source=edit(original,0,'240px').edits[0].after;
 source=source.replace('class="title"','class="title" style="width:200px !important"');
 const reset=edit(source,0,null);assert.equal(reset.ok,true);assert.ok(!reset.edits[0].after.includes('data-rt-css='));assert.ok(reset.edits[0].after.includes('width:200px !important'));
});

test('HTML image framing accepts fit modes and bounded focal points',()=>{
 for(const mode of ['cover','contain','fill','none','scale-down'])assert.equal(css.valid('object-fit',mode),true);
 for(const value of ['0% 100%','25.5% 50%'])assert.equal(css.valid('object-position',value),true);
 for(const value of ['101% 0%','-1% 0%','0%','0% 0%;color:red','left top'])assert.equal(css.valid('object-position',value),false);
 let source=edit(original,768,'cover','object-fit').edits[0].after;
 source=edit(source,768,'25% 75%','object-position').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules[768],{'object-fit':'cover','object-position':'25% 75%'});
 source=edit(source,768,null,'object-position').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules[768],{'object-fit':'cover'});
});

test('HTML opacity and rotation persist without replacing authored transforms',()=>{
 for(const [property,value]of [['opacity','0.25'],['opacity','1'],['rotate','-45deg']])assert.equal(css.valid(property,value),true);
 for(const [property,value]of [['opacity','1.5'],['opacity','-1'],['rotate','361deg'],['rotate','45deg;display:none']])assert.equal(css.valid(property,value),false);
 const input=original.replace('class="title"','class="title" style="transform:translateX(10px)"');
 let source=edit(input,0,'0.25','opacity').edits[0].after;
 source=edit(source,768,'45deg','rotate').edits[0].after;
 assert.ok(source.includes('style="transform:translateX(10px)"'));
 assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{opacity:'0.25'},768:{rotate:'45deg'}});
 source=edit(source,768,null,'rotate').edits[0].after;assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{opacity:'0.25'}});
});
