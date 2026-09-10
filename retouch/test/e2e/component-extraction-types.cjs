'use strict';
// Use the disposable browser fixture's compiler, without adding runtime dependencies.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;
if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE to a fixture with TypeScript installed.');
const ts=require(path.join(fixture,'node_modules/typescript'));
const {makeApp,cleanup,Index}=require('../helpers.cjs'),create=require('../../src/create-component.cjs');
const jsx='declare namespace JSX {interface ElementChildrenAttribute {children:{}} interface IntrinsicElements {article:{title?:string;onClick?:()=>void;children?:unknown}}}\n';
const cases=[
 ['diamond interface','interface Base{title:string}interface Left extends Base{}interface Right extends Base{}interface Props extends Left,Right{count:number}function Page(data:Props){return <article title={data.title}>{data.count+1}</article>}'],
 ['identical intersection fields','type Props={title:string}&{title:string}&{count:number};function Page(data:Props){return <article title={data.title}>{data.count+1}</article>}'],
 ['diamond index signature','interface Base{readonly [key:string]:string}interface Left extends Base{}interface Right extends Base{}interface Props extends Left,Right{}function Page(data:Props){return <article title={data["title"]??"Hi"}>Hi</article>}'],
 ['object intersection','interface Base{title:string}type Props=Base & {count:number};function Page(data:Props){return <article title={data.title}>{data.count+1}</article>}'],
 ['destructured intersection','interface Base{title:string}type Props=Base & {count:number};function Page({title,count}:Props){return <article title={title}>{count+1}</article>}'],
 ['indexed object','type Label=string;interface Props{[key:string]:Label}function Page(data:Props){return <article title={data["title"]??"Hi"}>Hi</article>}'],
 ['inherited readonly index','type Label=string;interface Base{readonly [key:string]:Label}interface Props extends Base{title:Label}function Page(data:Props){return <article title={data["other"]??data.title}>Hi</article>}'],
 ['optional object member','interface Props{title?:string}function Page(data:Props){return <article title={data.title??"Hi"}>Hi</article>}'],
 ['optional method argument','type Label=string;interface Props{onSelect(value?:Label):void}function Page({onSelect}:Props){return <article onClick={()=>onSelect()}>Hi</article>}'],
 ['optional whole tuple','function Page(data:[title?:string]){return <article title={data[0]??"Hi"}>Hi</article>}'],
 ['method prop','type Label=string;interface Base{onSelect(value:Label):void}interface Props extends Base{}function Page({onSelect}:Props){return <article onClick={()=>onSelect("Hi")}>Hi</article>}'],
 ['inline props','function Page({title,count}:{title:string;count:number}){return <article title={title}>{count+1}</article>}'],
 ['local callback','function Page(){const title:string="Hi",onClick:()=>void=()=>{};return <article title={title} onClick={onClick}>Hi</article>}'],
 ['object aliases','function Page(){const {text:title,count}:{text:string;count:number}={text:"Hi",count:2};return <article title={title}>{count+1}</article>}'],
 ['named tuple','function Page(){const [title,,count]:[text:string,unused:boolean,total:number]=["Hi",true,2];return <article title={title}>{count+1}</article>}'],
 ['nested object tuple','function Page(){const {data:[title,count]}:{data:[string,number]}={data:["Hi",2]};return <article title={title}>{count+1}</article>}'],
 ['nested tuple object','function Page(){const [{text:title},[count]]:[{text:string},[number]]=[{text:"Hi"},[2]];return <article title={title}>{count+1}</article>}'],
 ['interface','interface Props{title:string;count:number}function Page({title,count}:Props){return <article title={title}>{count+1}</article>}'],
 ['alias chain','type Label=string;type Base={title:Label;count:number};type Props=Base;function Page({title,count}:Props){return <article title={title}>{count+1}</article>}'],
 ['inherited object','interface Base{title:string}interface Props extends Base{count:number}function Page(data:Props){return <article title={data.title}>{data.count+1}</article>}'],
 ['nested named types','type Label=string;type Count=number;interface Base{title:Label}interface Props extends Base{count:Count}type Handler=(value:Label)=>void;function Page(data:Props,onValue:Handler){return <article onClick={()=>onValue(data.title)}>{data.count+1}</article>}'],
 ['readonly array','type Label=string;function Page(){const values:readonly Label[]=["Hi"];return <article>{values.join(",")}</article>}'],
 ['readonly tuple','function Page(){const values:readonly [string,number]=["Hi",2];return <article title={values[0]}>{values[1]+1}</article>}'],
 ['readonly destructuring','function Page(){const [title,count]:readonly [string,number]=["Hi",2];return <article title={title}>{count+1}</article>}'],
];
const refusedCases=[
 ['earlier optional guard','interface Props{title?:string}function Page(data:Props){if(!data.title)return null;return <article title={data.title.toUpperCase()}>Hi</article>}',true],
 ['class shadows alias','type Value=string;function Page(){class Value{label="Hi"}const value:Value=new Value();return <article>{value.label}</article>}',true],
 ['enum shadows alias','type Value=string;function Page(){enum Value{First}const value:Value=Value.First;return <article>{value.toFixed()}</article>}',true],
];
function check(file,label){
 const program=ts.createProgram([file],{strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,noEmit:true,jsx:ts.JsxEmit.Preserve,types:[],skipLibCheck:true});
 const diagnostics=ts.getPreEmitDiagnostics(program);
 assert.equal(diagnostics.length,0,label+'\n'+ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:file=>file,getCurrentDirectory:()=>path.dirname(file),getNewLine:()=> '\n'}));
}
for(const [name,body,refused]of [...cases,...refusedCases]){
 const root=makeApp({'page.tsx':jsx+body});let index;
 try{
  index=new Index(root);index.scanAll();
  const resolved=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(result=>result.element.node.openingElement.name.name==='article');
  check(resolved.file,name+' before extraction');
  const plan=create.plan(resolved,{name:'ExtractedCard',fileHash:resolved.hash});
  if(refused){assert.equal(plan.ok,false,name);assert.equal(fs.readFileSync(resolved.file,'utf8'),jsx+body);console.log('PASS refusal',name);continue;}
  assert.ok(plan.ok,name+': '+plan.reason);
  fs.writeFileSync(resolved.file,plan.edits[0].after);check(resolved.file,name+' after extraction');
  console.log('PASS',name);
 }finally{index?.close();cleanup(root);}
}
console.log('PASS',refusedCases.length,'compiler-valid guarded refusals');
console.log('PASS',cases.length,'strict TypeScript extraction scenarios with typed JSX attributes; compiler',ts.version);
