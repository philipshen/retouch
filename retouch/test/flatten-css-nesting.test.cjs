'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),postcss=require('postcss'),{flatten,resolve}=require('../src/flatten-css-nesting.cjs');
const flat=css=>flatten(postcss.parse(css)).toString();
test('flattening retains declaration order across nested rules and conditional groups',()=>{
 const source='.frame, #unused { color: red; & { color: blue; } color: green; @media (width < 600px) { color: purple; > img { width: 80px; } color: orange; } color: black; }',root=postcss.parse(flat(source)),seen=[];root.walkDecls(decl=>seen.push([decl.value,decl.parent.selector,decl.parent.parent.type==='atrule'?decl.parent.parent.name:null]));assert.deepEqual(seen,[['red','.frame, #unused',null],['blue',':is(.frame, #unused)',null],['green','.frame, #unused',null],['purple','.frame, #unused','media'],['80px',':is(.frame, #unused) > img','media'],['orange','.frame, #unused','media'],['black','.frame, #unused',null]]);
});
test('explicit, implicit, repeated and functional nesting use the complete parent selector list',()=>{
 assert.equal(resolve('> img, &.active, :not(&), & + &','.frame, #unused'),':is(.frame, #unused) > img, :is(.frame, #unused).active, :not(:is(.frame, #unused)), :is(.frame, #unused) + :is(.frame, #unused)');assert.equal(resolve('img','.frame'),':is(.frame) img');assert.equal(resolve('& > body',null),':where(:scope) > body');
 assert.throws(()=>resolve('&Suffix','.frame'),/Sass-style/);
});
test('ordinary CSS, empty rules, literals and keyframes retain their source bytes',()=>{
 const source='/* & */\n.empty {}\n.a { content: "&"; --literal: { nested: value }; }\n@font-face {font-family: Test; src:url(test.woff2)}\n@keyframes spin {from {opacity:0} to {opacity:1}}';assert.equal(flat(source),source);
 const nested='.a { @layer theme { @supports (display:grid) { @container (width > 20px) { > img { display:block } } } } }';assert.equal(flat(flat(nested)),flat(nested));
});
test('flattening bounds recursion and refuses unsupported nested at-rules',()=>{
 assert.throws(()=>flat('.a { @unknown { color:red } }'),/cannot yet/);assert.throws(()=>flat('.a { @font-face {font-family:Test} }'),/cannot yet/);assert.throws(()=>flat('.a{'.repeat(66)+'color:red'+'}'.repeat(66)),/too deep|too large/);assert.throws(()=>resolve('a'.repeat(65537),'.frame'),/too large/);assert.throws(()=>resolve(Array(200).fill('&').join(' '),'.'+ 'a'.repeat(1000)),/too large/);
});
