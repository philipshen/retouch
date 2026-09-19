(function(root){
 'use strict';
 const attribute='data-rt-prototype',positions=['center','top-left','top-center','top-right','center-left','center-right','bottom-left','bottom-center','bottom-right'];
 const transitions={
  'open-overlay':['instant','dissolve','move-in','slide-in'],
  'close-overlay':['instant','dissolve','move-out','slide-out'],
  'swap-overlay':['instant','dissolve','move-in','move-out','push','slide-in','slide-out']
 },easings=['linear','ease-in','ease-out','ease-in-out'];
 function transition(value,action){
  if(!transitions[action]||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['type','duration','easing','direction'].includes(key))||!transitions[action].includes(value.type))throw Error('Choose a supported transition for this action.');
  if(value.type==='instant')return {type:'instant'};
  const result={type:value.type,duration:value.duration??300,easing:value.easing??'ease-out'};
  if(!Number.isInteger(result.duration)||result.duration<1||result.duration>10000||!easings.includes(result.easing))throw Error('Choose a duration from 1 to 10000 ms and a supported easing curve.');
  if(value.type!=='dissolve'){result.direction=value.direction??'right';if(!['left','right','top','bottom'].includes(result.direction))throw Error('Choose a transition direction.');}
  else if(value.direction!==undefined)throw Error('Dissolve does not have a direction.');
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
  if(!Array.isArray(value)||value.length>3)throw Error('Use at most one interaction per trigger.');
  const used=new Set();return value.map(item=>{
   if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!['trigger','action','destination','preserveScroll','overlay','transition'].includes(key))||!['click','mouseenter','mouseleave'].includes(item.trigger)||used.has(item.trigger))throw Error('Choose distinct supported interaction triggers.');used.add(item.trigger);
   if(!['navigate','back','scroll','open-overlay','swap-overlay','close-overlay'].includes(item.action))throw Error('Choose a supported navigation or overlay action.');
   if(['navigate','open-overlay','swap-overlay'].includes(item.action)&&!route(item.destination))throw Error('Choose a project page URL beginning with /.');
   if(item.action==='scroll'&&(typeof item.destination!=='string'||!item.destination||item.destination.length>256||/[\u0000-\u0020\u007f]/.test(item.destination)))throw Error('Choose the destination element ID without #.');
   if(['back','close-overlay'].includes(item.action)&&item.destination!==undefined)throw Error('This action does not have a destination.');
   if(item.preserveScroll!==undefined&&(item.action!=='navigate'||typeof item.preserveScroll!=='boolean'))throw Error('Scroll preservation is available for navigation only.');
   if(item.overlay!==undefined&&item.action!=='open-overlay')throw Error('Overlay settings belong to Open overlay. Swap overlay keeps the current settings.');
   return {trigger:item.trigger,action:item.action,...(!['back','close-overlay'].includes(item.action)?{destination:item.destination}:{}),...(item.action==='navigate'?{preserveScroll:!!item.preserveScroll}:{}),...(item.action==='open-overlay'?{overlay:overlay(item.overlay)}:{}),...(item.transition!==undefined?{transition:transition(item.transition,item.action)}:{})};
  });
 }
 function parse(value){if(value===null)return [];if(typeof value!=='string'||value.length>16384)throw Error('Invalid prototype interactions.');return validate(JSON.parse(value));}
 const api={attribute,positions,transitions,easings,transition,overlay,route,validate,parse};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPrototypeValues=api;
})(typeof window==='object'?window:globalThis);
