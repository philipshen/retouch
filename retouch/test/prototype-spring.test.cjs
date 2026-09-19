'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../shell/prototype-spring.js'),V=require('../shell/prototype-values.js');
const spring=(stiffness,damping,mass=1)=>({type:'spring',stiffness,damping,mass});
test('spring response agrees with independent integration for under, critical and overdamping',()=>{
 for(const value of [spring(100,8),spring(100,20),spring(100,35),spring(200,10,2),spring(100,19.9999999)]){
  const model=S.model(value);let position=0,velocity=0;const dt=.00001;
  for(let n=1;n<=200000;n++){velocity+=(value.stiffness*(1-position)-value.damping*velocity)/value.mass*dt;position+=velocity*dt;if(n%10000===0){const actual=model.at(n*dt);assert.ok(Math.abs(actual.position-position)<.0002);assert.ok(Math.abs(actual.velocity-velocity)<.001);}}
  assert.deepEqual(model.at(0),{position:0,velocity:0});
 }
});
test('spring samples resolve oscillations and terminate only after position and velocity settle',()=>{
 for(const value of [...Object.values(S.presets).map(v=>({type:'spring',...v})),spring(100,20),spring(100,40),spring(1000,10,.1)]){
  const curve=S.curve(value),model=S.model(value);assert.equal(curve.samples[0],0);assert.equal(curve.samples.at(-1),1);assert.ok(curve.duration<=10000);assert.ok(curve.css.startsWith('linear('));
  for(let t=curve.duration/1000;t<curve.duration/1000+2;t+=.003){const p=model.at(t);assert.ok(Math.abs(1-p.position)<=.001);assert.ok(Math.abs(p.velocity)<=.01);}
  // Independently bound interpolation error between the serialized samples.
  for(let i=0;i<curve.samples.length-1;i++){const actual=model.at((i+.5)/(curve.samples.length-1)*curve.duration/1000).position;assert.ok(Math.abs(actual-(curve.samples[i]+curve.samples[i+1])/2)<.001);}
 }
 assert.ok(Math.max(...S.curve(spring(200,10)).samples)>1.2);
 assert.ok(S.curve(spring(100,15,2)).duration>S.curve(spring(100,15,1)).duration);
});
test('spring validation rejects unstable, unbounded and nonnumeric values',()=>{
 for(const value of [spring(0,10),spring(100,0),spring(100,10,0),spring(1001,10),spring(100,101),spring(100,10,11),spring(NaN,10),spring(100,'10'),{...spring(100,10),code:'x'}])assert.throws(()=>S.curve(value));
 assert.throws(()=>S.curve(spring(1,.1,10)),/10 seconds/);
 const value=spring(200,10),result=V.transition({type:'move-in',easing:value,duration:300},'open-overlay');assert.equal(result.duration,S.curve(value).duration);assert.deepEqual(result.easing,value);assert.equal(V.easingCss(value),S.curve(value).css);
});
