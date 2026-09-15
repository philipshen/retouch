'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../shell/background-paint.js'),V=require('../shell/html-css-values.js');
const key=B.property;
test('background visibility preserves color and opacity through hide, edit and show',()=>{
 for(const color of ['#33669980','color(srgb 0.2 0.4 0.6 / 0.375)','color(display-p3 0.2 0.4 0.6 / 0.375)','#12345600']){
  const hidden=B.toggle(color,'none',true),state=B.state(hidden['background-color'],hidden[key]);assert.deepEqual(state,{hidden:true,color});assert.deepEqual(B.toggle(hidden['background-color'],hidden[key],true),{});
  const shown=B.toggle(hidden['background-color'],hidden[key],false);assert.deepEqual(shown,{'background-color':color,[key]:'none'});
  const edited=B.edit(hidden['background-color'],hidden[key],'color(display-p3 0.8 0.1 0.2 / 0.25)');assert.equal(B.state(edited['background-color'],edited[key]).color,'color(display-p3 0.8 0.1 0.2 / 0.25)');assert.equal(B.toggle(edited['background-color'],edited[key],false)['background-color'],'color(display-p3 0.8 0.1 0.2 / 0.25)');assert.ok(Object.keys(edited).every(property=>[key,'background-color'].includes(property)));
 }
 assert.deepEqual(B.edit('#ff0000','none','#00ff00'),{'background-color':'#00ff00ff'});
 assert.deepEqual(B.clear(),{'background-color':'transparent',[key]:'none'});assert.deepEqual(B.reset(),{'background-color':null,[key]:null});
});
test('background visibility refuses stale state, contextual colors and malformed metadata',()=>{
 const hidden=B.toggle('#33669980','none',true);assert.throws(()=>B.state('#336699ff',hidden[key]),/changed outside/);assert.throws(()=>B.state('#ff000000',hidden[key]),/changed outside/);
 for(const color of ['var(--brand)','currentcolor','inherit','url(javascript:alert(1))'])assert.throws(()=>B.toggle(color,'none',true));
 const encode=data=>'rtbc1-'+Buffer.from(JSON.stringify(data)).toString('hex');
 for(const value of ['rtbc1-ff','rtbc1-0','rtbc1-'+ '00'.repeat(3000),encode({version:2,color:'#ff0000ff'}),encode({version:1,color:'#ff0000ff',extra:true}),encode({version:1,color:'var(--brand)'}),encode({version:1,color:'color(display-p3 2 0 0 / 1)'}),encode({version:1,color:'color(srgb 0 0 0 / 2)'}),encode({version:1,color:'COLOR(display-p3 2 0 0 / 1)'}),encode({version:1,color:'#fff;opacity:0'})]){assert.equal(V.valid(key,value),false);assert.throws(()=>B.state('#00000000',value));}
 assert.equal(V.valid(key,hidden[key]),true);assert.equal(V.valid(key,null),true);assert.equal(V.valid('--unrelated',hidden[key]),false);assert.throws(()=>B.toggle('#ff0000','none',1));
});
test('HTML stores hidden background color and metadata atomically in one responsive rule',()=>{
 const html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),source='<html><head></head><body><h1>Headline</h1></body></html>',resolve=text=>({source:text,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(text),element:html.collect(text,'index.html').elements.find(el=>el.tag==='h1')}),changes=B.toggle('#33669980','none',true),result=css.plan(resolve(source),{width:768,changes});
 assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,source);assert.deepEqual(css.describe(resolve(result.edits[0].after)).cssRules,{768:changes});
});
test('React and Liquid source writers retain hidden background metadata with independent responsive classes',()=>{
 const C=require('../src/color-style-classes.cjs'),R=require('../shell/responsive.js'),I=require('../shell/inspector.js'),before='text-red-500 bg-blue-500 md:bg-red-500 md:bg-cover',changes=B.toggle('#33669980','none',true),colorClasses=C.compose(before,'background-color',changes['background-color'],'md:'),classes=R.replaceScope(colorClasses,I.replace(R.project(colorClasses,'md:'),token=>token.startsWith('['+key+':'),'!['+key+':'+changes[key]+']'),'md:');
 assert.ok(classes.includes('bg-blue-500'));assert.ok(classes.includes('md:bg-cover'));assert.ok(!classes.includes('md:bg-red-500'));assert.ok(classes.includes('md:!['+key+':'));
 for(const kind of ['react','liquid']){const adapter=require('../src/adapters/'+kind+'.cjs'),relPath=kind==='react'?'app/Page.jsx':'sections/main.liquid',source=kind==='react'?'export default function Page(){return <h1 className="'+before+'">Headline</h1>}':'<h1 class="'+before+'">Headline</h1>',find=source=>adapter.collect(source,relPath).elements.find(el=>(kind==='react'?require('../src/id.cjs').jsxElementName(el.node):el.tag)==='h1'),resolved={source,file:'/tmp/'+relPath,relPath,hash:adapter.contentHash(source),element:find(source)},result=adapter.planOp(resolved,{type:'setClasses',classes,fileHash:resolved.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits[0].before,source);const next=find(result.edits[0].after);assert.equal(kind==='react'?next.node.openingElement.attributes.find(attr=>attr.name?.name==='className').value.value:next.classAttr.value,classes);}
});
