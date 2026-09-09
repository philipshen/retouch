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
