(function(root){
 'use strict';
 function create(){let resolve,settled=false;const finished=new Promise(done=>resolve=done);return {finished,finish(completed){if(settled)return;settled=true;resolve(completed===true);}};}
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPrototypeCompletion=api;
})(typeof window==='object'?window:globalThis);
