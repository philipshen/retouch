'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../shell/prototype-expressions.js');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),lit=(type,value)=>({kind:'literal',type,value}),num=value=>lit('number',value),bool=value=>lit('boolean',value),str=value=>lit('string',value),variable=(n,type='number')=>({kind:'variable',id:id(n),type}),op=(name,...args)=>({kind:'operation',op:name,args});
test('typed expressions combine arithmetic, comparisons, logic and text without coercion',()=>{
 const formula=op('if',op('and',op('>=',variable(1),num(2)),op('not',variable(2,'boolean'))),op('+',str('Total: '),op('to-string',op('*',op('+',variable(1),num(1)),num(3)))),str('Empty'));
 const original=JSON.stringify(formula);assert.deepEqual(E.evaluate(formula,n=>n===id(1)?{type:'number',value:2}:{type:'boolean',value:false}),{type:'string',value:'Total: 9'});assert.equal(JSON.stringify(formula),original);
 for(const [name,a,b,value]of [['+',5,2,7],['-',5,2,3],['*',5,2,10],['/',5,2,2.5],['%',5,2,1],['<',5,2,false],['<=',2,2,true],['>',5,2,true],['>=',2,2,true],['==',5,2,false],['!=',5,2,true]])assert.equal(E.evaluate(op(name,num(a),num(b))).value,value);
 assert.equal(E.evaluate(op('negate',num(2))).value,-2);assert.equal(E.evaluate(op('concat',str('Hello '),str('世界'))).value,'Hello 世界');assert.equal(E.evaluate(op('to-string',bool(false))).value,'false');
});
test('dependencies are typed, deduplicated and resolved once per evaluation snapshot',()=>{
 const expression=op('+',variable(1),variable(1)),checked=E.analyze(expression);assert.deepEqual(checked.references,[{id:id(1),type:'number'}]);let calls=0;
 assert.equal(E.evaluate(expression,()=>({type:'number',value:++calls})).value,2);assert.equal(calls,1);
 assert.notEqual(checked.expression,expression);assert.notEqual(checked.expression.args,expression.args);checked.expression.args[0].id=id(2);assert.equal(expression.args[0].id,id(1));
 assert.throws(()=>E.analyze(op('if',bool(true),variable(1),variable(1,'string'))),/conflicting types/);
});
test('conditional and Boolean evaluation short-circuit unneeded variable reads and division',()=>{
 const missing=variable(99,'boolean'),resolve=()=>{throw Error('should not resolve');};
 assert.equal(E.evaluate(op('and',bool(false),missing),resolve).value,false);assert.equal(E.evaluate(op('or',bool(true),missing),resolve).value,true);
 assert.equal(E.evaluate(op('if',bool(true),num(7),op('/',num(1),num(0)))).value,7);
 assert.throws(()=>E.evaluate(op('if',bool(false),num(7),op('/',num(1),num(0)))),/divide by zero/);
});
test('color literals normalize and equality preserves value types',()=>{
 assert.deepEqual(E.evaluate(lit('color','#abc')),{type:'color',value:'#aabbccff'});assert.equal(E.evaluate(op('==',lit('color','#abc'),lit('color','#aabbccff'))).value,true);
 assert.equal(E.evaluate(op('==',bool(false),bool(false))).value,true);assert.equal(E.evaluate(op('==',str(''),str(''))).value,true);
 for(const expression of [op('+',num(1),str('1')),op('==',num(1),bool(true)),op('<',str('a'),str('b')),op('and',num(1),num(0)),op('concat',str('n'),num(2)),op('if',num(1),num(2),num(3)),op('if',bool(true),num(1),str('one'))])assert.throws(()=>E.analyze(expression));
});
test('invalid syntax, executable-shaped nodes and missing or changed variables fail closed',()=>{
 for(const expression of [null,[],{},'1+2',{...num(1),extra:true},{kind:'operation',op:'constructor',args:[]},op('eval',str('process.exit()')),op('+',num(1)),op('not',bool(true),bool(false)),{kind:'variable',type:'number',id:'process.env'},lit('object',{}),lit('string','\0'),lit('color','url(/x)'),lit('number','1'),lit('boolean',0)])assert.throws(()=>E.validate(expression));
 assert.throws(()=>E.evaluate(variable(1)),/resolver/);for(const value of [null,{type:'string',value:'1'},{type:'number',value:'1'},{type:'number',value:NaN},Promise.resolve({type:'number',value:1})])assert.throws(()=>E.evaluate(variable(1),()=>value));
});
test('input and intermediate bounds reject overflow, oversized text, deep trees and cycles',()=>{
 for(const value of [NaN,Infinity,-Infinity,1000001,-1000001])assert.throws(()=>E.evaluate(num(value)),/finite/);
 for(const expression of [op('*',num(1000000),num(2)),op('/',num(1000000),num(.000001)),op('/',num(1),num(0)),op('%',num(1),num(-0)),op('concat',str('x'.repeat(4096)),str('x'))])assert.throws(()=>E.evaluate(expression));
 let deep=num(1);for(let n=0;n<16;n++)deep=op('negate',deep);assert.throws(()=>E.validate(deep),/16 levels/);
 let wide=num(1);for(let n=0;n<7;n++)wide=op('+',wide,wide);assert.throws(()=>E.validate(wide),/128 expression nodes/);
 const cycle=op('negate',null);cycle.args[0]=cycle;assert.throws(()=>E.validate(cycle),/16 levels/);
 assert.equal(E.evaluate(str('x'.repeat(4096))).value.length,4096);assert.equal(E.evaluate(op('-',num(1000000),num(1000000))).value,0);
});
