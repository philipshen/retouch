'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),I=require('../shell/inspector.js'),V=require('../shell/html-css-values.js');
test('shadow stack classes retain scopes and other effects and round-trip ordered inner and outer shadows',()=>{
 const value='1px 2px 3px 4px rgba(0, 0, 0, 0.2), inset -2px 4px 5px 0px #ff000080',original='shadow-lg ![box-shadow:none] blur-sm backdrop-blur-lg md:shadow-sm hover:shadow-xl',next=I.shadowClasses(original,value);
 assert.equal(next,'blur-sm backdrop-blur-lg md:shadow-sm hover:shadow-xl ![box-shadow:1px_2px_3px_4px_rgba(0,_0,_0,_0.2),_inset_-2px_4px_5px_0px_#ff000080]');assert.equal(I.shadowClasses(next,value),next);
 const parsed=V.parseShadows(value);assert.equal(parsed.length,2);assert.equal(parsed[1].inset,true);assert.deepEqual(V.parseShadows(V.serializeShadows(parsed)),parsed);
 assert.equal(I.shadowClasses(next,null),'blur-sm backdrop-blur-lg md:shadow-sm hover:shadow-xl');assert.equal(I.shadowClasses('','none'),'![box-shadow:none]');
});
test('shadow stack edits refuse unrepresentable values and conflicting important ownership',()=>{
 for(const value of ['url(evil)','0px 2px -1px red','var(--unknown)'])assert.throws(()=>I.shadowClasses('',value),/Unsupported/);
 for(const classes of ['!ring-2','![all:initial]'])assert.throws(()=>I.shadowClasses(classes,'none'),/important/);
 assert.equal(I.shadowClasses('ring-2 opacity-50','none'),'ring-2 opacity-50 ![box-shadow:none]');
});

test('Display P3 shadow colors preserve channels and alpha through stack and filter edits',()=>{
 const color='color(display-p3 1 0.25 0.1 / 0.4)',value='0px 2px 4px '+color+', inset 1px 2px 3px rgba(0 0 0 / 0.2)',parsed=V.parseShadows(value);assert.equal(parsed.length,2);assert.equal(parsed[0].color,color);assert.deepEqual(V.parseShadows(V.serializeShadows(parsed)),parsed);assert.ok(I.shadowClasses('',value).includes('color(display-p3_1_0.25_0.1_/_0.4)'));
 const filter='drop-shadow(1px 2px 3px '+color+') blur(2px)';assert.equal(V.parseFilters(filter).length,2);assert.equal(V.withBlur(filter,4),'drop-shadow(1px 2px 3px '+color+') blur(4px)');
 for(const bad of ['0px 2px color(display-p3 2 0 0)','0px 2px color(display-p3 1 0 0','0px 2px rgb(0,0,0))','0px 2px red,','0px 2px var(--unknown)'])assert.equal(V.parseShadows(bad),null,bad);
 assert.equal(V.parseFilters('drop-shadow(1px 2px 3px 4px '+color+')'),null);
});

test('Oklab and OKLCH shadows preserve explicit channels, hue units, percentages and missing components',()=>{
 for(const color of ['oklch(63.7% 0.237 25.331 / .6)','oklab(.65 -0.1 2e-2 / 40%)','oklch(.8 0.2 .5turn)','oklab(none 10% -5%)','oklch(1 0 none / none)']){assert.equal(V.valid('color',color),true,color);const value='0px 2px 4px '+color;assert.equal(V.parseShadows(value)[0].color,color);assert.ok(I.shadowClasses('',value).includes(color.replace(/\s/g,'_')));assert.equal(V.parseFilters('drop-shadow(1px 2px 3px '+color+')').length,1);}
 for(const bad of ['oklch(.7 .2 50%)','oklab(.7 20deg .1)','oklab(.7,.1,.2)','oklab(.7 .1)','oklch(.7 .1 2 / 0.5 / 1)','oklab(.7 .1 .2 /)','oklab(.7 .1 .2);color:red','oklch(from red l c h)','oklab(calc(.7) .1 .2)','oklab(1e999 .1 .2)'])assert.equal(V.valid('color',bad),false,bad);
});
