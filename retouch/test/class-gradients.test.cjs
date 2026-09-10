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
 for(const bad of ['conic-gradient(from 90degat 25% 50%, red, blue)','conic-gradient(from 361deg, red, blue)','conic-gradient(at 101% 20%, red, blue)','conic-gradient(red 270deg, blue 90deg)','conic-gradient(red 0px, blue 100px)','linear-gradient(red 0deg, blue 360deg)','conic-gradient(red 0%, blue 101%)'])assert.equal(V.parseGradients(bad),null,bad);
});
