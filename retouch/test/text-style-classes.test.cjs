'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {encode}=require('../src/text-style-classes.cjs'),tokens=require('../src/class-tokens.cjs'),responsive=require('../shell/responsive.js');
const full={'font-family':'"标题_Font", sans-serif','font-size':'32px','font-weight':'537.5','font-style':'oblique','font-optical-sizing':'none','font-variation-settings':'"wght" 537.5, "GRAD" -30','font-variant-numeric':'tabular-nums slashed-zero','line-height':'1.4','letter-spacing':'-0.02em','text-align':'center','text-decoration-line':'underline line-through','text-transform':'uppercase'};
test('every catalog typography property has a validated scoped class encoding',()=>{
 const encoded=encode(full);assert.equal(Object.keys(encoded).length,12);
 assert.equal(encoded['font-family'],'![font-family:"标题\\_Font",_sans-serif]');assert.equal(encoded['font-variation-settings'],'![font-variation-settings:"wght"_537.5,_"GRAD"_-30]');
 const scoped=responsive.replaceScope('hover:text-red-500 md:p-4',Object.values(encoded).join(' '),'md:');
 for(const token of scoped.split(' '))assert.equal(tokens.valid(token),true,token);
 assert.ok(scoped.includes('hover:text-red-500'));assert.deepEqual(encode(Object.fromEntries(Object.entries(full).reverse())),encoded);
});
test('text style encodings refuse injection, missing values and unsupported properties',()=>{
 for(const input of [null,[],{}, {color:'red'}, {'font-size':'32px;color:red'}, {'font-size':32}, {'font-family':'"x" onmouseover="bad"'}, {'font-variation-settings':'"wght" 1; color:red'}])assert.throws(()=>encode(input));
});
module.exports={full};
test('React and Liquid source writers preserve all encoded typography tokens',()=>{
 const classes=Object.values(encode(full)).join(' ');
 for(const kind of ['react','liquid']){
  const adapter=require('../src/adapters/'+kind+'.cjs'),relPath=kind==='react'?'Page.jsx':'sections/main.liquid',source=kind==='react'?'export default function Page(){return <p className="p-4">Text</p>}':'<p class="p-4">Text</p>';
  const resolve=value=>({source:value,relPath,file:'/tmp/'+relPath,hash:adapter.contentHash(value),element:adapter.collect(value,relPath).elements[0]});
  const result=adapter.planOp(resolve(source),{type:'setClasses',classes:'p-4 '+classes});assert.equal(result.ok,true,result.reason);
  const saved=adapter.describe(resolve(result.edits[0].after)).className;
  for(const token of classes.split(' '))assert.ok(saved.split(' ').includes(token),kind+' '+token);
 }
});
