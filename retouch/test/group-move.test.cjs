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
 a.getBoundingClientRect=()=>({x:10,y:20,width:30,height:40});b.getBoundingClientRect=()=>({x:50,y:80,width:20,height:10});c.getBoundingClientRect=()=>({x:100,y:5,width:10,height:10});
 const members=move.measureSelection([group,a,c]),bounds=move.selectionBounds([group,a,c],members);
 assert.deepEqual(bounds.map(({el,...rect})=>rect),[{left:10,top:20,width:60,height:70},{left:100,top:5,width:10,height:10}]);
 assert.deepEqual(move.memberDeltas(bounds,members,[{x:0,y:-15},{x:-90,y:0}]),[{x:0,y:-15},{x:0,y:-15},{x:-90,y:0}]);
 assert.throws(()=>move.memberDeltas(bounds,members,[{x:NaN,y:0},{x:0,y:0}]),/finite/);
 assert.throws(()=>move.memberDeltas(bounds.slice(0,1),members,[{x:0,y:0}]),/one selection root/);

});

test('distribution treats each group as one bound while preserving internal child offsets',()=>{
 const arrange=require('../shell/selection-layout.js').arrange;
 const a={},b={},c={},d={},e={},root=children=>({contains:el=>children.includes(el)}),roots=[root([a,b]),root([c,d]),root([e])];
 const members=[{el:a,rect:{x:0,y:0,width:10,height:10}},{el:b,rect:{x:20,y:0,width:10,height:10}},{el:c,rect:{x:60,y:0,width:10,height:10}},{el:d,rect:{x:80,y:0,width:10,height:10}},{el:e,rect:{x:150,y:0,width:10,height:10}}];
 const bounds=move.selectionBounds(roots,members),deltas=move.memberDeltas(bounds,members,arrange(bounds,'gap-x'));
 assert.deepEqual(deltas,[{x:0,y:0},{x:0,y:0},{x:15,y:0},{x:15,y:0},{x:0,y:0}]);
 const moved=members.map((member,i)=>({...member,rect:{...member.rect,x:member.rect.x+deltas[i].x}})),next=move.selectionBounds(roots,moved);
 assert.equal(next[1].left-next[0].left-next[0].width,45);assert.equal(next[2].left-next[1].left-next[1].width,45);
 assert.equal(moved[3].rect.x-moved[2].rect.x,20);
});

test('parent alignment skips transparent ancestors and requires one visible parent',()=>{
 const d={defaultView:{getComputedStyle:el=>({display:el.transparent?'contents':'block'})}},parent={isConnected:true,getBoundingClientRect:()=>({left:12,top:34,width:500,height:200})},transparent={transparent:true,parentElement:parent},a={ownerDocument:d,parentElement:transparent,contains:el=>el===a},b={ownerDocument:d,parentElement:parent,contains:el=>el===b};
 assert.deepEqual(move.parentBounds([a,b]),{el:parent,left:12,top:34,width:500,height:200});
 b.parentElement={...parent};assert.equal(move.parentBounds([a,b]),null);
 b.parentElement=parent;parent.getBoundingClientRect=()=>({left:0,top:0,width:0,height:0});assert.equal(move.parentBounds([a,b]),null);
});

test('group scaling validates its ratio and replaces only active scale utilities',()=>{
 assert.throws(()=>move.scalePlan([],2),/source layers/);
 for(const offset of [{x:NaN,y:0},{x:0,y:Infinity},{x:1}])assert.throws(()=>move.scalePlan([],2,offset),/finite scale anchor/);
 for(const value of [0,-1,Infinity,NaN,.001,101])assert.throws(()=>move.scalePlan([],value),/scale/);
 assert.equal(move.scaleClasses('rotate-12 scale-x-125 md:scale-50 hover:opacity-50','','2 -1'),'md:scale-50 hover:opacity-50 rotate-12 ![scale:2_-1]');
 assert.equal(move.scaleClasses('scale-75 md:scale-125 md:translate-x-2','md:','1.5 1.5'),'scale-75 md:translate-x-2 md:![scale:1.5_1.5]');
});

test('scaled layer movement reads bounded pixel offsets without saving rendered translation',()=>{
 const values={},el={ownerDocument:{defaultView:{getComputedStyle:()=>({getPropertyValue:name=>values[name]||''})}}};
 assert.deepEqual(move.scaleMovement(el),{x:0,y:0});values['--rt-scale-move-x']='23px';values['--rt-scale-move-y']='-9.5px';assert.deepEqual(move.scaleMovement(el),{x:23,y:-9.5});
 for(const value of ['10%', 'calc(1px + 2%)','NaNpx','100001px']){values['--rt-scale-move-x']=value;assert.throws(()=>move.scaleMovement(el),/pixels/);}
});
