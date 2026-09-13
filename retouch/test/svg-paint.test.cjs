'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),paint=require('../shell/svg-paint.js'),responsive=require('../shell/responsive.js');
test('SVG paint separates stroke colors and widths, preserving other scopes and unrelated styles',()=>{
 const classes='fill-red-500 stroke-blue-500 stroke-2 hover:fill-yellow-500 md:[fill:none] opacity-50';
 assert.equal(paint.update(classes,'fill','#00ff00'),'stroke-blue-500 stroke-2 hover:fill-yellow-500 md:[fill:none] opacity-50 [fill:#00ff00]');
 assert.equal(paint.update(classes,'stroke-width','4'),'fill-red-500 stroke-blue-500 hover:fill-yellow-500 md:[fill:none] opacity-50 [stroke-width:4]');
 assert.equal(paint.update('stroke-[5px] stroke-[#ff0000]','stroke','none'),'stroke-[5px] [stroke:none]');
 assert.equal(paint.update('![fill:red] md:fill-blue-500','fill','none'),'md:fill-blue-500 ![fill:none]');
 const scoped=responsive.replaceScope(classes,paint.update(responsive.project(classes,'md:'),'fill','rgb(1, 2, 3)'),'md:');assert.ok(scoped.includes('md:[fill:rgb(1,_2,_3)]'));assert.ok(scoped.includes('fill-red-500'));assert.equal(paint.value(responsive.project(scoped,'md:'),'fill'),'rgb(1, 2, 3)');
 assert.equal(paint.update('opacity-50 [stroke-dasharray:4_2]','stroke-dasharray',null),'opacity-50');
});
test('SVG paint refuses unsupported properties and unsafe or malformed class values',()=>{
 for(const [key,value]of [['fill','url(https://example.com/a.svg)'],['stroke-width','-2'],['fill','red;display:none'],['stroke-dasharray','2 nope'],['unknown','red']])assert.throws(()=>paint.update('',key,value));
 assert.equal(paint.update('','stroke-linecap','round'),'[stroke-linecap:round]');assert.equal(paint.update('','stroke-dasharray','4 2'),'[stroke-dasharray:4_2]');
});

test('SVG local responsive paint retains inherited importance and typed stroke width ownership',()=>{
 assert.equal(paint.property('!stroke-(length:--outline-width)'),'stroke-width');assert.equal(paint.property('stroke-[length:var(--outline-width)]!'),'stroke-width');
 const source='!stroke-(length:--outline-width) !stroke-red-500';assert.equal(paint.update(source,'stroke','#1234'),'!stroke-(length:--outline-width) ![stroke:#1234]');assert.equal(paint.update(source,'stroke-width','4'),'!stroke-red-500 ![stroke-width:4]');
 assert.equal(paint.update('','fill','#1234','![fill:#abcdef]'),'![fill:#1234]');assert.equal(paint.update('','stroke','none','!stroke-blue-500'),'![stroke:none]');assert.equal(paint.update('','fill','#1234','!stroke-blue-500'),'[fill:#1234]');assert.equal(paint.update('![fill:#1234]','fill',null,'![fill:#abcdef]'),'');
});

test('Stroke settings validate signed dash offsets, miter limits and fixed-width strokes independently',()=>{
 for(const [key,value]of [['stroke-dashoffset','-3.5%'],['stroke-miterlimit','2.5'],['vector-effect','non-scaling-stroke']]){
  const original='stroke-red-500 stroke-2 [stroke-dasharray:4_2] md:[stroke-dashoffset:8]';const changed=paint.update(original,key,value);assert.ok(changed.startsWith(original));assert.equal(paint.value(changed,key),value);assert.equal(paint.update(changed,key,null),original);
  const important=paint.update('',key,value,'!['+key+':'+value+']');assert.equal(important,'!['+key+':'+value+']');
 }
 for(const [key,value]of [['stroke-dashoffset','1 2'],['stroke-dashoffset','Infinity'],['stroke-dashoffset','100001px'],['stroke-miterlimit','0'],['stroke-miterlimit','-1'],['stroke-miterlimit','2px'],['vector-effect','scale'],['vector-effect','non-scaling-stroke;fill:red']])assert.throws(()=>paint.update('',key,value));
});
