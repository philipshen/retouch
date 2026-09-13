(function(root){
 'use strict';
 function fraction(value){if(value===null)return 0;if(typeof value!=='string'||!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?%?$/i.test(value))return null;const n=parseFloat(value)/(value.endsWith('%')?100:1);return Number.isFinite(n)?n:null;}
 function move(stops,index,value){
  if(!Array.isArray(stops)||!Number.isInteger(index)||index<0||index>=stops.length)return null;
  const offset=fraction(value),raw=stops.map(stop=>fraction(stop.offset));if(offset===null||offset<0||offset>1||raw.some(n=>n===null))return null;
  let previous=0;const original=raw.map(n=>previous=Math.max(previous,Math.max(0,Math.min(1,n)))),positions=original.map((n,i)=>i===index?offset:n),key=offset>original[index]?stops.length:offset<original[index]?-1:index,order=positions.map((_,i)=>i).sort((a,b)=>positions[a]-positions[b]||(a===index?key:a)-(b===index?key:b));
  return {raw,original,positions,order,index:order.indexOf(index)};
 }
 const api={fraction,move};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGGradientOrder=api;
})(typeof window==='object'?window:globalThis);
