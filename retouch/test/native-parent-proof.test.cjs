'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
for(const language of ['react','liquid']){
 const adapter=require('../src/adapters/'+language+'.cjs'),tag=e=>language==='react'?e.node.openingElement.name.name:e.tag;
 function move(markup,selected,target){const source=language==='react'?'const view='+markup:markup,relPath=language==='react'?'view.jsx':'view.liquid',elements=adapter.collect(source,relPath).elements,element=elements.find(e=>tag(e)===selected),destination=elements.find(e=>tag(e)===target);return adapter.planOp({source,relPath,elements,element,hash:adapter.contentHash(source),file:'/p/'+relPath},{type:'reparentElement',fileHash:adapter.contentHash(source),destinationId:destination.id});}
 test(language+' refuses parent moves that the browser reparents or drops',()=>{
  for(const [source,selected,target]of [
   ['<main><section><button>Move</button></section><button><div></div></button></main>','button','div'],
   ['<main><section><a>Move</a></section><a><div></div></a></main>','a','div'],
   ['<main><section><li>Move</li></section><ul><li><div></div></li></ul></main>','li','div']
  ]){const result=move(source,selected,target);assert.equal(result.refused,true,JSON.stringify(result));assert.equal(result.edits,undefined);}
 });
 test(language+' preserves valid nested controls and complete table or SVG subtrees',()=>{
  for(const [source,selected,target]of [
   ['<main><section><button>Move</button></section><aside></aside></main>','button','aside'],
   ['<main><section><table><tr><td>Cell</td></tr></table></section><aside></aside></main>','table','aside'],
   ['<main><section><svg><circle></circle></svg></section><aside></aside></main>','svg','aside'],
   ['<main><section><input /></section><aside></aside></main>','input','aside']
  ]){const result=move(source,selected,target);assert.equal(result.ok,true,result.reason);}
 });
}
