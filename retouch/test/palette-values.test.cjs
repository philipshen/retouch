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

test('color-space conversion preserves in-gamut colors and requires explicit clipping',()=>{
 for(const hex of ['#00000000','#ffffffff','#ff000080','#00ff00ff','#0000ffff','#33669988','#01020304','#fefdfcfb']){const p3=values.convert(hex,'display-p3');assert.equal(p3.clipped,false);const back=values.convert(p3.value,'srgb');assert.equal(back.clipped,false,hex);assert.equal(back.value,hex);assert.equal(values.parse(p3.value).alpha,values.parse(hex).alpha);}
 const red=values.parse(values.convert('#ff0000ff','display-p3').value).channels;assert.ok(Math.abs(red[0]-.917488)<.00001);assert.ok(Math.abs(red[1]-.200287)<.00001);assert.ok(Math.abs(red[2]-.138561)<.00001);
 assert.deepEqual(values.convert('color(display-p3 1 0 0 / 0.5)','srgb'),{value:null,clipped:true});assert.deepEqual(values.convert('color(display-p3 1 0 0 / 0.5)','srgb',true),{value:'color(srgb 1 0 0 / 0.5)',clipped:true});assert.throws(()=>values.convert('#fff','unknown'));
});


test('explicit sRGB preserves non-byte channels and alpha through palette validation',()=>{
 const color='color(srgb 0.2 0.4 0.6 / 0.2345)',parsed=values.parse(color);assert.equal(parsed.value,color);assert.equal(parsed.alpha,.2345);assert.equal(values.parse(values.convert(values.convert(color,'display-p3').value,'srgb').value).alpha,.2345);assert.equal(parsed.space,'srgb');assert.deepEqual(parsed.channels,[.2,.4,.6]);assert.equal(values.srgb(parsed.channels,parsed.alpha),color);assert.equal(values.srgb([.2,.4,.6],128/255),'#33669980');
 const style={id:'11111111-1111-4111-8111-111111111111',name:'Exact opacity',properties:{color}};assert.equal(catalog.validate({version:1,styles:[style]}).styles[0].properties.color,color);for(const property of ['color','background-color','border-color','fill','stroke'])assert.ok(classes.encode(property,color).includes('0.2345'));
 for(const bad of ['color(srgb -1 0 0)','color(srgb 0 0 2)','color(srgb 0 0 0 / 1.1)','color(srgb 0 0)','color(srgb 0 0 0);display:none'])assert.equal(values.valid(bad),false,bad);
});
