'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),loader=require('../src/next-websocket-loader.cjs');
const fixture=prefix=>`let mostRecentCompilationHash = null;
function messageReceived(message){
 if (message.type === ${prefix}.SYNC && 'hash' in message) {
  if (mostRecentCompilationHash !== null && mostRecentCompilationHash !== message.hash) { reload(); return; }
  mostRecentCompilationHash = message.hash;
 }
 delivered.push(message.type);
}`;
for(const prefix of ['HMR_MESSAGE_SENT_TO_BROWSER','_hotreloadertypes.HMR_MESSAGE_SENT_TO_BROWSER'])test(prefix+' keeps live builds across new preview connections and preserves restart detection',()=>{
 const input=fixture(prefix),result=loader.transform(input,'web-socket.js'),types={SYNC:'sync',BUILT:'built'},delivered=[];let reloads=0;assert.ok(result);const c=vm.createContext({HMR_MESSAGE_SENT_TO_BROWSER:types,_hotreloadertypes:{HMR_MESSAGE_SENT_TO_BROWSER:types},delivered,reload:()=>reloads++});vm.runInContext(result.code,c);
 for(const message of [{type:'sync',hash:'one'},{type:'built',hash:'two'},{type:'sync',hash:'two'},{type:'sync',hash:'two'}])c.messageReceived(message);assert.equal(reloads,0);assert.deepEqual(delivered,['sync','built','sync','sync']);
 c.messageReceived({type:'built'});c.messageReceived({type:'sync',hash:'two'});assert.equal(reloads,0);c.messageReceived({type:'sync',hash:'restart'});assert.equal(reloads,1);assert.equal(loader.transform(result.code,'web-socket.js'),null);
});
test('websocket guard refuses ambiguous or changed source and leaves production untouched',()=>{
 const source=fixture('HMR_MESSAGE_SENT_TO_BROWSER');assert.equal(loader.transform(source+source,'web-socket.js'),null);assert.equal(loader.transform(source.replace('let mostRecentCompilationHash','var mostRecentCompilationHash'),'web-socket.js'),null);
 const previous=process.env.NODE_ENV;try{process.env.NODE_ENV='production';let output;loader.call({async:()=>((error,code,map)=>{assert.equal(error,null);output={code,map};})},source,'map');assert.deepEqual(output,{code:source,map:'map'});}finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});
