(function(root){
 'use strict';
 const S=typeof module==='object'&&module.exports?require('./prototype-spring.js'):root.RetouchPrototypeSpring;
 const K=typeof module==='object'&&module.exports?require('./prototype-keys.js'):root.RetouchPrototypeKeys;
 const attribute='data-rt-prototype',positions=['center','top-left','top-center','top-right','center-left','center-right','bottom-left','bottom-center','bottom-right'];
 const triggers=['click','mouseenter','mouseleave','mousedown','mouseup','after-delay','keyboard'];
 const transitions={
  'navigate':['instant','dissolve','move-in','move-out','push','slide-in','slide-out'],
  'back':['instant','dissolve','move-in','move-out','push','slide-in','slide-out'],
  'scroll':['instant','animate'],
  'open-overlay':['instant','dissolve','move-in','slide-in'],
  'close-overlay':['instant','dissolve','move-out','slide-out'],
  'swap-overlay':['instant','dissolve','move-in','move-out','push','slide-in','slide-out']
 },easings=['linear','ease-in','ease-out','ease-in-out'];
 const curves={'linear':[0,0,1,1],'ease-in':[.42,0,1,1],'ease-out':[0,0,.58,1],'ease-in-out':[.42,0,.58,1]};
 function easing(value){
  if(easings.includes(value))return value;
  if(value?.type==='spring'){const checked=S.validate(value);S.curve(checked);return checked;}
  if(!value||typeof value!=='object'||Array.isArray(value)||value.type!=='cubic-bezier'||Object.keys(value).some(key=>!['type','values'].includes(key))||!Array.isArray(value.values)||value.values.length!==4||value.values.some(n=>!Number.isFinite(n)||Math.abs(n)>10000)||[value.values[0],value.values[2]].some(n=>n<0||n>1))throw Error('Use four finite Bézier coordinates, with X values between 0 and 1 and Y values between -10000 and 10000.');
  return {type:'cubic-bezier',values:[...value.values]};
 }
 function easingCss(value){const checked=easing(value);return typeof checked==='string'?checked:checked.type==='spring'?S.curve(checked).css:'cubic-bezier('+checked.values.join(', ')+')';}
 function transition(value,action){
  if(!transitions[action]||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['type','duration','easing','direction'].includes(key))||!transitions[action].includes(value.type))throw Error('Choose a supported transition for this action.');
  if(value.type==='instant')return {type:'instant'};
  const result={type:value.type,duration:value.duration??300,easing:easing(value.easing??'ease-out')};
  if(!Number.isInteger(result.duration)||result.duration<1||result.duration>10000)throw Error('Choose a duration from 1 to 10000 ms and a supported easing curve.');
  if(result.easing?.type==='spring')result.duration=S.curve(result.easing).duration;
  if(!['dissolve','animate'].includes(value.type)){result.direction=value.direction??'right';if(!['left','right','top','bottom'].includes(result.direction))throw Error('Choose a transition direction.');}
  else if(value.direction!==undefined)throw Error('This animation does not have a direction.');
  return result;
 }
 function overlay(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['width','height','position','background','closeOutside'].includes(key)))throw Error('Invalid overlay settings.');
  const result={width:400,height:300,position:'center',background:'#00000040',closeOutside:true,...value};
  if(![result.width,result.height].every(n=>Number.isInteger(n)&&n>=80&&n<=7680))throw Error('Overlay dimensions must be whole pixels from 80 to 7680.');
  if(!positions.includes(result.position)||typeof result.closeOutside!=='boolean'||typeof result.background!=='string'||!/^#[0-9a-f]{8}$/i.test(result.background))throw Error('Choose a valid overlay position, background and dismissal setting.');
  result.background=result.background.toLowerCase();return result;
 }
 function route(value){if(typeof value!=='string'||value.length>2048||!value.startsWith('/')||value.startsWith('//')||/[\u0000-\u0020\u007f\\]/.test(value))return false;try{const url=new URL(value,'http://retouch.local');return url.origin==='http://retouch.local'&&!/^\/rt(?:\/|$)/.test(decodeURIComponent(url.pathname));}catch{return false;}}
 function validate(value){
  if(!Array.isArray(value)||value.length>32)throw Error('Use at most 32 interactions per source layer.');
  const used=new Set();return value.map(item=>{
   if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!['trigger','action','destination','preserveScroll','overlay','transition','delay','shortcut','scrollOffset'].includes(key))||!triggers.includes(item.trigger))throw Error('Choose distinct supported interaction triggers.');const key=item.trigger==='keyboard'?'keyboard:'+K.signature(item.shortcut):item.trigger;if(used.has(key))throw Error('Use each trigger or keyboard shortcut only once per layer.');used.add(key);
   if(item.trigger!=='keyboard'&&item.shortcut!==undefined)throw Error('Shortcuts belong to keyboard triggers.');
   if(item.trigger==='after-delay'&&(!Number.isInteger(item.delay)||item.delay<1||item.delay>10000)||item.trigger!=='after-delay'&&item.delay!==undefined)throw Error('After delay needs a whole duration from 1 to 10000 ms. Other triggers do not have a delay.');
   if(!['navigate','back','scroll','open-overlay','swap-overlay','close-overlay'].includes(item.action))throw Error('Choose a supported navigation or overlay action.');
   if(['navigate','open-overlay','swap-overlay'].includes(item.action)&&!route(item.destination))throw Error('Choose a project page URL beginning with /.');
   if(item.action==='scroll'&&(typeof item.destination!=='string'||!item.destination||item.destination.length>256||/[\u0000-\u0020\u007f]/.test(item.destination)))throw Error('Choose the destination element ID without #.');
   if(['back','close-overlay'].includes(item.action)&&item.destination!==undefined)throw Error('This action does not have a destination.');
   if(item.preserveScroll!==undefined&&(item.action!=='navigate'||typeof item.preserveScroll!=='boolean'))throw Error('Scroll preservation is available for navigation only.');
   if(item.overlay!==undefined&&item.action!=='open-overlay')throw Error('Overlay settings belong to Open overlay. Swap overlay keeps the current settings.');
   if(item.scrollOffset!==undefined&&(item.action!=='scroll'||!item.scrollOffset||typeof item.scrollOffset!=='object'||Array.isArray(item.scrollOffset)||Object.keys(item.scrollOffset).some(key=>!['x','y'].includes(key))||!['x','y'].every(key=>Number.isFinite(item.scrollOffset[key])&&Math.abs(item.scrollOffset[key])<=100000)))throw Error('Scroll offsets must be finite X and Y values between -100000 and 100000.');
   return {trigger:item.trigger,action:item.action,...(item.trigger==='keyboard'?{shortcut:K.validate(item.shortcut)}:{}),...(item.trigger==='after-delay'?{delay:item.delay}:{}),...(!['back','close-overlay'].includes(item.action)?{destination:item.destination}:{}),...(item.action==='navigate'?{preserveScroll:!!item.preserveScroll}:{}),...(item.action==='open-overlay'?{overlay:overlay(item.overlay)}:{}),...(item.scrollOffset!==undefined?{scrollOffset:{...item.scrollOffset}}:{}),...(item.transition!==undefined?{transition:transition(item.transition,item.action)}:{})};
  });
 }
 function parse(value){if(value===null)return [];if(typeof value!=='string'||value.length>131072)throw Error('Invalid prototype interactions.');return validate(JSON.parse(value));}
 const api={attribute,positions,triggers,transitions,easings,curves,easing,easingCss,transition,overlay,route,validate,parse};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPrototypeValues=api;
})(typeof window==='object'?window:globalThis);
