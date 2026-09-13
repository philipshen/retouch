'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{evaluate}=require('../shell/numeric-expression.js');
test('Numeric expressions respect arithmetic precedence, powers and signed values',()=>{
 for(const [text,value] of [['60*1.5',90],['(120 - 16) / 2',52],['2+3*4',14],['2^3^2',512],['-2^2',-4],['(-2)^2',4],['2^-2',.25],['-20',-20],['+24',24],['60+24',84],['60-24',36],['.5 + .25',.75],['1e2 / 4',25],['1--2',3],['0',0],['-0',0],['100000',100000],['1e13 / 1e12',10]])assert.equal(evaluate(text),value,text);
});
test('Invalid calculations cannot execute code or return nonfinite values',()=>{
 for(const text of ['', ' ', '*1.5', '1/0','0/0','1e999','2^1024','(-1)^.5','1 2','2(3)','(2+3','2+3)','1+','1.2.3','Math.random()','alert(1)','globalThis.x=1','1;2','0x20','20px','50%','[1]','2**3',null])assert.throws(()=>evaluate(text),undefined,String(text));
 assert.throws(()=>evaluate('('.repeat(17)+'1'+')'.repeat(17)),/nested/);assert.throws(()=>evaluate('1+'.repeat(129)+'1'),/calculation|number/);
});
test('Escape restores rounded display values without applying them to precise source values',()=>{
 const {field}=require('../shell/numeric-expression.js');let writes=0;const input={value:'0',onchange:()=>writes++,setCustomValidity:()=>{},blur(){this.onchange({});}};field(input);input.value='2+3';input.onkeydown({key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(input.value,'0');assert.equal(writes,0);input.value='2+3';input.onkeydown({key:'Enter',preventDefault(){},stopPropagation(){}});assert.equal(writes,1);
});
