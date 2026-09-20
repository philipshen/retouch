'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{validate,resolver,cssName}=require('../src/variable-collections.cjs');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function fixture(){return {version:1,collections:[{id:id(1),name:'Theme',defaultMode:id(2),modes:[{id:id(2),name:'Light'},{id:id(3),name:'Dark'}]},{id:id(4),name:'Palette',defaultMode:id(5),modes:[{id:id(5),name:'Day'},{id:id(6),name:'Night'}]}],variables:[{id:id(7),collectionId:id(1),name:'Surface',type:'color',values:{[id(2)]:{alias:id(8)},[id(3)]:'#000000'}},{id:id(8),collectionId:id(4),name:'Surface',type:'color',values:{[id(5)]:'#ffffff',[id(6)]:'color(display-p3 1 0.2 0.1 / 0.5)'}}]};}
test('linked variables follow independent collection modes and retain alias provenance',()=>{
 const input=fixture(),original=JSON.stringify(input),normal=resolver(input).resolve(id(7));assert.equal(normal.value,'#ffffffff');assert.deepEqual(normal.path,[{variableId:id(7),collectionId:id(1),modeId:id(2)},{variableId:id(8),collectionId:id(4),modeId:id(5)}]);
 const alternate=resolver(input,{[id(4)]:id(6)}).resolve(id(7));assert.match(alternate.value,/display-p3/);assert.equal(alternate.path[1].modeId,id(6));assert.equal(resolver(input,{[id(1)]:id(3)}).resolve(id(7)).value,'#000000ff');assert.equal(JSON.stringify(input),original);
 input.variables[0].name='Renamed surface';assert.equal(cssName(input.variables[0].id),'--rt-v-'+id(7));assert.equal(resolver(input).resolve(id(7)).value,normal.value);
});
test('collection validation requires stable identities, complete modes and type-safe aliases',()=>{
 for(const mutate of [x=>x.collections[0].modes.push({...x.collections[0].modes[0]}),x=>x.collections[0].defaultMode=id(6),x=>delete x.variables[0].values[id(3)],x=>x.variables[0].values[id(2)]={alias:id(99)},x=>x.variables[0].values[id(2)]={alias:id(8),extra:true},x=>x.variables[0].collectionId=id(99),x=>x.variables[1].id=id(7)]){const input=fixture();mutate(input);assert.throws(()=>validate(input));}
 const mismatch=fixture();mismatch.variables[1].type='number';mismatch.variables[1].values={[id(5)]:1,[id(6)]:2};assert.throws(()=>validate(mismatch),/same type/);
 assert.throws(()=>resolver(fixture(),{[id(1)]:id(5)}),/selected mode/);assert.throws(()=>resolver(fixture(),{[id(99)]:id(5)}),/structure/);
});
test('cycles depend on the complete mode selection and never return partial resolved output',()=>{
 const input=fixture();input.variables[0].values={[id(2)]:'#ffffff',[id(3)]:{alias:id(8)}};input.variables[1].values={[id(5)]:'#000000',[id(6)]:{alias:id(7)}};
 assert.equal(resolver(input,{[id(1)]:id(3)}).resolve(id(7)).value,'#000000ff');assert.equal(resolver(input,{[id(4)]:id(6)}).resolve(id(8)).value,'#ffffffff');
 assert.throws(()=>resolver(input,{[id(1)]:id(3),[id(4)]:id(6)}).resolveAll(),/alias cycle/);
});
test('number, boolean and string values retain their types and bounded content',()=>{
 const input=fixture();input.variables=[];
 for(const [offset,type,light,dark]of [[9,'number',24,-0.5],[10,'boolean',true,false],[11,'string','Hello\nworld','']])input.variables.push({id:id(offset),collectionId:id(1),name:type,type,values:{[id(2)]:light,[id(3)]:dark}});
 assert.deepEqual(resolver(input).resolveAll().map(value=>value.value),[24,true,'Hello\nworld']);assert.deepEqual(resolver(input,{[id(1)]:id(3)}).resolveAll().map(value=>value.value),[-0.5,false,'']);
 input.variables[0].values[id(2)]=Infinity;assert.throws(()=>validate(input),/finite/);input.variables[0].values[id(2)]=24;input.variables[2].values[id(2)]='\0';assert.throws(()=>validate(input),/string/);
});

