'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{stackLayout,flexAlignment,adaptiveColumns,parseAdaptiveColumns,valid,overlaps}=require('../shell/html-css-values.js'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs');
test('Stack controls choose physical horizontal and vertical axes across writing modes',()=>{
 for(const mode of ['horizontal-tb','vertical-rl','vertical-lr','sideways-rl','sideways-lr'])for(const axis of ['horizontal','vertical']){
  const changes=stackLayout(axis,mode);assert.equal(changes.display,'flex');assert.equal(changes['flex-wrap'],'nowrap');assert.equal(changes['flex-direction'],(axis==='horizontal')===(mode==='horizontal-tb')?'row':'column');
 }
});
test('Alignment control maps physical positions through RTL, reversed flex and vertical writing',()=>{
 const cases=[
  [{},['flex-start','flex-start']],
  [{direction:'rtl'},['flex-end','flex-start']],
  [{flexDirection:'row-reverse'},['flex-end','flex-start']],
  [{direction:'rtl',flexDirection:'column'},['flex-start','flex-end']],
  [{writingMode:'vertical-rl'},['flex-start','flex-end']],
  [{writingMode:'vertical-lr',flexDirection:'column-reverse'},['flex-end','flex-start']],
  [{writingMode:'sideways-lr'},['flex-end','flex-start']]
 ];
 for(const [state,expected]of cases){const topLeft=flexAlignment(0,0,state);assert.deepEqual(Object.values(topLeft),expected);assert.deepEqual(Object.values(flexAlignment(1,1,state)),['center','center']);assert.deepEqual(Object.values(flexAlignment(2,2,state)),expected.map(v=>v==='flex-start'?'flex-end':'flex-start'));for(const [property,value]of Object.entries(topLeft))assert.equal(valid(property,value),true);}
});
test('Stack and alignment changes form one responsive source edit and refuse conflicting declarations atomically',()=>{
 const source='<html><head></head><body><main><p>One</p><p>Two</p></main></body></html>',elements=html.collect(source,'index.html').elements,r={source,elements,element:elements.find(e=>e.tag==='main'),hash:html.contentHash(source),file:'/tmp/index.html',relPath:'index.html'},changes={...stackLayout('horizontal'),...flexAlignment(2,2)};
 const result=css.plan(r,{changes,width:768,fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);const after=result.edits[0].after,next=html.collect(after,'index.html').elements;assert.deepEqual(css.describe({...r,source:after,elements:next,element:next.find(e=>e.tag==='main')}).cssRules,{768:changes});
 const conflict=source.replace('<main>','<main style="display:block !important">'),items=html.collect(conflict,'index.html').elements,refusal=css.plan({...r,source:conflict,hash:html.contentHash(conflict),elements:items,element:items.find(e=>e.tag==='main')},{changes,width:768});assert.equal(refusal.refused,true);assert.equal(refusal.edits,undefined);
});

test('Wrapping alignment moves the line group and reverses the cross axis for reverse wrapping',()=>{
 for(const mode of ['horizontal-tb','vertical-rl','vertical-lr'])for(const direction of ['row','column','row-reverse','column-reverse']){
  const state={writingMode:mode,flexDirection:direction},single=flexAlignment(0,0,state),normal=flexAlignment(0,0,{...state,flexWrap:'wrap'}),reverse=flexAlignment(0,0,{...state,flexWrap:'wrap-reverse'});
  assert.equal(normal['align-content'],single['align-items']);assert.equal(reverse['align-content'],single['align-items']==='flex-start'?'flex-end':'flex-start');assert.equal(reverse['align-items'],reverse['align-content']);assert.equal(reverse['justify-content'],single['justify-content']);
  for(const [p,v]of Object.entries(reverse))assert.equal(valid(p,v),true);
 }
});

test('Adaptive columns permit bounded exact syntax while keeping rows and injected values out',()=>{
 for(const size of [1,240,2000]){const value=adaptiveColumns(size);assert.equal(parseAdaptiveColumns(value),size);assert.equal(valid('grid-template-columns',value),true);assert.equal(valid('grid-template-rows',value),false);}
 for(const size of [0,-1,2001,1.5,NaN])assert.equal(adaptiveColumns(size),null);
 for(const value of ['repeat(auto-fit, minmax(min(100%, 2001px), 1fr))','repeat(auto-fit, minmax(min(100%, 0px), 1fr))',adaptiveColumns(240)+';color:red','repeat(auto-fit, minmax(var(--x), 1fr))'])assert.equal(valid('grid-template-columns',value),false);
});

test('Frame aspect ratios reject zero and injection; clipping conflicts include both overflow axes',()=>{
 for(const value of [null,'auto','1','1 / 1','16 / 9','auto 4 / 3','0.5','1/2'])assert.equal(valid('aspect-ratio',value),true);
 for(const value of ['0','1 / 0','-1','calc(1)','1;display:none','10001 / 1'])assert.equal(valid('aspect-ratio',value),false);
 for(const axis of ['overflow-x','overflow-y']){assert.equal(overlaps('overflow',axis),true);assert.equal(overlaps(axis,'overflow'),true);}
 assert.equal(overlaps('overflow-x','overflow-y'),false);
});

test('Visibility writes preserve authored display and can override or reset at another screen',()=>{
 const source='<html><head></head><body><main style="display:flex"><p>Text</p></main></body></html>';
 const resolve=text=>{const elements=html.collect(text,'index.html').elements;return {source:text,elements,element:elements.find(e=>e.tag==='main'),hash:html.contentHash(text),file:'/tmp/index.html',relPath:'index.html'};};
 let r=resolve(source);const hidden=css.plan(r,{property:'visibility',value:'hidden',width:0});assert.equal(hidden.ok,true);r=resolve(hidden.edits[0].after);assert.ok(r.source.includes('style="display:flex"'));
 const shown=css.plan(r,{property:'visibility',value:'visible',width:768});assert.equal(shown.ok,true);r=resolve(shown.edits[0].after);assert.deepEqual(css.describe(r).cssRules,{0:{visibility:'hidden'},768:{visibility:'visible'}});
 const reset=css.plan(r,{property:'visibility',value:null,width:768});assert.equal(reset.ok,true);assert.deepEqual(css.describe(resolve(reset.edits[0].after)).cssRules,{0:{visibility:'hidden'}});
 assert.equal(valid('visibility','hidden;display:none'),false);
});


test('custom grid track validation accepts bounded track lists and rejects injected or invalid expressions',()=>{
 for(const axis of ['columns','rows']){
  const property='grid-template-'+axis;
  for(const value of ['160px 1fr','80px minmax(0, 1fr)','repeat(3, minmax(0, 1fr))','[content_start] 80px [rest] 1fr','auto 1fr','fit-content(30%) 2fr','var(--track_size) 1fr','var(--missing, 80px) 1fr','minmax(var(--minimum, 20px), 1fr)','fit-content(var(--limit, 30%)) 1fr'])assert.equal(valid(property,value),true,value);
  for(const value of ['','[name]','minmax(1fr, 80px)','repeat(999, 1fr)','repeat(2, repeat(2, 1fr))','1fr; color:red','url(x)','var(bad)','var(--x, url(x))','minmax(var(--x, 1fr), 80px)','1fr]','[span] 1fr','repeat(2,,1fr)'])assert.equal(valid(property,value),false,value);
 }
});
