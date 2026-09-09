'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{delta}=require('../shell/canvas-move.js'),P=require('../shell/html-position.js');
test('canvas movement axis lock follows the dominant displacement and preserves anchor modes',()=>{
 assert.deepEqual(delta(30,-10,true),{x:30,y:0});assert.deepEqual(delta(-8,-20,true),{x:0,y:-20});assert.deepEqual(delta(30,-10,false),{x:30,y:-10});
 const g={x:20,y:30,width:80,height:40,parentWidth:400,parentHeight:200},values={...P.axis(g,'x','end'),...P.axis(g,'y','scale')};
 assert.deepEqual(P.placement({...g,x:45,y:50},values),{margin:'0','box-sizing':'border-box',left:'auto',right:'275px',width:'80px',top:'25%',bottom:'auto',height:'20%'});
});
test('canvas resizing anchors opposite edges and supports centered proportional changes',()=>{
 const {resize}=require('../shell/canvas-move.js');
 assert.deepEqual(resize(100,50,'e',20,30),{x:0,y:0,width:120,height:50});
 assert.deepEqual(resize(100,50,'nw',-20,-10),{x:-20,y:-10,width:120,height:60});
 assert.deepEqual(resize(100,50,'se',20,30,{shiftKey:true}),{x:0,y:0,width:160,height:80});
 assert.deepEqual(resize(100,50,'e',20,30,{shiftKey:true,altKey:true}),{x:-20,y:-10,width:140,height:70});
 assert.deepEqual(resize(100,50,'n',0,-10,{shiftKey:true}),{x:-10,y:-10,width:120,height:60});
 assert.deepEqual(resize(100,50,'w',200,0,{minWidth:12}),{x:88,y:0,width:12,height:50});
 assert.deepEqual(resize(100,50,'s',0,80,{maxHeight:70}),{x:0,y:0,width:100,height:70});
 for(const handle of ['n','s','e','w','ne','nw','se','sw']){const g=resize(100,50,handle,12,7,{altKey:true});assert.equal(g.x+g.width/2,50);assert.equal(g.y+g.height/2,25);}
 assert.throws(()=>resize(100,50,'invalid',0,0));
});
