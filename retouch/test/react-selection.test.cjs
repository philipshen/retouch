'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{change}=require('../shell/react-selection.js');
test('React shared styles preserve unrelated classes, scopes and important markers',()=>{
 assert.equal(change('p-4 opacity-80 hover:opacity-40 md:opacity-60','md:','opacity',25),'p-4 opacity-80 hover:opacity-40 md:opacity-[0.25]');
 assert.equal(change('opacity-80! hover:opacity-40','','opacity',50),'hover:opacity-40 !opacity-[0.5]');
 assert.equal(change('opacity-80!','md:','opacity',25),'opacity-80! md:!opacity-[0.25]');
 assert.equal(change('visible md:invisible hover:visible','md:','visibility','collapse'),'visible hover:visible md:collapse');
 assert.equal(change('mix-blend-screen isolate','','mix-blend-mode','multiply'),'isolate mix-blend-multiply');
 assert.equal(change('mix-blend-screen isolate','','isolation','auto'),'mix-blend-screen isolation-auto');
 assert.equal(change('opacity-80 md:opacity-60 hover:opacity-20','md:','opacity',null),'opacity-80 hover:opacity-20');
 assert.equal(change('[opacity:.2] shadow-lg','','opacity',75),'shadow-lg opacity-[0.75]');
});
test('React shared style controls validate values before generating any source classes',()=>{
 for(const [property,value]of [['opacity',NaN],['opacity',-1],['opacity',101],['visibility','none'],['mix-blend-mode','multiply;bad'],['unknown',null]])assert.throws(()=>change('p-4','',property,value));
 assert.equal(change(null,'','visibility','hidden'),'invisible');
 const original='opacity-80 hover:opacity-95 md:opacity-90';assert.equal(change(original,'','visibility',null),original);assert.equal(change(original,'lg:','opacity',null),original);
});
