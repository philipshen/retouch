'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const V=require('../shell/prototype-values.js'),model=require('../src/variable-collections.cjs');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function setup(pause){
 const library={version:1,collections:[{id:id(1),name:'Values',defaultMode:id(2),modes:[{id:id(2),name:'Default'}]}],variables:[['number',12],['number',24],['boolean',false],['boolean',true],['string',''],['string','Text'],['color','#ff0000'],['color',{alias:id(9)}]].map(([type,value],n)=>({id:id(n+3),collectionId:id(1),name:'Value '+n,type,values:{[id(2)]:value}}))},requests=[],errors=[],root={RetouchPrototypeValues:V,RetouchPresentationHost:{error:message=>errors.push(message)},RetouchVariableLibraryRequest:async()=>({...library,revision:'r'}),RetouchVariableModePreview:async request=>{requests.push(JSON.parse(JSON.stringify(request)));await pause?.(request);const resolver=model.resolver(library,request.modes,request.overrides);return request.expression?{revision:'r',result:require('../shell/prototype-expressions.js').evaluate(request.expression,id=>resolver.resolve(id))}:{revision:'r',values:request.variableId?[resolver.resolve(request.variableId)]:resolver.resolveAll()};}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../shell/prototype-variables.js'),'utf8'),{window:root});
 return {runtime:root.RetouchPrototypeVariables,requests,errors,library};
}
test('variable copies snapshot typed current values, defaults and aliases in trigger order',async()=>{
 const {runtime,requests,errors,library}=setup(),before=JSON.stringify(library);
 for(const [target,source,type,expected]of [[4,3,'number',12],[6,5,'boolean',false],[8,7,'string',''],[9,10,'color','#ff0000ff']]){
  await runtime.assign({id:id(target),type,variableId:id(source)});assert.equal(requests.at(-1).overrides[id(target)],expected);
 }
 await Promise.all([runtime.assign({id:id(3),type:'number',value:0}),runtime.assign({id:id(4),type:'number',variableId:id(3)})]);assert.equal(requests.at(-1).overrides[id(4)],0);
 await runtime.assign({id:id(3),type:'number',value:99});assert.equal(requests.at(-1).overrides[id(4)],0,'copy is not a lasting alias');
 await runtime.assign({id:id(4),type:'number',variableId:id(4)});assert.equal(requests.at(-1).overrides[id(4)],0,'self-copy keeps the current value');
 runtime.reset();await runtime.assign({id:id(4),type:'number',variableId:id(3)});assert.deepEqual(requests.at(-1).overrides,{[id(4)]:12});
 assert.deepEqual(errors,[]);assert.equal(JSON.stringify(library),before);
});
test('missing or incompatible copy sources fail without changing presentation values',async()=>{
 const {runtime,requests,errors}=setup();await runtime.assign({id:id(4),type:'number',value:7});const count=requests.length;
 await runtime.assign({id:id(4),type:'number',variableId:id(99)});await runtime.assign({id:id(4),type:'number',variableId:id(5)});assert.equal(requests.length,count);assert.equal(errors.length,2);assert.ok(errors.every(message=>/source variable/.test(message)));
 await runtime.assign({id:id(3),type:'number',variableId:id(4)});assert.equal(requests.at(-1).overrides[id(3)],7);assert.equal(requests.at(-1).overrides[id(4)],7);
});
test('reset cancels a copy whose source value is still being resolved',async()=>{
 let release,started;const gate=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve),{runtime,requests,errors}=setup(async request=>{if(request.variableId===id(3)){started();await gate;}});
 const pending=runtime.assign({id:id(4),type:'number',variableId:id(3)});await seen;runtime.reset();release();await pending;assert.equal(requests.length,1,'cancelled copy never validates or applies its target');assert.deepEqual(errors,[]);
 await runtime.assign({id:id(4),type:'number',value:2});assert.deepEqual(requests.at(-1).overrides,{[id(4)]:2});
});

test('expression assignments read current state in order and errors preserve the last value',async()=>{
 const {runtime,requests,errors}=setup(),reference={kind:'variable',id:id(3),type:'number'},literal=value=>({kind:'literal',type:'number',value}),assignment={id:id(3),type:'number',expression:{kind:'operation',op:'+',args:[reference,literal(1)]}};
 await Promise.all([runtime.assign(assignment),runtime.assign(assignment)]);assert.equal(requests.at(-1).overrides[id(3)],14);
 await runtime.assign({...assignment,expression:{kind:'operation',op:'/',args:[reference,literal(0)]}});assert.match(errors[0],/divide by zero/);
 await runtime.assign({id:id(4),type:'number',variableId:id(3)});assert.equal(requests.at(-1).overrides[id(4)],14);
});

test('reset cancels an expression preview before it can assign its result',async()=>{
 let release,started;const gate=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve),{runtime,requests,errors}=setup(async request=>{if(request.expression){started();await gate;}});
 const pending=runtime.assign({id:id(3),type:'number',expression:{kind:'literal',type:'number',value:77}});await seen;runtime.reset();release();await pending;assert.equal(requests.length,1);assert.deepEqual(errors,[]);
 await runtime.assign({id:id(4),type:'number',variableId:id(3)});assert.equal(requests.at(-1).overrides[id(4)],12);
});

function alternate(library){library.collections[0].modes.push({id:id(20),name:'Alternate'});for(const variable of library.variables)variable.values[id(20)]=variable.type==='number'?50:variable.values[id(2)];}
test('mode actions select current copy/expression defaults and preserve explicit assignments until reset',async()=>{
 const {runtime,requests,errors,library}=setup();alternate(library);const before=JSON.stringify(library);
 await runtime.setMode({collectionId:id(1),modeId:id(20)});
 await runtime.assign({id:id(4),type:'number',variableId:id(3)});assert.equal(requests.at(-1).overrides[id(4)],50);
 await runtime.setMode({collectionId:id(1),modeId:id(2)});
 await runtime.assign({id:id(3),type:'number',expression:{kind:'variable',id:id(4),type:'number'}});assert.equal(requests.at(-1).overrides[id(3)],50);
 await runtime.setMode({collectionId:id(1),modeId:id(99)});assert.match(errors[0],/mode is missing/);
 runtime.reset();await runtime.assign({id:id(4),type:'number',variableId:id(3)});assert.equal(requests.at(-1).overrides[id(4)],12);assert.deepEqual(requests.at(-1).modes,{});assert.equal(JSON.stringify(library),before);
});
test('reset cancels an in-flight mode change before another session reads its mode',async()=>{
 let release,started;const gate=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve),{runtime,requests,errors,library}=setup(async request=>{if(request.modes?.[id(1)]===id(20)){started();await gate;}});alternate(library);
 const pending=runtime.setMode({collectionId:id(1),modeId:id(20)});await seen;runtime.reset();release();await pending;
 await runtime.assign({id:id(4),type:'number',variableId:id(3)});assert.equal(requests.at(-1).overrides[id(4)],12);assert.deepEqual(errors,[]);
});
