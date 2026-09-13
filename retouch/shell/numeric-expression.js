(function(root){
 'use strict';
 function evaluate(text){
  if(typeof text!=='string'||!text.trim()||text.length>256)throw Error('Enter a number or a calculation, such as (120 - 16) / 2.');
  const tokens=[];let offset=0;
  while(offset<text.length){if(/\s/.test(text[offset])){offset++;continue;}const number=text.slice(offset).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);if(number){tokens.push(Number(number[0]));offset+=number[0].length;}else if('+-*/^()'.includes(text[offset]))tokens.push(text[offset++]);else throw Error('Use numbers, +, -, *, /, ^ and parentheses.');if(tokens.length>128)throw Error('Use a shorter calculation.');}
  let index=0,depth=0;
  const checked=value=>{if(!Number.isFinite(value))throw Error('The calculation must produce a finite number.');return value;};
  function atom(){const token=tokens[index++];if(typeof token==='number')return checked(token);if(token==='('){if(++depth>16)throw Error('Use fewer nested parentheses.');const value=sum();if(tokens[index++]!==')')throw Error('Close each opening parenthesis.');depth--;return value;}throw Error('Enter a number after each operator.');}
  function power(){let value=atom();if(tokens[index]==='^'){index++;value=checked(value**unary());}return value;}
  function unary(){if(tokens[index]==='+'||tokens[index]==='-'){const sign=tokens[index++];return checked((sign==='-'?-1:1)*unary());}return power();}
  function product(){let value=unary();while(tokens[index]==='*'||tokens[index]==='/'){const op=tokens[index++],other=unary();if(op==='/'&&other===0)throw Error('Cannot divide by zero.');value=checked(op==='*'?value*other:value/other);}return value;}
  function sum(){let value=product();while(tokens[index]==='+'||tokens[index]==='-'){const op=tokens[index++],other=product();value=checked(op==='+'?value+other:value-other);}return value;}
  const value=sum();if(index!==tokens.length)throw Error('Separate numbers with an operator and check the parentheses.');return Object.is(value,-0)?0:value;
 }
 function field(input){const original=input.value,change=input.onchange;input.onchange=e=>{if(input.value===original){input.setCustomValidity('');return;}change?.(e);};input.title='Calculations: append +24 or *1.5, or enter (120 - 16) / 2';input.onkeydown=e=>{if(e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='Enter'){e.preventDefault();e.stopPropagation();input.blur();}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();input.value=original;input.setCustomValidity('');input.blur();}};}
 const api={evaluate,field};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchNumericExpression=api;
})(typeof window==='object'?window:globalThis);
