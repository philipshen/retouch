'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),react=require('../src/adapters/react.cjs'),links=require('../src/jsx-color-styles.cjs'),classes=require('../src/color-style-classes.cjs');
const style={id:'11111111-1111-4111-8111-111111111111',name:'Brand',properties:{color:'#12345678'}},source='export default function Page(){return <main><h1 className="text-lg/7 bg-red-500 border-2 border-blue-500 hover:bg-green-500 md:bg-blue-500">Title</h1></main>}';
function resolve(source){const elements=react.collect(source,'Page.jsx').elements;return {file:'/tmp/Page.jsx',relPath:'Page.jsx',source,elements,element:elements.find(e=>e.node.openingElement.name.name==='h1'),hash:react.contentHash(source)};}
test('React color links preserve geometry, typography and other scopes and detach without changing classes',()=>{
 const r=resolve(source),op={type:'applyColorStyle',scope:'md:',property:'background-color',fileHash:r.hash},result=links.plan(r,op,style);assert.equal(result.ok,true,result.reason);
 const next=resolve(result.edits[0].after),info=links.describe(next);assert.equal(info.classColorStyles,true);assert.equal(info.colorStyleLinks['md:']['background-color'].id,style.id);assert.deepEqual(info.colorStyleOverrides['md:'],[]);
 const className=react.describe(next).className;for(const token of ['text-lg/7','border-2','border-blue-500','hover:bg-green-500','md:![background-color:#12345678]'])assert.ok(className.split(' ').includes(token));
 assert.deepEqual(links.plan(next,{...op,fileHash:next.hash},style).edits,[]);
 const detached=links.plan(next,{...op,type:'detachColorStyle',fileHash:next.hash});assert.equal(detached.ok,true,detached.reason);const clear=resolve(detached.edits[0].after);assert.deepEqual(links.describe(clear).colorStyleLinks,{});assert.equal(react.describe(clear).className,className);
});
test('React palette refresh preserves local overrides across matching definitions until reset',()=>{
 const initial=links.plan(resolve(source),{type:'applyColorStyle',scope:'md:',property:'color'},style),applied=initial.edits[0].after,local=resolve(applied.replace('md:![color:#12345678]','md:![color:#ff0000]')),nextStyle={...style,properties:{color:'#ff0000'}};
 const refreshed=links.plan(local,{type:'refreshColorStyle',scope:'md:',property:'color'},nextStyle);assert.equal(refreshed.ok,true,refreshed.reason);let next=resolve(refreshed.edits[0].after);assert.equal(links.describe(next).colorStyleLinks['md:'].color.override,true);
 const update=links.plan(next,{type:'refreshColorStyle',scope:'md:',property:'color'},{...style,properties:{color:'#00ff00'}});next=resolve(update.edits[0].after);assert.ok(react.describe(next).className.includes('md:![color:#ff0000]'));
 const reset=links.plan(next,{type:'resetColorStyle',scope:'md:',property:'color'},style),resetInfo=links.describe(resolve(reset.edits[0].after));assert.deepEqual(resetInfo.colorStyleOverrides['md:'],[]);
});
test('React color source planner rejects ambiguous attributes and classes without partial edits',()=>{
 for(const bad of [source.replace('<h1','<h1 {...props}'),source.replace('<h1','<h1 data-rt-color-styles="bad"'),source.replace('className="text-lg/7 bg-red-500 border-2 border-blue-500 hover:bg-green-500 md:bg-blue-500"','className={value}')]){const result=links.plan(resolve(bad),{type:'applyColorStyle',scope:'',property:'color'},style);assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
 assert.equal(links.plan(resolve(source),{type:'applyColorStyle',property:'color',fileHash:'stale'},style).ok,false);
 assert.equal(links.plan(resolve(source),{type:'applyColorStyle',property:'opacity'},style).ok,false);
});
test('React project planner refreshes each paint link and refuses malformed unindexed links',()=>{
 let current=source;for(const property of ['color','background-color','border-color'])current=links.plan(resolve(current),{type:'applyColorStyle',scope:'md:',property},style).edits[0].after;
 const result=links.planFile('/tmp/Page.jsx','Page.jsx',current,{...style,properties:{color:'#abcdef'}});assert.equal(result.ok,true,result.reason);assert.equal(result.updated,3);for(const link of Object.values(links.describe(resolve(result.edits[0].after)).colorStyleLinks['md:']))assert.equal(link.value,'#abcdef');
 const bad=links.planFile('/tmp/Page.jsx','Page.jsx',source.replace('<main>','<main data-rt-color-styles="bad">'),style);assert.equal(bad.ok,false);assert.equal(bad.edits,undefined);
});
test('explicit linked paint classes keep ordinary utilities and refuse important shorthand ownership',()=>{
 assert.equal(classes.compose('text-lg/7 border-2 bg-cover','color','#abc'),'text-lg/7 border-2 bg-cover ![color:#abc]');
 for(const [property,token]of [['color','!text-red-500'],['background-color','!bg-red-500'],['border-color','!border-2'],['color','![all:unset]']])assert.throws(()=>classes.compose(token,property,'#fff'),/important/);
 assert.equal(classes.overridden('![color:#abc] text-red-500','color','#abc'),false);assert.equal(classes.overridden('![color:#abc] !text-red-500','color','#abc'),true);
 assert.equal(classes.compose('md:!bg-red-500','background-color','#fff'),'md:!bg-red-500 ![background-color:#fff]');
});
