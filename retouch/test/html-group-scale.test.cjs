'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),{plan}=require('../src/html-group-scale.cjs');
const source='<!doctype html><html><head></head><body><main><div data-rt-frame data-rt-group style="display:contents"><h1>Heading</h1><p>Text</p></div><p>Outside</p></main></body></html>';
function resolve(source){const relPath='index.html',elements=html.collect(source,relPath).elements;return {source,relPath,elements,element:elements.find(item=>item.tag==='div'),file:'/site/index.html',hash:html.contentHash(source)};}
test('HTML group scaling persists ranges, stable identities and one private runtime in one source edit',()=>{
 const r=resolve(source),first=plan(r,{fileHash:r.hash,width:0,factor:1.5});assert.equal(first.ok,true,first.reason);assert.equal(first.edits.length,1);assert.equal(first.edits[0].before,source);const next=resolve(first.edits[0].after);assert.deepEqual(next.elements.map(item=>item.id),r.elements.map(item=>item.id));assert.equal(next.elements.find(item=>item.tag==='h1').node.attrs.some(attr=>attr.name==='data-rt-scale-member'),true);
 const second=plan(next,{fileHash:next.hash,width:1100,factor:2});assert.equal(second.ok,true,second.reason);const final=resolve(second.edits[0].after),metadata=JSON.parse(final.element.node.attrs.find(attr=>attr.name==='data-rt-scale').value);assert.deepEqual(metadata,{version:1,ranges:{0:1.5,1100:3}});assert.equal((final.source.match(/<script data-rt-scale-runtime="1"/g)||[]).length,1);assert.ok(final.source.includes('<p>Outside</p>'));assert.deepEqual(plan(final,{fileHash:final.hash,width:0,factor:1}).edits,[]);
});
test('HTML scaling rejects stale source, invalid factors and modified runtime',()=>{
 const r=resolve(source);assert.equal(plan(r,{fileHash:'stale',width:0,factor:2}).ok,false);
 for(const factor of [0,101,NaN,'2'])assert.equal(plan(r,{fileHash:r.hash,width:0,factor}).ok,false);
 const first=plan(r,{fileHash:r.hash,width:0,factor:2}),edited=resolve(first.edits[0].after.replace('data-rt-scale-runtime="1"','data-rt-scale-runtime="2"'));assert.match(plan(edited,{fileHash:edited.hash,width:0,factor:2}).reason,/outside/);
});
test('saved scaling is one exact undoable source transaction',t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{applyPlan}=require('../src/transactions.cjs'),{SourceHistory}=require('../src/history.cjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-scale-history-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const file=path.join(root,'index.html');fs.writeFileSync(file,source);
 const r={...resolve(source),file},result=applyPlan(root,plan(r,{fileHash:r.hash,width:0,factor:1.5}));assert.equal(result.ok,true,result.reason);const history=new SourceHistory(),id=history.record(result.edits),saved=fs.readFileSync(file,'utf8');assert.notEqual(saved,source);assert.equal(history.apply(root,'undo',id,{}).ok,true);assert.equal(fs.readFileSync(file,'utf8'),source);assert.equal(history.apply(root,'redo',id,{}).ok,true);assert.equal(fs.readFileSync(file,'utf8'),saved);
});
test('scale anchors compose separately from pixel moves and survive range inheritance',()=>{
 let r=resolve(source);const step=op=>{const result=plan(r,{fileHash:r.hash,width:0,...op});assert.equal(result.ok,true,result.reason);r=resolve(result.edits[0].after);return JSON.parse(r.element.node.attrs.find(attr=>attr.name==='data-rt-scale').value);};
 step({factor:1.5});const anchored=step({factor:2,offset:[-.5,-.5]});assert.deepEqual(anchored.offsets,{0:[-.75,-.75]});assert.equal(anchored.ranges[0],3);
 const moved=step({factor:1,move:[23,-9]});assert.deepEqual(moved.pixels,{0:[23,-9]});assert.deepEqual(moved.offsets,anchored.offsets);
 const inherited=step({factor:.5,width:1100});assert.equal(inherited.ranges[1100],1.5);assert.deepEqual(inherited.offsets[1100],[-.75,-.75]);assert.deepEqual(inherited.pixels[1100],[23,-9]);
});
test('duplicating a scaled group member allocates a distinct persistent identity',()=>{
 const r=resolve(source),scaled=plan(r,{fileHash:r.hash,width:0,factor:1.5}).edits[0].after,next=resolve(scaled),heading=next.elements.find(item=>item.tag==='h1');
 const copied=html.planOp({...next,element:heading},{type:'duplicateElement',fileHash:next.hash});assert.equal(copied.ok,true,copied.reason);
 const headings=resolve(copied.edits[0].after).elements.filter(item=>item.tag==='h1'),ids=headings.map(item=>item.node.attrs.find(attr=>attr.name==='data-rt-scale-member')?.value);assert.equal(ids.length,2);assert.ok(ids.every(Boolean));assert.notEqual(ids[0],ids[1]);assert.equal(ids[0],heading.node.attrs.find(attr=>attr.name==='data-rt-scale-member').value);
});
test('paste, shared duplication and whole-group duplication remap copied scale members',()=>{
 const r=resolve(source),scaled=plan(r,{fileHash:r.hash,width:0,factor:1.5}).edits[0].after,next=resolve(scaled),heading=next.elements.find(item=>item.tag==='h1'),text=next.elements.find(item=>item.tag==='p'),ids=[heading.id,text.id];
 const results=[
  html.planOp({...next,element:text},{type:'pasteElement',fileHash:next.hash,copiedHash:next.hash,copiedId:heading.id}),
  require('../src/html-structure-selection.cjs').plan({...next,element:heading},{type:'duplicateSelection',fileHash:next.hash,ids}),
  html.planOp(next,{type:'duplicateElement',fileHash:next.hash})
 ];
 for(const result of results){assert.equal(result.ok,true,result.reason);const copied=resolve(result.edits[0].after),members=copied.elements.flatMap(item=>item.node.attrs.filter(attr=>attr.name==='data-rt-scale-member').map(attr=>attr.value));assert.equal(members.length,new Set(members).size);for(const original of [heading,text])assert.ok(members.includes(original.node.attrs.find(attr=>attr.name==='data-rt-scale-member').value));assert.equal((copied.source.match(/<script data-rt-scale-runtime="1"/g)||[]).length,1);}
});
test('ungrouping preserves responsive scale intent on the released source members',()=>{
 const r=resolve(source),scaled=plan(r,{fileHash:r.hash,width:0,factor:1.5}).edits[0].after,next=resolve(scaled),released=require('../src/html-frame-selection.cjs').plan(next,{type:'removeFrame',fileHash:next.hash});assert.equal(released.ok,true,released.reason);
 const after=released.edits[0].after;assert.equal(html.collect(after,'index.html').elements.some(item=>item.node.attrs.some(attr=>attr.name==='data-rt-group')),false);assert.match(after,/<script type="application\/json" data-rt-scale-set=/);assert.ok(after.includes('&quot;ranges&quot;:{&quot;0&quot;:1.5}'));
});
test('scale descriptions resolve all members across parser instances',()=>{
 const r=resolve(source),describe=require('../src/html-group-scale.cjs').describe;assert.equal(Object.keys(describe(r).groupScale.members).length,2);
 const next=resolve(plan(r,{fileHash:r.hash,width:0,factor:1.5}).edits[0].after);assert.equal(Object.values(describe(next).groupScale.members).filter(Boolean).length,2);
});

