'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),values=require('../shell/range-style-values.js');
test('text range sizes accept bounded pixel values and reject CSS syntax and nonfinite values',()=>{
 for(const value of ['0.1px','1px','24.5px','999.125px','1000px'])assert.equal(values.valid('font-size',value),true,value);
 for(const value of ['0px','-1px','1001px','1e2px','Infinitypx','NaNpx','24px;color:red','var(--size)','calc(12px + 2px)','24em','1.1234px'])assert.equal(values.valid('font-size',value),false,value);
 assert.equal(values.valid('constructor','400'),false);assert.equal(values.camel('__proto__'),null);assert.equal(values.camel('font-size'),'fontSize');
});

test('range colors share solid sRGB/P3 parsing and reject contextual or executable CSS',()=>{
 for(const value of ['#abc','#12345680','rgb(17, 34, 51)','rgba(17, 34, 51, 0.5)','color(srgb 0.1 0.2 0.3 / 0.4)','color(display-p3 1 0.2 0.3 / 0.5)'])assert.equal(values.valid('color',value),true,value);
 for(const value of ['var(--brand)','currentColor','url(javascript:alert(1))','#123456;opacity:0','rgb(300 0 0)','color(display-p3 2 0 0)'])assert.equal(values.valid('color',value),false,value);
 assert.equal(values.camel('color'),'color');
});

test('range weights accept named steps and variable values within CSS bounds',()=>{
 for(const value of ['1','100','200','300','400','500','537.25','600','700','800','900','1000'])assert.equal(values.valid('font-weight',value),true,value);
 for(const value of ['0','-1','1000.1','1001','NaN','Infinity','1e2','400; color:red','var(--weight)','bold','bolder'])assert.equal(values.valid('font-weight',value),false,value);
});

test('range font families accept literal lists and reject declarations and contextual CSS',()=>{
 for(const value of ['serif','Georgia, serif','"Studio_Test", sans-serif',"'Page Face'",'Noto Sans CJK'])assert.equal(values.valid('font-family',value),true,value);
 for(const value of ['', 'inherit','var(--font)','Arial; color:red','"Arial" onmouseover="alert(1)"','url(x)','Arial,','123'])assert.equal(values.valid('font-family',value),false,value);
});

test('range spacing distinguishes pixels, percentages and line-height multipliers',()=>{
 assert.equal(values.spacingValue('line-height','150%'),'150%');assert.equal(values.spacingValue('line-height','1.5x'),'1.5');assert.equal(values.spacingValue('line-height','32'),'32px');
 assert.equal(values.spacingValue('letter-spacing','10%'),'0.1em');assert.equal(values.spacingValue('letter-spacing','1.1%'),'0.011em');assert.equal(values.spacingValue('letter-spacing','-2'),'-2px');assert.equal(values.spacingValue('letter-spacing','Auto'),'normal');
 assert.equal(values.spacingDisplay('line-height','150%'),'150%');assert.equal(values.spacingDisplay('line-height','1.5'),'1.5x');assert.equal(values.spacingDisplay('letter-spacing','0.1em'),'10%');
 for(const [property,value]of [['line-height','-1px'],['line-height','var(--height)'],['letter-spacing','1.2x'],['letter-spacing','1px;color:red'],['line-height','Infinity']])assert.throws(()=>values.spacingValue(property,value));
 assert.equal(values.validProperties({'line-height':'150%','letter-spacing':'-0.01em'}),true);
});
