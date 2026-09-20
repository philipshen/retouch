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
test('Svelte structural HMR migrates only proved surviving child scopes and initializes copies',()=>{
 const registry=state.createRegistry(),props={},oldParent=registry('App','script','one',props,{shape:'before'}),one=registry('Tile','tile','tile',{'data-rt-i':'one'},{parent:oldParent.scope,shape:'tile'}),two=registry('Tile','tile','tile',{'data-rt-i':'two'},{parent:oldParent.scope,shape:'tile'});one.capture('count',()=>3);two.capture('count',()=>7);
 registry.begin();one.dispose();two.dispose();oldParent.dispose();const parent=registry('App','script','two',props,{shape:'after',migrations:[{from:'before',to:'after',pairs:[['one','one'],['two','three']]}]});
 const restored=registry('Tile','tile','tile',{'data-rt-i':'one'},{parent:parent.scope,shape:'tile'}),copy=registry('Tile','tile','tile',{'data-rt-i':'two'},{parent:parent.scope,shape:'tile'}),neighbor=registry('Tile','tile','tile',{'data-rt-i':'three'},{parent:parent.scope,shape:'tile'});assert.equal(restored.read('count',()=>0),3);assert.equal(copy.read('count',()=>0),0);assert.equal(neighbor.read('count',()=>0),7);registry.end();
 neighbor.capture('count',()=>9);neighbor.dispose();assert.equal(registry('Tile','tile','tile',{'data-rt-i':'three'},{parent:parent.scope,shape:'tile'}).read('count',()=>0),0);
});
test('Svelte scope migration isolates repeated instances by current DOM order and nested parent',()=>{
 const registry=state.createRegistry(),props={},parent=registry('App','script','one',props,{shape:'a'}),anchor=n=>({compareDocumentPosition(other){return n<other.n?4:n>other.n?2:0;},n}),a=registry('Wrapper','wrapper','w',{'data-rt-i':'repeat'},{parent:parent.scope,shape:'w',anchor:anchor(2)}),b=registry('Wrapper','wrapper','w',{'data-rt-i':'repeat'},{parent:parent.scope,shape:'w',anchor:anchor(1)}),childA=registry('Tile','tile','t',{'data-rt-i':'nested'},{parent:a.scope,shape:'t'}),childB=registry('Tile','tile','t',{'data-rt-i':'nested'},{parent:b.scope,shape:'t'});childA.capture('value',()=>11);childB.capture('value',()=>22);
 registry.begin();for(const old of [childA,childB,a,b,parent])old.dispose();const next=registry('App','script','two',props,{shape:'b',migrations:[{from:'a',to:'b',pairs:[['repeat','repeat']]}]}),first=registry('Wrapper','wrapper','w',{'data-rt-i':'repeat'},{parent:next.scope,shape:'w'}),second=registry('Wrapper','wrapper','w',{'data-rt-i':'repeat'},{parent:next.scope,shape:'w'});
 assert.equal(registry('Tile','tile','t',{'data-rt-i':'nested'},{parent:first.scope,shape:'t'}).read('value',()=>0),22);assert.equal(registry('Tile','tile','t',{'data-rt-i':'nested'},{parent:second.scope,shape:'t'}).read('value',()=>0),11);registry.end();
});
test('Svelte unproved structural edits and script changes cannot migrate child state',()=>{
 for(const change of [{script:'script',shape:'b',migrations:[]},{script:'changed',shape:'b',migrations:[{from:'a',to:'b',pairs:[['child','child']]}]}]){const registry=state.createRegistry(),props={},parent=registry('App','script','one',props,{shape:'a'}),child=registry('Tile','tile','t',{'data-rt-i':'child'},{parent:parent.scope,shape:'t'});child.capture('value',()=>7);registry.begin();child.dispose();parent.dispose();const next=registry('App',change.script,'two',props,change);assert.equal(registry('Tile','tile','t',{'data-rt-i':'child'},{parent:next.scope,shape:'t'}).read('value',()=>0),0);registry.end();}
});
test('Svelte stateless wrappers establish scopes in both compiler context modes',()=>{
 for(const dev of [true,false]){const input='<section/>',info=state.metadata(input,'Wrapper.svelte'),compiled=compiler.compile(input,{filename:'Wrapper.svelte',dev,hmr:true}).js.code,result=state.transform(compiled,'Wrapper.svelte',info);assert.ok(result);require('@babel/parser').parse(result.code,{sourceType:'module'});assert.match(result.code,/componentState/);assert.ok(result.code.indexOf('.push(')<result.code.indexOf('const __retouch_component_state ='));}
});
test('Svelte migration follows caller-owned snippet IDs through unchanged receiving components',()=>{
 const registry=state.createRegistry(),props={},parent=registry('App','app','one',props,{shape:'a'}),receiver=registry('Tile','tile','t',{'data-rt-i':'receiver'},{parent:parent.scope,shape:'t'}),slot=registry('Slot','slot','s',{'data-rt-i':'caller-slot'},{parent:receiver.scope,shape:'s'});slot.capture('value',()=>17);
 registry.begin();slot.dispose();receiver.dispose();parent.dispose();const next=registry('App','app','two',props,{shape:'b',migrations:[{from:'a',to:'b',pairs:[['receiver','new-receiver'],['caller-slot','new-slot']],ids:['receiver','caller-slot']}]}),receiving=registry('Tile','tile','t',{'data-rt-i':'new-receiver'},{parent:next.scope,shape:'t'}),restored=registry('Slot','slot','s',{'data-rt-i':'new-slot'},{parent:receiving.scope,shape:'s'});assert.equal(restored.read('value',()=>0),17);registry.end();
});
test('Svelte committed import-only insertion proofs retain state without accepting arbitrary script changes',()=>{
 const {createRegistry}=require('../src/svelte-component-state.cjs'),registry=createRegistry(),props={},old=registry('App.svelte','before-script','before',props,{shape:'before-shape'});old.capture('count',()=>7);registry.begin();const edge={from:'before-shape',to:'after-shape',fromScript:'before-script',toScript:'after-script',pairs:[]},next=registry('App.svelte','after-script','after',props,{shape:'after-shape',migrations:[edge]});assert.equal(next.read('count',()=>0),7);next.capture('count',()=>9);registry.end();registry.begin();const unrelated=registry('App.svelte','external-script','external',props,{shape:'after-shape',migrations:[edge]});assert.equal(unrelated.read('count',()=>0),0);registry.end();
 const fresh=registry('App.svelte','before-script','before',{}, {shape:'before-shape'});fresh.capture('count',()=>11);registry.begin();const other=registry('App.svelte','after-script','after',{}, {shape:'after-shape',migrations:[edge]});assert.equal(other.read('count',()=>0),0);registry.end();
});
