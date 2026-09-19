'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const P=require('../src/prototype-interactions.cjs'),V=require('../shell/prototype-values.js'),{SourceHistory}=require('../src/history.cjs');
const interaction={trigger:'click',action:'navigate',destination:'/next?label=%22%3C%26#details',preserveScroll:true};
for(const [scenario,interactions]of [['navigation',[interaction]],['overlays',[{trigger:'click',action:'open-overlay',destination:'/menu',overlay:V.overlay({width:640,height:480,position:'bottom-right',background:'#12345680',closeOutside:false})},{trigger:'mouseenter',action:'swap-overlay',destination:'/details'},{trigger:'mouseleave',action:'close-overlay'}]]])for(const [name,file,original]of [['html','index.html','<main><button>Continue</button></main>'],['react','App.jsx','export default function App(){return <main><button>Continue</button></main>}'],['liquid','page.liquid','<main><button>Continue</button></main>'],['vue','App.vue','<template><main><button>Continue</button></main></template>']])test(name+' '+scenario+' prototype source round trip, identity preservation, stale writes and exact undo',t=>{
 const adapter=require('../src/adapters/'+name+'.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-prototype-')),absolute=path.join(root,file);t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(absolute,original);
 function resolve(source){const elements=adapter.collect(source,file).elements;return {appRoot:root,file:absolute,relPath:file,source,hash:adapter.contentHash(source),elements,element:elements.find(e=>(e.tag||e.node?.openingElement?.name.name)==='button')};}
 const before=resolve(original),history=new SourceHistory(),plan=P.plan(before,{type:'setPrototypeInteractions',fileHash:before.hash,interactions},adapter);assert.equal(plan.ok,true,plan.reason);const result=history.commit(root,plan);assert.equal(result.ok,true,result.reason);
 const after=fs.readFileSync(absolute,'utf8');assert.deepEqual(P.describe(resolve(after),adapter).prototypeInteractions,interactions);assert.equal(resolve(after).element.id,before.element.id);assert.equal(P.plan(resolve(after),{fileHash:before.hash,interactions:[]},adapter).ok,false);
 assert.equal(history.apply(root,'undo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(absolute,'utf8'),original);assert.equal(history.apply(root,'redo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(absolute,'utf8'),after);
 const current=resolve(after),remove=P.plan(current,{type:'setPrototypeInteractions',fileHash:current.hash,interactions:[]},adapter);assert.equal(remove.ok,true,remove.reason);assert.deepEqual(P.describe(resolve(remove.edits[0].after),adapter).prototypeInteractions,[]);
 const reordered=after.replace('<main>','<main><p>New sibling</p>');assert.deepEqual(P.describe(resolve(reordered),adapter).prototypeInteractions,interactions,'interaction stays on the button after sibling insertion');
});
test('prototype routes and actions reject executable, external and editor destinations',()=>{
 for(const destination of ['javascript:alert(1)','https://example.com','//example.com','/\\example.com','/rt','/x/../rt/__api/op','/%72t/','/%zz','/a\nb'])assert.throws(()=>V.validate([{trigger:'click',action:'navigate',destination}]));
 assert.deepEqual(V.validate([{trigger:'mouseenter',action:'back'}]),[{trigger:'mouseenter',action:'back'}]);
 for(const value of [[{trigger:'click',action:'eval'}],[interaction,interaction],[{trigger:'click',action:'back',destination:'/'}],[{trigger:'click',action:'scroll',destination:''}],[{...interaction,code:'alert(1)'}]])assert.throws(()=>V.validate(value));
});
test('runtime-controlled JSX/Vue attributes and Liquid expressions are not overwritten',()=>{
 for(const [name,file,source]of [['react','App.jsx','export default ()=> <button {...props}/>'],['vue','App.vue','<template><button v-bind="props"/></template>'],['liquid','page.liquid','<button data-rt-prototype="{{ interaction }}">Go</button>']]){
  const adapter=require('../src/adapters/'+name+'.cjs'),elements=adapter.collect(source,file).elements,element=elements.find(e=>(e.tag||e.node?.openingElement?.name.name)==='button'),resolved={source,relPath:file,element,elements,hash:adapter.contentHash(source)};
  assert.equal(P.describe(resolved,adapter).prototypeEditable,false,name);assert.equal(P.plan(resolved,{fileHash:resolved.hash,interactions:[interaction]},adapter).ok,false,name);
 }
});

test('overlay settings are bounded and only Open overlay authors placement',()=>{
 const action={trigger:'click',action:'open-overlay',destination:'/menu'};assert.deepEqual(V.validate([action])[0].overlay,V.overlay());
 for(const overlay of [{width:0},{height:9000},{width:1.5},{position:'elsewhere'},{background:'url(/x)'},{closeOutside:'false'},{extra:true}])assert.throws(()=>V.validate([{...action,overlay}]));
 for(const action of ['navigate','swap-overlay','close-overlay'])assert.throws(()=>V.validate([{trigger:'click',action,destination:'/menu',overlay:V.overlay()}]));
 assert.deepEqual(V.validate([{trigger:'click',action:'close-overlay'}]),[{trigger:'click',action:'close-overlay'}]);
});
