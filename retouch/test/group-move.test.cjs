'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const move=require('../shell/group-move.js'),css=require('../shell/html-css-values.js');
test('group translations compose existing pixel offsets and reject unresolved coordinates',()=>{
 assert.equal(move.translation('none',{x:10,y:-2}),'10px -2px');
 assert.equal(move.translation('2px -3px',{x:1,y:10}),'3px 7px');
 for(const value of ['var(--move) 0px','1px 2px 3px','calc(1px * 2%) 0px'])assert.throws(()=>move.translation(value,{x:1,y:0}));
 assert.throws(()=>move.translation('none',{x:Infinity,y:0}));assert.throws(()=>move.translation('99999px 0px',{x:2,y:0}));
});
test('group classes replace only active translation utilities and preserve other scopes and transforms',()=>{
 assert.equal(move.classes('rotate-12 translate-x-2 md:translate-y-4 hover:opacity-50','','10px 20px'),'md:translate-y-4 hover:opacity-50 rotate-12 ![translate:10px_20px]');
 assert.equal(move.classes('translate-x-2 md:translate-y-4 md:scale-125','md:','10px 20px'),'translate-x-2 md:scale-125 md:![translate:10px_20px]');
});
test('managed translation values accept bounded pixel pairs and resetting, never arbitrary declarations',()=>{
 for(const value of ['0px -2px','100000px 0px',null])assert.equal(css.valid('translate',value),true);
 for(const value of ['100001px 0px','1px; color:red','1px','var(--x)','NaNpx 0px'])assert.equal(css.valid('translate',value),false);
});

test('percentage translations retain their proportional term through repeated pixel movements',()=>{
 assert.equal(move.translation('10% -5%',{x:20,y:-3}),'calc(10% + 20px) calc(-5% - 3px)');
 assert.equal(move.translation('calc(10% + 20px) calc(-5% - 3px)',{x:-20,y:3}),'10% -5%');
 assert.equal(move.translation('calc(3px - 8%) 4%',{x:-5,y:0}),'calc(-8% - 2px) 4%');
 assert.equal(css.valid('translate','calc(10% + 20px) calc(-5% - 3px)'),true);
 assert.equal(css.valid('translate','calc(10% + 20px);color:red'),false);
});
test('container transform inversion maps screen movement through nested rotation, nonuniform scale, skew and reflection',()=>{
 const rotation=[0,1,-1,0],scale=[2,0,0,.5],skew=[1,.4,.3,1],reflection=[-1,0,0,1];
 const matrices=[[1,0,0,1],rotation,scale,skew,reflection,move.multiply(rotation,move.multiply(scale,skew))];
 for(const matrix of matrices){const d={x:13,y:-7},local=move.localDelta(matrix,d);assert.ok(Math.abs(matrix[0]*local.x+matrix[2]*local.y-d.x)<1e-8);assert.ok(Math.abs(matrix[1]*local.x+matrix[3]*local.y-d.y)<1e-8);}
 assert.throws(()=>move.localDelta([0,0,0,1],{x:1,y:2}),/singular/);assert.throws(()=>move.localDelta([Infinity,0,0,1],{x:1,y:2}),/singular/);
});
test('mixed group measurements flatten transparent groups and move covered descendants only once',()=>{
 const d={defaultView:{DOMMatrixReadOnly:class{constructor(){Object.assign(this,{a:1,b:0,c:0,d:1,is2D:true});}},getComputedStyle:el=>({display:el.group?'contents':'block',transform:'none',rotate:'none',scale:'none',translate:'none',zoom:'1'})}};
 const node=(id,group=false)=>({id,group,namespaceURI:'http://www.w3.org/1999/xhtml',isConnected:true,ownerDocument:d,parentElement:null,children:[],childNodes:[],hasAttribute:name=>name==='data-rt-group'&&group,getAttribute:name=>name==='data-rt'?id:null,getBoundingClientRect:()=>({x:0,y:0,width:10,height:10}),querySelectorAll(){return this.children.flatMap(child=>[child,...child.querySelectorAll()]);},contains(other){return other===this||this.children.some(child=>child.contains(other));}});
 const group=node('group',true),nested=node('nested',true),a=node('a'),b=node('b'),c=node('c');group.children=group.childNodes=[a,nested];a.parentElement=nested.parentElement=group;nested.children=nested.childNodes=[b];b.parentElement=nested;
 assert.deepEqual(move.measureSelection([group,a,c,group]).map(item=>item.id),['a','b','c']);
 assert.throws(()=>move.measureSelection([group,c],el=>el===b),/Unlock/);
 assert.throws(()=>move.measureSelection([group,node('a')]),/distinct/);
});
