'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),mask=require('../src/html-svg-mask.cjs');
const source='<main><svg viewBox="0 0 200 100"><circle cx="50" cy="50" r="35" fill="red"/><rect x="0" y="0" width="100" height="100" fill="blue"/><path d="M150 0h20v20h-20Z"/></svg><p>Keep</p></main>';
function resolve(text=source,id){const elements=html.collect(text,'index.html').elements;return {source:text,elements,element:id?elements.find(e=>e.id===id):elements.find(e=>e.tag==='circle'),relPath:'index.html',file:'/tmp/index.html',hash:html.contentHash(text)};}
function create(r,mode='alpha'){return mask.plan(r,{type:'createSVGMask',ids:r.elements.filter(e=>['circle','rect'].includes(e.tag)).map(e=>e.id),maskId:r.elements.find(e=>e.tag==='circle').id,fileHash:r.hash,mode});}
for(const mode of ['alpha','luminance'])test(mode+' mask retains original nodes and releases to exact original source',()=>{
 const r=resolve(),result=create(r,mode);assert.ok(result.ok,result.reason);const text=result.edits[0].after,fresh=resolve(text,result.selectionIds[0]);assert.match(text,new RegExp('mask-type="'+mode+'"'));assert.ok(mask.describe(fresh).canRelease);
 const map=new Map(result.sourceIdMap);for(const old of r.elements){const next=fresh.elements.find(e=>e.id===(map.get(old.id)||old.id));assert.ok(next);assert.equal(next.tag,old.tag);}assert.deepEqual(result.removedSourceIds,[]);
 const released=mask.plan(fresh,{type:'releaseSVGMask',fileHash:fresh.hash});assert.ok(released.ok,released.reason);assert.equal(released.edits[0].after,source);assert.equal(released.removedSourceIds.length,3);assert.equal(released.selectionIds.length,2);
});
test('mask shape stays source-addressable and retains edits when released',()=>{
 const initial=create(resolve()),r=resolve(initial.edits[0].after),circle=r.elements.find(e=>e.tag==='circle'),changed=require('../src/svg-geometry.cjs').plan({...r,element:circle},{fileHash:r.hash,property:'r',value:'20'});assert.ok(changed.ok,changed.reason);const edited=resolve(changed.edits[0].after,initial.selectionIds[0]),released=mask.plan(edited,{type:'releaseSVGMask',fileHash:edited.hash});assert.ok(released.ok,released.reason);assert.equal(released.edits[0].after,source.replace('r="35"','r="20"'));
});
test('mask creation and release refuse stale, reordered, nonconsecutive and altered wrapper structures',()=>{
 const r=resolve(),ids=r.elements.filter(e=>['circle','rect'].includes(e.tag)).map(e=>e.id),op={type:'createSVGMask',fileHash:r.hash,ids,maskId:ids[0]};
 for(const change of [{fileHash:'old'},{ids:[ids[0],ids[0]]},{maskId:ids[1]},{mode:'invalid'},{ids:[ids[0],r.elements.find(e=>e.tag==='path').id]}])assert.equal(mask.plan(r,{...op,...change}).refused,true);
 for(const text of [source.replace('<svg ','<svg v-if="shown" '),source.replace('<rect ','<g><rect ').replace('/><path','/></g><path')])assert.equal(create(resolve(text)).refused,true);
 const made=create(r),text=made.edits[0].after.replace('data-rt-mask-group=""','data-rt-mask-group="" transform="scale(2)"'),edited=resolve(text,made.selectionIds[0]);assert.equal(mask.plan(edited,{type:'releaseSVGMask',fileHash:edited.hash}).refused,true);
});
test('create, edit and release masks restore exact source through transaction history',t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{SourceHistory}=require('../src/history.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-mask-history-')),file=path.join(root,'index.html'),history=new SourceHistory(),states=[source],entries=[];t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(file,source);
 const apply=(r,op)=>{const result=html.applyOp({...r,file,appRoot:root},op);assert.ok(result.ok,result.reason);assert.equal(result.edits.length,1);entries.push(history.record(result.edits));states.push(fs.readFileSync(file,'utf8'));return result;};
 const initial=resolve(),made=apply(initial,{type:'createSVGMask',fileHash:initial.hash,ids:initial.elements.filter(e=>['circle','rect'].includes(e.tag)).map(e=>e.id),maskId:initial.element.id});
 const masked=resolve(states.at(-1));apply(masked,{type:'setSVGGeometry',fileHash:masked.hash,property:'r',value:'20'});
 const edited=resolve(states.at(-1),made.selectionIds[0]);apply(edited,{type:'releaseSVGMask',fileHash:edited.hash});
 for(let i=entries.length-1;i>=0;i--){assert.equal(history.apply(root,'undo',entries[i],{}).ok,true);assert.equal(fs.readFileSync(file,'utf8'),states[i]);}
 for(let i=0;i<entries.length;i++){assert.equal(history.apply(root,'redo',entries[i],{}).ok,true);assert.equal(fs.readFileSync(file,'utf8'),states[i+1]);}
});
test('existing mask type changes preserve nodes and source identities and reject invalid or stale writes',()=>{
 const created=create(resolve()),r=resolve(created.edits[0].after,created.selectionIds[0]),op={type:'setSVGMaskType',fileHash:r.hash,mode:'luminance'},result=html.planOp(r,op);assert.ok(result.ok,result.reason);assert.equal(result.edits[0].after,r.source.replace('mask-type="alpha"','mask-type="luminance"'));assert.deepEqual(result.sourceIdMap,[]);assert.deepEqual(result.removedSourceIds,[]);assert.deepEqual(result.selectionIds,[r.element.id]);assert.equal(html.describe(resolve(result.edits[0].after,r.element.id)).svgMask.mode,'luminance');assert.equal(html.planOp(r,{...op,mode:'alpha'}).unchanged,true);
 for(const change of [{fileHash:'old'},{mode:'invalid'},{mode:null}]){const invalid=html.planOp(r,{...op,...change});assert.equal(invalid.refused,true);assert.equal(invalid.edits,undefined);}
});

