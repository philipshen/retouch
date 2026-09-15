'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),F=require('../shell/filter-visibility.js'),V=require('../shell/html-css-values.js'),R=require('../shell/responsive.js'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs');
const model=[{raw:'blur(12px)',hidden:true},{raw:'brightness(60%)',hidden:false},{raw:'drop-shadow(2px 4px 8px currentColor)',hidden:true}],resolve=source=>({source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(e=>e.tag==='p')});
test('filter and backdrop visibility preserve hidden settings and order while rendering only visible effects',()=>{
 for(const property of Object.keys(F.properties)){
  const values=F.write(property,model),key=F.properties[property];assert.equal(values[property],'brightness(60%)');assert.deepEqual(F.read(values[property],values[key]),model);assert.deepEqual(F.read('brightness(0.6)',values[key]),model);
  const all=F.write(property,model.map(item=>({...item,hidden:true})));assert.equal(all[property],'none');assert.equal(F.read('none',all[key]).length,3);
  const shown=F.write(property,model.map(item=>({...item,hidden:false})));assert.equal(shown[key],'none');assert.equal(shown[property],model.map(item=>item.raw).join(' '));
 }
});
test('hidden filter edits, duplicate, removal and reorder retain the original expressions',()=>{
 for(const stack of [[{...model[0],raw:'blur(23px)'},...model.slice(1)],[model[2],model[0],model[1]],[model[0],{...model[0]},model[1]],model.slice(1),[]]){const values=F.write('filter',stack);assert.deepEqual(F.read(values.filter,values[F.properties.filter]),stack);}
});
test('invalid or stale filter visibility never silently replaces the current filter stack',()=>{
 const values=F.write('filter',model),key=F.properties.filter;
 for(const rendered of ['none','brightness(0.7)','brightness(0.6) blur(1px)'])assert.throws(()=>F.read(rendered,values[key]));
 for(const value of ['','rtfx1-ff','rtfx1-0','rtfx1-'+ 'aa'.repeat(40000)]){assert.throws(()=>F.read('none',value));assert.equal(V.valid(key,value),false);}
 for(const stack of [[{raw:'url(evil)',hidden:true}],[{raw:'blur(2px)',hidden:1}],[{raw:'blur(2px)',extra:1}],Array.from({length:17},()=>model[0])])assert.throws(()=>F.write('filter',stack));
 const all=Array.from({length:16},(_,i)=>({raw:'blur('+i+'px)',hidden:true})),full=F.write('filter',all);assert.deepEqual(F.read('none',full[key]),all);
});
test('scoped class filter writes preserve the other effect family and screen scopes',()=>{
 const base=F.classes('p-4','', 'filter',F.write('filter',model)),tablet=F.classes(base,'md:','backdrop-filter',F.write('backdrop-filter',model));assert.equal(R.project(tablet,''),R.project(base,''));assert.ok(R.project(tablet,'md:').includes('[--rt-hidden-backdrop-filter:'));
 const reset=F.classes(tablet,'md:','backdrop-filter',{'backdrop-filter':null,'--rt-hidden-backdrop-filter':null});assert.equal(reset,base);
 const replaced=require('../shell/inspector.js').filterClasses(R.project(base,''),'filter','none');assert.ok(!replaced.includes('--rt-hidden-filter'));
});
test('HTML writes filter visibility and rendering atomically, including replacement and reset',()=>{
 const before='<html><head></head><body><p>Filters</p></body></html>',values=F.write('filter',model),key=F.properties.filter;
 const apply=css.plan(resolve(before),{width:768,changes:values});assert.equal(apply.ok,true,apply.reason);assert.equal(apply.edits.length,1);const current=resolve(apply.edits[0].after);assert.deepEqual(css.describe(current).cssRules[768],values);
 for(const changes of [{[key]:values[key]},{filter:'none',[key]:values[key]},{filter:null,[key]:values[key]}]){const result=css.plan(current,{width:768,changes});assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
 const replace=css.plan(current,{width:768,property:'filter',value:'blur(2px)'});assert.equal(replace.ok,true,replace.reason);assert.equal(css.describe(resolve(replace.edits[0].after)).cssRules[768][key],'none');
 const reset=css.plan(current,{width:768,property:'filter',value:null});assert.equal(reset.ok,true,reset.reason);assert.equal(css.describe(resolve(reset.edits[0].after)).cssRules[768]?.[key],undefined);
});
