'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const swift=fs.readFileSync(path.resolve(__dirname,'../Sources/Retouch.swift'),'utf8');
const script=/static let colorSamplerScript = #"""([\s\S]*?)"""#/.exec(swift)?.[1];
assert.ok(script,'Use the exact JavaScript injected by the desktop app');
function fixture({pathname='/rt',main=true,active=true,postMessage}={}) {
 let calls=0,resolve,reject;
 const window={};window.top=main?window:{};
 window.webkit={messageHandlers:{retouchColorSampler:{postMessage(body){calls++;assert.deepEqual({...body},{action:'sample'});if(postMessage)return postMessage(body);return new Promise((yes,no)=>{resolve=yes;reject=no;});}}}};
 vm.runInNewContext(script,{window,location:{pathname},navigator:{userActivation:{isActive:active}},DOMException});
 return {window,open:options=>new window.RetouchNativeEyeDropper().open(options),get calls(){return calls;},resolve:value=>resolve(value),reject:error=>reject(error)};
}
test('native adapter is installed only in the editor main document',()=>{
 for(const pathname of ['/','/rt/site','/rt/__api/health','/rtevil'])assert.equal(fixture({pathname}).window.RetouchNativeEyeDropper,undefined);
 assert.equal(fixture({main:false}).window.RetouchNativeEyeDropper,undefined);
 assert.equal(typeof fixture({pathname:'/rt/'}).window.RetouchNativeEyeDropper,'function');
});
test('native adapter requires activation and does not dispatch an already aborted request',async()=>{
 const inactive=fixture({active:false});await assert.rejects(inactive.open(),{name:'NotAllowedError'});assert.equal(inactive.calls,0);
 const active=fixture(),controller=new AbortController();controller.abort();await assert.rejects(active.open({signal:controller.signal}),{name:'AbortError'});assert.equal(active.calls,0);
});
test('native adapter returns only a validated sRGB color',async()=>{
 const adapter=fixture(),promise=adapter.open();adapter.resolve({sRGBHex:'#AaBbCc',extra:'ignored'});assert.deepEqual({...await promise},{sRGBHex:'#AaBbCc'});
 for(const value of [null,{}, {sRGBHex:'red'},{sRGBHex:'#12345678'}]){const adapter=fixture(),promise=adapter.open();adapter.resolve(value);await assert.rejects(promise,{name:'OperationError'});}
});
test('native adapter maps cancellation, unavailable transport and errors',async()=>{
 for(const name of ['AbortError','NotAllowedError','InvalidStateError','OperationError']){const adapter=fixture(),promise=adapter.open();adapter.resolve({error:name});await assert.rejects(promise,{name});}
 const rejected=fixture(),pending=rejected.open();rejected.reject(Error('Transport failed'));await assert.rejects(pending,{name:'OperationError'});
 const throwing=fixture({postMessage(){throw Error('Transport missing');}});await assert.rejects(throwing.open(),{name:'OperationError'});
});
test('native adapter ignores a late native result after abort and removes its listener',async()=>{
 const adapter=fixture(),controller=new AbortController();let listeners=0;
 const signal={get aborted(){return controller.signal.aborted;},addEventListener(...args){listeners++;controller.signal.addEventListener(...args);},removeEventListener(...args){listeners--;controller.signal.removeEventListener(...args);}};
 const promise=adapter.open({signal});controller.abort();await assert.rejects(promise,{name:'AbortError'});assert.equal(listeners,0);adapter.resolve({sRGBHex:'#123456'});await Promise.resolve();assert.equal(listeners,0);
 const success=adapter.open({signal:new AbortController().signal});adapter.resolve({sRGBHex:'#abcdef'});assert.equal((await success).sRGBHex,'#abcdef');
});
