'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../shell/shadow-visibility.js'),P=require('../shell/palette-values.js'),V=require('../shell/html-css-values.js');
const shadow=(color='#33669980',extra={})=>({x:2,y:4,blur:8,spread:-1,color,inset:false,...extra}),read=values=>S.read(values['box-shadow'],values[S.property]),encode=value=>'rtsh1-'+Buffer.from(JSON.stringify(value)).toString('hex');
test('hidden shadows retain exact original alpha, geometry and color space',()=>{
 for(const color of ['#33669980','#12345600','color(display-p3 0.2 0.4 0.6 / 0.375)','color(srgb 0.1 0.2 0.3 / 0.12345)']){
  const initial=S.write([shadow(color),shadow('#ff000040',{inset:true})]),hidden=S.update(initial['box-shadow'],initial[S.property],0,{hidden:true}),model=read(hidden);
  assert.equal(model[0].hidden,true);assert.equal(model[0].color,P.fromComputed(color));assert.deepEqual(model[1],read(initial)[1]);assert.equal(P.parse(V.parseShadows(hidden['box-shadow'])[0].color).alpha,0);
  assert.deepEqual(S.update(hidden['box-shadow'],hidden[S.property],0,{hidden:true}),{});assert.deepEqual(S.update(hidden['box-shadow'],hidden[S.property],0,{hidden:false}),initial);
 }
});
test('editing hidden geometry and color stays hidden and restores the edited settings',()=>{
 const hidden=S.write([shadow('#12345680',{hidden:true})]),edited=S.update(hidden['box-shadow'],hidden[S.property],0,{x:19,blur:23,inset:true,color:'color(display-p3 0.3 0.5 0.7 / 0.6)'});
 assert.equal(P.parse(V.parseShadows(edited['box-shadow'])[0].color).alpha,0);const model=read(edited);assert.deepEqual(model,[shadow('color(display-p3 0.3 0.5 0.7 / 0.6)',{x:19,blur:23,inset:true,hidden:true})]);
 const visible=S.update(edited['box-shadow'],edited[S.property],0,{hidden:false});assert.equal(visible[S.property],'none');assert.equal(read(visible)[0].color,model[0].color);
});
test('duplicate, reorder and removal carry hidden state with the shadow',()=>{
 const model=read(S.write([shadow('#12345680',{hidden:true}),shadow('#abcdef40',{x:9}),shadow('#fedcba80',{inset:true,hidden:true})]));
 for(const next of [[model[2],model[0],model[1]],[model[0],{...model[0]},model[1]],model.slice(1),[]])assert.deepEqual(read(S.write(next)),next);
});
test('metadata never turns an ordinary transparent shadow into a hidden shadow',()=>{
 const values=S.write([shadow('#12345600')]);assert.equal(values[S.property],'none');assert.equal(read(values)[0].hidden,false);
});
test('external changes to a hidden shadow refuse stale metadata',()=>{
 const values=S.write([shadow('#12345680',{hidden:true})]);
 for(const change of [{x:9},{y:9},{blur:9},{spread:9},{inset:true},{color:'#12345680'},{color:'#abcdef00'}]){const current=V.parseShadows(values['box-shadow']);current[0]={...current[0],...change};assert.throws(()=>S.read(V.serializeShadows(current),values[S.property]),/changed outside/);}
 assert.throws(()=>S.read('none',values[S.property]),/changed outside/);
});
test('malformed, duplicate, excessive and unknown metadata fields are rejected',()=>{
 const css=S.write([shadow('#12345680',{hidden:true})])['box-shadow'],entry={index:0,shadow:shadow('#12345680')};
 for(const value of ['','rtsh1-ff','rtsh1-0','rtsh1-'+ 'aa'.repeat(40000),encode({version:2,hidden:[]}),encode({version:1,hidden:[entry,entry]}),encode({version:1,hidden:[{...entry,index:16}]}),encode({version:1,hidden:[{...entry,unknown:true}]}),encode({version:1,hidden:[{...entry,shadow:{...entry.shadow,unknown:true}}]}),encode({version:1,hidden:[],unknown:true})])assert.throws(()=>S.read(css,value));
});
test('invalid edits and unsupported variable bindings fail without altering the input model',()=>{
 const model=[shadow()],before=structuredClone(model),values=S.write(model);
 for(const changes of [{blur:-1},{x:Infinity},{inset:'yes'},{hidden:1},{color:'var(--brand)'},{color:'inherit'},{color:'initial'},{color:'revert'},{unknown:4}])assert.throws(()=>S.update(values['box-shadow'],values[S.property],0,changes));
 for(const index of [-1,1,.5])assert.throws(()=>S.update(values['box-shadow'],values[S.property],index,{hidden:true}));assert.deepEqual(model,before);assert.throws(()=>S.write(Array.from({length:17},()=>shadow())));
});
test('sixteen hidden shadows survive a complete source metadata round trip',()=>{
 const model=Array.from({length:16},(_,i)=>shadow('color(display-p3 0.1 0.2 0.3 / 0.45)',{x:i,inset:i%2===0,hidden:true})),values=S.write(model);assert.deepEqual(read(values),model);assert.ok(values[S.property].length<65536);
});

