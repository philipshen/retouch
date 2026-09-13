(function(root){
 'use strict';
 function valid(value){
  if(typeof value!=='string'||!value||value.length>2048||/[\u0000-\u0020\u007f\\]/.test(value))return false;
  const scheme=/^([a-z][a-z0-9+.-]*):/i.exec(value);
  return !scheme||/^(https?|mailto|tel)$/i.test(scheme[1]);
 }
 const api={valid};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchLinkValues=api;
})(typeof window==='object'?window:globalThis);
