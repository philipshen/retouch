'use strict';
module.exports=()=>{
 const API=parent.RetouchSVGDraw,outer=document.createElement('div'),inner=document.createElement('div');outer.style.cssText='position:fixed;left:20px;top:20px;width:200px;height:120px;overflow:scroll;padding:8px;border:3px solid;visibility:hidden';inner.style.cssText='position:relative;width:600px;height:500px;transform:rotate(12deg);transform-origin:30px 40px';outer.append(inner);document.body.append(outer);
 const assert=(condition,message)=>{if(!condition)throw Error(message);},equal=(a,b)=>['a','b','c','d','e','f'].every(key=>Math.abs(a[key]-b[key])<1e-6);
 try{
  let previous=API.stableNativeSpace(inner);assert(API.stableNativeSpace(inner)===previous,'stable frame reuses its measurement');assert(equal(previous.matrix,API.nativeSpace(inner).matrix),'initial cached matrix matches DOM probes');
  const changes=[()=>{outer.scrollLeft=23;outer.scrollTop=17;assert(outer.scrollLeft===23&&outer.scrollTop===17,'fixture must actually scroll');},()=>inner.style.transformOrigin='70px 90px',()=>inner.style.transform='rotate(-17deg)',()=>outer.style.width='230px',()=>outer.style.transform='scale(.8,1.2)',()=>{const wrapper=document.createElement('div');wrapper.style.display='contents';outer.append(wrapper);wrapper.append(inner);}];
  for(const change of changes){change();assert(!previous.current(),'changed frame invalidates earlier measurement');const next=API.stableNativeSpace(inner);assert(next!==previous,'changed frame is remeasured');assert(equal(next.matrix,API.nativeSpace(inner).matrix),'remeasured matrix matches current DOM probes');assert(API.stableNativeSpace(inner)===next,'remeasured frame can be reused');previous=next;}
 }finally{outer.remove();}
};
