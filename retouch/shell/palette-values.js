(function(root){
 'use strict';
 function parse(value){
  if(typeof value!=='string')throw Error('Enter a hex color or Display P3 color.');
  if(/^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value)){
   let hex=value.slice(1).toLowerCase();if(hex.length<5)hex=[...hex].map(c=>c+c).join('');if(hex.length===6)hex+='ff';return {value:'#'+hex,space:'srgb',channels:[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255),alpha:parseInt(hex.slice(6),16)/255};
  }
  const match=/^color\(display-p3\s+([^()]+)\)$/i.exec(value);
  if(match){const parts=match[1].trim().split(/\s*\/\s*/),channels=parts[0].split(/\s+/),alpha=parts[1]??'1',values=[...channels,alpha];if(parts.length<=2&&channels.length===3&&values.every(v=>/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v)&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=1)){const numbers=values.map(Number);return {value:p3(numbers.slice(0,3),numbers[3]),space:'display-p3',channels:numbers.slice(0,3),alpha:numbers[3]};}}
  throw Error('Enter a hex color or color(display-p3 r g b / alpha), with channels from 0 to 1.');
 }
 function p3(channels,alpha){return 'color(display-p3 '+channels.join(' ')+' / '+alpha+')';}
 function valid(value){try{parse(value);return true;}catch{return false;}}
 const api={parse,p3,valid};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPaletteValues=api;
})(typeof window==='object'?window:globalThis);
