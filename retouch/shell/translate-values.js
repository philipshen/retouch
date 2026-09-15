(function(root){
 'use strict';
 const number='[+-]?(?:\\d*\\.)?\\d+',simple=new RegExp('^('+number+')(px|%)$'),sum=new RegExp('^calc\\(\\s*('+number+')(px|%)\\s+([+-])\\s+((?:\\d*\\.)?\\d+)(px|%)\\s*\\)$');
 const bounded=value=>Number.isFinite(value)&&Math.abs(value)<=100000;
 function axis(value){
  if(value==='0')return {percent:0,pixels:0};
  const match=simple.exec(value),calc=sum.exec(value),result={percent:0,pixels:0};
  if(match)result[match[2]==='%'?'percent':'pixels']=Number(match[1]);
  else if(calc){result[calc[2]==='%'?'percent':'pixels']+=Number(calc[1]);result[calc[5]==='%'?'percent':'pixels']+=(calc[3]==='-'?-1:1)*Number(calc[4]);}
  else throw Error('Group movement needs two-dimensional length or percentage translations.');
  if(!Object.values(result).every(bounded))throw Error('Keep group offsets within 100,000 pixels or percent.');return result;
 }
 function parse(value){
  if(!value||value==='none')return [axis('0'),axis('0')];
  if(typeof value!=='string'||value.length>150)throw Error('Invalid translation.');
  const parts=value.trim().match(/calc\([^()]*\)|[^\s]+/g)||[];
  if(parts.length<1||parts.length>2)throw Error('Group movement needs a two-dimensional translation.');
  return [axis(parts[0]),axis(parts[1]||'0')];
 }
 const round=n=>Math.round(n*1e6)/1e6;
 function format(values){return values.map(({percent,pixels})=>{if(![percent,pixels].every(bounded))throw Error('Keep group offsets within 100,000 pixels or percent.');percent=round(percent);pixels=round(pixels);return percent?(pixels?'calc('+percent+'% '+(pixels<0?'-':'+')+' '+Math.abs(pixels)+'px)':percent+'%'):pixels+'px';}).join(' ');}
 function add(value,delta){if(![delta.x,delta.y].every(Number.isFinite))throw Error('Use a finite group movement.');return format(parse(value).map((item,i)=>({...item,pixels:item.pixels+(i?delta.y:delta.x)})));}
 function valid(value){try{return typeof value==='string'&&format(parse(value))===value;}catch{return false;}}
 const api={parse,format,add,valid};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchTranslateValues=api;
})(typeof window==='object'?window:globalThis);
