'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),F=require('../shell/filter-stack.js');
test('filter stack edits preserve duplicates, ordering and untouched functions',()=>{
 const value='blur(2px) brightness(80%) blur(4px)';assert.equal(F.change(value,'value',2,'6px'),'blur(2px) brightness(80%) blur(6px)');assert.equal(F.change(value,'up',2),'blur(2px) blur(4px) brightness(80%)');assert.equal(F.change(value,'down',0),'brightness(80%) blur(2px) blur(4px)');assert.equal(F.change(value,'remove',1),'blur(2px) blur(4px)');assert.equal(F.change('blur(2px)','remove',0),'none');assert.equal(F.change('none','add',0,'contrast'),'contrast(100%)');assert.equal(F.change(value,'type',1,'sepia'),'blur(2px) sepia(100%) blur(4px)');
});
test('filter editing rejects invalid arguments, unsafe values and oversized stacks',()=>{
 for(const args of [['none','value',0,'4px'],['blur(2px)','value',0,'-2px'],['blur(2px)','up',0],['blur(2px)','value',0,'2px) url(evil'],['none','add',0,'url'],['blur(2px)','bad',0]])assert.throws(()=>F.change(...args));assert.throws(()=>F.change(Array(16).fill('blur(1px)').join(' '),'add',0,'blur'));assert.equal(F.amount({name:'contrast',arg:'1.25'}),125);assert.equal(F.amount({name:'hue-rotate',arg:'.5turn'}),180);
});
