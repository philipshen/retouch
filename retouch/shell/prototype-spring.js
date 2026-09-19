(function(root){
 'use strict';
 const presets={gentle:{stiffness:100,damping:15,mass:1},quick:{stiffness:300,damping:24,mass:1},bouncy:{stiffness:200,damping:10,mass:1},slow:{stiffness:60,damping:12,mass:1}};
 function validate(value){
  if(!value||value.type!=='spring'||Object.keys(value).some(key=>!['type','stiffness','damping','mass'].includes(key))||!Number.isFinite(value.stiffness)||value.stiffness<1||value.stiffness>1000||!Number.isFinite(value.damping)||value.damping<.1||value.damping>100||!Number.isFinite(value.mass)||value.mass<.1||value.mass>10)throw Error('Use stiffness 1–1000, damping 0.1–100 and mass 0.1–10.');
  return {type:'spring',stiffness:value.stiffness,damping:value.damping,mass:value.mass};
 }
 function model(value){
  const {stiffness:k,damping:c,mass:m}=validate(value),a=c/(2*m),w2=k/m,delta=w2-a*a;
  if(Math.abs(delta)<1e-8*w2)return {frequency:Math.sqrt(w2),at:t=>({position:1-(1+a*t)*Math.exp(-a*t),velocity:w2*t*Math.exp(-a*t)}),bound:t=>[(1+a*t)*Math.exp(-a*t),w2*t*Math.exp(-a*t)]};
  if(delta>0){const b=Math.sqrt(delta);return {frequency:Math.sqrt(w2),at:t=>({position:1-Math.exp(-a*t)*(Math.cos(b*t)+a/b*Math.sin(b*t)),velocity:w2/b*Math.exp(-a*t)*Math.sin(b*t)}),bound:t=>[Math.exp(-a*t)*Math.min(1+a*t,Math.sqrt(1+a*a/(b*b))),Math.exp(-a*t)*w2*Math.min(t,1/b)]};}
  const d=Math.sqrt(-delta),r1=-w2/(a+d),r2=-a-d,den=r1-r2;
  return {frequency:Math.sqrt(w2),at:t=>({position:1-(-r2*Math.exp(r1*t)+r1*Math.exp(r2*t))/den,velocity:w2*(Math.exp(r1*t)-Math.exp(r2*t))/den}),bound:t=>[(-r2*Math.exp(r1*t)-r1*Math.exp(r2*t))/den,w2*(Math.exp(r1*t)+Math.exp(r2*t))/den]};
 }
 const cache=new Map();
 function curve(value){
  const checked=validate(value),key=JSON.stringify(checked);if(cache.has(key))return cache.get(key);
  const physical=model(checked);let duration=0;
  // Conservative displacement and velocity envelopes prevent stopping at a zero crossing.
  for(let ms=16;ms<=10000;ms+=16){const [distance,speed]=physical.bound(ms/1000);if(distance<=.001&&speed<=.01){duration=ms;break;}}
  if(!duration)throw Error('This spring takes more than 10 seconds to settle. Increase damping or stiffness, or reduce mass.');
  const count=Math.max(100,Math.ceil(duration/1000*physical.frequency*16)),samples=Array.from({length:count+1},(_,i)=>i===count?1:physical.at(duration/1000*i/count).position),css='linear('+samples.map(n=>Number(n.toFixed(6))).join(',')+')';
  const result=Object.freeze({duration,css,samples:Object.freeze(samples)});cache.set(key,result);if(cache.size>64)cache.delete(cache.keys().next().value);return result;
 }
 const api={presets,validate,model,curve};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPrototypeSpring=api;
})(typeof window==='object'?window:globalThis);
