'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{mount}=require('../shell/svg-drag.js');
test('SVG direct drag keeps clicks, rejects stale hover, and tracks the owning pointer',()=>{
 const d=new EventTarget(),w=new EventTarget();d.defaultView=w;w.innerWidth=100;const info={},vector={},starts=[];let current=info;
 const stop=mount({document:d,frame:{getBoundingClientRect:()=>({width:200})},candidate:()=>({info:current,target:vector}),onStart:(...args)=>starts.push(args)});
 const emit=(target,type,extra={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,{button:0,buttons:1,isPrimary:true,pointerId:1,clientX:10,clientY:10,...extra});target.dispatchEvent(e);return e;};
 emit(d,'pointerdown');emit(w,'pointermove',{clientX:11});emit(w,'pointerup',{clientX:11});assert.equal(starts.length,0);assert.equal(emit(d,'click',{clientX:11}).defaultPrevented,false);
 emit(d,'pointerdown');emit(w,'pointermove',{clientX:30,buttons:0});emit(w,'pointermove',{clientX:35});assert.equal(starts.length,0,'released pointer cannot start a stale drag');
 emit(d,'pointerdown');current={};emit(w,'pointermove',{clientX:20});assert.equal(starts.length,0,'selection replacement cancels pending drag');
 emit(d,'pointerdown');assert.equal(emit(w,'pointermove',{clientX:12}).defaultPrevented,true);assert.equal(starts.length,1);emit(w,'pointerup',{pointerId:2,clientX:50});emit(w,'pointerup',{clientX:20});assert.equal(emit(d,'click',{clientX:20}).defaultPrevented,true,'only the drag click is consumed');assert.equal(emit(d,'click',{clientX:20}).defaultPrevented,false);
 stop();emit(d,'pointerdown');emit(w,'pointermove',{clientX:20});assert.equal(starts.length,1);
});
test('Unselected vector drag retains quick release and cancels stale asynchronous preparation',async()=>{
 const d=new EventTarget(),w=new EventTarget();d.defaultView=w;w.innerWidth=100;let captured=null;const vector={setPointerCapture:id=>captured=id,hasPointerCapture:id=>captured===id,releasePointerCapture:()=>captured=null},info={},starts=[];let ready;
 const stop=mount({document:d,frame:{getBoundingClientRect:()=>({width:100})},candidate:()=>({target:vector}),prepare:(_,current)=>new Promise(resolve=>{ready=()=>resolve(current()?{target:vector,info}:null);}),onStart:(...args)=>starts.push(args)});
 const emit=(target,type,extra={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,{button:0,buttons:1,isPrimary:true,pointerId:1,clientX:10,clientY:10,...extra});target.dispatchEvent(e);return e;};
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 emit(d,'pointerdown');emit(w,'pointermove',{clientX:30});await settle();emit(w,'pointerup',{clientX:35,buttons:0});ready();await settle();assert.equal(starts.length,1);assert.equal(starts[0][2].clientX,35);assert.equal(starts[0][3],true);assert.equal(emit(d,'click',{clientX:35}).defaultPrevented,true);
 for(const cancel of [()=>emit(w,'keydown',{key:'Escape'}),()=>emit(w,'pointercancel'),()=>emit(w,'blur'),()=>emit(w,'resize'),()=>emit(w,'scroll'),()=>emit(w,'lostpointercapture'),()=>emit(d,'pointerdown')]){emit(d,'pointerdown');emit(w,'pointermove',{clientX:30});await settle();assert.equal(captured,1);cancel();assert.equal(captured,null);ready();await settle();assert.equal(starts.length,1,'canceled preparation cannot start a late drag');}
 stop();
});
