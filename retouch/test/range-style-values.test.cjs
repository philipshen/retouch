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
