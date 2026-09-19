(function(root){
 'use strict';
 const attribute='data-rt-prototype';
 function route(value){if(typeof value!=='string'||value.length>2048||!value.startsWith('/')||value.startsWith('//')||/[\u0000-\u0020\u007f\\]/.test(value))return false;try{const url=new URL(value,'http://retouch.local');return url.origin==='http://retouch.local'&&!/^\/rt(?:\/|$)/.test(decodeURIComponent(url.pathname));}catch{return false;}}
 function validate(value){
  if(!Array.isArray(value)||value.length>3)throw Error('Use at most one interaction per trigger.');
  const used=new Set();return value.map(item=>{
   if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!['trigger','action','destination','preserveScroll'].includes(key))||!['click','mouseenter','mouseleave'].includes(item.trigger)||used.has(item.trigger))throw Error('Choose distinct supported interaction triggers.');used.add(item.trigger);
   if(!['navigate','back','scroll'].includes(item.action))throw Error('Choose Navigate to, Back or Scroll to.');
   if(item.action==='navigate'&&!route(item.destination))throw Error('Choose a project page URL beginning with /.');
   if(item.action==='scroll'&&(typeof item.destination!=='string'||!item.destination||item.destination.length>256||/[\u0000-\u0020\u007f]/.test(item.destination)))throw Error('Choose the destination element ID without #.');
   if(item.action==='back'&&item.destination!==undefined)throw Error('Back does not have a destination.');
   if(item.preserveScroll!==undefined&&(item.action!=='navigate'||typeof item.preserveScroll!=='boolean'))throw Error('Scroll preservation is available for navigation only.');
   return {trigger:item.trigger,action:item.action,...(item.action!=='back'?{destination:item.destination}:{}),...(item.action==='navigate'?{preserveScroll:!!item.preserveScroll}:{})};
  });
 }
 function parse(value){if(value===null)return [];if(typeof value!=='string'||value.length>16384)throw Error('Invalid prototype interactions.');return validate(JSON.parse(value));}
 const api={attribute,route,validate,parse};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPrototypeValues=api;
})(typeof window==='object'?window:globalThis);
