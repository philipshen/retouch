'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),react=require('../src/adapters/react.cjs'),linked=require('../src/jsx-effect-styles.cjs'),classes=require('../src/effect-style-classes.cjs');
const source='export default () => <main><h1 className="shadow-lg blur-sm !p-4 md:opacity-50 hover:blur-lg">Title</h1><p>Body</p></main>',style={id:'11111111-1111-4111-8111-111111111111',name:'Floating',properties:{'box-shadow':'0px 2px 4px rgba(0, 0, 0, 0.25)',filter:'blur(2px)','backdrop-filter':'blur(3px)'}};
function resolve(source){const parsed=react.collect(source,'app/page.tsx');return {source,file:'/tmp/page.tsx',relPath:'app/page.tsx',hash:react.contentHash(source),element:parsed.elements.find(e=>e.node.openingElement.name.name==='h1')};}
function apply(source,op='applyEffectStyle',definition=style){const r=resolve(source);return linked.plan(r,{type:op,scope:'md:',fileHash:r.hash},definition);}
test('React effect links retain other scopes and utilities and detach without changing classes',()=>{
 const result=apply(source);assert.equal(result.ok,true,result.reason);const after=result.edits[0].after,r=resolve(after),info=linked.describe(r),name=react.describe(r).className;
 assert.equal(info.effectStyleLinks['md:'].id,style.id);assert.deepEqual(info.effectStyleOverrides['md:'],[]);for(const token of ['shadow-lg','blur-sm','!p-4','md:opacity-50','hover:blur-lg','md:![filter:blur(2px)]'])assert.ok(name.split(' ').includes(token));assert.deepEqual(apply(after).edits,[]);
 const detached=apply(after,'detachEffectStyle');assert.equal(detached.ok,true);assert.deepEqual(linked.describe(resolve(detached.edits[0].after)).effectStyleLinks,{});assert.equal(react.describe(resolve(detached.edits[0].after)).className,name);
});
test('React effect refresh preserves local overrides and reset adopts changed property sets',()=>{
 const initial=apply(source).edits[0].after,local=initial.replace('md:![filter:blur(2px)]','md:![filter:blur(8px)]'),next={...style,properties:{filter:'blur(4px)'}};
 const refresh=apply(local,'refreshEffectStyle',next);assert.equal(refresh.ok,true,refresh.reason);const after=refresh.edits[0].after;assert.ok(react.describe(resolve(after)).className.includes('md:![filter:blur(8px)]'));assert.deepEqual(linked.describe(resolve(after)).effectStyleOverrides['md:'],['filter']);assert.ok(!react.describe(resolve(after)).className.includes('md:![box-shadow:'));
 const reset=apply(after,'resetEffectStyle',next);assert.equal(reset.ok,true,reset.reason);assert.deepEqual(linked.describe(resolve(reset.edits[0].after)).effectStyleOverrides['md:'],[]);assert.ok(react.describe(resolve(reset.edits[0].after)).className.includes('md:![filter:blur(4px)]'));
});
test('React effect planning rejects ambiguous source and stale hashes without partial edits',()=>{
 for(const input of [source.replace('<h1','<h1 {...props}'),source.replace('<h1','<h1 data-rt-effect-styles="bad"'),source.replace('className="shadow-lg blur-sm !p-4 md:opacity-50 hover:blur-lg"','className={choose()}'),source.replace('md:opacity-50','md:!blur-lg')]){const result=apply(input);assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
 const r=resolve(source),stale=linked.plan(r,{type:'applyEffectStyle',scope:'md:',fileHash:'stale'},style);assert.equal(stale.ok,false);
});
test('effect refresh preserves newly introduced local properties and detects competing important effects',()=>{
 const original=classes.compose('md:backdrop-blur-lg', {filter:'blur(2px)'},'md:'),next=classes.refresh(original,{filter:'blur(2px)'},style.properties,'md:');assert.deepEqual(next.overrides,['backdrop-filter']);assert.ok(!next.classes.includes('![backdrop-filter:'));
 for(const token of ['md:!blur-lg','md:![all:initial]'])assert.deepEqual(classes.overrides('md:![filter:blur(2px)] '+token,{filter:'blur(2px)'},'md:'),['filter']);
});
test('React effect file planner refreshes a linked owner and refuses malformed metadata',()=>{
 const initial=apply(source).edits[0].after,next={...style,properties:{filter:'blur(5px)'}},result=linked.planFile('/tmp/page.tsx','app/page.tsx',initial,next);assert.equal(result.ok,true,result.reason);assert.equal(result.updated,1);assert.ok(result.edits[0].after.includes('md:![filter:blur(5px)]'));
 const malformed=linked.planFile('/tmp/page.tsx','app/page.tsx',initial.replace('<p>','<p data-rt-effect-styles="bad">'),next);assert.equal(malformed.ok,false);assert.equal(malformed.edits,undefined);
});

test('effect reset replaces standard important shadow overrides without removing ring ownership',()=>{
 const next=classes.compose('md:!shadow-lg md:opacity-50 hover:shadow-xl',{'box-shadow':'none'},'md:');assert.equal(next,'md:opacity-50 hover:shadow-xl md:![box-shadow:none]');
 assert.equal(classes.compose('md:!shadow-[inset_0px_2px_4px_0px_#00000033]',{'box-shadow':'none'},'md:'),'md:![box-shadow:none]');
 assert.throws(()=>classes.compose('md:!ring-2',{'box-shadow':'none'},'md:'),/important effect/);
});