test('presentation assignments follow aliases across modes without changing authored values',()=>{
 const input=fixture(),before=JSON.stringify(input),overrides={[id(8)]:'#123456'},runtime=resolver(input,{},overrides);
 overrides[id(8)]='#ffffff';
 assert.equal(runtime.resolve(id(7)).value,'#123456ff');
 assert.equal(runtime.resolve(id(8)).value,'#123456ff');
 assert.equal(resolver(input,{[id(4)]:id(6)},{[id(8)]:'#123456'}).resolve(id(7)).value,'#123456ff');
 // The dark theme uses its own literal rather than the palette alias.
 assert.equal(resolver(input,{[id(1)]:id(3)},{[id(8)]:'#123456'}).resolve(id(7)).value,'#000000ff');
 const direct=resolver(input,{}, {[id(7)]:'#abcdef',[id(8)]:'#123456'}).resolve(id(7));
 assert.equal(direct.value,'#abcdefff');assert.equal(direct.path.length,1);
 assert.equal(JSON.stringify(input),before);assert.equal(resolver(input).resolve(id(7)).value,'#ffffffff');
});

test('runtime assignments preserve false, zero and empty strings and reject malformed state atomically',()=>{
 const input=fixture();input.variables=[];
 for(const [n,type,value]of [[9,'number',24],[10,'boolean',true],[11,'string','Hello']])input.variables.push({id:id(n),collectionId:id(1),name:type,type,values:{[id(2)]:value,[id(3)]:value}});
 assert.deepEqual(resolver(input,{}, {[id(9)]:0,[id(10)]:false,[id(11)]:''}).resolveAll().map(x=>x.value),[0,false,'']);
 for(const state of [null,[],{[id(99)]:0},{[id(9)]:NaN},{[id(9)]:Infinity},{[id(9)]:1000001},{[id(9)]:'3'},{[id(10)]:0},{[id(11)]:'\0'},{[id(11)]:'a'.repeat(4097)},{[id(9)]:{alias:id(9)}}])assert.throws(()=>resolver(input,{},state));
 assert.throws(()=>resolver(fixture(),{}, {[id(8)]:'url(https://example.com)'}));
});

test('runtime assignments can terminate an alias cycle without changing future resolutions',()=>{
 const input=fixture();input.variables[1].values[id(5)]={alias:id(7)};
 assert.throws(()=>resolver(input).resolve(id(7)),/alias cycle/);
 assert.equal(resolver(input,{}, {[id(8)]:'#ff0000'}).resolve(id(7)).value,'#ff0000ff');
 assert.throws(()=>resolver(input).resolve(id(7)),/alias cycle/);
});

test('mode-local assignments snapshot independent values and follow aliases in their selected modes',()=>{
 const input=fixture(),before=JSON.stringify(input),modeOverrides={[id(8)]:{[id(5)]:'#123456',[id(6)]:'#abcdef'}},day=resolver(input,{}, {},modeOverrides),night=resolver(input,{[id(4)]:id(6)}, {},modeOverrides);
 modeOverrides[id(8)][id(5)]='#000000';assert.equal(day.resolve(id(7)).value,'#123456ff');assert.equal(night.resolve(id(7)).value,'#abcdefff');
 assert.equal(resolver(input,{[id(1)]:id(3)}, {},modeOverrides).resolve(id(7)).value,'#000000ff');
 assert.equal(resolver(input,{}, {[id(8)]:'#ff0000'},modeOverrides).resolve(id(8)).value,'#000000ff');
 assert.equal(resolver(input,{[id(4)]:id(6)}, {},{[id(8)]:{[id(5)]:'#000000'}}).resolve(id(8)).value,input.variables[1].values[id(6)]);
 assert.equal(JSON.stringify(input),before);
});
test('mode-local state validates inactive modes and retains false, zero and empty text',()=>{
 const input=fixture();input.variables=[];for(const [n,type,value]of [[9,'number',24],[10,'boolean',true],[11,'string','Hello']])input.variables.push({id:id(n),collectionId:id(1),name:type,type,values:{[id(2)]:value,[id(3)]:value}});
 const modeOverrides={[id(9)]:{[id(2)]:0},[id(10)]:{[id(2)]:false},[id(11)]:{[id(2)]:''}};
 assert.deepEqual(resolver(input,{}, {},modeOverrides).resolveAll().map(x=>x.value),[0,false,'']);assert.deepEqual(resolver(input,{[id(1)]:id(3)}, {},modeOverrides).resolveAll().map(x=>x.value),[24,true,'Hello']);
 for(const state of [null,[],{[id(99)]:{}},{[id(9)]:null},{[id(9)]:[]},{[id(9)]:{[id(5)]:1}},{[id(9)]:{[id(3)]:Infinity}},{[id(10)]:{[id(3)]:0}},{[id(11)]:{[id(3)]:'a'.repeat(4097)}},{[id(9)]:{[id(3)]:{alias:id(9)}}}])assert.throws(()=>resolver(input,{}, {},state));
});
