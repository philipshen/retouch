'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),compiler=require('svelte/compiler'),parser=require('@babel/parser'),source=require('../src/svelte-source.cjs'),markers=require('../src/svelte-component-markers.cjs');
function compile(text){const file='/tmp/App.svelte',info=markers.metadata(text,'App.svelte'),stamped=source.stamp(text,file,'/tmp',{runtime:true,componentMarkers:true}),compiled=compiler.compile(stamped.code,{filename:file,dev:true,hmr:true}),transformed=markers.transform(compiled.js.code,file,info);if(transformed)parser.parse(transformed.code,{sourceType:'module'});return {info,stamped,compiled,transformed};}
test('Svelte instance markers identify native roots across branches without wrapping authored DOM',()=>{
 const text='<script>import Child from "./Child.svelte";let show=$state(true);</script><header><b>Title</b></header>{#if show}<main><Child label="First"/></main>{:else}<footer>Empty</footer>{/if}<Child label="Second"/>';
 const {info,stamped,transformed}=compile(text);assert.deepEqual(info.roots.map(root=>root.tag),['header','main','footer']);assert.equal(info.components.length,2);assert.notEqual(info.components[0].id,info.components[1].id);assert.equal((stamped.code.match(/ data-rt-i=/g)||[]).length,5);assert.ok(transformed.code.includes('const '+info.binding+' = name => $$props?.[name]'));
 // The editable-source index intentionally excludes runtime-bound markers.
 // Compare compiler AST host elements instead to detect introduced DOM wrappers.
 const tags=text=>{const result=[];function visit(node){if(!node||typeof node!=='object')return;if(node.type==='RegularElement')result.push(node.name);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}}visit(compiler.parse(text,{modern:true}).fragment);return result;};
 assert.deepEqual(tags(stamped.code),tags(text));
});
test('Svelte marker forwarding preserves rune props, legacy exports and components without props',()=>{
 for(const text of ['<script>let {label,...rest}=$props();</script><main>{label}</main>','<script>export let label="Legacy";</script><main>{label}</main>','<main>Static</main>']){const {stamped,transformed}=compile(text);assert.ok(transformed);assert.equal((stamped.code.match(/\$props\(/g)||[]).length,(text.match(/\$props\(/g)||[]).length);assert.ok(stamped.code.includes(text.match(/<script>[\s\S]*?<\/script>/)?.[0]||'Static'));}
});
test('Svelte marker collection respects authored markers, spreads, dynamic roots and snippets',()=>{
 const text='<script>import Child from "./Child.svelte";let props={};let kind="main";</script><div data-rt-i="authored"/><section {...props}/><svelte:element this={kind}><p>Nested</p></svelte:element>{#snippet child()}<aside>Snippet</aside>{/snippet}<Child {...props}/><Child data-rt-i="authored"/>';
 const info=markers.metadata(text,'App.svelte');assert.deepEqual(info.roots,[]);assert.deepEqual(info.components,[]);assert.equal(markers.transform('', 'App.svelte', info),null);
 const only=compile('<script>import Child from "./Child.svelte";</script><Child label="Only"/>');assert.equal(only.info.roots.length,0);assert.match(only.stamped.code,/data-rt-i=/);assert.equal(only.transformed,null);
});

test('Svelte forwarded instance revisions run in tracked effects across native and custom roots',()=>{
 for(const text of ['<main/>','<custom-card/>','<script>let show=$state(true);</script>{#if show}<main/>{:else}<footer/>{/if}']){const {info,transformed}=compile(text);assert.equal((transformed.code.match(/template_effect\(\(\) => \$\.set_(?:attribute|custom_element_data)\([^;]*'data-rt-i(?:-revision)?'/g)||[]).length,info.roots.length*2);}
});

test('Svelte legacy default instrumentation also reaches component-only definitions',()=>{
 const {info,transformed}=compile('<script>import Child from "./Child.svelte";export let amount=1;</script><Child amount={amount}/>');assert.equal(info.roots.length,0);assert.ok(transformed);assert.match(transformed.code,/legacyProp as/);assert.match(transformed.code,/_legacy\(\$\.prop\(/);
});
