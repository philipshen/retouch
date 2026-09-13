'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),ids=require('../src/id.cjs');
for(const kind of ['html','react','liquid']){
 const adapter=require('../src/adapters/'+kind+'.cjs'),wrap=body=>kind==='react'?'export default()=>('+body.replace('<!-- keep -->','{/* keep */}')+');':'<html><body>'+body+'</body></html>',color=kind==='react'?'stopColor':'stop-color';
 const original=wrap('<svg><defs><linearGradient id="paint"><stop offset="0" '+color+'="red"/><!-- keep --><stop offset="1" '+color+'="blue"/></linearGradient></defs><rect fill="url(#paint)" width="40"/><circle fill="url(#paint)" r="10"/></svg>');
 const resolve=source=>{const relPath=kind==='react'?'app/page.jsx':kind==='liquid'?'sections/main.liquid':'index.html',elements=adapter.collect(source,relPath).elements;return {source,relPath,elements,element:elements.find(el=>(kind==='react'?ids.jsxElementName(el.node):el.tag)==='rect'),hash:ids.contentHash(source),file:'/tmp/'+relPath};};
 test(kind+' inserts and removes gradient stops while preserving painted layer identities',()=>{
  for(const stop of [0,1,2]){const r=resolve(original),result=adapter.planOp(r,{type:'setSVGGradient',paint:'fill',fileHash:r.hash,action:'insertStop',stop,value:{offset:'0.5',color:'#800080',opacity:'1'}});assert.equal(result.ok,true,result.reason);const after=result.edits[0].after,fresh=resolve(after);assert.equal(fresh.element.id,r.element.id);assert.ok(after.includes(kind==='react'?'{/* keep */}':'<!-- keep -->'));assert.ok(after.includes('<rect fill="url(#paint)" width="40"/><circle fill="url(#paint)" r="10"/>'));assert.equal(adapter.describe(fresh).svgGradients[0].stops.length,3);assert.equal(adapter.describe(fresh).svgGradients[0].stops[stop].color,'#800080');const removed=adapter.planOp(fresh,{type:'setSVGGradient',paint:'fill',fileHash:fresh.hash,action:'removeStop',stop});assert.equal(removed.ok,true,removed.reason);assert.equal(removed.edits[0].after,original);}
 });
 test(kind+' rejects stale, unsafe, ambiguous and minimum stop mutations',()=>{
  const r=resolve(original),op={type:'setSVGGradient',paint:'fill',fileHash:r.hash,action:'insertStop',stop:1,value:{offset:'0.5',color:'purple',opacity:'1'}};
  for(const bad of [{fileHash:'stale'},{stop:3},{stop:-1},{action:'removeStop'},{changes:{offset:'0.5'}},{value:{offset:'101%',color:'purple',opacity:'1'}},{value:{offset:'0.5',color:'red" onclick="x',opacity:'1'}},{value:{offset:'0.5',color:'purple',opacity:'1',extra:'x'}}]){const result=adapter.planOp(r,{...op,...bad});assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
 });
}
