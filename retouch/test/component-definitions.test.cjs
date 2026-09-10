'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {makeApp,cleanup,Index}=require('./helpers.cjs'),definitions=require('../src/component-definitions.cjs'),{library}=require('../src/component-usage.cjs');
test('unused discovery recognizes direct function/arrow exports and marked private components without executing source',()=>{
 const source='globalThis.neverRun(); export function Button(){return <button/>} const Card=()=> <section/>;export {Card as Panel};export default function(){return <main/>} /** @retouch-component */\nfunction Private(){return <aside/>} function Hidden(){return <div/>} export const utility=()=> <span/>;export function Factory(){return ()=> <article/>}';
 const result=definitions.definitions(source,'Components.tsx');assert.deepEqual(result.map(item=>item.name),['Button','Card','Default component','Private']);assert.deepEqual(result.find(item=>item.name==='Card').names,['Card','Panel']);assert.equal(new Set(result.map(item=>item.definitionId)).size,4);
});
test('unused definitions expose imported property types and literal defaults without inventing instance values',()=>{
 const root=fs.realpathSync(makeApp({'Button.tsx':'import type {Props} from "./types";export function Button({tone="calm",label}:Props){return <button>{label}</button>}','types.ts':'export interface Props {tone?:"calm"|"bold";label:string}'})),index=new Index(root);try{
  index.scanAll();const item=library(index).components.find(item=>item.name==='Button');assert.ok(item);assert.equal(item.usageCount,0);assert.deepEqual(item.usages,[]);const info=definitions.describe(index.resolve(item.definitionId));assert.equal(info.definitionOnly,true);assert.equal(info.props.find(prop=>prop.name==='tone').value,'"calm" | "bold" (optional)');assert.equal(info.props.find(prop=>prop.name==='tone').default,'"calm"');assert.equal(info.props.find(prop=>prop.name==='label').value,'string (required)');assert.equal(info.props.find(prop=>prop.name==='label').default,'—');assert.equal(info.source.startsWith('function Button'),true);
  fs.writeFileSync(path.join(root,'Use.tsx'),'import {Button} from "./Button";export const Usage=()=> <Button label="A"/>');index.indexFile(path.join(root,'Use.tsx'));assert.equal(library(index).components.find(candidate=>candidate.definitionId===item.definitionId).usageCount,1);
  fs.writeFileSync(path.join(root,'Use.tsx'),'import {Button} from "./Button";export const Usage=()=> <><Button label="A"/><Button label="B"/></>');index.indexFile(path.join(root,'Use.tsx'));const updated=library(index).components.filter(candidate=>candidate.definitionId===item.definitionId&&candidate.name==='Button');assert.equal(updated.length,1);assert.equal(updated[0].usageCount,2);assert.equal(updated[0].definitionOnly,undefined);
 }finally{index.close();cleanup(root);}
});
test('definition inspection refuses nested host ids and non-component functions',()=>{
 const root=fs.realpathSync(makeApp({'Card.tsx':'export function Card(){return <section><span/></section>}function helper(){return <aside/>}'})),index=new Index(root);try{index.scanAll();const all=[...index.idToFile.keys()].map(id=>index.resolve(id));assert.equal(definitions.describe(all.find(r=>r.element.node.openingElement.name.name==='span')).ok,false);assert.equal(definitions.describe(all.find(r=>r.element.node.openingElement.name.name==='aside')).ok,false);}finally{index.close();cleanup(root);}
});
test('used and unused definitions agree on returned roots rather than nested helper markup',()=>{
 const root=fs.realpathSync(makeApp({'Card.tsx':'export function Card({alternate=false}){function Helper(){return <nav/>}if(alternate){return <article/>}return <footer/>}','Page.tsx':'import {Card} from "./Card";export default function Page(){return <main><Card/></main>}'})),index=new Index(root);try{
  index.scanAll();const usage=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(resolved=>resolved.element.kind==='instance'),info=require('../src/components.cjs').describe(usage);assert.ok(info.ok);assert.equal(index.resolve(info.definitionId).element.node.openingElement.name.name,'article');assert.deepEqual(info.definitionIds.map(id=>index.resolve(id).element.node.openingElement.name.name),['article','footer']);const components=library(index).components.filter(item=>item.file==='Card.tsx');assert.equal(components.length,1);assert.equal(components[0].usageCount,1);assert.equal(components[0].definitionId,info.definitionId);
 }finally{index.close();cleanup(root);}
});

test('fragment descriptors include top-level conditional hosts and exclude their descendants',()=>{
 const root=fs.realpathSync(makeApp({'Card.tsx':'export function Card({show}){return <><header><b/></header><>{show&&<aside/>}{show?<section/>:<footer/>}</>{[1].map(n=><nav/>)}</>}','Page.tsx':'import {Card} from "./Card";export default function Page(){return <Card/>}'})),index=new Index(root);try{
  index.scanAll();const usage=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(resolved=>resolved.element.kind==='instance'),info=require('../src/components.cjs').describe(usage);assert.equal(info.ok,true);assert.deepEqual(info.definitionIds.map(id=>index.resolve(id).element.node.openingElement.name.name),['header','aside','section','footer']);assert.equal(index.resolve(info.definitionId).element.node.openingElement.name.name,'header');
 }finally{index.close();cleanup(root);}
});
