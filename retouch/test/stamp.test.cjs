'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { stampMod } = require('./helpers.cjs');
const { stamp } = stampMod;

const ROOT = '/app';
const file = path.join(ROOT, 'C.tsx');

test('stamps host elements with data-rt and instances with data-rt-i', () => {
  const src = `export const C = () => <div><h2>x</h2><Button>y</Button></div>;`;
  const out = stamp(src, file, ROOT);
  assert.strictEqual((out.code.match(/data-rt="/g) || []).length, 2); // div, h2
  assert.strictEqual((out.code.match(/data-rt-i="/g) || []).length, 1); // Button
});

test('never stamps a fragment', () => {
  const src = `export const C = () => <><span>x</span></>;`;
  const out = stamp(src, file, ROOT);
  assert.ok(!/<>\s*data-rt/.test(out.code));
  assert.strictEqual((out.code.match(/data-rt="/g) || []).length, 1); // span only
});

test('returns null for files with no JSX', () => {
  assert.strictEqual(stamp('export const x = 1;', file, ROOT), null);
});

test('skips node_modules', () => {
  const nm = path.join(ROOT, 'node_modules', 'pkg', 'C.tsx');
  assert.strictEqual(stamp('export const C = () => <div/>;', nm, ROOT), null);
});

test('skips non-tsx/jsx files', () => {
  assert.strictEqual(stamp('<div/>', path.join(ROOT, 'x.ts'), ROOT), null);
});

test('is idempotent on IDs: stamping twice yields the same IDs', () => {
  const src = `export const C = () => <div><h2>x</h2></div>;`;
  const a = stamp(src, file, ROOT).code.match(/data-rt="([0-9a-f]{10})"/g);
  const b = stamp(src, file, ROOT).code.match(/data-rt="([0-9a-f]{10})"/g);
  assert.deepStrictEqual(a, b);
});

test('produces a source map', () => {
  const out = stamp(`export const C = () => <div/>;`, file, ROOT);
  assert.ok(out.map && out.map.mappings);
});

test('compiled host revisions change with source while structural IDs remain stable',()=>{
 const {contentHash,collectElements}=require('../src/id.cjs'),src='export const C=()=> <svg {...props}><rect width={10}/><Icon/></svg>;',next=src.replace('10','20'),a=stamp(src,file,ROOT),b=stamp(next,file,ROOT);
 assert.equal((a.code.match(/data-rt-revision=/g)||[]).length,2);assert.ok(a.code.includes('data-rt-revision="'+contentHash(src)+'"'));assert.ok(b.code.includes('data-rt-revision="'+contentHash(next)+'"'));assert.deepEqual(a.code.match(/data-rt="[^"]+"/g),b.code.match(/data-rt="[^"]+"/g));
 const hosts=collectElements(a.code,'C.tsx').elements.filter(e=>e.kind==='host');for(const host of hosts)assert.ok(host.node.openingElement.attributes.some(attr=>attr.name?.name==='data-rt-revision'));assert.ok(!src.includes('data-rt-revision'));
});


test('explicitly created component roots forward instance identity only in compiled output',()=>{
 const src='export default function Page(){return <Card/>}\n/** @retouch-component */\nfunction Card(){return <article><span>Hi</span></article>}';
 const output=stamp(src,file,ROOT).code;assert.ok(output.includes('data-rt-i={arguments[0]?.["data-rt-i"]}'));assert.strictEqual((output.match(/arguments\[0\]\?\.\["data-rt-i"\]/g)||[]).length,1);assert.ok(!src.includes('arguments[0]'));assert.doesNotThrow(()=>require('../src/id.cjs').parseSource(output));
 const unmarked=stamp(src.replace('/** @retouch-component */',''),file,ROOT).code;assert.ok(!unmarked.includes('arguments[0]'));
});
test('exported function component roots forward their incoming instance marker without changing nested hosts',()=>{
 for(const src of ['export function Card({label}){return <article><span>{label}</span></article>}','function Card(){return <article/>} export {Card as PublicCard};','export default function Card(){return <article/>}']){
  const output=stamp(src,file,ROOT).code,{elements}=require('../src/id.cjs').collectElements(output,'C.tsx'),root=elements.find(element=>element.node.openingElement.name.name==='article');assert.ok(root.node.openingElement.attributes.some(attr=>attr.name?.name==='data-rt-i'));assert.equal((output.match(/arguments\[0\]\?\.\["data-rt-i"\]/g)||[]).length,1);assert.ok(!src.includes('data-rt-i'));const nested=elements.find(element=>element.node.openingElement.name.name==='span');if(nested)assert.equal(nested.node.openingElement.attributes.some(attr=>attr.name?.name==='data-rt-i'),false);
 }
 const existing='export function Card(){return <article data-rt-i="authored"/>}';assert.equal((stamp(existing,file,ROOT).code.match(/arguments\[0\]\?\.\["data-rt-i"\]/g)||[]).length,0);
});
test('conditional and nested-statement returns forward identity on each own host branch',()=>{
 const source='export function Card({mode}){function helper(){return <nav/>} if(mode===1){return <article><span/></article>} switch(mode){case 2:return <aside/>;default:return mode ? <section/> : <footer/>}}';
 const output=stamp(source,file,ROOT).code,hosts=require('../src/id.cjs').collectElements(output,'C.tsx').elements.filter(element=>element.kind==='host');
 for(const host of hosts)assert.equal(host.node.openingElement.attributes.some(attr=>attr.name?.name==='data-rt-i'),['article','aside','section','footer'].includes(host.node.openingElement.name.name));assert.equal((output.match(/arguments\[0\]\?\.\["data-rt-i"\]/g)||[]).length,4);assert.ok(!source.includes('data-rt-i'));
});
test('exported regular function expressions and wrapped logical returns retain their own arguments',()=>{
 const source='export const Card=function Named(props){return props.show && (<article/> as JSX.Element)};export function Other(){return (()=> <aside/>)()}';
 const output=stamp(source,file,ROOT).code;assert.equal((output.match(/arguments\[0\]\?\.\["data-rt-i"\]/g)||[]).length,1);assert.doesNotThrow(()=>require('../src/id.cjs').parseSource(output));
});

// Evaluate tiny host-only JSX fixtures without adding a production compiler dependency.
function evaluatedArrow(source,outerThis={},outerArgument='lexical argument'){
 const stamped=stamp(source,file,ROOT).code,{elements}=require('../src/id.cjs').collectElements(stamped,'C.tsx'),ms=new(require('magic-string'))(stamped);
 for(const {node} of elements){
  assert.equal(node.children.length,0);
  const props=node.openingElement.attributes.map(attr=>attr.type==='JSXSpreadAttribute'?'...('+stamped.slice(attr.argument.start,attr.argument.end)+')':JSON.stringify(attr.name.name)+':'+(!attr.value?'true':attr.value.type==='StringLiteral'?JSON.stringify(attr.value.value):'('+stamped.slice(attr.value.expression.start,attr.value.expression.end)+')'));
  ms.overwrite(node.start,node.end,'({tag:'+JSON.stringify(node.openingElement.name.name)+','+props.join(',')+'})');
 }
 return Function(ms.toString().replace('export const Card','const Card')+';return Card;').call(outerThis,outerArgument);
}
test('arrow identity preserves lexical this and arguments and captures before props reassignment',()=>{
 const source='export const Card = props => {"use strict"; const original=props; props={};return <article title={this.label+arguments[0]} data-original={original.value}/>}',Card=evaluatedArrow(source,{label:'outer '},'argument');
 const result=Card({'data-rt-i':'instance',value:42});assert.equal(result['data-rt-i'],'instance');assert.equal(result.title,'outer argument');assert.equal(result['data-original'],42);assert.equal(Card.length,1);assert.ok(!source.includes('rtInstance'));
 const expression=evaluatedArrow('export const Card = props => (<article title={(props={},this.label+arguments[0])}/>)',{label:'outer '},'argument');assert.equal(expression({'data-rt-i':'expression'})['data-rt-i'],'expression');
});
test('arrow parameter forms retain defaults, rest props and unique local identity on every branch',()=>{
 for(const source of [
  'export const Card = ({label="Default",alternate=false}) => alternate ? <aside title={label}/> : <article title={label}/>',
  'export const Card = ({label="Default",alternate=false,...rest}={}) => {rest["data-rt-i"]="changed";return alternate ? <aside title={label}/> : <article title={label}/>}',
  'export const Card = (...args) => {const {label="Default",alternate=false}=args[0];args[0]={};return alternate ? <aside title={label}/> : <article title={label}/>}',
  'export const Card = ({label="Default",alternate=false,"data-rt-i":authored}) => {authored="changed";return alternate ? <aside title={label}/> : <article title={label}/>}',
  'export const Card = (props={}) => {const _rtInstance="collision";if(props.alternate){const _rtInstance2="nested";return <aside title={props.label??"Default"}/>};return <article title={props.label??"Default"}/>}',
 ]){
  const Card=evaluatedArrow(source);for(const alternate of [false,true]){const rendered=Card({'data-rt-i':'instance',alternate});assert.equal(rendered['data-rt-i'],'instance',source);assert.equal(rendered.title,'Default');assert.equal(rendered.tag,alternate?'aside':'article');}
 }
 const defaults=evaluatedArrow('export const Card=({label="Default",...rest}={})=><article title={label} data-rest={Object.keys(rest).join()}/>');assert.equal(defaults().title,'Default');assert.equal(defaults({'data-rt-i':'instance',extra:1})['data-rest'],'data-rt-i,extra');
});
test('empty, async, typed and parenthesized arrow headers produce valid compiled source',async()=>{
 for(const source of [
  'export const Card=()=> <article/>',
  'export const Card=()=>{"use strict";return <article/>}',
  'export const Card=props=>{"use strict"\nreturn <article/>}',
  'export const Card=async /* comment ( ) */ () => (<article/>)',
  'export const Card=async <T,>() : Promise<unknown> => (<article/>)',
  'export const Card=({label}: {label:string}) => (<article title={label}/>)',
  'export const Card=(props: {label:string}): unknown => ((<article title={props.label}/>))',
  'export const Card=async (props) => (<article title={await props.label}/>)',
 ])assert.doesNotThrow(()=>require('../src/id.cjs').parseSource(stamp(source,file,ROOT).code),source);
 const empty=evaluatedArrow('export const Card= /* ( ignored ) */ () => (<article/>)');assert.equal(empty.length,0);assert.equal(empty({'data-rt-i':'empty'})['data-rt-i'],'empty');assert.equal(empty()['data-rt-i'],undefined);
 const asyncCard=evaluatedArrow('export const Card=async props=><article title={await props.label}/>');const rendered=await asyncCard({'data-rt-i':'async',label:Promise.resolve('Awaited')});assert.equal(rendered.title,'Awaited');assert.equal(rendered['data-rt-i'],'async');
});
test('component usages carry a compiler revision independent of structural identity',()=>{
 const source='export default function Page(){return <Card label="A"/>}',next=source.replace('"A"','"B"'),a=stamp(source,file,ROOT).code,b=stamp(next,file,ROOT).code,hash=require('../src/id.cjs').contentHash;
 assert.deepEqual(a.match(/data-rt-i="[^"]+"/g),b.match(/data-rt-i="[^"]+"/g));assert.ok(a.includes('data-rt-i-revision="'+hash(source)+'"'));assert.ok(b.includes('data-rt-i-revision="'+hash(next)+'"'));assert.ok(!source.includes('data-rt-i-revision'));
});
test('host roots forward the caller revision for functions and arrow parameter forms',()=>{
 for(const source of ['export const Card=props=>{props={};return <article/>}','export const Card=({label,...rest})=>{rest["data-rt-i-revision"]="changed";return <article/>}','export const Card=({label})=><article/>','export const Card=function({label}){return <article/>}']){
  const rendered=evaluatedArrow(source)({'data-rt-i':'instance','data-rt-i-revision':'usage revision',label:'A'});assert.equal(rendered['data-rt-i'],'instance');assert.equal(rendered['data-rt-i-revision'],'usage revision');assert.equal(rendered['data-rt-revision'],require('../src/id.cjs').contentHash(source));
 }
});

test('fragment roots forward caller identity and revision without stamping nested hosts or callbacks',()=>{
 const source='export const Card=({show})=><><header><b/></header><>{show && <aside/>}{show ? <section/> : <footer/>}</>{[1].map(n=><nav/>)}<Child/></>';
 const output=stamp(source,file,ROOT).code,{elements}=require('../src/id.cjs').collectElements(output,'C.tsx');
 for(const element of elements.filter(el=>el.kind==='host')){
  const attrs=element.node.openingElement.attributes.map(attr=>attr.name?.name),expected=['header','aside','section','footer'].includes(element.node.openingElement.name.name);
  assert.equal(attrs.includes('data-rt-i'),expected);assert.equal(attrs.includes('data-rt-i-revision'),expected);
 }
 assert.doesNotThrow(()=>require('../src/id.cjs').parseSource(output));assert.ok(!source.includes('data-rt-i'));
});

test('React fragment bindings and aliases are transparent while shadowed and custom names remain instances',()=>{
 for(const [imports,tag] of [['import React from "react";','React.Fragment'],['import * as R from "react";','R.Fragment'],['import {Fragment as Group} from "react";','Group'],['import {default as R} from "react";','R.Fragment']]){
  const source=imports+'export const Card=()=> <'+tag+' key="group"><header/><footer/></'+tag+'>',out=stamp(source,file,ROOT).code,{elements}=require('../src/id.cjs').collectElements(out,'C.tsx');assert.equal(elements.length,2);for(const el of elements){assert.equal(el.kind,'host');assert.ok(el.node.openingElement.attributes.some(attr=>attr.name?.name==='data-rt-i'));}assert.match(out,/key="group"/);assert.doesNotThrow(()=>require('../src/id.cjs').parseSource(out));
 }
 for(const source of ['import {Fragment} from "other";export const Card=()=> <Fragment><header/></Fragment>','import React from "other";export const Card=()=> <React.Fragment><header/></React.Fragment>','import {Fragment} from "react";export const Card=({Fragment})=> <Fragment><header/></Fragment>','import React from "react";export const Card=({React})=> <React.Fragment><header/></React.Fragment>']){
  const out=stamp(source,file,ROOT).code,{elements}=require('../src/id.cjs').collectElements(out,'C.tsx');assert.equal(elements[0].kind,'instance');assert.ok(elements[0].node.openingElement.attributes.some(attr=>attr.name?.name==='data-rt-i'));assert.equal(elements[1].node.openingElement.attributes.some(attr=>attr.name?.name==='data-rt-i'),false);
 }
});
test('host layer names are compiled metadata with escaped values, while instance names remain comments',()=>{
 const {collectElements}=require('../src/id.cjs'),names=require('../src/jsx-layer-name.cjs'),label='Hero */ "& <tag> 🌞',source='export default ()=> <main'+names.comment(label)+' {...props} data-rt-layer-name="old" aria-label="Accessible"><Card'+names.comment('Instance')+'/><svg><rect'+names.comment('Shape')+'/></svg></main>;',output=stamp(source,file,ROOT).code,elements=collectElements(output,'C.tsx').elements;
 const main=elements.find(e=>e.node.openingElement.name.name==='main').node.openingElement,attr=main.attributes.filter(a=>a.name?.name==='data-rt-layer-name');assert.equal(attr.length,1);assert.equal(attr[0].value.expression.value,label);assert.ok(attr[0].start>main.attributes.find(a=>a.type==='JSXSpreadAttribute').end);assert.equal(main.attributes.find(a=>a.name?.name==='aria-label').value.value,'Accessible');assert.equal(elements.find(e=>e.kind==='instance').node.openingElement.attributes.some(a=>a.name?.name==='data-rt-layer-name'),false);assert.equal(elements.find(e=>e.node.openingElement.name.name==='rect').node.openingElement.attributes.find(a=>a.name?.name==='data-rt-layer-name').value.expression.value,'Shape');assert.ok(!source.includes('data-rt-layer-name={'));
});
test('generic component stamps follow type arguments and retain layer comments',()=>{
 const source='export default ()=> <Card<string> /* @retouch-layer "Hero" */ value="x"/>;',output=stamp(source,file,ROOT).code;
 assert.doesNotThrow(()=>require('../src/id.cjs').parseSource(output));assert.match(output,/<Card<string> data-rt-i=/);assert.match(output,/@retouch-layer "Hero"/);
});
