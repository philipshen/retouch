(function(root){
 'use strict';
 function parse(value){
  if(typeof value!=='string')throw Error('Enter a hex color or explicit sRGB or Display P3 color.');
  if(/^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value)){
   let hex=value.slice(1).toLowerCase();if(hex.length<5)hex=[...hex].map(c=>c+c).join('');if(hex.length===6)hex+='ff';return {value:'#'+hex,space:'srgb',channels:[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255),alpha:parseInt(hex.slice(6),16)/255};
  }
  const match=/^color\((srgb|display-p3)\s+([^()]+)\)$/i.exec(value);
  if(match){const parts=match[2].trim().split(/\s*\/\s*/),channels=parts[0].split(/\s+/),alpha=parts[1]??'1',values=[...channels,alpha];if(parts.length<=2&&channels.length===3&&values.every(v=>/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v)&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=1)){const numbers=values.map(Number);const space=match[1].toLowerCase();return {value:space==='srgb'?srgb(numbers.slice(0,3),numbers[3]):p3(numbers.slice(0,3),numbers[3]),space,channels:numbers.slice(0,3),alpha:numbers[3]};}}
  throw Error('Enter a hex color, color(srgb r g b / alpha) or color(display-p3 r g b / alpha), with channels from 0 to 1.');
 }
 function srgb(channels,alpha){const values=[...channels,alpha];return values.every(n=>Math.abs(n*255-Math.round(n*255))<1e-8)?'#'+values.map(n=>Math.round(n*255).toString(16).padStart(2,'0')).join(''):'color(srgb '+channels.join(' ')+' / '+alpha+')';}
 function p3(channels,alpha){return 'color(display-p3 '+channels.join(' ')+' / '+alpha+')';}
 function valid(value){try{parse(value);return true;}catch{return false;}}
 // D65 primaries and transfer curves: W3C CSS Color 4, color-conversion-code.
 // https://www.w3.org/TR/css-color-4/#color-conversion-code
 const toXYZ={srgb:[[506752/1228815,87881/245763,12673/70218],[87098/409605,175762/245763,12673/175545],[7918/409605,87881/737289,1001167/1053270]],'display-p3':[[608311/1250200,189793/714400,198249/1000160],[35783/156275,247089/357200,198249/2500400],[0,32229/714400,5220557/5000800]]};
 const fromXYZ={srgb:[[12831/3959,-329/214,-1974/3959],[-851781/878810,1648619/878810,36519/878810],[705/12673,-2585/12673,705/667]],'display-p3':[[446124/178915,-333277/357830,-72051/178915],[-14852/17905,63121/35810,423/17905],[11844/330415,-50337/660830,316169/330415]]};
 const multiply=(matrix,vector)=>matrix.map(row=>row.reduce((sum,n,i)=>sum+n*vector[i],0));
 function convert(value,space,clip=false){
  if(!Object.hasOwn(toXYZ,space))throw Error('Choose sRGB or Display P3.');const original=parse(value);
  if(original.space===space)return {value:original.value,clipped:false};
  const linear=original.channels.map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4),xyz=multiply(toXYZ[original.space],linear),channels=multiply(fromXYZ[space],xyz).map(n=>Math.abs(n)<=0.0031308?12.92*n:Math.sign(n)*(1.055*Math.abs(n)**(1/2.4)-0.055)),clipped=channels.some(n=>n< -1e-7||n>1+1e-7);
  if(clipped&&!clip)return {value:null,clipped:true};
  const bounded=channels.map(n=>Math.max(0,Math.min(1,n)));
  return {value:space==='display-p3'?p3(bounded.map(n=>Number(n.toFixed(12))),original.alpha):srgb(bounded.map(n=>Math.round(n*255)/255),original.alpha),clipped};
 }
 const api={parse,p3,srgb,valid,convert};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPaletteValues=api;
})(typeof window==='object'?window:globalThis);
