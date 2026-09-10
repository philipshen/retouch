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