test('scaling refuses a new wrapper overlapping released scale members',()=>{
 const r=resolve(source),scaled=plan(r,{fileHash:r.hash,width:0,factor:1.5}).edits[0].after,next=resolve(scaled);
 const released=require('../src/html-frame-selection.cjs').plan(next,{type:'removeFrame',fileHash:next.hash}).edits[0].after;
 const wrapped=resolve(released.replace('<main>','<main><div data-rt-frame data-rt-group style="display:contents">').replace('</main>','</div></main>'));
 const result=plan(wrapped,{fileHash:wrapped.hash,width:0,factor:2});assert.equal(result.ok,false);assert.match(result.reason,/Overlapping/);assert.equal(result.edits,undefined);
});

test('copies of released scale roots join the saved responsive set with fresh identities',()=>{
 const r=resolve(source),scaled=plan(r,{fileHash:r.hash,width:0,factor:1.5}).edits[0].after,next=resolve(scaled);
 const released=require('../src/html-frame-selection.cjs').plan(next,{type:'removeFrame',fileHash:next.hash}).edits[0].after;
 const elements=html.collect(released,'index.html').elements,heading=elements.find(item=>item.tag==='h1'),text=elements.find(item=>item.tag==='p'),state={...next,source:released,elements,element:heading,hash:html.contentHash(released)};
 const results=[html.planOp(state,{type:'duplicateElement',fileHash:state.hash}),html.planOp({...state,element:text},{type:'pasteElement',fileHash:state.hash,copiedHash:state.hash,copiedId:heading.id}),require('../src/html-structure-selection.cjs').plan(state,{type:'duplicateSelection',fileHash:state.hash,ids:[heading.id,text.id]})];
 for(const result of results){assert.equal(result.ok,true,result.reason);const after=result.edits[0].after,ids=JSON.parse(after.match(/<script type="application\/json" data-rt-scale-set=[^>]+>([^<]+)<\/script>/)[1]),members=html.collect(after,'index.html').elements.flatMap(item=>item.node.attrs.filter(a=>a.name==='data-rt-scale-member').map(a=>a.value));assert.deepEqual(new Set(ids),new Set(members));assert.equal(ids.length,members.length);}
});
test('known saved runtimes upgrade in the scale transaction and preserve exact history input',()=>{
 const runtime=require('../src/group-scale-runtime.cjs'),legacy=require('node:fs').readFileSync(require('node:path').join(__dirname,'fixtures/group-scale/pre-revision-runtime.html'),'utf8'),r=resolve(source),current=plan(r,{fileHash:r.hash,width:0,factor:1.5}).edits[0].after,old=current.replace(runtime.script(),()=>legacy),state=resolve(old);
 const heading=state.elements.find(item=>item.tag==='h1'),cssUpgrade=require('../src/html-css.cjs').plan({...state,element:heading},{fileHash:state.hash,width:0,changes:{'--rt-scale-factor':'2'}});assert.equal(cssUpgrade.ok,true,cssUpgrade.reason);assert.equal(cssUpgrade.edits[0].before,old);assert.ok(cssUpgrade.edits[0].after.includes(runtime.script()));
 assert.notEqual(old,current);assert.equal(runtime.upgrade(old),current);assert.equal(runtime.upgrade(current),current);
 const changed=plan(state,{fileHash:state.hash,width:0,factor:2});assert.equal(changed.ok,true,changed.reason);assert.equal(changed.edits[0].before,old);assert.ok(changed.edits[0].after.includes(runtime.script()));
 const released=require('../src/html-frame-selection.cjs').plan(state,{type:'removeFrame',fileHash:state.hash});assert.equal(released.ok,true,released.reason);assert.equal(released.edits[0].before,old);assert.ok(released.edits[0].after.includes(runtime.script()));
 for(const altered of [old.replace('data-rt-scale-runtime="1"','data-rt-scale-runtime="2"'),old.replace('<script data-rt-scale-runtime="1">','<script data-rt-scale-runtime="1">/* edited */'),old+legacy])assert.throws(()=>runtime.upgrade(altered),/outside/);
});
test('regrouping an entire released scale set restores editable group metadata',()=>{
 const r=resolve(source),scaled=plan(r,{fileHash:r.hash,width:0,factor:1.5}).edits[0].after,next=resolve(scaled),frames=require('../src/html-frame-selection.cjs');
 const released=frames.plan(next,{type:'removeFrame',fileHash:next.hash}).edits[0].after,elements=html.collect(released,'index.html').elements,roots=elements.filter(item=>item.node.attrs.some(a=>a.name==='data-rt-scale-member')),state={...next,source:released,elements,element:roots[0],hash:html.contentHash(released)},regrouped=frames.plan(state,{type:'groupSelection',fileHash:state.hash,ids:roots.map(item=>item.id)});
 const record=released.match(/<script type="application\/json" data-rt-scale-set=[^>]+>[\s\S]*?<\/script>/)[0],runtime=require('../src/group-scale-runtime.cjs'),legacy=require('node:fs').readFileSync(require('node:path').join(__dirname,'fixtures/group-scale/pre-revision-runtime.html'),'utf8');
 for(const input of [released.replace(record,'').replace('<head>','<head>'+record),released.replace(record,'').replace('<main>','<main>'+record),released.replace(record,'').replace('</h1>','</h1>'+record),released.replace(runtime.script(),()=>legacy)]){const elements=html.collect(input,'index.html').elements,roots=elements.filter(item=>item.node.attrs.some(a=>a.name==='data-rt-scale-member')),state={...next,source:input,elements,element:roots[0],hash:html.contentHash(input)},result=frames.plan(state,{type:'groupSelection',fileHash:state.hash,ids:roots.map(item=>item.id)});assert.equal(result.ok,true,result.reason);assert.equal(result.edits[0].before,input);assert.equal(result.edits[0].after.includes('data-rt-scale-set='),false);assert.ok(result.edits[0].after.includes(runtime.script()));}
 const scripted=released+record,scriptedElements=html.collect(scripted,'index.html').elements,scriptedRoots=scriptedElements.filter(item=>item.node.attrs.some(a=>a.name==='data-rt-scale-member')),refused=frames.plan({...state,source:scripted,elements:scriptedElements,element:scriptedRoots[0],hash:html.contentHash(scripted)},{type:'groupSelection',fileHash:html.contentHash(scripted),ids:scriptedRoots.map(item=>item.id)});assert.equal(refused.ok,false);assert.match(refused.reason,/multiple owners/);
 const partial=frames.plan(state,{type:'groupSelection',fileHash:state.hash,ids:[roots[0].id]});assert.equal(partial.ok,true,partial.reason);assert.ok(partial.edits[0].after.includes(record));
 assert.equal(regrouped.ok,true,regrouped.reason);assert.equal(regrouped.edits[0].before,released);const restored=resolve(regrouped.edits[0].after);assert.equal(restored.source.includes('data-rt-scale-set='),false);assert.deepEqual(JSON.parse(restored.element.node.attrs.find(a=>a.name==='data-rt-scale').value).ranges,{0:1.5});
 const rescaled=plan(restored,{fileHash:restored.hash,width:0,factor:2});assert.equal(rescaled.ok,true,rescaled.reason);assert.deepEqual(JSON.parse(resolve(rescaled.edits[0].after).element.node.attrs.find(a=>a.name==='data-rt-scale').value).ranges,{0:3});
});
test('group edits snapshot independent styles in order and copies retain those snapshots',()=>{
 const r=resolve(source),first=plan(r,{fileHash:r.hash,width:0,factor:1.5}),state=resolve(first.edits[0].after),heading=state.elements.find(item=>item.tag==='h1'),edited=require('../src/html-css.cjs').plan({...state,element:heading},{fileHash:state.hash,width:0,changes:{'--rt-scale-move-x':'23px','--rt-scale-move-y':'-9px','--rt-scale-factor':'1.2'}});assert.equal(edited.ok,true,edited.reason);
 const ready=resolve(edited.edits[0].after),result=plan(ready,{fileHash:ready.hash,width:0,factor:1.5});assert.equal(result.ok,true,result.reason);assert.equal(result.edits[0].before,ready.source);const composed=resolve(result.edits[0].after),data=JSON.parse(composed.element.node.attrs.find(a=>a.name==='data-rt-scale').value),id=composed.elements.find(item=>item.tag==='h1').node.attrs.find(a=>a.name==='data-rt-scale-member').value;
 assert.deepEqual(data.ranges,{0:1.5});assert.equal(data.steps.length,2);assert.deepEqual(data.steps[0].styles[id],{0:{factor:1.2,move:[23,-9]}});assert.deepEqual(data.steps[1],{factor:1.5,min:0,offset:[0,0],move:[0,0]});
 for(const element of [composed.element,composed.elements.find(item=>item.tag==='h1')]){const copy=html.planOp({...composed,element},{type:'duplicateElement',fileHash:composed.hash});assert.equal(copy.ok,true,copy.reason);const elements=html.collect(copy.edits[0].after,'index.html').elements;
  for(const group of elements.filter(item=>item.node.attrs.some(a=>a.name==='data-rt-group'))){const metadata=JSON.parse(group.node.attrs.find(a=>a.name==='data-rt-scale').value),headings=elements.filter(item=>item.tag==='h1'&&item.node.parentNode===group.node);assert.equal(Object.keys(metadata.steps[0].styles).length,headings.length);for(const child of headings){const identity=child.node.attrs.find(a=>a.name==='data-rt-scale-member').value;assert.deepEqual(metadata.steps[0].styles[identity],data.steps[0].styles[id]);}}
 }
});

