'use strict';
// Use the disposable browser fixture's compiler, without adding runtime dependencies.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;
if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE to a fixture with TypeScript installed.');
const ts=require(path.join(fixture,'node_modules/typescript'));
const {makeApp,cleanup,Index}=require('../helpers.cjs'),create=require('../../src/create-component.cjs');
const jsx='declare namespace JSX {interface ElementChildrenAttribute {children:{}} interface IntrinsicElements {article:{title?:string;onClick?:()=>void;children?:unknown}}}\n';
const cases=[
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
function check(file,label){
 const program=ts.createProgram([file],{strict:true,noEmit:true,jsx:ts.JsxEmit.Preserve,types:[],skipLibCheck:true});
 const diagnostics=ts.getPreEmitDiagnostics(program);
 assert.equal(diagnostics.length,0,label+'\n'+ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:file=>file,getCurrentDirectory:()=>path.dirname(file),getNewLine:()=> '\n'}));
}
for(const [name,body]of cases){
 const root=makeApp({'page.tsx':jsx+body});let index;
 try{
  index=new Index(root);index.scanAll();
  const resolved=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(result=>result.element.node.openingElement.name.name==='article');
  check(resolved.file,name+' before extraction');
  const plan=create.plan(resolved,{name:'ExtractedCard',fileHash:resolved.hash});assert.ok(plan.ok,name+': '+plan.reason);
  fs.writeFileSync(resolved.file,plan.edits[0].after);check(resolved.file,name+' after extraction');
  console.log('PASS',name);
 }finally{index?.close();cleanup(root);}
}
console.log('PASS',cases.length,'strict TypeScript extraction scenarios with typed JSX attributes; compiler',ts.version);
