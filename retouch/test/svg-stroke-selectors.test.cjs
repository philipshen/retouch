'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {resolveSelector}=require('../shell/svg-stroke-probe.js'),{resolve}=require('../src/flatten-css-nesting.cjs');
test('stroke selector inspection agrees with the source parser for nested selector lists',()=>{
 const cases=['> img, &.active, :not(&), & + &','img','&:has(> rect), circle','[data-value="&,x"] &',String.raw`& .escaped\,comma`,String.raw`& .escaped\&ampersand`,'& [title="escaped\\\"&"]','& /* &, */ > circle','&& > :is(rect,circle)'];
 for(const parent of ['.frame','.frame, #unused',':is(main, article) > svg'])for(const selector of cases){
  const compact=value=>value.replace(/\s*,\s*/g,',').replace(/\s+/g,' ');
  assert.equal(compact(resolveSelector(selector,parent)),compact(resolve(selector,parent)),selector);
 }
 assert.equal(resolveSelector('& > body',null),':where(:scope) > body');
});
test('stroke selector inspection bounds expanded selectors',()=>{
 assert.throws(()=>resolveSelector('a'.repeat(65537),'.frame'),/too large/);
 assert.throws(()=>resolveSelector(Array(200).fill('&').join(' '),'.'+'a'.repeat(1000)),/too large/);
});
