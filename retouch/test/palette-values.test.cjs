'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),values=require('../shell/palette-values.js'),catalog=require('../src/color-styles.cjs'),css=require('../shell/html-css-values.js'),classes=require('../src/color-style-classes.cjs');
test('Display P3 values retain their space and alpha across library, CSS and class encodings',()=>{
 const color='color(display-p3 1 0.2 0.1 / 0.5)',style={id:'11111111-1111-4111-8111-111111111111',name:'P3',properties:{color}};
 assert.equal(values.parse('color(display-p3 1 .2 .1 / .5)').value,color);assert.equal(values.parse(color).space,'display-p3');assert.equal(css.valid('color','COLOR(DISPLAY-P3 1 0.2 0.1 / 0.5)'),true);assert.deepEqual(values.parse(color).channels,[1,.2,.1]);assert.equal(catalog.validate({version:1,styles:[style]}).styles[0].properties.color,color);
 for(const property of ['color','background-color','border-color','fill','stroke']){assert.equal(css.valid(property,color),true);assert.equal(classes.encode(property,color),'!['+property+':color(display-p3_1_0.2_0.1_/_0.5)]');}
});
test('Display P3 rejects out-of-range, injected, malformed and unsupported colors',()=>{
 for(const value of ['color(display-p3 2 0 0)','color(display-p3 -0.1 0 0)','color(display-p3 1 0 0 / 2)','color(display-p3 1 0)','color(display-p3 1 0 0 /)','color(display-p3 1 0 0);display:none','color(display-p3 1 0 0 / NaN)','color(rec2020 1 0 0)'])assert.equal(values.valid(value),false,value);
});
