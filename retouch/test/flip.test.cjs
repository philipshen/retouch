'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{parse,flip,token}=require('../shell/flip.js'),{valid}=require('../shell/html-css-values.js');
test('Flips preserve scale magnitude, other axes and browser-normalized percentages',()=>{
 assert.deepEqual(parse('none'),[1,1]);assert.equal(flip('none','x'),'-1 1');assert.equal(flip('2','y'),'2 -2');assert.equal(flip('-2 3 4','x'),'2 3 4');assert.equal(flip('50% 200% 300%','y'),'0.5 -2 3');assert.equal(flip('1e-3 2','x'),'-0.001 2');assert.equal(flip(flip('2 3','x'),'x'),'2 3');
});
test('Unsupported computed scales and invalid axes are refused',()=>{
 for(const value of ['',null,'calc(1 + 1)','var(--scale)','1 2 3 4','Infinity 1','1e999 1','10001 1','1;display:none'])assert.equal(parse(value),null);
 assert.equal(flip('1 2','z'),null);assert.equal(flip('none','horizontal'),null);
});
test('Scale utility replacement preserves unrelated transform and custom classes',()=>{
 for(const value of ['scale-100','-scale-x-50','scale-y-[1.5]','scale-z-200','scale-(--zoom)','[scale:-1_1]'])assert.ok(token(value),value);
 for(const value of ['transform-gpu','rotate-90','translate-x-2','md:scale-50','scale-card','scale-heading'])assert.equal(token(value),false,value);
});
test('HTML scale authoring accepts bounded numeric axes and reset only',()=>{
 for(const value of [null,'-1 1','2 -3 4','1e-3 2'])assert.ok(valid('scale',value),String(value));
 for(const value of ['none','1','1 2 3 4','Infinity 1','10001 1','1; color:red'])assert.equal(valid('scale',value),false,value);
});
