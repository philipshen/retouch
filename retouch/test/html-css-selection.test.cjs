'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),selection=require('../src/html-css-selection.cjs');
const source='<html><head></head><body><main><h1>Title</h1><p>Paragraph</p><img src="x.png"></main></body></html>';
function resolve(source){const elements=html.collect(source,'index.html').elements;return {source,hash:html.contentHash(source),file:'/tmp/index.html',relPath:'index.html',elements,element:elements.find(e=>e.tag==='h1')};}
function operation(r,extra={}){return {ids:r.elements.filter(e=>['h1','p'].includes(e.tag)).map(e=>e.id),fileHash:r.hash,width:768,property:'width',value:'240px',...extra};}
test('HTML shared styling returns one atomic source edit with isolated responsive identities',()=>{
 const r=resolve(source),result=selection.plan(r,operation(r));assert.equal(result.ok,true);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,source);assert.equal(result.selection.length,2);
 for(const info of result.selection)assert.deepEqual(info.cssRules,{768:{width:'240px'}});
 const fresh=resolve(result.edits[0].after);assert.deepEqual(css.describe({...fresh,element:fresh.elements.find(e=>e.tag==='img')}).cssRules,{});
 assert.equal(new Set(result.selection.map(info=>fresh.elements.find(e=>e.id===info.id).node.attrs.find(a=>a.name==='data-rt-style').value)).size,2);
 const noop=selection.plan(fresh,operation(fresh));assert.deepEqual(noop.edits,[]);
 const reset=selection.plan(fresh,operation(fresh,{value:null}));assert.equal(reset.ok,true);for(const info of reset.selection)assert.deepEqual(info.cssRules,{});
});
test('HTML shared styling refuses the entire edit when any selected layer conflicts',()=>{
 const r=resolve(source.replace('<p>','<p style="width:100px !important">'));
 const result=selection.plan(r,operation(r));assert.equal(result.refused,true);assert.equal(result.edits,undefined);assert.equal(r.source,source.replace('<p>','<p style="width:100px !important">'));
 const invalid=selection.plan(r,operation(r,{property:'color',value:'red;display:none'}));assert.equal(invalid.refused,true);
});
test('HTML shared styling refuses stale, unknown, duplicate and non-body selections',()=>{
 const r=resolve(source),ids=operation(r).ids;
 for(const extra of [{fileHash:'stale'},{fileHash:undefined},{ids:[ids[0],ids[0]]},{ids:[ids[0],'0000000000']},{ids:[ids[0],r.elements.find(e=>e.tag==='head').id]},{ids:[ids[0]]},{ids:['not-an-id',ids[0]]}])assert.equal(selection.plan(r,operation(r,extra)).refused,true);
});
test('individual layer change sets form one atomic edit and reject partial or mixed maps',()=>{
 const r=resolve(source),ids=operation(r).ids,op={ids,fileHash:r.hash,width:768,changesById:{[ids[0]]:{left:'20px',width:'80px'},[ids[1]]:{left:'100px',width:'120px'}}},result=selection.plan(r,op);
 assert.equal(result.ok,true);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,source);assert.deepEqual(result.selection.map(info=>info.cssRules[768]),Object.values(op.changesById));
 const fresh=resolve(result.edits[0].after);assert.deepEqual(selection.plan(fresh,{...op,fileHash:fresh.hash}).edits,[]);
 for(const extra of [{property:'width'},{value:null},{changes:{}},{changesById:null},{changesById:[]},{changesById:{[ids[0]]:{left:'20px'}}},{changesById:{...op.changesById,'0000000000':{left:'0px'}}},{changesById:{[ids[0]]:{left:'20px'},[ids[1]]:{left:'red'}}}])assert.equal(selection.plan(r,{...op,...extra}).refused,true);
 const protectedSource=source.replace('<p>','<p style="left:100px!important">'),protectedResult=selection.plan(resolve(protectedSource),{...op,fileHash:html.contentHash(protectedSource)});assert.equal(protectedResult.refused,true);assert.equal(protectedResult.edits,undefined);
});
test('unchanged reference layers remain byte-for-byte untouched while other layers change atomically',()=>{
 const original=source.replace('<p>','<p style="left:100px!important">'),r=resolve(original),ids=operation(r).ids,op={ids,fileHash:r.hash,width:0,changesById:{[ids[0]]:{left:'100px'},[ids[1]]:{}}},result=selection.plan(r,op);
 assert.equal(result.ok,true);assert.match(result.edits[0].after,/<p style="left:100px!important">Paragraph<\/p>/);assert.deepEqual(result.selection[1].cssRules,{});assert.deepEqual(result.selection[0].cssRules,{0:{left:'100px'}});
 const unchanged={...op,changesById:Object.fromEntries(ids.map(id=>[id,{}]))};assert.deepEqual(selection.plan(r,unchanged).edits,[]);
 for(const width of [undefined,-1,7681,1.5])assert.equal(selection.plan(r,{...unchanged,width}).refused,true);
});

test('HTML shared CSS edits retain linked typography metadata and updated override counts',()=>{
 const links=require('../src/html-text-styles.cjs'),style={id:'11111111-1111-4111-8111-111111111111',name:'Heading',properties:{'font-size':'32px','line-height':'1.4'}};let current=source;
 for(const id of operation(resolve(source)).ids){const r=resolve(current),result=links.plan({...r,element:r.elements.find(e=>e.id===id)},{type:'applyTextStyle',width:768},style);assert.equal(result.ok,true,result.reason);current=result.edits[0].after;}
 const r=resolve(current),result=selection.plan(r,operation(r,{property:'line-height',value:'2'}));assert.equal(result.ok,true,result.reason);
 for(const info of result.selection){assert.equal(info.textStyleLinks[768].id,style.id);assert.deepEqual(info.textStyleOverrides[768],['line-height']);}
});
