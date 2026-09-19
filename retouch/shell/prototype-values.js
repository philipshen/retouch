(function(root){
 'use strict';
 const attribute='data-rt-prototype',positions=['center','top-left','top-center','top-right','center-left','center-right','bottom-left','bottom-center','bottom-right'];
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
   if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!['trigger','action','destination','preserveScroll','overlay'].includes(key))||!['click','mouseenter','mouseleave'].includes(item.trigger)||used.has(item.trigger))throw Error('Choose distinct supported interaction triggers.');used.add(item.trigger);
   if(!['navigate','back','scroll','open-overlay','swap-overlay','close-overlay'].includes(item.action))throw Error('Choose a supported navigation or overlay action.');
   if(['navigate','open-overlay','swap-overlay'].includes(item.action)&&!route(item.destination))throw Error('Choose a project page URL beginning with /.');
   if(item.action==='scroll'&&(typeof item.destination!=='string'||!item.destination||item.destination.length>256||/[\u0000-\u0020\u007f]/.test(item.destination)))throw Error('Choose the destination element ID without #.');
   if(['back','close-overlay'].includes(item.action)&&item.destination!==undefined)throw Error('This action does not have a destination.');
   if(item.preserveScroll!==undefined&&(item.action!=='navigate'||typeof item.preserveScroll!=='boolean'))throw Error('Scroll preservation is available for navigation only.');
   if(item.overlay!==undefined&&item.action!=='open-overlay')throw Error('Overlay settings belong to Open overlay. Swap overlay keeps the current settings.');
   return {trigger:item.trigger,action:item.action,...(!['back','close-overlay'].includes(item.action)?{destination:item.destination}:{}),...(item.action==='navigate'?{preserveScroll:!!item.preserveScroll}:{}),...(item.action==='open-overlay'?{overlay:overlay(item.overlay)}:{})};
  });
 }
 function parse(value){if(value===null)return [];if(typeof value!=='string'||value.length>16384)throw Error('Invalid prototype interactions.');return validate(JSON.parse(value));}
 const api={attribute,positions,overlay,route,validate,parse};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPrototypeValues=api;
})(typeof window==='object'?window:globalThis);
