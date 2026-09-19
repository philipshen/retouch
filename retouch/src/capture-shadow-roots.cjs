'use strict';
// Installed before page scripts so imperative closed roots can be read without
// changing the mode returned to the application.
module.exports=function installShadowCapture(key){
 const roots=new WeakMap(),attach=Element.prototype.attachShadow;
 Object.defineProperty(Element.prototype,'attachShadow',{...Object.getOwnPropertyDescriptor(Element.prototype,'attachShadow'),value:function(...args){const root=Reflect.apply(attach,this,args);roots.set(this,root);return root;}});
 Object.defineProperty(window,key,{value:element=>roots.get(element),configurable:true});
};
