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
 function quantity(text,unit=''){
  if(typeof text!=='string')return null;
  const match=/^([\d.eE+\-*/^()\s]+?)(px|rem|em|vw|vh|ch|%)?$/.exec(text.trim());
  return match?{value:evaluate(match[1]),unit:match[2]||unit}:null;
 }
 function decimal(value){
  if(typeof value!=='number'||!Number.isFinite(value))throw Error('Use a finite number.');
  const text=String(value);if(!text.includes('e'))return text;
  const [mantissa,power]=text.split('e'),negative=mantissa.startsWith('-'),unsigned=negative?mantissa.slice(1):mantissa,parts=unsigned.split('.'),digits=parts.join(''),point=parts[0].length+Number(power);
  return (negative?'-':'')+(point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point));
 }
 function calculation(input,{unit='',displayValue}={}){
  const numeric=input.type==='number',initial=displayValue??input.value,min=input.min===''?-Infinity:Number(input.min),max=input.max===''?Infinity:Number(input.max);
  let currentUnit=unit,held=false;try{currentUnit=quantity(initial,unit)?.unit||unit;}catch{}
  if(numeric){input.type='text';input.inputMode='decimal';}input.value=initial;
  const parse=()=>{const result=quantity(input.value,currentUnit);if(!result){if(numeric)throw Error('Enter a number or a calculation.');return null;}if(numeric&&result.unit!==unit)throw Error('Use '+(unit==='%'?'percent':unit==='px'?'pixels':'a unitless value')+' in this field.');if(numeric&&(result.value<min||result.value>max))throw Error('Enter a value from '+min+' to '+max+'.');return result;};
  const format=result=>decimal(result.value)+(numeric?'':result.unit);
  input.addEventListener('input',()=>input.setCustomValidity(''));
  const normalize=()=>{
   if(input.disabled)return false;
   try{const result=parse();if(result){input.value=format(result);currentUnit=result.unit;}input.setCustomValidity('');return true;}
   catch(error){input.setCustomValidity(error.message);input.reportValidity();return false;}
  };
  input.addEventListener('change',event=>{held=false;if(input.disabled||input.value===initial)return;if(!normalize())event.stopImmediatePropagation();},true);
  if(numeric){
   input.addEventListener('keydown',event=>{if(event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||!['ArrowUp','ArrowDown'].includes(event.key))return;try{const result=parse();if(!result)return;event.preventDefault();event.stopPropagation();held=true;result.value=Math.max(min,Math.min(max,result.value+(event.key==='ArrowUp'?1:-1)*(event.shiftKey?10:1)));input.value=format(result);input.dispatchEvent(new Event('input',{bubbles:true}));}catch{};});
   const finish=queue=>{if(!held)return;held=false;if(queue)root.RetouchPanelFocus?.queue(input);input.dispatchEvent(new Event('change',{bubbles:true}));};
   input.addEventListener('keyup',event=>{if(['ArrowUp','ArrowDown'].includes(event.key))finish(true);});
   input.addEventListener('keydown',event=>{if(event.key==='Escape')held=false;});input.addEventListener('blur',()=>finish(false));
  }
  input.title=(input.title?input.title+' ':'')+'Calculations: 2 * 3 or (12 + 4) / 2. A trailing CSS unit applies to the result.';
  return normalize;
 }
 function field(input){const original=input.value,change=input.onchange;input.onchange=e=>{if(input.value===original){input.setCustomValidity('');return;}change?.(e);};input.title='Calculations: append +24 or *1.5, or enter (120 - 16) / 2';input.onkeydown=e=>{if(e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='Enter'){e.preventDefault();e.stopPropagation();input.blur();}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();input.value=original;input.setCustomValidity('');input.blur();}};}
 const api={evaluate,quantity,decimal,calculation,field};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchNumericExpression=api;
})(typeof window==='object'?window:globalThis);
