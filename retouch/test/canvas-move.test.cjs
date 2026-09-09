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
test('movement snapping chooses nearest edges and centers without changing a locked axis',()=>{
 const {snap}=require('../shell/canvas-move.js'),rect={left:20,top:30,width:40,height:20},targets=[{left:150,top:120,width:60,height:40}];
 const aligned=snap(rect,{x:88,y:72},targets);assert.equal(aligned.x,90);assert.equal(aligned.y,70);assert.equal(aligned.guides.length,2);
 const center=snap(rect,{x:139,y:99},targets);assert.equal(center.x,140);assert.equal(center.y,100);
 const locked=snap(rect,{x:88,y:0},targets,{lock:'x'});assert.equal(locked.x,90);assert.equal(locked.y,0);assert.equal(locked.guides.length,1);
 assert.deepEqual(snap(rect,{x:70,y:50},targets),{x:70,y:50,guides:[]});
 assert.equal(snap(rect,{x:79,y:0},targets,{tolerance:12}).x,90);assert.equal(snap(rect,{x:79,y:0},targets,{tolerance:3}).x,79);
 const nearest=snap(rect,{x:88,y:0},[...targets,{left:149,top:300,width:50,height:50}]);assert.equal(nearest.x,89);
});
test('resize snapping preserves fixed opposite edges and solves independent corner alignment',()=>{
 const {snapResize}=require('../shell/canvas-move.js'),r={left:30,top:40,width:80,height:60},targets=[{left:300,top:200,width:100,height:80}];
 const corner=snapResize(r,'se',187,97,targets);assert.equal(corner.width,270);assert.equal(corner.height,160);assert.equal(corner.x,0);assert.equal(corner.y,0);assert.equal(corner.guides.length,2);
 const west=snapResize(r,'w',-28,0,[{left:0,top:0,width:600,height:600}]);assert.equal(west.x,-30);assert.equal(west.width,110);assert.equal(west.x+west.width,80);assert.equal(west.height,60);
 const locked=snapResize(r,'se',187,97,targets,{maxWidth:268,maxHeight:158});assert.equal(locked.width,267);assert.equal(locked.height,157);assert.equal(locked.guides.length,0);
 const stationary=snapResize(r,'se',0,0,[{left:112,top:102,width:50,height:50}]);assert.equal(stationary.width,80);assert.equal(stationary.height,60);assert.equal(stationary.guides.length,0);
});
test('resize snapping keeps proportions and center constraints and honors screen-pixel tolerance',()=>{
 const {snapResize}=require('../shell/canvas-move.js'),r={left:30,top:40,width:80,height:60},targets=[{left:150,top:200,width:100,height:80}];
 const ratio=snapResize(r,'se',38,25,targets,{shiftKey:true});assert.equal(ratio.width,120);assert.equal(ratio.height,90);assert.equal(ratio.x,0);assert.equal(ratio.y,0);
 const centered=snapResize(r,'e',38,0,targets,{altKey:true});assert.equal(centered.width,160);assert.equal(centered.x,-40);assert.equal(centered.x+centered.width/2,40);assert.equal(centered.y,0);
 const both=snapResize(r,'ne',38,-25,targets,{shiftKey:true,altKey:true});assert.equal(both.width,160);assert.equal(both.height,120);assert.equal(both.x,-40);assert.equal(both.y,-30);
 const limited=snapResize(r,'e',38,0,targets,{shiftKey:true,maxHeight:89});assert.equal(limited.guides.length,0);assert.equal(limited.width,118);assert.equal(limited.height,88.5);
 assert.equal(snapResize(r,'e',29,0,targets,{tolerance:12}).width,120);assert.equal(snapResize(r,'e',29,0,targets,{tolerance:3}).width,109);
});
test('every resize handle snaps only its dragged edges and preserves the opposite bounds',()=>{
 const {snapResize}=require('../shell/canvas-move.js'),r={left:100,top:100,width:100,height:80},targets=[{left:0,top:0,width:600,height:600}];
 for(const handle of ['n','s','e','w','ne','nw','se','sw']){
  const hx=handle.includes('w')?-1:handle.includes('e')?1:0,hy=handle.includes('n')?-1:handle.includes('s')?1:0,result=snapResize(r,handle,hx*98,hy<0?-98:hy>0?118:0,targets);
  assert.equal(result.guides.length,Number(Boolean(hx))+Number(Boolean(hy)),handle);
  if(hx<0){assert.equal(r.left+result.x,0);assert.equal(result.x+result.width,r.width);}else if(hx>0){assert.equal(result.x,0);assert.equal(r.left+result.width,300);}else{assert.equal(result.x,0);assert.equal(result.width,r.width);}
  if(hy<0){assert.equal(r.top+result.y,0);assert.equal(result.y+result.height,r.height);}else if(hy>0){assert.equal(result.y,0);assert.equal(r.top+result.height,300);}else{assert.equal(result.y,0);assert.equal(result.height,r.height);}
 }
});
test('movement offers equal gaps between siblings and repeats a neighboring gap in either direction',()=>{
 const {snap}=require('../shell/canvas-move.js'),r={left:20,top:20,width:40,height:30},targets=[{left:100,top:100,width:50,height:30},{left:270,top:100,width:50,height:30}];
 for(const [raw,expected,gap] of [[168,170,40],[418,420,120],[-78,-80,120]]){const result=snap(r,{x:raw,y:80},targets);assert.equal(result.x,expected);assert.equal(result.y,80);assert.equal(result.spacing.length,2);assert.ok(result.spacing.every(s=>s.axis==='x'&&s.gap===gap));}
 const transpose=t=>({left:t.top,top:t.left,width:t.height,height:t.width}),vertical=snap(transpose(r),{x:80,y:168},targets.map(transpose));assert.equal(vertical.y,170);assert.ok(vertical.spacing.every(s=>s.axis==='y'&&s.gap===40));
 const locked=snap(r,{x:168,y:80},targets,{lock:'y'});assert.equal(locked.spacing,undefined);assert.equal(locked.x,168);
});
test('spacing ignores containers, other rows, collisions and more distant candidates than edge alignment',()=>{
 const {snap}=require('../shell/canvas-move.js'),r={left:20,top:20,width:40,height:30},a={left:100,top:100,width:50,height:30},b={left:270,top:100,width:50,height:30},movement={x:168,y:80};
 assert.equal(snap(r,movement,[{...a,container:true},b]).spacing,undefined);
 assert.equal(snap(r,{x:168,y:200},[a,b]).spacing,undefined);
 assert.equal(snap(r,movement,[a,{left:190,top:100,width:40,height:30},b]).spacing,undefined);
 const closer=snap(r,movement,[a,b,{left:189,top:500,width:20,height:20}]);assert.equal(closer.x,169);assert.equal(closer.spacing,undefined);
 assert.equal(snap(r,{x:159,y:80},[a,b],{tolerance:12}).x,170);assert.equal(snap(r,{x:159,y:80},[a,b],{tolerance:3}).x,159);
});
