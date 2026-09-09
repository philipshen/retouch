'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../shell/html-position.js'),V=require('../shell/html-css-values.js'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs');
const g={x:20,y:30,width:80,height:40,parentWidth:400,parentHeight:200};
test('HTML anchors retain edge distances, center offset or proportional position and size',()=>{
 assert.deepEqual(P.axis(g,'x','end'),{left:'auto',right:'300px',width:'80px'});
 assert.deepEqual(P.axis(g,'y','center'),{top:'calc(50% - 70px)',bottom:'auto',height:'40px'});
 assert.deepEqual(P.axis(g,'x','stretch'),{left:'20px',right:'300px',width:'auto'});
 assert.deepEqual(P.axis(g,'x','scale'),{left:'5%',right:'auto',width:'20%'});
 for(const d of ['x','y'])for(const mode of ['start','end','center','stretch','scale']){const values=P.axis(g,d,mode);assert.equal(P.infer(values,d),mode);for(const [p,v]of Object.entries(values))assert.equal(V.valid(p,v),true,p+':'+v);}
 assert.throws(()=>P.axis({...g,parentWidth:0},'x','scale'));assert.throws(()=>P.axis(g,'x','unknown'));
});
test('HTML positioning writes a single scoped rule and refuses important shorthand collisions',()=>{
 function resolved(style=''){const source='<html><head></head><body><div style="'+style+'">Box</div></body></html>';return {source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(e=>e.tag==='div')};}
 const r=resolved(),changes={position:'absolute',margin:'0','box-sizing':'border-box',...P.axis(g,'x','center'),...P.axis(g,'y','scale')},result=css.plan(r,{fileHash:r.hash,width:768,changes});assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.match(result.edits[0].after,/@media \(min-width: 768px\)/);
 for(const style of ['inset:0!important','inset-inline-start:2px!important','margin:10px!important','all:initial!important']){const r=resolved(style);assert.equal(css.plan(r,{fileHash:r.hash,width:0,changes}).refused,true,style);}
 for(const value of ['calc(50% + var(--x))','1px; color:red','url(x)'])assert.equal(V.valid('left',value),false);
});
