'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {nearest,replace}=require('../shell/max-width.js');
test('max-width snaps to the nearest token and clamps at scale endpoints',()=>{
  const points=[{token:'max-w-sm',px:384},{token:'max-w-md',px:448},{token:'max-w-lg',px:512}];
  assert.equal(nearest(points,426).token,'max-w-md');
  assert.equal(nearest(points,-10).token,'max-w-sm');
  assert.equal(nearest(points,1500).token,'max-w-lg');
  assert.equal(nearest(points,416).token,'max-w-sm');
});
test('changing max width preserves width, min width, spacing and other breakpoint scopes',()=>{
  assert.equal(replace('w-full min-w-0 px-4 max-w-[900px] lg:max-w-xl','max-w-md'),'w-full min-w-0 px-4 lg:max-w-xl max-w-md');
  assert.equal(replace('max-w-sm lg:max-w-xl xl:max-w-7xl','lg:max-w-lg','lg:'),'max-w-sm xl:max-w-7xl lg:max-w-lg');
});

test('important max-width replacements remain in their variant scope',()=>{
  assert.equal(replace('w-full max-w-sm md:max-w-xl!','md:max-w-lg!','md:'),'w-full max-w-sm md:max-w-lg!');
});
