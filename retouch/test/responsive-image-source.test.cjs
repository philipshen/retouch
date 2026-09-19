'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../shell/responsive-image-source.js');
test('source ranges preserve custom conditions and decode editable width bounds',()=>{
 assert.deepEqual(S.range(null),{kind:'all'});assert.deepEqual(S.range(''),{kind:'all'});
 assert.deepEqual(S.range('(MAX-width:600px)'),{kind:'upTo',value:600});assert.deepEqual(S.range('(min-width: .5px)'),{kind:'from',value:.5});
 assert.deepEqual(S.range('(min-width: 390px) and (max-width: 900.5px)'),{kind:'between',min:390,max:900.5});
 for(const value of ['screen and (max-width: 600px)','(width < 600px)','(orientation: portrait)','(min-width: 40em)', 'not all'])assert.deepEqual(S.range(value),{kind:'custom',value});
});
test('source range authoring validates finite ordered widths without coercing blanks to zero',()=>{
 assert.equal(S.condition('all'),null);assert.equal(S.condition('custom',null,null,' (orientation: portrait) '),'(orientation: portrait)');assert.equal(S.condition('custom',null,null,''),null);
 assert.equal(S.condition('upTo',0,600),'(max-width: 600px)');assert.equal(S.condition('from','400'),'(min-width: 400px)');assert.equal(S.condition('between','0','900.5'),'(min-width: 0px) and (max-width: 900.5px)');
 for(const value of [null,undefined,true,[],{},'', ' ', '-1',Infinity,NaN,'100001','potato'])assert.throws(()=>S.condition('from',value));
 assert.throws(()=>S.condition('between',600,500));assert.throws(()=>S.condition('wrong'));
});
