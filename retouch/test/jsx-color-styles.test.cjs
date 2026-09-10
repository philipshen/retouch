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
 for(const [property,token]of [['color','!text-custom-effect'],['background-color','!bg-custom-effect'],['border-color','![border:2px_solid_red]'],['color','![all:unset]']])assert.throws(()=>classes.compose(token,property,'#fff'),/important/);
 assert.equal(classes.overridden('![color:#abc] text-red-500','color','#abc'),false);assert.equal(classes.overridden('![color:#abc] !text-red-500','color','#abc'),true);
 assert.equal(classes.compose('md:!bg-red-500','background-color','#fff'),'md:!bg-red-500 ![background-color:#fff]');
});

test('important geometry and background image utilities neither block paint nor create false overrides',()=>{
 const cases={
  'border-color':['!border-2','border-x-4!','!border-solid','![border-width:2px]','![border-radius:4px]','![border-image:url(x)]','!border-[length:var(--stroke)]','!border-(length:--stroke)'],
  'background-color':['!bg-cover','!bg-none','!bg-center','!bg-no-repeat','!bg-clip-text','!bg-blend-multiply','!bg-linear-to-r','!bg-[url(image.png)]','!bg-[position:10%_20%]','!bg-(image:--picture)','![background-image:url(x)]'],
  'color':['!text-lg/7','!text-center','!text-balance']
 };
 for(const [property,values]of Object.entries(cases))for(const token of values){const composed=classes.compose(token,property,'#1234');assert.ok(composed.split(' ').includes(token),token);assert.equal(classes.overridden(composed,property,'#1234'),false,token);}
 for(const [property,token]of [['border-color','![border-inline:2px_solid_red]'],['border-color','!border-t-custom-effect'],['background-color','![background:red]'],['background-color','!bg-(--unknown)']])assert.throws(()=>classes.compose(token,property,'#fff'),/important/);
});

test('linked paint replaces only recognized color utilities at its own scope',()=>{
 for(const [property,utilities]of Object.entries({'color':['!text-red-500','text-white/50!','!text-[#1234]','!text-[color:var(--brand)]','!text-(color:--brand)'],'background-color':['!bg-emerald-950/25','!bg-[rgb(1_2_3)]','bg-transparent!'],'border-color':['!border-t-red-500','!border-x-[#ff0000]','![border-inline-color:red]']})){
  for(const utility of utilities){const source='p-4 md:'+utility+' hover:'+utility+' '+utility,composed=classes.compose(source,property,'#12345678','md:');assert.ok(!composed.split(' ').includes('md:'+utility),utility);assert.ok(composed.split(' ').includes('hover:'+utility));assert.ok(composed.split(' ').includes(utility));assert.ok(composed.includes('md:!['+property+':#12345678]'));assert.equal(classes.overridden(composed,property,'#12345678','md:'),false);}
 }
 assert.throws(()=>classes.compose('!bg-(--custom)','background-color','#fff'),/important/);
});

test('SVG palette paint owns fill and stroke without taking stroke width or background images',()=>{
 const fill=classes.compose('!fill-red-500 !stroke-2 !stroke-blue-500 !bg-none','fill','#1234');assert.ok(fill.includes('![fill:#1234]'));assert.ok(!fill.includes('!fill-red-500'));assert.ok(fill.includes('!stroke-2'));
 const stroke=classes.compose(fill,'stroke','#abcdef');assert.ok(stroke.includes('![stroke:#abcdef]'));assert.ok(stroke.includes('!stroke-2'));assert.ok(!stroke.includes('!stroke-blue-500'));assert.equal(classes.overridden(stroke,'stroke','#abcdef'),false);
 assert.equal(classes.overridden(stroke+' !stroke-[length:3px]','stroke','#abcdef'),false);assert.equal(classes.overridden(stroke+' !stroke-red-500','stroke','#abcdef'),true);
 assert.ok(classes.compose('!bg-none','background-color','#fff').includes('!bg-none'));
 assert.ok(!classes.compose('!fill-none','fill','#fff').includes('!fill-none'));assert.ok(!classes.compose('!stroke-none','stroke','#fff').includes('!stroke-none'));
});

test('clearing linked paint keeps the connection as an override that palette reset can restore',()=>{
 const applied=links.plan(resolve(source),{type:'applyColorStyle',property:'color',scope:'md:'},style).edits[0].after,r=resolve(applied),className=classes.compose(react.describe(r).className,'color',null,'md:'),cleared=react.planOp(r,{type:'setClasses',classes:className,fileHash:r.hash});assert.equal(cleared.ok,true,cleared.reason);
 const next=resolve(cleared.edits[0].after);assert.equal(links.describe(next).colorStyleLinks['md:'].color.id,style.id);assert.deepEqual(links.describe(next).colorStyleOverrides['md:'],['color']);
 const reset=links.plan(next,{type:'resetColorStyle',property:'color',scope:'md:'},style);assert.equal(reset.ok,true,reset.reason);assert.deepEqual(links.describe(resolve(reset.edits[0].after)).colorStyleOverrides['md:'],[]);
});

test('selection reset refuses malformed React color metadata instead of treating it as unlinked',()=>{
 const r=resolve(source.replace('<h1','<h1 data-rt-color-styles="bad"')),result=require('../src/text-style-selection.cjs').plan(r,{type:'resetColorStyleSelection',ids:r.elements.map(e=>e.id),fileHash:r.hash,scope:'md:',property:'color'},{styles:[]},react,'color');assert.equal(result.ok,false);assert.equal(result.edits,undefined);
});
