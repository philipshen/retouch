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

test('calculated quantities keep CSS units and preserve ordinary CSS syntax for its own validator',()=>{
 const {quantity}=require('../shell/numeric-expression.js');
 assert.deepEqual(quantity('(2 + 3) * 2px'),{value:10,unit:'px'});
 assert.deepEqual(quantity('100 / 4','%'),{value:25,unit:'%'});
 assert.deepEqual(quantity('2^3rem'),{value:8,unit:'rem'});
 assert.deepEqual(quantity('1e2 / 10','em'),{value:10,unit:'em'});
 for(const value of ['var(--width)','2px 3px','calc(1em + 2px)','red','alert(1)'])assert.equal(quantity(value),null);
 for(const value of ['1/0px','1+','1 2','1e999'])assert.throws(()=>quantity(value));
});

test('calculated decimals avoid CSS exponent notation without rounding numeric precision',()=>{
 const {decimal,quantity}=require('../shell/numeric-expression.js'),V=require('../shell/html-css-values.js');
 for(const number of [0,-0,.123456789123456,1e-7,-1.2345e-7,1e21,Number.MIN_VALUE,Number.MAX_VALUE]){const text=decimal(number);assert.ok(!/[eE]/.test(text));assert.equal(Number(text),number===0?0:number);}
 assert.equal(decimal(quantity('1 / 10000000px').value),'0.0000001');assert.ok(V.valid('border-width',decimal(1e-7)+'px'));assert.ok(V.valid('stroke-width',decimal(1e-7)+'px'));
 for(const bad of [NaN,Infinity,-Infinity,'1'])assert.throws(()=>decimal(bad));
});