test('identity edits remain no-ops at the saved transform step limit',()=>{
 const r=resolve(source),scaled=plan(r,{fileHash:r.hash,width:0,factor:1.5}).edits[0].after,state=resolve(scaled),location=state.element.location.attrs['data-rt-scale'],metadata={version:1,ranges:{0:1.5},steps:Array.from({length:100},()=>({factor:1,min:0,offset:[0,0],move:[0,0]}))},input=scaled.slice(0,location.startOffset)+'data-rt-scale="'+JSON.stringify(metadata).replace(/"/g,'&quot;')+'"'+scaled.slice(location.endOffset),full=resolve(input);
 assert.deepEqual(plan(full,{fileHash:full.hash,width:0,factor:1}),{ok:true,hash:full.hash,edits:[]});
 const overflow=plan(full,{fileHash:full.hash,width:1100,factor:1.5});assert.equal(overflow.ok,false);assert.match(overflow.reason,/100 transform steps/);
});
test('repeated group movement after a child edit does not exhaust transform history',()=>{
 let state=resolve(source);state=resolve(plan(state,{fileHash:state.hash,width:0,factor:1.5}).edits[0].after);const heading=state.elements.find(item=>item.tag==='h1'),changed=require('../src/html-css.cjs').plan({...state,element:heading},{fileHash:state.hash,width:0,changes:{'--rt-scale-move-x':'23px'}});state=resolve(changed.edits[0].after);
 for(let i=0;i<120;i++){const result=plan(state,{fileHash:state.hash,width:0,factor:1,move:[1,-1]});assert.equal(result.ok,true,'Edit '+(i+1)+': '+result.reason);assert.equal(result.edits[0].before,state.source);state=resolve(result.edits[0].after);}
 const data=JSON.parse(state.element.node.attrs.find(a=>a.name==='data-rt-scale').value);assert.equal(data.steps.length,2);assert.deepEqual(data.steps[1],{factor:1,min:0,offset:[0,0],move:[120,-120]});
});
