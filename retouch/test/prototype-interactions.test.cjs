'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const P=require('../src/prototype-interactions.cjs'),V=require('../shell/prototype-values.js'),{SourceHistory}=require('../src/history.cjs');
const interaction={trigger:'click',action:'navigate',destination:'/next?label=%22%3C%26#details',preserveScroll:true};
for(const [scenario,interactions]of [['external-link',[{trigger:'click',action:'open-link',destination:'https://example.com/details?x=1&y=2#part'}]],['smart-motion',[{trigger:'click',action:'navigate',destination:'/next',preserveScroll:false,transition:{type:'smart-animate',duration:1000,easing:'linear'}},{trigger:'mouseenter',action:'swap-overlay',destination:'/alt',transition:{type:'smart-animate',duration:400,easing:'ease-in-out'}}]],['navigation-motion',[{trigger:'click',action:'navigate',destination:'/next',preserveScroll:true,transition:{type:'push',direction:'left',duration:800,easing:'ease-in-out'}},{trigger:'mouseenter',action:'back',transition:{type:'dissolve',duration:400,easing:'linear'}}]],['scroll-motion',[{trigger:'click',action:'scroll',destination:'section',scrollOffset:{x:12.5,y:-80},transition:{type:'animate',duration:750,easing:'ease-in-out'}}]],['keyboard',[{trigger:'keyboard',shortcut:{code:'KeyK',ctrl:false,alt:false,shift:true,meta:false},action:'navigate',destination:'/menu',preserveScroll:false},{trigger:'keyboard',shortcut:{code:'KeyL',ctrl:false,alt:false,shift:true,meta:false},action:'back'}]],['triggers',[{trigger:'mousedown',action:'open-overlay',destination:'/menu',overlay:V.overlay()},{trigger:'mouseup',action:'navigate',destination:'/details',preserveScroll:false},{trigger:'after-delay',delay:1500,action:'back'}]],['springs',[{trigger:'click',action:'open-overlay',destination:'/menu',overlay:V.overlay(),transition:V.transition({type:'move-in',easing:{type:'spring',stiffness:200,damping:10,mass:1}},'open-overlay')}]],['custom-curves',[{trigger:'click',action:'open-overlay',destination:'/menu',overlay:V.overlay(),transition:{type:'move-in',duration:700,direction:'left',easing:{type:'cubic-bezier',values:[.2,-.4,.8,1.4]}}}]],['motion',[{trigger:'click',action:'open-overlay',destination:'/menu',overlay:V.overlay(),transition:{type:'slide-in',duration:700,direction:'left',easing:'ease-in-out'}},{trigger:'mouseenter',action:'swap-overlay',destination:'/alt',transition:{type:'push',duration:600,direction:'right',easing:'linear'}},{trigger:'mouseleave',action:'close-overlay',transition:{type:'move-out',duration:400,direction:'bottom',easing:'ease-in'}}]],['navigation',[interaction]],['overlays',[{trigger:'click',action:'open-overlay',destination:'/menu',overlay:V.overlay({width:640,height:480,position:'bottom-right',background:'#12345680',closeOutside:false})},{trigger:'mouseenter',action:'swap-overlay',destination:'/details'},{trigger:'mouseleave',action:'close-overlay'}]]])for(const [name,file,original]of [['html','index.html','<main><button>Continue</button></main>'],['react','App.jsx','export default function App(){return <main><button>Continue</button></main>}'],['liquid','page.liquid','<main><button>Continue</button></main>'],['vue','App.vue','<template><main><button>Continue</button></main></template>']])test(name+' '+scenario+' prototype source round trip, identity preservation, stale writes and exact undo',t=>{
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

test('transition grammar constrains action semantics, timing and CSS values',()=>{
 const item={trigger:'click',action:'open-overlay',destination:'/menu'};
 for(const transition of [{type:'push'},{type:'slide-out'},{type:'dissolve',duration:0},{type:'dissolve',duration:10001},{type:'dissolve',duration:2.5},{type:'dissolve',easing:'steps(2)'},{type:'move-in',direction:'diagonal'},{type:'dissolve',direction:'left'},{type:'dissolve',extra:true}])assert.throws(()=>V.validate([{...item,transition}]));
 assert.equal(V.validate([{...item,action:'navigate',transition:{type:'dissolve'}}])[0].transition.type,'dissolve');
 assert.deepEqual(V.transition({type:'move-in'},'open-overlay'),{type:'move-in',duration:300,easing:'ease-out',direction:'right'});
 assert.deepEqual(V.transition({type:'instant'},'swap-overlay'),{type:'instant'});
});

test('custom easing validates numeric control points without admitting arbitrary CSS',()=>{
 const custom={type:'cubic-bezier',values:[.25,-.5,.75,1.5]};
 assert.deepEqual(V.easing(custom),custom);assert.notEqual(V.easing(custom).values,custom.values);
 assert.equal(V.easingCss(custom),'cubic-bezier(0.25, -0.5, 0.75, 1.5)');
 for(const value of ['cubic-bezier(0,0,1,1)',null,{},[],{...custom,extra:1},...[[-.01,0,1,1],[0,0,1.01,1],[0,NaN,1,1],[0,Infinity,1,1],[0,'0',1,1],[0,0,1],[0,0,1,1,2],[0,10001,1,1]].map(values=>({...custom,values}))])assert.throws(()=>V.easing(value));
 for(const preset of V.easings)assert.equal(V.easingCss(preset),preset);
});

test('delayed triggers need bounded integer times and each trigger is unique',()=>{
 for(const delay of [undefined,0,-1,10001,1.5,'800',NaN])assert.throws(()=>V.validate([{trigger:'after-delay',action:'back',delay}]));
 assert.throws(()=>V.validate([{trigger:'click',action:'back',delay:800}]));
 assert.throws(()=>V.validate([{trigger:'mouseup',action:'back'},{trigger:'mouseup',action:'back'}]));
 const all=V.triggers.map(trigger=>({trigger,action:'back',...(trigger==='after-delay'?{delay:1}:trigger==='keyboard'?{shortcut:{code:'KeyK',ctrl:false,alt:false,shift:false,meta:false}}:{})}));assert.deepEqual(V.validate(all),all);
});

test('scroll motion accepts bounded offsets and excludes directional transitions',()=>{
 const item={trigger:'click',action:'scroll',destination:'section'};
 assert.deepEqual(V.transition({type:'animate'},'scroll'),{type:'animate',duration:300,easing:'ease-out'});
 for(const scrollOffset of [null,[],{}, {x:0}, {x:0,y:'2'}, {x:Infinity,y:0}, {x:0,y:100001}, {x:0,y:0,z:1}])assert.throws(()=>V.validate([{...item,scrollOffset}]));
 for(const transition of [{type:'move-in'}, {type:'dissolve'}, {type:'animate',direction:'left'}, {type:'animate',duration:0}])assert.throws(()=>V.validate([{...item,transition}]));
 assert.throws(()=>V.validate([{trigger:'click',action:'back',scrollOffset:{x:0,y:0}}]));
 assert.deepEqual(V.validate([item]),[item],'legacy instant scrolling remains valid');
});

test('Smart Animate is directional-free and limited to navigation, Back and overlay swaps',()=>{for(const action of ['navigate','back','swap-overlay'])assert.deepEqual(V.transition({type:'smart-animate'},action),{type:'smart-animate',duration:300,easing:'ease-out'});for(const action of ['scroll','open-overlay','close-overlay'])assert.throws(()=>V.transition({type:'smart-animate'},action));assert.throws(()=>V.transition({type:'smart-animate',direction:'left'},'navigate'));});

test('prototype links accept only explicit HTTP(S) destinations without credentials',()=>{for(const destination of ['https://example.com/a?x=1#part','http://localhost:9400/'])assert.doesNotThrow(()=>V.validate([{trigger:'click',action:'open-link',destination}]));for(const destination of ['javascript:alert(1)','data:text/html,hi','file:///tmp/x','mailto:me@example.com','//example.com','/next','https://name:secret@example.com/','https://example.com/\\path','https://example.com/ a'])assert.throws(()=>V.validate([{trigger:'click',action:'open-link',destination}]));assert.throws(()=>V.validate([{trigger:'click',action:'open-link',destination:'https://example.com',transition:{type:'dissolve'}}]));});
