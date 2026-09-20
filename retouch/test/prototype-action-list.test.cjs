'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),A=require('../shell/prototype-action-list.js');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),literal=value=>({kind:'literal',type:typeof value==='boolean'?'boolean':'number',value}),assign=value=>({action:'set-variable',assignment:{id:id(1),type:'number',value}}),go={action:'navigate',destination:'/next'},conditional=(condition,yes,no=[])=>({action:'conditional',condition,then:yes,else:no});
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('action lists validate and snapshot every branch using the existing action grammar',()=>{
 const original=[assign(2),conditional(literal(true),[go],[{action:'back'}])],normalized=A.validate(original);assert.equal(normalized[1].then[0].preserveScroll,false);normalized[0].assignment.value=9;assert.equal(original[0].assignment.value,2);
 for(const invalid of [[],null,[{...go,trigger:'click'}],[{...go,delay:1}],[{...go,shortcut:{}}],[{action:'execute',code:'x'}],[conditional(literal(1),[go])],[conditional(literal(true),[go],null)],[{...conditional(literal(true),[go]),extra:1}],[conditional(literal(true),[go],[{action:'open-link',destination:'javascript:x'}])]])assert.throws(()=>A.validate(invalid));
 let deep=go;for(let n=0;n<17;n++)deep=conditional(literal(true),[deep]);assert.throws(()=>A.validate([deep]),/16 conditional/);assert.throws(()=>A.validate(Array(129).fill(go)),/128 actions/);
 const cycle=conditional(literal(true),[]);cycle.then.push(cycle);assert.throws(()=>A.validate([cycle]),/16 conditional/);
 assert.throws(()=>A.validate(Array.from({length:32},()=>({action:'set-variable',assignment:{id:id(1),type:'string',value:'x'.repeat(4096)}}))),/source size/);
});
test('ordered asynchronous actions finish before conditions read their effects and before the next trigger',async()=>{
 let value=0;const entered=gate(),release=gate(),events=[];
 const runner=A.create({perform:async action=>{if(action.action==='set-variable'){events.push('start');entered.resolve();await release.promise;value=action.assignment.value;events.push('assigned');}else events.push(action.action);},evaluate:async()=>{events.push('condition');return {type:'boolean',value:value===2};}});
 const first=runner.run([assign(2),conditional(literal(true),[go],[{action:'back'}])]);await entered.promise;const second=runner.run([{action:'close-overlay'}]);assert.deepEqual(events,['start']);release.resolve();assert.deepEqual(await first,{completed:true,actions:3});assert.deepEqual(await second,{completed:true,actions:1});assert.deepEqual(events,['start','assigned','condition','navigate','close-overlay']);
});
test('nested branches run only selected actions and later conditions see earlier selected writes',async()=>{
 let value=0;const events=[],runner=A.create({perform:async action=>{if(action.action==='set-variable')value=action.assignment.value;events.push(action.action);},evaluate:async condition=>({type:'boolean',value:condition.value?value===2:false})});
 await runner.run([conditional(literal(false),[{action:'back'}],[assign(2),conditional(literal(true),[go])])]);assert.deepEqual(events,['set-variable','navigate']);
});
test('failure stops remaining actions but does not poison the next trigger',async()=>{
 const events=[],runner=A.create({perform:async action=>{events.push(action.action);if(action.action==='set-variable')return {ok:false,reason:'Missing variable'};},evaluate:async()=>({type:'number',value:1})});
 await assert.rejects(runner.run([assign(1),go]),/Missing variable/);assert.deepEqual(events,['set-variable']);
 await assert.rejects(runner.run([conditional(literal(true),[go])]),/true or false/);await runner.run([go]);assert.deepEqual(events,['set-variable','navigate']);
});
test('reset cancels pending actions and conditions, unblocks a new session and observes late failures',async()=>{
 const entered=gate(),release=gate(),events=[];let oldSignal;
 const runner=A.create({perform:async action=>events.push(action.action),evaluate:async(_,options)=>{oldSignal=options.signal;entered.resolve();await release.promise;throw Error('late failure');}});
 const old=runner.run([conditional(literal(true),[go])]);await entered.promise;runner.reset();assert.equal(oldSignal.aborted,true);assert.deepEqual(await old,{completed:false,actions:0});await runner.run([{action:'back'}]);release.resolve();await Promise.resolve();assert.deepEqual(events,['back']);
});
test('queued external cancellation and trigger-time snapshots prevent later unwanted execution',async()=>{
 const entered=gate(),release=gate(),events=[],runner=A.create({perform:async action=>{events.push(action.action);if(action.action==='back'){entered.resolve();await release.promise;}},evaluate:async()=>({type:'boolean',value:true})});
 const first=runner.run([{action:'back'}]);await entered.promise;const controller=new AbortController(),second=runner.run([go],{signal:controller.signal});controller.abort();assert.equal((await second).completed,false);
 const input=[{action:'close-overlay'}],third=runner.run(input);input[0].action='back';release.resolve();await first;await third;assert.deepEqual(events,['back','close-overlay']);
});

test('canvas entries retain unique nested branch paths and reject malformed action locations',()=>{
 const tree=[assign(2),conditional(literal(true),[{action:'scroll',destination:'a'},conditional(literal(false),[go],[{action:'back'}])],[{action:'scroll',destination:'b'}])],entries=A.entries(tree);
 assert.deepEqual(entries.map(x=>x.path),[[0],[1,'then',0],[1,'then',1,'then',0],[1,'then',1,'else',0],[1,'else',0]]);
 for(const entry of entries)assert.equal(A.locate(tree,entry.path).action,entry.item.action);entries[1].item.destination='changed';assert.equal(tree[1].then[0].destination,'a');
 for(const path of [null,[],[0,'then'],[-1],[1,'constructor',0],[0,'then',0],[1,'then',99],['1'],Array(35).fill(0)])assert.throws(()=>A.locate(tree,path));
});
