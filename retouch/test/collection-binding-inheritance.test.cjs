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

test('class collection inheritance follows named breakpoints and ignores disjoint important declarations',()=>{
 const {classInherited}=require('../shell/collection-bindings.js'),d={createElement:()=>({style:{},remove(){}}),documentElement:{append(){}},defaultView:{getComputedStyle:()=>({fontSize:'20px'})}},choices=[{prefix:'tablet:',label:'Tablet',condition:'(width >= 40rem)'},{prefix:'desktop:',label:'Desktop',condition:'(min-width: 1200px)'}];
 const info={variableLinks:{'':{padding:link},'tablet:':{padding:{...link,id:'tablet'}}},className:'![padding:2rem] tablet:![padding:3rem] desktop:![color:#fff]'};
 assert.equal(classInherited(info,'desktop:','padding',d,false,choices).link.id,'tablet');assert.equal(classInherited(info,'tablet:','padding',d,false,choices),null);assert.equal(classInherited(info,'tablet:','padding',d,true,choices).link.id,'variable');
 for(const token of ['desktop:![padding-left:3px]','desktop:!custom-effect','min-[900px]:![padding:4px]','min-[1200px]:![padding:4px]','unknown:![padding:4px]'])assert.equal(classInherited({...info,className:info.className+' '+token},'desktop:','padding',d,false,choices),null,token);
 const tied={...info,variableLinks:{...info.variableLinks,'min-[800px]:':{padding:link}}};assert.equal(classInherited(tied,'desktop:','padding',d,false,choices),null);
 info.variableOverrides={'tablet:':['padding']};assert.equal(classInherited(info,'desktop:','padding',d,false,choices).override,true);
});
