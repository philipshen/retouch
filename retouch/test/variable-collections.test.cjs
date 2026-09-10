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
