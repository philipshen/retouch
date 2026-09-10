'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),G=require('../shell/class-gradients.js'),V=require('../shell/html-css-values.js');
test('gradient classes replace only background image ownership at the edited scope',()=>{
 const value='linear-gradient(45deg, color(display-p3 1 .2 .1 / .4) 0%, #ffffff 100%), radial-gradient(circle at 30% 60%, red 0%, blue 100%)',current='bg-linear-to-r from-red-500 to-blue-500 !bg-cover bg-center bg-no-repeat !bg-red-500 hover:bg-none md:bg-linear-to-b',next=G.classes(current,value);
 for(const token of ['!bg-cover','bg-center','bg-no-repeat','!bg-red-500','hover:bg-none','md:bg-linear-to-b'])assert.ok(next.split(' ').includes(token));assert.ok(!next.split(' ').includes('bg-linear-to-r'));assert.ok(next.includes('![background-image:linear-gradient('));assert.equal(G.classes(next,value),next);assert.ok(!G.classes(next,null).includes('![background-image:'));assert.equal(V.parseGradients(value).length,2);
});
test('gradient writing refuses image expressions and important background shorthands',()=>{
 for(const value of ['url(evil)','linear-gradient(red)','none; color:red'])assert.throws(()=>G.classes('',value));for(const current of ['![background:red]','![all:initial]'])assert.throws(()=>G.classes(current,'none'),/important/);
 assert.equal(G.classes('!bg-[url(photo.png)] !bg-cover','none'),'!bg-cover ![background-image:none]');
});

test('angular gradients normalize angle units without changing stop order or colors',()=>{
 const value='conic-gradient(from .25turn at 25% 75%, color(display-p3 1 .2 .1 / .4) 0deg, red 100grad, blue .5turn, black 100%)';
 const [gradient]=V.parseGradients(value);assert.equal(gradient.angle,90);assert.equal(gradient.x,25);assert.equal(gradient.y,75);assert.deepEqual(gradient.stops.map(s=>s.position),[0,25,50,100]);
 assert.deepEqual(V.parseGradients(V.serializeGradients([gradient])),[gradient]);assert.ok(G.classes('bg-conic !bg-cover',value).startsWith('!bg-cover ![background-image:conic-gradient('));
 assert.equal(V.parseGradients('conic-gradient(red, blue)')[0].angle,0);
 assert.equal(V.parseGradients('conic-gradient(at 20% 30%, red, blue)')[0].x,20);
 assert.equal(V.parseGradients('conic-gradient(from 3.141592653589793rad, red 0rad, blue 6.283185307179586rad)')[0].angle,180);
 for(const bad of ['conic-gradient(from 90degat 25% 50%, red, blue)','conic-gradient(from 361deg, red, blue)','conic-gradient(at 101% 20%, red, blue)','conic-gradient(red 0px, blue 100px)','linear-gradient(red 0deg, blue 360deg)','conic-gradient(red 0%, blue 101%)'])assert.equal(V.parseGradients(bad),null,bad);
});

test('gradient stop fixup preserves implicit spacing, hard bands, and descending anchors',()=>{
 for(const [value,positions]of [
  ['linear-gradient(red, green, blue)',[0,50,100]],
  ['linear-gradient(red 10%, orange, yellow, green 70%, blue)',[10,30,50,70,100]],
  ['radial-gradient(red 0% 25%, blue 25% 100%)',[0,25,25,100]],
  ['conic-gradient(red 0deg 90deg, blue, green .5turn, black)',[0,25,37.5,50,100]],
  ['linear-gradient(red 80%, green, blue 20%, black)',[80,80,80,100]],
  ['linear-gradient(red, green 70% 30%, blue)',[0,70,70,100]]
 ]){const parsed=V.parseGradients(value);assert.deepEqual(parsed[0].stops.map(s=>s.position),positions,value);assert.deepEqual(V.parseGradients(V.serializeGradients(parsed)),parsed);}
 for(const invalid of ['linear-gradient(red 0% 20% 30%, blue)', 'linear-gradient(red 20px 40%, blue)', 'linear-gradient(red, 50%, blue)', 'linear-gradient('+Array(9).fill('red 0% 100%').join(',')+')'])assert.equal(V.parseGradients(invalid),null);
});

test('repeating gradient stacks retain their period and independent repeat settings',()=>{
 const value='repeating-linear-gradient(45deg, red 0% 10%, blue 10% 20%), repeating-radial-gradient(circle, white 0%, black 25%), repeating-conic-gradient(red 0deg 45deg, blue 45deg 90deg), linear-gradient(red, blue)';
 const parsed=V.parseGradients(value);assert.equal(parsed.length,4);assert.deepEqual(parsed.map(g=>!!g.repeat),[true,true,true,false]);assert.deepEqual(parsed[0].stops.map(s=>s.position),[0,10,10,20]);assert.equal(parsed[2].stops.at(-1).position,25);assert.deepEqual(V.parseGradients(V.serializeGradients(parsed)),parsed);
 const single=V.serializeGradients([{...parsed[0],repeat:false}]);assert.ok(single.startsWith('linear-gradient('));assert.deepEqual(V.parseGradients(single)[0].stops,parsed[0].stops);
 assert.ok(G.classes('!bg-[repeating-linear-gradient(red,blue)] bg-cover',value).startsWith('bg-cover ![background-image:'));
});
