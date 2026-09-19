'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),K=require('../shell/prototype-keys.js'),V=require('../shell/prototype-values.js');
test('keyboard shortcuts normalize modifiers and match physical keys exactly',()=>{
 const v=K.validate({code:'KeyK',shift:true});assert.equal(K.label(v),'Shift + K');assert.equal(K.matches(v,{code:'KeyK',shiftKey:true}),true);
 for(const event of [{code:'KeyK'},{code:'KeyK',shiftKey:true,ctrlKey:true},{code:'KeyL',shiftKey:true},{code:'KeyK',shiftKey:true,repeat:true},{code:'KeyK',shiftKey:true,isComposing:true}])assert.equal(K.matches(v,event),false);
 for(const value of [null,{},[],{code:'ShiftLeft'},{code:'KeyA',ctrl:'true'},{code:'KeyA',extra:true},{code:'<script>'}])assert.throws(()=>K.validate(value));
});
test('layers allow multiple distinct shortcuts but reject duplicate and misplaced shortcut metadata',()=>{
 const item={trigger:'keyboard',shortcut:{code:'KeyK'},action:'back'},other={...item,shortcut:{code:'KeyL'}};
 assert.equal(V.validate([item,other]).length,2);assert.throws(()=>V.validate([item,item]));assert.throws(()=>V.validate([{...item,trigger:'click'}]));assert.throws(()=>V.validate([{trigger:'keyboard',action:'back'}]));
 const values=[];for(let i=0;i<32;i++)values.push({...item,shortcut:K.next(values)});assert.equal(V.validate(values).length,32);assert.throws(()=>V.validate([...values,{...item,shortcut:K.next(values)}]));
 assert.deepEqual(V.parse(JSON.stringify(V.validate(values))),V.validate(values));
 const long=V.validate(values.map(item=>({...item,action:'navigate',destination:'/'+ 'x'.repeat(2047)}))),encoded=JSON.stringify(long);assert.ok(encoded.length>16384);assert.deepEqual(V.parse(encoded),long,'valid collections remain readable at their maximum URL lengths');
});
