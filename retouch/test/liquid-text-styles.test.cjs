'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),liquid=require('../src/adapters/liquid.cjs'),linked=require('../src/liquid-text-styles.cjs');
const source='{% if product %}<p class="p-4 font-bold md:text-lg/7 hover:text-red-500">{{ product.title }}</p>{% endif %}';
const style={id:'11111111-1111-4111-8111-111111111111',name:'Heading',properties:{'font-family':'"Example_Font", serif','font-size':'32px','line-height':'1.4','font-weight':'500'}};
const resolve=(source,context)=>{const elements=liquid.collect(source,'sections/main.liquid').elements;return {file:'/tmp/main.liquid',relPath:'sections/main.liquid',source,hash:liquid.contentHash(source),element:elements[0],elements,context};};
const apply=(text,scope='',context)=>linked.plan(resolve(text,context),{type:'applyTextStyle',scope},style);
test('Liquid text styles preserve template syntax and scope ownership through serialization',()=>{
 const base=apply(source);assert.equal(base.ok,true,base.reason);
 const next=apply(base.edits[0].after,'md:');assert.equal(next.ok,true,next.reason);
 const r=resolve(next.edits[0].after),info=liquid.describe(r),links=linked.describe(r).textStyleLinks;
 assert.equal(r.element.id,resolve(source).element.id);assert.deepEqual(links['md:'].properties,style.properties);assert.equal(links[''].id,style.id);
 assert.ok(r.source.startsWith('{% if product %}'));assert.ok(r.source.endsWith('{{ product.title }}</p>{% endif %}'));
 assert.ok(info.className.includes('p-4'));assert.ok(info.className.includes('hover:text-red-500'));assert.ok(!info.className.includes('md:text-lg/7'));assert.ok(info.className.includes('md:![font-size:32px]'));
 assert.deepEqual(apply(r.source,'md:').edits,[]);
 const detached=linked.plan(r,{type:'detachTextStyle',scope:'md:'});assert.equal(detached.ok,true);
 assert.equal(liquid.describe(resolve(detached.edits[0].after)).className,info.className);assert.deepEqual(Object.keys(linked.describe(resolve(detached.edits[0].after)).textStyleLinks),['']);
});
test('Liquid refresh retains local overrides and reset follows the current style',()=>{
 const before=apply(apply(source).edits[0].after,'md:').edits[0].after.replace('md:![font-size:32px]','md:!text-[40px]');
 const next={...style,properties:{'font-size':'48px','line-height':'1.2'}};
 assert.deepEqual(linked.describe(resolve(before)).textStyleOverrides['md:'],['font-size']);
 const refreshed=linked.plan(resolve(before),{type:'refreshTextStyle',scope:'md:'},next);assert.equal(refreshed.ok,true,refreshed.reason);
 const r=resolve(refreshed.edits[0].after);assert.ok(liquid.describe(r).className.includes('md:!text-[40px]'));assert.deepEqual(linked.describe(r).textStyleLinks['md:'].overrides,['font-size']);
 const reset=linked.plan(r,{type:'resetTextStyle',scope:'md:'},next);assert.equal(reset.ok,true,reset.reason);const info=liquid.describe(resolve(reset.edits[0].after));
 assert.ok(info.className.includes('![font-size:32px]'));assert.ok(info.className.includes('md:![font-size:48px]'));assert.ok(!info.className.includes('md:!text-[40px]'));assert.deepEqual(linked.describe(resolve(reset.edits[0].after)).textStyleOverrides['md:'],[]);
});
test('Liquid dynamic classes retain the authored branch and require a rendered snapshot',async()=>{
 const dynamic='<p class="{% if product.available %}font-bold{% else %}font-normal{% endif %} p-4">{{ product.title }}</p>';
 assert.equal(apply(dynamic).ok,false);
 const result=apply(dynamic,'',{className:'font-bold p-4'});assert.equal(result.ok,true,result.reason);
 const engine=new(require('liquidjs').Liquid)();
 for(const available of [true,false]){
  const rendered=await engine.parseAndRender(result.edits[0].after,{product:{available,title:'Product title'}});
  const node=require('parse5').parseFragment(rendered).childNodes[0],attrs=Object.fromEntries(node.attrs.map(a=>[a.name,a.value]));
  assert.equal(JSON.parse(attrs['data-rt-text-styles'])[''].id,style.id);assert.ok(attrs.class.includes('![font-size:32px]'));assert.ok(attrs.class.includes('p-4'));assert.equal(node.childNodes[0].value,'Product title');
 }
 assert.ok(result.edits[0].after.includes('{% if product.available %}font-bold{% else %}font-normal{% endif %} p-4'));
 assert.ok(liquid.describe(resolve(result.edits[0].after,{className:'font-bold p-4'})).className.includes('![font-size:32px]'));
});
test('Liquid links refuse stale, duplicate, generated and dynamic metadata without source edits',()=>{
 assert.equal(linked.plan(resolve(source),{type:'applyTextStyle',fileHash:'stale'},style).ok,false);
 for(const text of ['<p class="a" class="b">Text</p>','<p {{ attributes }}>Text</p>','<p {% if x %}class="a"{% endif %}>Text</p>','<p data-rt-text-styles="{{ links }}">Text</p>','<p data-rt-text-styles="{}" data-rt-text-styles="{}">Text</p>']){const result=apply(text);assert.equal(result.ok,false,text);assert.equal(result.edits,undefined);}
 assert.equal(apply(source,'md:hover:').ok,false);
});
