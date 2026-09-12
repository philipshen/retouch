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
