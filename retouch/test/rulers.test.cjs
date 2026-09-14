'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{ticks}=require('../shell/rulers.js');
test('ruler marks follow document origin and maintain readable spacing across zoom levels',()=>{
 for(const scale of [.01,.25,1,1.5,16,64])for(const origin of [-1401.5,0,250.25]){
  const marks=ticks(1600,origin,scale),major=marks.filter(t=>t.major);assert.ok(marks.length>0&&marks.length<200);for(const mark of marks){assert.ok(mark.position>=0&&mark.position<=1600);assert.ok(Math.abs(mark.position-(origin+mark.value*scale))<1e-6);}
  for(let i=1;i<major.length;i++)assert.ok(major[i].position-major[i-1].position>=59.99&&major[i].position-major[i-1].position<=150.01);
 }
});
test('rulers handle invalid dimensions and negative document positions',()=>{for(const args of [[0,0,1],[100,NaN,1],[100,0,0],[Infinity,0,1]])assert.deepEqual(ticks(...args),[]);assert.ok(ticks(1000,500,1).some(t=>t.value<0));});
