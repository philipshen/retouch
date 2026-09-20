'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),G=require('../shell/svg-path.js'),S=require('../shell/svg-stroke-alignment.js');
const id='rt-stroke-0123456789abcdef',document=G.parseCompound('M20 20H80V80H20Z');
test('stroke alignment retains original geometry and computes separate fill and constrained stroke',()=>{
 const input={document,width:8,fill:'#ff0000',stroke:'#0000ff'},before=JSON.stringify(input);
 for(const position of ['inside','center','outside']){const markup=S.render({...input,position},id);assert.match(markup,/fill="#ff0000"/);assert.match(markup,new RegExp('stroke-width="'+(position==='center'?8:16)+'"'));assert.equal(S.normalize({...input,position}).path,G.serializeCompound(document));assert.equal(markup.includes('<defs>'),position!=='center');}
 assert.equal(JSON.stringify(input),before);
});
test('stroke alignment bounds include curved extrema and miter expansion before transforms',()=>{
 const input={document:G.parseCompound('M20 50A30 30 0 1 1 80 50A30 30 0 1 1 20 50Z'),position:'outside',width:5,miterlimit:10,matrix:[2,0,0,3,5,9],fillRule:'evenodd'},normalized=S.normalize(input);
 assert.deepEqual(normalized.bounds,{x:-31,y:-31,width:162,height:162});assert.match(S.render(input,id),/maskUnits="userSpaceOnUse"/);assert.match(S.render(input,id),/fill-rule="evenodd"/);assert.match(S.render(input,id),/matrix\(2 0 0 3 5 9\)/);
 normalized.matrix[0]=99;assert.equal(input.matrix[0],2);
});
test('stroke alignment preserves literal dash and opacity settings',()=>{
 const output=S.render({document,position:'inside',width:5,dasharray:'4 2 1 2',dashoffset:-3,opacity:.5,fillOpacity:.25,strokeOpacity:.75,linecap:'round',linejoin:'bevel'},id);
 for(const text of ['stroke-dasharray="4 2 1 2"','stroke-dashoffset="-3"','opacity="0.5"','fill-opacity="0.25"','stroke-opacity="0.75"','stroke-linecap="round"','stroke-linejoin="bevel"'])assert.ok(output.includes(text));
});
test('stroke alignment rejects unsupported geometry and unresolved paints without mutating input',()=>{
 for(const change of [{position:'bad'},{width:-1},{width:Infinity},{matrix:[1,0,0,0,0,0]},{fillRule:'bad'},{stroke:'url(#gradient)'},{fill:'var(--paint)'},{dasharray:'10%'},{miterlimit:0},{opacity:2},{document:G.parseCompound('M0 0L10 10'),position:'inside'}]){const input={document,...change},before=JSON.stringify(input);assert.throws(()=>S.render(input,id));assert.equal(JSON.stringify(input),before);}
 assert.throws(()=>S.render({document},'bad"id'));assert.doesNotThrow(()=>S.render({document:G.parseCompound('M0 0L10 10'),position:'center'},id));
});

test('inside and outside alignment reject ambiguous contour boundaries without leaking geometry scopes',()=>{
 const paper=require('paper'),before=Object.keys(paper.PaperScope._scopes).length;
 for(const path of ['M20 20L80 80L20 80L80 20Z','M20 20H80V80H20Z M40 40H60V60H40Z','M0 0H50V50H0Z M25 25H75V75H25Z','M0 0L10 0L20 0Z'])for(const position of ['inside','outside'])assert.throws(()=>S.render({document:G.parseCompound(path),position},id),/contours/);
 assert.doesNotThrow(()=>S.render({document:G.parseCompound('M20 20H80V80H20Z M40 40H60V60H40Z'),fillRule:'evenodd',position:'inside'},id));
 assert.doesNotThrow(()=>S.render({document:G.parseCompound('M20 20H80V80H20Z M40 40V60H60V40Z'),position:'outside'},id));
 assert.equal(Object.keys(paper.PaperScope._scopes).length,before);
});
