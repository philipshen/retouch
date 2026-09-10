'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {group,bounds}=require('../shell/component-instances.js'),{collectElements}=require('../src/id.cjs'),rootGroups=require('../src/component-root-groups.cjs');
function nodes(ids){const result=ids.map(id=>({getAttribute:()=>id,nextElementSibling:null}));result.forEach((el,i)=>el.nextElementSibling=result[i+1]||null);return result;}
test('fragment roots form one instance per complete adjacent source sequence',()=>{
 const elements=nodes(['footer','small','footer','small','section']);const result=group(elements,[['footer','small'],['section']]);assert.deepEqual(result.map(item=>[item.elements.length,item.complete]),[[2,true],[2,true],[1,true]]);assert.equal(result[1].element,elements[2]);
});
test('missing, separated or ambiguous fragment roots remain individually selectable',()=>{
 const elements=nodes(['footer','small']);elements[0].nextElementSibling={};assert.deepEqual(group(elements,[['footer','small']]).map(item=>item.complete),[false,false]);assert.equal(group(nodes(['footer']),[['footer','small']])[0].complete,false);assert.equal(group(nodes(['footer','small']),[['footer'],['footer','small'],['small']])[0].complete,false);
});
test('group bounds include every visible root and preserve negative positions',()=>{
 const result=bounds([{getBoundingClientRect:()=>({left:-10,top:5,right:20,bottom:25,width:30,height:20})},{getBoundingClientRect:()=>({left:50,top:40,right:80,bottom:50,width:30,height:10})}]);assert.deepEqual(result,{left:-10,top:5,width:90,height:45});assert.equal(bounds([]),null);
});
test('source groups cover fixed shorthand and named fragments but refuse unknown DOM children',()=>{
 for(const returnValue of ['<><footer/><small/></>','<Group><footer/><small/></Group>']){
  const source='import {Fragment as Group} from "react";export function Card({show}){if(show)return <section/>;return '+returnValue+'}',parsed=collectElements(source,'Card.tsx'),fn=parsed.ast.program.body[1].declaration,groups=rootGroups(fn,parsed.elements,parsed.fragments);assert.deepEqual(groups.map(ids=>ids.map(id=>parsed.elements.find(el=>el.id===id).node.openingElement.name.name)),[['section'],['footer','small']]);
 }
 for(const content of ['<Child/>','{items.map(x=><small/>)}','text','{label}','{show&&<small/>}']){
  const source='export function Card(){return <><footer/>'+content+'</>}',parsed=collectElements(source,'Card.tsx');assert.deepEqual(rootGroups(parsed.ast.program.body[0].declaration,parsed.elements,parsed.fragments),[]);
 }
});

test('conditional fragment children group both states around their shared host anchor',()=>{
 const source='export function Card({show}){return <><header/>{show ? <aside/> : null}<footer/></>}',parsed=collectElements(source,'Card.tsx'),patterns=rootGroups(parsed.ast.program.body[0].declaration,parsed.elements,parsed.fragments),ids=Object.fromEntries(parsed.elements.map(el=>[el.node.openingElement.name.name,el.id]));assert.deepEqual(patterns,[[ids.header,ids.aside,ids.footer],[ids.header,ids.footer]]);
 const rendered=nodes([ids.header,ids.footer,ids.header,ids.aside,ids.footer]);assert.deepEqual(group(rendered,patterns).map(item=>[item.elements.length,item.complete]),[[2,true],[3,true]]);
});
test('conditional root enumeration refuses unknown text, missing anchors and exponential alternatives',()=>{
 for(const children of ['{a?<header/>:null}{b?<footer/>:null}','<header/>{show?<aside/>:label}<footer/>','<header/>'+Array.from({length:7},(_,i)=>'{show'+i+'?<aside/>:null}').join('')+'<footer/>']){
  const parsed=collectElements('export function Card(){return <>'+children+'</>}','Card.tsx');assert.deepEqual(rootGroups(parsed.ast.program.body[0].declaration,parsed.elements,parsed.fragments),[]);
 }
});


test('anchored optional prefix and suffix variants keep adjacent repeated instances separate',()=>{
 assert.deepEqual(group(nodes(['a','a','b','a','a','b']),[['a'],['a','b']]).map(item=>[item.elements.length,item.complete]),[[1,true],[2,true],[1,true],[2,true]]);
 assert.deepEqual(group(nodes(['b','a','b','b']),[['b'],['a','b']]).map(item=>[item.elements.length,item.complete]),[[1,true],[2,true],[1,true]]);
 // A transitive overlap without one shared anchor does not justify longest-match grouping.
 assert.equal(group(nodes(['a','b','c']),[['a'],['a','b'],['b','c']])[0].complete,false);
 const separated=nodes(['a','b']);separated[0].nextElementSibling={};assert.deepEqual(group(separated,[['a'],['a','b']]).map(item=>[item.elements.length,item.complete]),[[1,true],[1,false]]);
});
