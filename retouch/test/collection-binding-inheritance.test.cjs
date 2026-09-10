'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{inherited}=require('../shell/collection-bindings.js');
const link={id:'variable',modes:{theme:'dark'},unit:'rem',value:'2rem'};
test('collection inheritance follows each property through unrelated screen rules',()=>{
 const info={variableLinks:{0:{padding:link},768:{color:{id:'paint'}}},cssRules:{0:{padding:'2rem'},768:{color:'#fff'}}};
 assert.deepEqual(inherited(info,1440,'padding'),{link,width:0,label:'All sizes',override:false});assert.equal(inherited(info,0,'padding'),null);assert.equal(inherited(info,768,'color'),null);
 info.variableLinks[768].padding={...link,id:'tablet'};info.cssRules[768].padding='3rem';info.variableOverrides={768:['padding']};assert.equal(inherited(info,1440,'padding').link.id,'tablet');assert.equal(inherited(info,1440,'padding').override,true);
});
test('intervening literal or overlapping declarations stop collection inheritance',()=>{
 for(const property of ['padding','padding-left']){const info={variableLinks:{0:{padding:link}},cssRules:{0:{padding:'2rem'},768:{[property]:'20px'}}};assert.equal(inherited(info,1440,'padding'),null);assert.equal(inherited(info,768,'padding'),null);}
 const info={variableLinks:{0:{color:link}},cssRules:{0:{color:'#fff'},768:{color:'#000'}}};assert.equal(inherited(info,1440,'color'),null);
});
test('removing only the current property reveals eligible smaller-screen binding',()=>{
 const info={variableLinks:{0:{padding:link},768:{padding:{...link,id:'tablet'}}},cssRules:{0:{padding:'2rem'},768:{padding:'3rem'}}};assert.equal(inherited(info,768,'padding'),null);assert.equal(inherited(info,768,'padding',true).link.id,'variable');info.cssRules[768]['padding-left']='5px';assert.equal(inherited(info,768,'padding',true),null);
});
