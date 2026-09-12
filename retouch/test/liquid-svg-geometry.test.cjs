'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),liquid=require('../src/adapters/liquid.cjs'),geometry=require('../src/liquid-svg-geometry.cjs');
function resolve(source,tag='rect'){const elements=liquid.collect(source,'sections/main.liquid').elements;return {source,hash:liquid.contentHash(source),file:'/tmp/main.liquid',relPath:'sections/main.liquid',elements,element:elements.find(el=>el.tag===tag)};}
function plan(source,property,value){const r=resolve(source);return liquid.planOp(r,{type:'setSVGGeometry',property,value,fileHash:r.hash});}
test('Liquid SVG geometry preserves templates, quote style, identities and source no-ops',()=>{
 const source='<svg viewBox="0 0 200 100"><g>{% if visible %}<rect x=5 width=\'40\' height="20" fill="{{ color }}" />{% endif %}</g></svg>';
 const r=resolve(source);assert.equal(liquid.describe(r).svgGeometry.fields.find(f=>f.name==='width').value,'40');
 const changed=plan(source,'width','80%');assert.equal(changed.ok,true,changed.reason);assert.equal(changed.edits[0].after,source.replace("width='40'","width='80%'"));assert.deepEqual(plan(source,'width','40').edits,[]);
 const unquoted=plan(source,'x','10');assert.equal(unquoted.edits[0].after,source.replace('x=5','x="10"'));
 const inserted=plan(source,'rx','2.5');assert.ok(inserted.edits[0].after.includes('<rect rx="2.5"'));const reset=plan(inserted.edits[0].after,'rx',null);assert.equal(reset.ok,true);assert.equal(liquid.collect(reset.edits[0].after,r.relPath).elements.find(el=>el.tag==='rect').attributes.some(attr=>attr.name==='rx'),false);assert.deepEqual(plan(source,'rx',null).edits,[]);
 assert.deepEqual(liquid.collect(changed.edits[0].after,r.relPath).elements.map(el=>el.id),r.elements.map(el=>el.id));
});
test('Liquid SVG geometry refuses dynamic ownership, stale writes and invalid values',()=>{
 for(const source of ['<svg><rect width="{{ width }}"/></svg>','<svg><rect width="1" width="2"/></svg>','<svg><rect {{ attrs }} width="1"/></svg>']){assert.equal(geometry.describe(resolve(source)).fields.find(f=>f.name==='width').editable,false);const result=plan(source,'width','20');assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
 const source='<svg><rect x="{{ x }}" width="40"/></svg>';assert.equal(plan(source,'width','20').ok,true);assert.equal(plan(source,'x','20').ok,false);
 for(const value of ['-1','100001','10em','{{ width }}','1" fill="red'])assert.equal(plan('<svg><rect/></svg>','width',value).ok,false,value);
 const r=resolve(source);assert.equal(liquid.planOp(r,{type:'setSVGGeometry',property:'width',value:'20',fileHash:'stale'}).ok,false);
});
test('Liquid SVG geometry follows SVG and foreignObject namespace boundaries',()=>{
 for(const source of ['<div><rect/></div>','<svg><foreignObject><rect/></foreignObject></svg>'])assert.equal(geometry.describe(resolve(source)),null);
 assert.ok(geometry.describe(resolve('<svg><foreignObject><svg><rect/></svg></foreignObject></svg>')));
 for(const [tag,property]of [['circle','r'],['ellipse','rx'],['line','x2'],['polygon','points'],['polyline','points']]){const r=resolve('<svg><'+tag+'/></svg>',tag);assert.ok(geometry.describe(r).fields.some(field=>field.name===property));}
});

test('Liquid SVG paths are indexed, stamped and rewritten without changing neighboring identities',()=>{
 const source='<svg><rect width="5"/><path d="M0 0L20 0L10 20Z M30 0C40 0 40 20 30 20" fill="{{ color }}"/></svg><p>Keep</p>',r=resolve(source,'path'),value='M0 0 L25 0 L10 20 Z M30 0 C40 0 40 20 30 20';assert.ok(r.element);assert.equal(liquid.describe(r).svgGeometry.fields[0].name,'d');assert.ok(liquid.stamp(source,'/tmp/main.liquid','/tmp').code.includes('<path data-rt="'));
 const result=liquid.planOp(r,{type:'setSVGGeometry',property:'d',value,fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits[0].after,source.replace(r.element.attributes.find(a=>a.name==='d').value,value));assert.deepEqual(liquid.collect(result.edits[0].after,r.relPath).elements.map(e=>e.id),r.elements.map(e=>e.id));
 for(const d of ['{{ path_data }}','{% if a %}M0 0L10 10{% else %}M0 0L20 20{% endif %}']){const dynamic=resolve('<svg><path d="'+d+'"/></svg>','path');assert.equal(geometry.describe(dynamic).fields[0].editable,false);assert.equal(liquid.planOp(dynamic,{type:'setSVGGeometry',property:'d',value,fileHash:dynamic.hash}).ok,false);}
 assert.equal(liquid.collect('<div><path/></div>','main.liquid').elements.some(e=>e.tag==='path'),false);
 assert.equal(liquid.collect('<svg><foreignObject><path/></foreignObject></svg>','main.liquid').elements.some(e=>e.tag==='path'),false);
 assert.equal(liquid.planOp(r,{type:'setSVGGeometry',property:'d',value:'M0 0 BAD',fileHash:r.hash}).ok,false);
});
