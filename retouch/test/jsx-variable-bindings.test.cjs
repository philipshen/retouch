'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),react=require('../src/adapters/react.cjs'),linked=require('../src/jsx-variable-bindings.cjs'),classes=require('../src/variable-classes.cjs');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),source='export default function Page(){return <main><h1 className="text-xl p-2 hover:text-red-500 md:p-4">Title</h1></main>}';
function fixture(){return {version:1,collections:[{id:id(1),name:'Theme',defaultMode:id(2),modes:[{id:id(2),name:'Light'},{id:id(3),name:'Dark'}]}],variables:[['color','#ffffff','#000000'],['number',24,48],['boolean',true,false],['string','"Open Sans", sans-serif','"Font_Name", serif']].map(([type,light,dark],i)=>({id:id(i+4),collectionId:id(1),name:type,type,values:{[id(2)]:light,[id(3)]:dark}}))};}
function resolve(source){const elements=react.collect(source,'Page.jsx').elements;return {file:'/tmp/Page.jsx',relPath:'Page.jsx',source,hash:react.contentHash(source),elements,element:elements.find(e=>e.node.openingElement.name.name==='h1')};}
function apply(source,property,n,extra={}){return linked.plan(resolve(source),{type:'applyVariable',scope:'md:',property,binding:{id:id(n),...extra}},fixture());}
test('React typed variable links preserve scopes, authored utilities, modes and literal font underscores',()=>{
 let current=source;for(const [property,n,extra]of [['color',4,{}],['padding',5,{unit:'rem'}],['visibility',6,{modes:{[id(1)]:id(3)}}],['font-family',7,{modes:{[id(1)]:id(3)}}]]){const result=apply(current,property,n,extra);assert.equal(result.ok,true,result.reason);current=result.edits[0].after;}
 const r=resolve(current),info=linked.describe(r),name=react.describe(r).className;assert.equal(info.classVariables,true);assert.deepEqual(info.variableOverrides['md:'],[]);assert.equal(info.variableLinks['md:'].padding.unit,'rem');assert.equal(info.variableLinks['md:'].visibility.value,'hidden');
 for(const token of ['text-xl','p-2','hover:text-red-500','md:p-4','md:![padding:24rem]','md:![visibility:hidden]','md:![font-family:"Font\\_Name",_serif]'])assert.ok(name.split(' ').includes(token),token);
 assert.deepEqual(apply(current,'padding',5,{unit:'rem'}).edits,[]);
 const detached=linked.plan(r,{type:'detachVariable',scope:'md:',property:'padding'});assert.equal(detached.ok,true,detached.reason);assert.equal(react.describe(resolve(detached.edits[0].after)).className,name);assert.equal(linked.describe(resolve(detached.edits[0].after)).variableLinks['md:'].padding,undefined);
 const removed=linked.plan(r,{type:'removeVariable',scope:'md:',property:'padding'});assert.equal(removed.ok,true,removed.reason);assert.ok(!react.describe(resolve(removed.edits[0].after)).className.includes('![padding:'));assert.ok(react.describe(resolve(removed.edits[0].after)).className.includes('md:p-4'));
});
test('React variable refresh follows renamed aliases and preserves local overrides until reset',()=>{
 const library=fixture();library.variables.push({id:id(8),collectionId:id(1),name:'Alias',type:'color',values:{[id(2)]:{alias:id(4)},[id(3)]:{alias:id(4)}}});
 let result=linked.plan(resolve(source),{type:'applyVariable',scope:'md:',property:'color',binding:{id:id(8)}},library);assert.equal(result.ok,true,result.reason);let current=result.edits[0].after.replace('md:![color:#ffffffff]','md:![color:#ff0000ff]');library.variables[0].name='Renamed';library.variables[0].values[id(2)]='#ff0000';
 result=linked.planFile('/tmp/Page.jsx','Page.jsx',current,library);assert.equal(result.ok,true,result.reason);current=result.edits[0].after;assert.equal(linked.describe(resolve(current)).variableLinks['md:'].color.override,true);
 library.variables[0].values[id(2)]='#00ff00';result=linked.planFile('/tmp/Page.jsx','Page.jsx',current,library);assert.equal(result.ok,true,result.reason);current=result.edits[0].after;assert.ok(react.describe(resolve(current)).className.includes('md:![color:#ff0000ff]'));
 result=linked.plan(resolve(current),{type:'resetVariable',scope:'md:',property:'color'},library);assert.equal(result.ok,true,result.reason);assert.ok(react.describe(resolve(result.edits[0].after)).className.includes('md:![color:#00ff00ff]'));assert.deepEqual(linked.describe(resolve(result.edits[0].after)).variableOverrides['md:'],[]);
});
test('React variable planner refuses ambiguous source, conflicting important classes and missing links without partial edits',()=>{
 const bad=[source.replace('<h1','<h1 {...props}'),source.replace('<h1','<h1 data-rt-variables="bad"'),source.replace('<h1','<h1 style={dynamicStyle}'),source.replace('<h1','<h1 style={{color: "red!important"}}'),source.replace('className="text-xl p-2 hover:text-red-500 md:p-4"','className={dynamicClasses}'),source.replace('md:p-4','md:!p-4')];
 for(const value of bad){const result=apply(value,'padding',5);assert.equal(result.ok,false,value);assert.equal(result.edits,undefined);}
 assert.equal(linked.plan(resolve(source),{type:'applyVariable',scope:'md:',property:'color',binding:{id:id(4)},fileHash:'stale'},fixture()).ok,false);
 const bound=apply(source,'color',4).edits[0].after,library=fixture();library.variables=library.variables.filter(v=>v.id!==id(4));const missing=linked.planFile('/tmp/Page.jsx','Page.jsx',bound,library);assert.equal(missing.ok,false);assert.equal(missing.edits,undefined);
 const unindexed=source.replace('<main>','<Widget data-rt-variables="{}">').replace('</main>','</Widget>');assert.equal(linked.planFile('/tmp/Page.jsx','Page.jsx',unindexed,fixture()).ok,false);
});
test('variable class writes preserve unrelated explicit important declarations and reject overlapping ones',()=>{
 assert.equal(classes.compose('p-2 md:![color:#fff] md:![width:20px]','padding','24px','md:'),'p-2 md:![color:#fff] md:![width:20px] md:![padding:24px]');
 assert.throws(()=>classes.compose('md:![padding-left:2px]','padding','24px','md:'),/conflicting/);assert.throws(()=>classes.compose('md:!custom-style','padding','24px','md:'),/conflicting/);
 assert.equal(classes.overridden('md:![padding:24px] md:![width:20px]','padding','24px','md:'),false);assert.equal(classes.overridden('md:![padding:24px] md:![padding-left:2px]','padding','24px','md:'),true);
});
