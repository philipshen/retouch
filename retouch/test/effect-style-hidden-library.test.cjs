'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../shell/shadow-visibility.js'),C=require('../src/effect-style-classes.cjs'),catalog=require('../src/effect-styles.cjs'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),links=require('../src/html-effect-styles.cjs');
const shadow={x:2,y:4,blur:8,spread:0,color:'color(display-p3 0.2 0.4 0.6 / 0.75)',inset:false,hidden:true},values=S.write([shadow]),style={id:'11111111-1111-4111-8111-111111111111',name:'Hidden',properties:values},source='<html><head></head><body><p>Effects</p></body></html>';
const resolve=source=>({source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(e=>e.tag==='p')}),apply=(source,definition,type='applyEffectStyle')=>{const result=links.plan(resolve(source),{type,width:768},definition);assert.equal(result.ok,true,result.reason);return result.edits[0]?.after||source;};
test('effect library preserves validated hidden shadows and rejects orphaned or stale metadata',()=>{
 assert.deepEqual(catalog.validate({version:1,styles:[style]}).styles[0],style);
 for(const properties of [{[S.property]:values[S.property]},{...values,'box-shadow':'none'},{...values,[S.property]:'invalid'}])assert.throws(()=>catalog.validate({version:1,styles:[{...style,properties}]}),{statusCode:422});
});
test('class effect styles apply and refresh hidden shadow metadata as one effect',()=>{
 const original=C.compose('p-4',values,'md:');assert.deepEqual(C.overrides(original,values,'md:'),[]);assert.ok(original.includes('md:!['+S.property+':'+values[S.property]+']'));
 const next=S.write([{...shadow,x:19}]),fresh=C.refresh(original,values,next,'md:');assert.deepEqual(fresh.overrides,[]);assert.deepEqual(C.overrides(fresh.classes,next,'md:'),[]);
 const local=S.classes(original,'md:',S.write([{...shadow,hidden:false}])),kept=C.refresh(local,values,next,'md:');assert.equal(kept.classes,local);assert.deepEqual(kept.overrides,['box-shadow']);
 const visible={'box-shadow':'none'},shown=C.refresh(original,values,visible,'md:');assert.deepEqual(shown.overrides,[]);assert.deepEqual(C.overrides(shown.classes,visible,'md:'),[]);assert.ok(!shown.classes.includes('rtsh1-'));
});
test('HTML hidden effect apply, refresh, local visibility override and reset remain atomic',()=>{
 let current=apply(source,style);assert.deepEqual(css.describe(resolve(current)).cssRules[768],values);assert.deepEqual(links.describe(resolve(current)).effectStyleOverrides[768],[]);
 const next={...style,properties:S.write([{...shadow,x:19}])};current=apply(current,next,'refreshEffectStyle');assert.deepEqual(css.describe(resolve(current)).cssRules[768],next.properties);
 const own=css.plan(resolve(current),{width:768,changes:S.write([{...shadow,x:19,hidden:false}])});assert.equal(own.ok,true,own.reason);current=own.edits[0].after;const before=css.describe(resolve(current)).cssRules[768];current=apply(current,style,'refreshEffectStyle');assert.deepEqual(css.describe(resolve(current)).cssRules[768],before);assert.deepEqual(links.describe(resolve(current)).effectStyleOverrides[768],['box-shadow']);
 current=apply(current,style,'resetEffectStyle');assert.deepEqual(css.describe(resolve(current)).cssRules[768],values);assert.deepEqual(links.describe(resolve(current)).effectStyleOverrides[768],[]);
 current=apply(current,{...style,properties:{'box-shadow':'none'}},'refreshEffectStyle');assert.deepEqual(css.describe(resolve(current)).cssRules[768],{'box-shadow':'none',[S.property]:'none'});
 current=apply(current,style,'refreshEffectStyle');assert.deepEqual(css.describe(resolve(current)).cssRules[768],values);
 current=apply(current,{...style,properties:{filter:'blur(2px)'}},'refreshEffectStyle');assert.deepEqual(css.describe(resolve(current)).cssRules[768],{filter:'blur(2px)'});
});
