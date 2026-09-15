'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{mount}=require('../shell/group-nudge.js');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function event(key,extra={}){const e=new Event('keydown',{cancelable:true});Object.assign(e,{key,...extra});return e;}
function setup(){
 const host=new EventTarget(),w=new EventTarget(),d={defaultView:w};host.requestAnimationFrame=()=>1;host.cancelAnimationFrame=()=>{};
 const commits=[],updates=[],errors=[];let ready,ended=0,restored=0,current=true,previewCurrent=true;
 const prepared=new Promise(resolve=>ready=resolve),context={preview:()=>({current:()=>previewCurrent,update:d=>updates.push({...d}),restore:()=>restored++})};
 const cancel=mount({document:d,host,initialKey:event('ArrowRight'),current:()=>current,prepare:()=>prepared,onCommit:(_,delta)=>commits.push(delta),onEnd:()=>ended++,onError:e=>errors.push(e)});
 const send=(type,key,extra={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,{key,...extra});w.dispatchEvent(e);return e;};
 return {host,send,cancel,commits,updates,errors,ready:()=>ready(context),invalidate:()=>current=false,losePreview:()=>previewCurrent=false,get ended(){return ended;},get restored(){return restored;}};
}
test('held keys accumulate through delayed resolution and commit once after every held arrow is released',async()=>{
 const f=setup();await settle();f.send('keydown','ArrowRight',{repeat:true});f.send('keydown','Shift',{shiftKey:true});f.send('keydown','ArrowDown',{shiftKey:true});f.send('keyup','ArrowRight');assert.equal(f.ended,0);f.send('keyup','ArrowDown');assert.equal(f.ended,0);f.ready();await settle();assert.deepEqual(f.commits,[{x:2,y:10}]);assert.equal(f.ended,1);assert.equal(f.restored,0);assert.deepEqual(f.errors,[]);
});
test('live keyboard preview restores before one final source commit and ignores Shift as a movement',async()=>{
 const f=setup();f.ready();await settle();assert.deepEqual(f.updates,[{x:1,y:0}]);f.send('keydown','Shift',{shiftKey:true});f.send('keydown','ArrowRight',{shiftKey:true,repeat:true});assert.deepEqual(f.updates.at(-1),{x:11,y:0});f.send('keyup','ArrowRight');await settle();assert.equal(f.restored,1);assert.deepEqual(f.commits,[{x:11,y:0}]);assert.equal(f.ended,1);
});
test('Escape, context invalidation, pointer interaction and preview ownership changes cancel without committing',async()=>{
 for(const action of [f=>f.send('keydown','Escape'),f=>{f.invalidate();f.send('keydown','ArrowRight');},f=>f.host.dispatchEvent(new Event('pointerdown')),f=>{f.losePreview();f.send('keyup','ArrowRight');}]){const f=setup();f.ready();await settle();action(f);await settle();assert.equal(f.restored,1);assert.deepEqual(f.commits,[]);assert.equal(f.ended,1);}
 const pending=setup();pending.send('keydown','Escape');pending.ready();await settle();assert.deepEqual(pending.commits,[]);assert.equal(pending.ended,1);
});
test('opposing held keys with zero net movement restore without a source transaction',async()=>{
 const f=setup();f.ready();await settle();f.send('keydown','ArrowLeft');f.send('keyup','ArrowRight');f.send('keyup','ArrowLeft');await settle();assert.deepEqual(f.commits,[]);assert.equal(f.restored,1);
});
