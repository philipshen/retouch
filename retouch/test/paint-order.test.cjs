'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../shell/paint-order.js'),V=require('../shell/html-css-values.js');
test('paint ordering carries repeated CSS lists, clipping, attachment and blending with each paint',()=>{
 const framing={'background-size':'10px 20px, contain','background-position':'-20px 150%, 50% 50%','background-repeat':'repeat-x, no-repeat','background-origin':'content-box, border-box','background-clip':'padding-box, content-box','background-attachment':'fixed, local','background-blend-mode':'multiply, screen'},layers=['url("/a.svg")','url("/b.svg")','linear-gradient(red,blue)'],changes=P.reorder(layers,framing,[1,0,2,1]);
 assert.equal(changes['background-size'],'contain, 10px 20px, 10px 20px, contain');assert.equal(changes['background-blend-mode'],'screen, multiply, multiply, screen');assert.equal(changes['background-position'],'50% 50%, -20px 150%, -20px 150%, 50% 50%');
 for(const [property,value]of Object.entries(changes))assert.equal(V.valid(property,value),true,property);
 const next=P.frameClasses('text-red-500 bg-autocomplete bg-left-label bg-origin-brand bg-blend-brand bg-cover bg-top bg-repeat bg-origin-border bg-clip-content bg-fixed bg-blend-multiply md:bg-contain',changes);assert.ok(next.includes('text-red-500'));for(const token of ['bg-autocomplete','bg-left-label','bg-origin-brand','bg-blend-brand'])assert.ok(next.includes(token));assert.ok(next.includes('md:bg-contain'));assert.ok(!next.includes('bg-cover'));assert.ok(!next.includes('bg-fixed'));assert.ok(next.includes('![background-size:contain,_10px_20px,_10px_20px,_contain]'));
 for(const order of [[],[-1],[3],Array(9).fill(0)])assert.throws(()=>P.reorder(layers,framing,order));assert.throws(()=>P.reorder(layers,{'background-size':'10px;display:none'},[1,0]));
});

test('adding a paint gives it independent framing and expands existing short lists',()=>{
 const layers=['url("/a.svg")','linear-gradient(red,blue)','url("/b.svg")'],next=P.prepend(layers,{'background-size':'10px 20px, contain','background-blend-mode':'screen'},'url("/new.svg")');
 assert.equal(next['background-size'],'cover, 10px 20px, contain, 10px 20px');assert.equal(next['background-blend-mode'],'normal, screen, screen, screen');assert.equal(next['background-image'],'url("/new.svg"), '+layers.join(', '));
 assert.equal(P.prepend([],{},'linear-gradient(red,blue)')['background-position'],'50% 50%');
 assert.throws(()=>P.prepend(Array(8).fill(layers[0]),{},layers[0]));assert.throws(()=>P.prepend(layers,{},'url("javascript:bad")'));
});

test('per-paint framing changes only the requested property and preserves cyclic neighbors',()=>{
 const result=P.edit(['url("/a")','url("/b")','url("/c")'],{'background-size':'contain, 10px 20px','background-repeat':'no-repeat'},1,{'background-size':'cover'});
 assert.deepEqual(result,{'background-size':'contain, cover, contain'});
 for(const patch of [{color:'red'},{'background-size':'cover, contain'},{'background-size':null},{}])assert.throws(()=>P.edit(['url("/a")'],{},0,patch));
});
