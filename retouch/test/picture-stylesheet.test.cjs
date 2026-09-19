'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),postcss=require('postcss');
const {transform}=require('../src/picture-stylesheet.cjs'),selectors=require('../src/picture-selectors.cjs');
test('picture adaptation preserves declaration bytes, rule order, media/layers and keyframes',()=>{
 const before='/* lead */\n@import "theme.css" layer(theme);\n@layer theme { .frame > img, img + button { width: 40%; --literal: "img > x"; color: red !important; } }\n@media (max-width: 600px) { .frame > img { width: 90%; } }\n@supports (display: grid) { .frame { display: grid; } }\n@keyframes pulse { from { opacity: .5 } 50%, to { opacity: 1 } }\n@-webkit-keyframes old { from { opacity: 0 } to { opacity: 1 } }';
 const after=transform(before),normalize=text=>{const ast=postcss.parse(text);ast.walkRules(rule=>{rule.selector='rule';});return ast.toString();};
 assert.equal(normalize(after),normalize(before));assert.match(after,/@keyframes pulse \{ from \{ opacity: .5 \} 50%, to \{ opacity: 1 \} \}/);assert.equal(transform(after),after);
});
test('explicit wrapper selectors do not suppress adaptation of unrelated selector-list entries',()=>{
 const after=selectors.transform('[data-rt-picture] > img, .frame > img');assert.ok(after.startsWith('[data-rt-picture] > img,'));assert.match(after,/\.frame[^,]*|:where\(img\)/);assert.ok(after.includes(' > :where([data-rt-picture]) > img'));assert.equal(selectors.transform(after),after);
});
test('unsupported selector semantics refuse adaptation instead of silently breaking layout',()=>{
 for(const selector of ['img:nth-of-type(2)','img:first-of-type','img:only-of-type','img:nth-child(2 of .art)',':is(img:last-of-type)',':has(img + button)','& > img'])assert.throws(()=>selectors.transform(selector),/cannot yet|nested :has/);
 for(const css of ['@scope (.frame) { img {width:20px} }','@namespace svg "http://www.w3.org/2000/svg"; img {width:20px}','.frame { img {width:20px} }','img {'])assert.throws(()=>transform(css));
 assert.doesNotThrow(()=>selectors.transform('.first-of-type, [title="nth-child(2 of img)"]'));
});
test('selector expansion and stylesheet input sizes are bounded',()=>{
 assert.throws(()=>selectors.transform(Array(10).fill('img').join(' + ')),/too many/);
 assert.throws(()=>selectors.transform('x'.repeat(65537)),/too large/);
 assert.throws(()=>transform(' '.repeat(2*1024*1024+1)),/too large/);
});
