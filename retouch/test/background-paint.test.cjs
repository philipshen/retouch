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
test('HTML hidden background edits, saved style refresh and resets stay atomic and scoped',()=>{
 const html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),styles=require('../src/html-color-styles.cjs');
 const initial='<html><head></head><body><h1>Headline</h1></body></html>',resolve=source=>({source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(el=>el.tag==='h1')});
 let source=initial;
 const apply=(planner,op,style)=>{const before=source,result=planner(resolve(source),op,style);assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,before);source=result.edits[0].after;return css.describe(resolve(source)).cssRules;};
 const style={id:'11111111-1111-4111-8111-111111111111',name:'Brand',properties:{color:'#33669980'}};
 apply(styles.plan,{type:'applyColorStyle',width:768,property:'background-color'},style);
 apply(css.plan,{width:0,property:'background-color',value:'#ffffff'});
 let rules=apply(css.plan,{width:768,changes:B.toggle(style.properties.color,'none',true)});
 assert.deepEqual(styles.describe(resolve(source)).colorStyleOverrides[768],[]);
 rules=apply(styles.plan,{type:'refreshColorStyle',width:768,property:'background-color'},{...style,properties:{color:'#abcdef80'}});
 assert.equal(B.state(rules[768]['background-color'],rules[768][key]).color,'#abcdef80');assert.equal(rules[0]['background-color'],'#ffffff');
 assert.deepEqual(styles.describe(resolve(source)).colorStyleOverrides[768],[]);
 rules=apply(css.plan,{width:768,property:'background-color',value:'color(display-p3 0.8 0.1 0.2 / 0.25)'});
 assert.equal(B.state(rules[768]['background-color'],rules[768][key]).color,'color(display-p3 0.8 0.1 0.2 / 0.25)');
 assert.deepEqual(styles.describe(resolve(source)).colorStyleOverrides[768],['background-color']);
 rules=apply(styles.plan,{type:'resetColorStyle',width:768,property:'background-color'},{...style,properties:{color:'#abcdef80'}});
 assert.equal(B.state(rules[768]['background-color'],rules[768][key]).hidden,true);
 rules=apply(css.plan,{width:768,changes:B.toggle(rules[768]['background-color'],rules[768][key],false)});
 assert.equal(rules[768]['background-color'],'#abcdef80');assert.equal(rules[768][key],'none');
 rules=apply(css.plan,{width:768,property:'background-color',value:null});assert.equal(rules[768],undefined);assert.equal(rules[0]['background-color'],'#ffffff');
});
test('React and Liquid hidden backgrounds keep saved links through refresh and local overrides',()=>{
 const C=require('../src/color-style-classes.cjs'),hidden=B.toggle('#33669980','none',true),initialClasses=C.compose('bg-white md:bg-cover','background-color',hidden['background-color'],'md:')+' md:!['+key+':'+hidden[key]+']';
 assert.equal(C.overridden(initialClasses,'background-color','#33669980','md:'),false);
 assert.throws(()=>C.compose(initialClasses+' md:bg-red-500','background-color','#fff','md:'),/ambiguous/);
 assert.throws(()=>C.compose(initialClasses.replace(hidden['background-color'].replace(/ /g,'_'),'#ff000000'),'background-color','#fff','md:'),/changed outside/);
 for(const kind of ['react','liquid']){
  const adapter=require('../src/adapters/'+kind+'.cjs'),links=require('../src/'+(kind==='react'?'jsx':'liquid')+'-color-styles.cjs'),relPath=kind==='react'?'Page.jsx':'main.liquid',resolve=source=>({source,file:'/tmp/'+relPath,relPath,hash:adapter.contentHash(source),element:adapter.collect(source,relPath).elements.find(el=>kind==='react'?el.node.openingElement.name.name==='h1':el.tag==='h1')});
  let source=kind==='react'?'export default function Page(){return <h1 className="'+initialClasses+'">Title</h1>}':'<h1 class="'+initialClasses+'">Title</h1>';
  const style={id:'11111111-1111-4111-8111-111111111111',name:'Brand',properties:{color:'#33669980'}},op={type:'applyColorStyle',property:'background-color',scope:'md:'};
  const apply=(planner,operation,value)=>{const before=source,result=planner(resolve(source),operation,value);assert.equal(result.ok,true,result.reason);if(result.edits.length){assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,before);source=result.edits[0].after;}return adapter.describe(resolve(source)).className;};
  apply(links.plan,op,style);assert.deepEqual(links.describe(resolve(source)).colorStyleOverrides['md:'],[]);
  let classes=apply(links.plan,{...op,type:'refreshColorStyle'},{...style,properties:{color:'#abcdef80'}});
  assert.equal(C.overridden(classes,'background-color','#abcdef80','md:'),false);assert.ok(classes.includes('bg-white'));assert.ok(classes.includes('md:bg-cover'));
  classes=apply(adapter.planOp,{type:'setClasses',classes:C.compose(classes,'background-color','#12345678','md:')});
  assert.deepEqual(links.describe(resolve(source)).colorStyleOverrides['md:'],['background-color']);
  classes=apply(links.plan,{...op,type:'resetColorStyle'},style);assert.equal(C.overridden(classes,'background-color','#33669980','md:'),false);
  classes=apply(adapter.planOp,{type:'setClasses',classes:C.compose(classes,'background-color',null,'md:')});
  assert.ok(!classes.includes(key));assert.ok(!classes.includes('[background-color:'));assert.ok(classes.includes('bg-white'));assert.ok(classes.includes('md:bg-cover'));
 }
});
test('explicit class visibility changes restore paint atomically and validate paired metadata',()=>{
 const C=require('../src/color-style-classes.cjs'),before='bg-blue-500 md:bg-red-500 md:bg-cover',hidden=B.toggle('#33669980','none',true),classes=C.composeBackground(before,hidden,'md:');
 assert.ok(classes.includes('bg-blue-500'));assert.ok(classes.includes('md:bg-cover'));assert.equal(C.overridden(classes,'background-color','#33669980','md:'),false);
 const shown=C.composeBackground(classes,B.toggle(hidden['background-color'],hidden[key],false),'md:');assert.ok(shown.includes('md:![background-color:#33669980]'));assert.ok(shown.includes('md:!['+key+':none]'));
 const reset=C.composeBackground(classes,B.reset(),'md:');assert.equal(reset,'bg-blue-500 md:bg-cover');
 for(const changes of [{}, {'background-color':'#fff'}, {...hidden,opacity:'0'}, {...hidden,'background-color':'#ff0000'}, {'background-color':null,[key]:'none'}])assert.throws(()=>C.composeBackground(before,changes,'md:'));
});
test('HTML saved colors inherit hidden state into larger scopes without changing smaller scopes',()=>{
 const html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),links=require('../src/html-color-styles.cjs'),resolve=source=>({source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(el=>el.tag==='h1')});
 const source='<html><head></head><body><h1>Title</h1></body></html>',hidden=B.toggle('#33669980','none',true),base=css.plan(resolve(source),{width:0,changes:hidden}).edits[0].after,style={id:'11111111-1111-4111-8111-111111111111',name:'Brand',properties:{color:'#abcdef80'}};
 const applied=links.plan(resolve(base),{type:'applyColorStyle',width:768,property:'background-color'},style);assert.equal(applied.ok,true,applied.reason);assert.equal(applied.edits[0].before,base);
 let next=resolve(applied.edits[0].after),rules=css.describe(next).cssRules;assert.deepEqual(rules[0],hidden);assert.equal(B.state(rules[768]['background-color'],rules[768][key]).color,'#abcdef80');assert.deepEqual(links.describe(next).colorStyleOverrides[768],[]);
 const refresh=links.plan(next,{type:'refreshColorStyle',width:768,property:'background-color'},{...style,properties:{color:'#12345678'}});assert.equal(refresh.ok,true,refresh.reason);next=resolve(refresh.edits[0].after);rules=css.describe(next).cssRules;assert.deepEqual(rules[0],hidden);assert.equal(B.state(rules[768]['background-color'],rules[768][key]).color,'#12345678');
 const reset=css.plan(next,{width:768,property:'background-color',value:null});assert.equal(reset.ok,true,reset.reason);assert.deepEqual(css.describe(resolve(reset.edits[0].after)).cssRules,{0:hidden});
});
test('React and Liquid saved colors capture effective hidden paint for custom screen scopes',()=>{
 const hidden=B.toggle('#33669980','none',true),C=require('../src/color-style-classes.cjs'),initial=C.composeBackground('tablet:bg-cover',hidden),style={id:'11111111-1111-4111-8111-111111111111',name:'Brand',properties:{color:'#abcdef80'}};
 for(const kind of ['react','liquid']){
  const adapter=require('../src/adapters/'+kind+'.cjs'),links=require('../src/'+(kind==='react'?'jsx':'liquid')+'-color-styles.cjs'),relPath=kind==='react'?'Page.jsx':'main.liquid',resolve=source=>({source,file:'/tmp/'+relPath,relPath,hash:adapter.contentHash(source),element:adapter.collect(source,relPath).elements.find(el=>kind==='react'?el.node.openingElement.name.name==='h1':el.tag==='h1')});
  const source=kind==='react'?'export default function Page(){return <h1 className="'+initial+'">Title</h1>}':'<h1 class="'+initial+'">Title</h1>',op={type:'applyColorStyle',property:'background-color',scope:'tablet:',backgroundPaint:{current:hidden['background-color'],stored:hidden[key]}},applied=links.plan(resolve(source),op,style);assert.equal(applied.ok,true,applied.reason);assert.equal(applied.edits[0].before,source);
  let next=resolve(applied.edits[0].after),classes=adapter.describe(next).className;assert.equal(C.overridden(classes,'background-color','#33669980',''),false);assert.equal(C.overridden(classes,'background-color','#abcdef80','tablet:'),false);assert.ok(classes.includes('tablet:bg-cover'));
  const refreshed=links.plan(next,{type:'refreshColorStyle',property:'background-color',scope:'tablet:'},{...style,properties:{color:'#12345678'}});assert.equal(refreshed.ok,true,refreshed.reason);classes=adapter.describe(resolve(refreshed.edits[0].after)).className;assert.equal(C.overridden(classes,'background-color','#12345678','tablet:'),false);assert.equal(C.overridden(classes,'background-color','#33669980',''),false);
  const bad=links.plan(resolve(source),{...op,backgroundPaint:{current:'#ff0000',stored:hidden[key]}},style);assert.equal(bad.ok,false);assert.equal(bad.edits,undefined);
 }
});
test('mixed hidden selection edits and saved colors preserve per-layer visibility atomically',()=>{
 const C=require('../src/color-style-classes.cjs'),hidden=B.toggle('#33669980','none',true),first=C.composeBackground('',hidden),second='![background-color:#abcdef80]',style={id:'11111111-1111-4111-8111-111111111111',name:'Brand',properties:{color:'#12345678'}};
 for(const kind of ['react','liquid']){
  const adapter=require('../src/adapters/'+kind+'.cjs'),relPath=kind==='react'?'Page.jsx':'main.liquid',source=kind==='react'?'export default function Page(){return <main><h1 className="'+first+'">Title</h1><p className="'+second+'">Other</p></main>}':'<main><h1 class="'+first+'">Title</h1><p class="'+second+'">Other</p></main>',resolve=source=>{const elements=adapter.collect(source,relPath).elements;return {source,file:'/tmp/'+relPath,relPath,hash:adapter.contentHash(source),elements,element:elements.find(el=>kind==='react'?el.node.openingElement.name.name==='h1':el.tag==='h1')};},r=resolve(source),selected=r.elements.filter(el=>['h1','p'].includes(kind==='react'?el.node.openingElement.name.name:el.tag)),ids=selected.map(el=>el.id),backgroundPaints={[ids[0]]:{current:hidden['background-color'],stored:hidden[key]},[ids[1]]:{current:'#abcdef80',stored:'none'}},op={ids,fileHash:r.hash,property:'background-color',value:'#12345678',scope:'tablet:',backgroundPaints,contexts:Object.fromEntries(ids.map(id=>[id,{}]))};
  for(const result of [require('../src/color-override-selection.cjs').plan(r,op,adapter),require('../src/text-style-selection.cjs').plan(r,{...op,type:'applyColorStyleSelection'},style,adapter,'color')]){
   assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,source);const next=resolve(result.edits[0].after);
   const classes=ids.map(id=>adapter.describe({...next,element:next.elements.find(el=>el.id===id)}).className);assert.equal(C.overridden(classes[0],'background-color','#12345678','tablet:'),false);assert.equal(C.overridden(classes[1],'background-color','#12345678','tablet:'),false);assert.ok(classes[0].includes('tablet:!['+key+':'));assert.ok(!classes[1].includes('tablet:!['+key+':'));assert.equal(C.overridden(classes[0],'background-color','#33669980',''),false);
  }
  const invalid=require('../src/color-override-selection.cjs').plan(r,{...op,backgroundPaints:{...backgroundPaints,[ids[1]]:{current:'#ff0000',stored:hidden[key]}}},adapter);assert.equal(invalid.ok,false);assert.equal(invalid.edits,undefined);
 }
});
test('shared background visibility handles unchanged layers and refuses partial selection writes',()=>{
 const C=require('../src/color-style-classes.cjs'),hidden=B.toggle('#33669980','none',true),first=C.composeBackground('',hidden),second='![background-color:#abcdef80]';
 for(const kind of ['react','liquid']){
  const adapter=require('../src/adapters/'+kind+'.cjs'),planner=require('../src/color-override-selection.cjs'),relPath=kind==='react'?'Page.jsx':'main.liquid',source=kind==='react'?'export default function Page(){return <main><h1 className="'+first+'">Title</h1><p className="'+second+'">Other</p></main>}':'<main><h1 class="'+first+'">Title</h1><p class="'+second+'">Other</p></main>',resolve=source=>{const elements=adapter.collect(source,relPath).elements;return {source,file:'/tmp/'+relPath,relPath,hash:adapter.contentHash(source),elements,element:elements.find(el=>kind==='react'?el.node.openingElement.name.name==='h1':el.tag==='h1')};},r=resolve(source),ids=r.elements.filter(el=>['h1','p'].includes(kind==='react'?el.node.openingElement.name.name:el.tag)).map(el=>el.id),changesById={[ids[0]]:{},[ids[1]]:B.toggle('#abcdef80','none',true)},op={type:'setBackgroundPaintSelection',ids,fileHash:r.hash,scope:'md:',changesById,contexts:Object.fromEntries(ids.map(id=>[id,{}]))};
  const result=planner.plan(r,op,adapter);assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,source);const next=resolve(result.edits[0].after),classes=ids.map(id=>adapter.describe({...next,element:next.elements.find(el=>el.id===id)}).className);assert.equal(classes[0],first);assert.equal(C.overridden(classes[1],'background-color','#abcdef80','md:'),false);assert.ok(classes[1].includes(second));
  for(const changes of [{[ids[0]]:{}},{[ids[0]]:hidden,[ids[1]]:{'background-color':'#fff'}},{[ids[0]]:hidden,[ids[1]]:null}]){const refused=planner.plan(r,{...op,changesById:changes},adapter);assert.equal(refused.ok,false);assert.equal(refused.edits,undefined);}
 }
});
test('per-layer color values keep mixed opacities and reject incomplete selection changes',()=>{
 const C=require('../src/color-style-classes.cjs'),hidden=B.toggle('#33669980','none',true),first=C.composeBackground('',hidden),second='![background-color:#abcdef40]';
 for(const kind of ['react','liquid']){
  const adapter=require('../src/adapters/'+kind+'.cjs'),planner=require('../src/color-override-selection.cjs'),relPath=kind==='react'?'Page.jsx':'main.liquid',source=kind==='react'?'export default function Page(){return <main><h1 className="'+first+'">Title</h1><p className="'+second+'">Other</p></main>}':'<main><h1 class="'+first+'">Title</h1><p class="'+second+'">Other</p></main>',resolve=source=>{const elements=adapter.collect(source,relPath).elements;return {source,file:'/tmp/'+relPath,relPath,hash:adapter.contentHash(source),elements,element:elements.find(el=>kind==='react'?el.node.openingElement.name.name==='h1':el.tag==='h1')};},r=resolve(source),ids=r.elements.filter(el=>['h1','p'].includes(kind==='react'?el.node.openingElement.name.name:el.tag)).map(el=>el.id),op={ids,fileHash:r.hash,property:'background-color',scope:'',valuesById:{[ids[0]]:'#ff000080',[ids[1]]:'#ff000040'},contexts:Object.fromEntries(ids.map(id=>[id,{}]))};
  const result=planner.plan(r,op,adapter);assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,source);const next=resolve(result.edits[0].after),classes=ids.map(id=>adapter.describe({...next,element:next.elements.find(el=>el.id===id)}).className);assert.equal(C.overridden(classes[0],'background-color','#ff000080'),false);assert.equal(C.overridden(classes[1],'background-color','#ff000040'),false);
  for(const valuesById of [{[ids[0]]:'#fff'},{[ids[0]]:'#fff',[ids[1]]:'not-a-color'}]){const invalid=planner.plan(r,{...op,valuesById},adapter);assert.equal(invalid.ok,false);assert.equal(invalid.edits,undefined);}
 }
});
