'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{delta}=require('../shell/canvas-move.js'),P=require('../shell/html-position.js');
test('canvas movement axis lock follows the dominant displacement and preserves anchor modes',()=>{
 assert.deepEqual(delta(30,-10,true),{x:30,y:0});assert.deepEqual(delta(-8,-20,true),{x:0,y:-20});assert.deepEqual(delta(30,-10,false),{x:30,y:-10});
 const g={x:20,y:30,width:80,height:40,parentWidth:400,parentHeight:200},values={...P.axis(g,'x','end'),...P.axis(g,'y','scale')};
 assert.deepEqual(P.placement({...g,x:45,y:50},values),{margin:'0','box-sizing':'border-box',left:'auto',right:'275px',width:'80px',top:'25%',bottom:'auto',height:'20%'});
});
