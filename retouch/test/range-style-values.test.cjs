'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),values=require('../shell/range-style-values.js');
test('text range sizes accept bounded pixel values and reject CSS syntax and nonfinite values',()=>{
 for(const value of ['0.1px','1px','24.5px','999.125px','1000px'])assert.equal(values.valid('font-size',value),true,value);
 for(const value of ['0px','-1px','1001px','1e2px','Infinitypx','NaNpx','24px;color:red','var(--size)','calc(12px + 2px)','24em','1.1234px'])assert.equal(values.valid('font-size',value),false,value);
 assert.equal(values.valid('constructor','400'),false);assert.equal(values.camel('__proto__'),null);assert.equal(values.camel('font-size'),'fontSize');
});
