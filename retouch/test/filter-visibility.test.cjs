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
test('quick blur edits preserve visibility and other filter expressions',()=>{
 const next=F.withBlur(model,23);assert.equal(next[0].raw,'blur(23px)');assert.equal(next[0].hidden,true);assert.deepEqual(next.slice(1),model.slice(1));assert.deepEqual(F.withBlur(model,0),model.slice(1));assert.equal(F.withBlur([],5)[0].hidden,false);assert.throws(()=>F.withBlur([model[0],model[0]],5));
});
test('saved filter libraries propagate paired values, preserve local overrides and reset together',()=>{
 const catalog=require('../src/effect-styles.cjs'),C=require('../src/effect-style-classes.cjs'),links=require('../src/html-effect-styles.cjs'),before='<html><head></head><body><p>Filters</p></body></html>';
 for(const property of Object.keys(F.properties)){
  const key=F.properties[property],values=F.write(property,model),next=F.write(property,F.withBlur(model,23)),style={id:'11111111-1111-4111-8111-111111111111',name:'Hidden',properties:values};assert.deepEqual(catalog.validate({version:1,styles:[style]}).styles[0],style);assert.throws(()=>catalog.validate({version:1,styles:[{...style,properties:{[key]:values[key]}}]}));
  const classes=C.compose('p-4',values,'md:');assert.deepEqual(C.overrides(classes,values,'md:'),[]);const retained=C.refresh(classes,values,next,'md:',[key]);assert.equal(retained.classes,classes);assert.deepEqual(retained.overrides,[property]);const refresh=C.refresh(classes,values,next,'md:');assert.deepEqual(refresh.overrides,[]);assert.deepEqual(C.overrides(refresh.classes,next,'md:'),[]);const visible=C.compose(classes,{[property]:'none'},'md:');assert.ok(!visible.includes('rtfx1-'));assert.deepEqual(C.refresh(visible,values,next,'md:').overrides,[property]);
  const apply=(source,type,properties)=>{const result=links.plan(resolve(source),{type,width:768},{...style,properties});assert.equal(result.ok,true,result.reason);return result.edits[0]?.after||source;};let source=apply(before,'applyEffectStyle',values);source=apply(source,'refreshEffectStyle',next);assert.deepEqual(css.describe(resolve(source)).cssRules[768],next);
  const local=F.write(property,F.withBlur(model,31)),edited=css.plan(resolve(source),{width:768,changes:local});assert.equal(edited.ok,true,edited.reason);source=apply(edited.edits[0].after,'refreshEffectStyle',values);assert.deepEqual(css.describe(resolve(source)).cssRules[768],local);assert.deepEqual(links.describe(resolve(source)).effectStyleOverrides[768],[property]);source=apply(source,'resetEffectStyle',values);assert.deepEqual(css.describe(resolve(source)).cssRules[768],values);
 }
});
