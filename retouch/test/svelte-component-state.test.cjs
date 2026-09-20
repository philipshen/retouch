'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),compiler=require('svelte/compiler'),state=require('../src/svelte-component-state.cjs');
test('Svelte template HMR captures independent instances and resets on scripts, dependencies and new mounts',()=>{
 const registry=state.createRegistry(),a={},b={};let valueA=3,valueB=7;
 let first=registry('App','script','one',a);assert.equal(first.read('count',()=>0),0);first.capture('count',()=>valueA);let second=registry('App','script','one',b);second.capture('count',()=>valueB);
 first=registry('App','script','two',a);assert.equal(first.read('count',()=>99),3);first.capture('count',()=>4);second=registry('App','script','two',b);assert.equal(second.read('count',()=>99),7);
 assert.equal(registry('App','changed','three',a).read('count',()=>10),10);assert.equal(registry('App','script','four',a).read('count',()=>0),0);
 let dependency=registry('App','script','two',b);assert.equal(dependency.read('count',()=>12),12);dependency.capture('count',()=>13);assert.equal(registry('App','script','two',b).read('count',()=>14),14);
 assert.equal(registry('App','script','two',{}).read('count',()=>15),15);
});
test('Svelte compiler transform restores top-level rune signals only with matching source script proof',()=>{
 const source='<script>let count=$state(0);let draft=$state("Initial");</script><button onclick={()=>count++}>{count}</button><input bind:value={draft}/>',info=state.metadata(source,'App.svelte');assert.deepEqual(info.names,['count','draft']);assert.equal(state.metadata(source.replace('<button','<strong>Text</strong><button'),'App.svelte').script,info.script);assert.notEqual(state.metadata(source.replace('$state(0)','$state(5)'),'App.svelte').script,info.script);
 for(const dev of [false,true]){const compiled=compiler.compile(source,{filename:'App.svelte',generate:'client',dev,hmr:true}).js.code,result=state.transform(compiled,'App.svelte',info);assert.ok(result);require('@babel/parser').parse(result.code,{sourceType:'module'});assert.match(result.code,/read\("count",\(\)=>\(0\)\)/);assert.match(result.code,/capture\("draft",\(\)=>\$\.get\(draft\)\)/);}
 const production=compiler.compile(source,{filename:'App.svelte',generate:'client',dev:false,hmr:false}).js.code;assert.equal(state.transform(production,'App.svelte',info),null);
});
test('Svelte object, array and compiler-elided raw state use direct-value captures',()=>{
 const input='<script>let form=$state({name:"Ada"});let rows=$state(["A"]);let raw=$state.raw({value:1});let unset=$state();</script><button onclick={()=>{form.name="Lin";rows.push("B");raw.value++;unset=1}}>Go</button><p>{unset}</p>',info=state.metadata(input,'App.svelte');
 for(const dev of [true,false]){const compiled=compiler.compile(input,{filename:'App.svelte',dev,hmr:true}).js.code,result=state.transform(compiled,'App.svelte',info);require('@babel/parser').parse(result.code,{sourceType:'module'});for(const name of ['form','rows','raw'])assert.match(result.code,new RegExp('capture\\("'+name+'",\\(\\)=>'+name+'\\)'));assert.match(result.code,/read\("unset",\(\)=>\((?:undefined|void 0)\)\)/);}
});
test('Svelte retained object state preserves identity and skips initializer effects only on template revisions',()=>{
 const registry=state.createRegistry(),props={},form={name:'Ada',rows:['A']};let initialized=0;
 let current=registry('App','script','one',props),value=current.read('form',()=>{initialized++;return form;});current.capture('form',()=>value);form.name='Lin';form.rows.push('B');
 current=registry('App','script','two',props);value=current.read('form',()=>{initialized++;return {};});assert.equal(value,form);assert.deepEqual(value.rows,['A','B']);assert.equal(initialized,1);current.capture('form',()=>value);
 assert.notEqual(registry('App','changed','three',props).read('form',()=>({})),form);
});
test('Svelte async rune initialization stays under compiler promise scheduling',()=>{
 const input='<script>async function load(){return {value:1}}let data=$state(await load());</script><p>{data.value}</p>',info=state.metadata(input,'Async.svelte'),compiled=compiler.compile(input,{filename:'Async.svelte',dev:true,hmr:true,experimental:{async:true}}).js.code;
 assert.equal(state.transform(compiled,'Async.svelte',info),null);
});
