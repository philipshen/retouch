'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
for(const language of ['html','react','liquid']){
 const adapter=require('../src/adapters/'+language+'.cjs');
 const source=language==='react'?'export default function Page(){return <main><p>Keep</p></main>}':'<main><p>Keep</p></main>',relPath=language==='react'?'page.jsx':language==='liquid'?'main.liquid':'index.html',elements=adapter.collect(source,relPath).elements,element=elements.find(e=>language==='react'?e.node.openingElement.name.name==='main':e.tag==='main'),resolved={source,relPath,file:'/tmp/'+relPath,elements,element,hash:adapter.contentHash(source)};
 test(language+' canvas text insertion validates coordinates and preserves existing layers',()=>{
  const result=adapter.planOp(resolved,{type:'insertElement',preset:'text',position:{x:-12.25,y:45.5},fileHash:resolved.hash});assert.equal(result.ok,true,result.reason);const after=result.edits[0].after,next=adapter.collect(after,relPath).elements;assert.equal(next.length,elements.length+1);assert.ok(after.includes('-12.25px'));assert.ok(after.includes('45.5px'));assert.ok(after.includes('<p>Keep</p>'));assert.equal(result.parentId,element.id);assert.ok(next.some(e=>e.id===result.createdId));for(const old of elements)assert.ok(next.some(e=>e.id===old.id));
  for(const position of [null,[],{x:0},{x:'1',y:2},{x:Infinity,y:0},{x:100001,y:0},{x:0,y:0,css:'color:red'}]){const refusal=adapter.planOp(resolved,{type:'insertElement',preset:'text',position,fileHash:resolved.hash});assert.equal(refusal.refused,true);assert.equal(refusal.edits,undefined);}
  assert.equal(adapter.planOp(resolved,{type:'insertElement',preset:'frame',position:{x:1,y:2},fileHash:resolved.hash}).refused,true);
 });
}
