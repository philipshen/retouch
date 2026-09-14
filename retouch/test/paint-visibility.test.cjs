'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../shell/paint-order.js'),V=require('../shell/html-css-values.js');
const key=V.paintVisibilityProperty,layers=['linear-gradient(0deg, color(display-p3 0.2 0.4 0.6 / 0.25) 0%, color(display-p3 0.2 0.4 0.6 / 0.25) 100%)','radial-gradient(ellipse at 30% 70%, red 0%, blue 100%)','url("/image.png")'],framing={'background-size':'contain, 20px 40px','background-position':'20% 70%','background-repeat':'repeat-x, no-repeat','background-blend-mode':'multiply, screen'};
test('hidden paints retain their color and framing independently of opacity',()=>{
 const hidden=P.toggleVisibility(layers,framing,'none',0,true),state=V.parsePaintVisibility(hidden[key]);
 assert.deepEqual(state,[{index:0,paint:layers[0],size:'contain'}]);assert.equal(hidden['background-size'],'0px 0px, 20px 40px, contain');assert.equal(hidden['background-image'],undefined);
 const current={...framing,...hidden};assert.deepEqual(P.toggleVisibility(layers,current,hidden[key],0,true),{});
 const second=P.toggleVisibility(layers,current,hidden[key],1,true),shown=P.toggleVisibility(layers,{...current,...second},second[key],0,false);
 assert.equal(shown['background-size'],'contain, 0px 0px, contain');assert.deepEqual(V.parsePaintVisibility(shown[key]),[{index:1,paint:layers[1],size:'20px 40px'}]);
 const restored=P.toggleVisibility(layers,{...current,...shown},shown[key],1,false);assert.equal(restored['background-size'],'contain, 20px 40px, contain');assert.equal(restored[key],'none');
});
test('hidden state follows a moved or duplicated paint and disappears with its last removal',()=>{
 const hidden=P.toggleVisibility(layers,framing,'none',0,true),current={...framing,...hidden},order=[1,0,2,0],moved=P.reorderVisibility(layers,current,hidden[key],order),next=order.map(index=>layers[index]);
 assert.deepEqual(V.parsePaintVisibility(moved[key]).map(entry=>entry.index),[1,3]);assert.equal(moved['background-size'],'20px 40px, 0px 0px, contain, 0px 0px');
 const shown=P.toggleVisibility(next,moved,moved[key],3,false);assert.equal(shown['background-size'],'20px 40px, 0px 0px, contain, contain');assert.deepEqual(V.parsePaintVisibility(shown[key]).map(entry=>entry.index),[1]);
 assert.equal(P.reorderVisibility(layers,current,hidden[key],[1,2])[key],'none');
});
test('visibility refuses stale paint identity, changed hidden framing and malformed metadata',()=>{
 const hidden=P.toggleVisibility(layers,framing,'none',0,true),current={...framing,...hidden};
 assert.throws(()=>P.visibility([layers[1],layers[0],layers[2]],current,hidden[key]),/changed outside/);
 assert.throws(()=>P.visibility(layers,framing,hidden[key]),/changed outside/);
 for(const input of ['rtpv1-00','rtpv1-c0af','rtpv1-abcd','none;display:none','rtpv1-'+('aa'.repeat(20001))])assert.equal(V.valid(key,input),false);
 const entry={index:0,paint:layers[0],size:'contain'};
 for(const entries of [[entry,entry],[{...entry,index:8}],[{...entry,index:-1}],[{...entry,paint:layers[2]}],[{...entry,size:'contain, cover'}],[{...entry,size:'0;display:none'}],[{...entry,extra:1}]])assert.throws(()=>V.serializePaintVisibility(entries));
 assert.throws(()=>P.toggleVisibility(layers,framing,'none',2,true));assert.throws(()=>P.toggleVisibility(layers,framing,'none',0,1));
 assert.equal(V.valid('--unrelated',hidden[key]),false);assert.equal(V.valid(key,null),true);
});
test('HTML source stores visibility and size atomically in the chosen responsive rule',()=>{
 const html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),source='<!doctype html><html><head></head><body><h1>Headline</h1></body></html>',resolve=text=>({source:text,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(text),element:html.collect(text,'index.html').elements.find(el=>el.tag==='h1')}),changes=P.toggleVisibility(layers,framing,'none',0,true);
 const result=css.plan(resolve(source),{width:768,changes});assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);
 const after=result.edits[0].after,stored=css.describe(resolve(after)).cssRules;assert.deepEqual(stored,{768:changes});assert.deepEqual(V.parsePaintVisibility(stored[768][key]),V.parsePaintVisibility(changes[key]));assert.equal(result.edits[0].before,source);
});
test('React and Liquid class writers preserve visibility metadata with scope isolation',()=>{
 const R=require('../shell/responsive.js'),changes=P.toggleVisibility(layers,framing,'none',0,true),before='text-red-500 md:bg-cover',classes=R.replaceScope(before,P.frameClasses(R.project(before,'md:'),changes),'md:');
 assert.ok(classes.includes('text-red-500'));assert.ok(classes.includes('md:!['+key+':'));assert.ok(!classes.includes('md:bg-cover'));
 for(const kind of ['react','liquid']){
  const adapter=require('../src/adapters/'+kind+'.cjs'),relPath=kind==='react'?'app/Page.jsx':'sections/main.liquid',source=kind==='react'?'export default function Page(){return <h1 className="'+before+'">Headline</h1>}':'<h1 class="'+before+'">Headline</h1>',element=adapter.collect(source,relPath).elements.find(el=>(kind==='react'?require('../src/id.cjs').jsxElementName(el.node):el.tag)==='h1'),resolved={source,file:'/tmp/'+relPath,relPath,hash:adapter.contentHash(source),element};
  const result=adapter.planOp(resolved,{type:'setClasses',classes,fileHash:resolved.hash});assert.equal(result.ok,true,result.reason);const next=adapter.collect(result.edits[0].after,relPath).elements.find(el=>(kind==='react'?require('../src/id.cjs').jsxElementName(el.node):el.tag)==='h1');const actual=kind==='react'?next.node.openingElement.attributes.find(attr=>attr.name?.name==='className').value.value:next.classAttr.value;assert.equal(actual,classes);assert.equal(result.edits[0].before,source);
 }
});

test('adding a paint carries hidden state and editing hidden colors updates their durable identity',()=>{
 const hidden=P.toggleVisibility(layers,framing,'none',0,true),current={...framing,...hidden},added=P.prependVisibility(layers,current,hidden[key],layers[1]),next=[layers[1],...layers];
 assert.equal(V.parsePaintVisibility(added[key])[0].index,1);assert.equal(added['background-size'],'cover, 0px 0px, 20px 40px, contain');
 const color='linear-gradient(0deg, rgb(0 0 255 / 25%) 0%, rgb(0 0 255 / 25%) 100%)',edited=P.editVisibilityPaint(next,added,added[key],1,color),editedLayers=V.imageLayers(edited['background-image']);
 assert.equal(edited['background-size'],undefined);assert.deepEqual(P.visibility(editedLayers,added,edited[key]),[{index:1,paint:color,size:'contain'}]);
 const restored=P.toggleVisibility(editedLayers,added,edited[key],1,false);assert.equal(restored['background-size'],'cover, contain, 20px 40px, contain');assert.equal(restored[key],'none');
 assert.equal(P.prependVisibility([],{},'none',layers[0])[key],'none');assert.throws(()=>P.prependVisibility([],{},hidden[key],layers[0]));
});
