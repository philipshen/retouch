'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),links=require('../src/html-effect-styles.cjs'),catalog=require('../src/effect-styles.cjs');
const source='<html><head></head><body><p>Effects</p></body></html>',style={id:'11111111-1111-4111-8111-111111111111',name:'Floating',properties:{'box-shadow':'0px 4px 8px 1px rgba(0,0,0,0.3)',filter:'blur(2px)','backdrop-filter':'blur(3px)'}};
function resolve(source){return {source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(e=>e.tag==='p')};}
test('HTML effect styles preserve scoped overrides and detach without changing effects',()=>{
 const applied=links.plan(resolve(source),{type:'applyEffectStyle',width:768},style);assert.equal(applied.ok,true,applied.reason);let r=resolve(applied.edits[0].after);assert.deepEqual(css.describe(r).cssRules[768],style.properties);assert.deepEqual(links.plan(r,{type:'applyEffectStyle',width:768},style).edits,[]);
 const local=css.plan(r,{width:768,property:'filter',value:'blur(4px)'}).edits[0].after,next={...style,properties:{filter:'blur(6px)','box-shadow':'none','backdrop-filter':'none'}},updated=links.planFile(r.file,r.relPath,local,next);assert.equal(updated.ok,true,updated.reason);r=resolve(updated.edits[0].after);assert.equal(css.describe(r).cssRules[768].filter,'blur(4px)');assert.equal(css.describe(r).cssRules[768]['box-shadow'],'none');assert.deepEqual(links.describe(r).effectStyleOverrides[768],['filter']);
 const reset=links.plan(r,{type:'resetEffectStyle',width:768},next);assert.equal(reset.ok,true,reset.reason);r=resolve(reset.edits[0].after);assert.deepEqual(links.describe(r).effectStyleOverrides[768],[]);const detached=links.plan(r,{type:'detachEffectStyle',width:768});assert.equal(detached.ok,true,detached.reason);assert.deepEqual(css.describe(resolve(detached.edits[0].after)),css.describe(r));
});
test('effect catalogs and links reject unsupported source or definitions atomically',()=>{
 for(const properties of [{color:'#fff'},{filter:'url(evil)'},{'box-shadow':'bad; display:none'}])assert.throws(()=>catalog.validate({version:1,styles:[{...style,properties}]}));
 for(const op of [{width:-1},{width:0,fileHash:'stale'}]){const result=links.plan(resolve(source),{type:'applyEffectStyle',...op},style);assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
 const bad=links.planFile('/tmp/index.html','index.html',source.replace('<p>','<p data-rt-effect-styles="bad">'),style);assert.equal(bad.ok,false);assert.equal(bad.edits,undefined);
});