test('visible CSS colors remain editable beside hidden literal shadows',()=>{
 for(const color of ['currentColor','rebeccapurple','hsl(210 50% 40% / .6)','oklch(.7 .2 140 / .6)','oklab(.7 .1 .2 / .8)']){
  const model=[shadow('#33669980',{hidden:true}),shadow(color,{x:11})],saved=S.write(model),roundtrip=read(saved);assert.equal(roundtrip[1].color,color);assert.equal(roundtrip[1].hidden,false);
  const edited=S.update(saved['box-shadow'],saved[S.property],1,{x:19}),next=read(edited);assert.equal(next[1].color,color);assert.equal(next[1].x,19);assert.deepEqual(next[0],roundtrip[0]);
  const both=S.update(edited['box-shadow'],edited[S.property],1,{hidden:true});assert.equal(read(both)[1].hidden,true);assert.equal(read(both)[1].color,color);assert.deepEqual(S.update(both['box-shadow'],both[S.property],1,{hidden:false}),edited);
  const shown=S.update(edited['box-shadow'],edited[S.property],0,{hidden:false});assert.equal(read(shown)[1].color,color);assert.equal(shown[S.property],'none');
 }
});
test('non-sRGB hidden metadata requires its matching neutral transparent placeholder',()=>{
 const values=S.write([shadow('#12345680',{hidden:true})]);
 for(const color of ['currentColor','rebeccapurple','oklch(.7 .2 140 / .6)'])assert.throws(()=>S.read(values['box-shadow'],encode({version:1,hidden:[{index:0,shadow:shadow(color)}]})));
});

test('hidden CSS colors survive geometry edits, duplication and reordering without conversion',()=>{
 for(const color of ['currentColor','rebeccapurple','hsl(210 50% 40% / .6)','oklch(.7 .2 140 / .6)','oklab(.7 .1 .2 / .8)']){
  const input=[shadow(color,{hidden:true})],saved=S.write(input);assert.equal(P.parse(V.parseShadows(saved['box-shadow'])[0].color).alpha,0);assert.equal(read(saved)[0].color,color);
  const edited=S.update(saved['box-shadow'],saved[S.property],0,{x:19,inset:true}),model=read(edited);assert.equal(model[0].color,color);assert.equal(model[0].hidden,true);
  assert.deepEqual(read(S.write([shadow('#ff000080',{hidden:false}),model[0],{...model[0]}])).slice(1),[model[0],model[0]]);
  const shown=S.update(edited['box-shadow'],edited[S.property],0,{hidden:false});assert.equal(V.parseShadows(shown['box-shadow'])[0].color,color);assert.equal(shown[S.property],'none');
 }
});