test('mask bounds edit, reset and release preserve content and reject invalid atomic edits',()=>{
 const made=create(resolve()),r=resolve(made.edits[0].after,made.selectionIds[0]),changes={x:'-5%',y:'0',width:'0.5',height:'100%'},op={type:'setSVGMaskBounds',fileHash:r.hash,changes},changed=html.planOp(r,op);assert.ok(changed.ok,changed.reason);
 const fresh=resolve(changed.edits[0].after,r.element.id);assert.deepEqual(html.describe(fresh).svgMask.bounds,changes);assert.deepEqual(changed.sourceIdMap,[]);assert.deepEqual(changed.selectionIds,[r.element.id]);assert.equal(html.planOp(fresh,{...op,fileHash:fresh.hash}).unchanged,true);
 const released=html.planOp(fresh,{type:'releaseSVGMask',fileHash:fresh.hash});assert.equal(released.edits[0].after,source);
 const reset=html.planOp(fresh,{type:'setSVGMaskBounds',fileHash:fresh.hash,changes:{x:null,y:null,width:null,height:null}});assert.ok(reset.ok,reset.reason);assert.deepEqual(html.describe(resolve(reset.edits[0].after,r.element.id)).svgMask.bounds,{x:null,y:null,width:null,height:null});
 for(const changes of [{width:'-1%'},{height:'Infinity'},{x:'1px'},{x:'calc(1%)'},{width:'20%',onclick:'bad'},{x:'1" bad="'},{x:2},{height:'100001%'},{}])assert.equal(html.planOp(r,{...op,changes}).refused,true);
 assert.equal(html.planOp(r,{...op,fileHash:'old'}).refused,true);
});
