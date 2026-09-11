'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {once}=require('node:events');
const liquid=require('../src/adapters/liquid.cjs'),theme=require('../src/liquid-theme.cjs');
const {Index}=require('../src/indexer.cjs'),{startServer}=require('../src/server.cjs');
const frame=`<section>{% content_for 'block', type: 'group', id: 'group' %}{% content_for 'blocks' %}</section>{% schema %}{"name":"Frame","blocks":[{"type":"@theme"}],"settings":[]}{% endschema %}`;
const group=`<div>{% content_for 'block', type: 'card', id: 'title' %}</div>{% schema %}{"name":"Group","settings":[]}{% endschema %}`;
const card=`<h2>{{ block.settings.title }}</h2>{% schema %}{"name":"Card","settings":[{"type":"text","id":"title","default":"Default"}]}{% endschema %}`;
const data={sections:{first:{type:'frame',blocks:{group:{type:'group',static:true,blocks:{title:{type:'card',static:true,settings:{title:'First'}}}},dynamic:{type:'card',settings:{title:'Dynamic'}}}},second:{type:'frame',blocks:{group:{type:'group',static:true,blocks:{title:{type:'card',static:true,settings:{title:'Second'}}}}}}},order:['first','second']};
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-theme-components-'));
  const files={'sections/frame.liquid':frame,'blocks/group.liquid':group,'blocks/card.liquid':card,'templates/index.json':'/* untouched formatting */\n'+JSON.stringify(data,null,2)+'\n'};
  for(const [name,source]of Object.entries(files)){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,source);}
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const index=new Index(root,liquid);index.scanAll();
  const elements=liquid.collect(files['templates/index.json'],'templates/index.json').elements;
  return {root,index,files,elements};
}
const context={attributes:{'data-rt-section':'template__first','data-rt-block':'child__title','data-rt-template':'index'},ancestors:[{'data-rt-block':'parent__group'}]};
test('JSON usages have stable IDs and the rendered ancestry resolves only the selected section and block',t=>{
  const app=fixture(t),binding=theme.bindings(app.root,context);
  assert.deepEqual(binding.map(b=>b.element.moduleName),['card','group','frame']);
  const selected=app.index.resolve(binding[0].element.id);selected.context=context;
  const info=liquid.describe(selected),component=liquid.describeComponent(selected);
  assert.equal(info.kind,'instance');assert.equal(component.name,'card');
  assert.equal(component.props[0].value,'"First"');assert.equal(component.props[0].default,'"Default"');
  assert.equal(component.renderScope['data-rt-block'],'child__title');
  const changed=app.files['templates/index.json'].replace('"card"','"changed"');
  assert.deepEqual(liquid.collect(changed,'templates/index.json').elements.map(e=>e.id),app.elements.map(e=>e.id));
});
test('dynamic block detachment changes one JSON usage and retains the parent and sibling sources',t=>{
  const app=fixture(t),element=app.elements.find(e=>e.blockKeys.at(-1)==='dynamic'),r=app.index.resolve(element.id);
  const component=liquid.describeComponent(r),plan=liquid.planOp(r,{type:'detachComponent',fileHash:r.hash,definitionHash:component.hash});
  assert.ok(plan.ok,plan.reason);assert.equal(plan.edits.length,2);assert.equal(plan.edits[0].after,card);
  assert.equal(fs.readFileSync(r.file,'utf8'),r.source,'planning has no writes');
  const result=liquid.applyOp(r,{type:'detachComponent',fileHash:r.hash,definitionHash:component.hash});assert.ok(result.ok,result.reason);
  const current=require('../src/json-source.cjs').parse(fs.readFileSync(r.file,'utf8')).value;
  assert.equal(current.sections.first.blocks.dynamic.type,plan.name);assert.equal(current.sections.second.blocks.group.blocks.title.type,'card');
  assert.equal(fs.readFileSync(path.join(app.root,'sections/frame.liquid'),'utf8'),frame);
});
test('static detachment copies the necessary parent chain and shared undo restores every file exactly',async t=>{
  const app=fixture(t),binding=theme.bindings(app.root,context)[0],r=app.index.resolve(binding.element.id);r.context=context;
  const component=liquid.describeComponent(r);assert.ok(component.canDetach,component.reason);
  const server=startServer({appRoot:app.root,adapter:liquid,port:0,quiet:true});await once(server,'listening');t.after(()=>{server.retouchIndex.close();server.close();});
  const base='http://127.0.0.1:'+server.address().port,shell=await(await fetch(base+'/rt')).text();
  const headers={'x-retouch-token':/__RT_TOKEN = "([a-f0-9]+)"/.exec(shell)[1],'content-type':'application/json'};
  const post=async body=>(await fetch(base+'/rt/__api/op',{method:'POST',headers,body:JSON.stringify(body)})).json();
  const result=await post({type:'detachComponent',id:r.element.id,context,fileHash:r.hash,definitionHash:component.hash});assert.ok(result.ok,result.reason);
  const current=require('../src/json-source.cjs').parse(fs.readFileSync(r.file,'utf8')).value;
  const selected=current.sections.first;
  assert.match(selected.type,/-retouch-/);assert.match(selected.blocks.group.type,/-retouch-/);assert.equal(selected.blocks.group.blocks.title.type,result.name);
  assert.equal(current.sections.second.type,'frame');assert.equal(current.sections.second.blocks.group.blocks.title.type,'card');
  assert.equal(fs.readFileSync(path.join(app.root,'sections/frame.liquid'),'utf8'),frame);
  assert.equal(fs.readFileSync(path.join(app.root,'blocks/group.liquid'),'utf8'),group);
  const copiedGroup=path.join(app.root,'blocks',selected.blocks.group.type+'.liquid');
  assert.ok(fs.readFileSync(copiedGroup,'utf8').includes("type: '"+result.name+"'"));
  fs.writeFileSync(path.join(app.root,'sections/extra.json'),JSON.stringify({sections:{extra:{type:selected.type}}}));
  assert.equal((await post({type:'undo',undoId:result.undoId})).ok,false,'a new JSON reference prevents module deletion');
  fs.unlinkSync(path.join(app.root,'sections/extra.json'));
  assert.ok((await post({type:'undo',undoId:result.undoId})).ok);
  for(const [rel,source]of Object.entries(app.files))assert.equal(fs.readFileSync(path.join(app.root,rel),'utf8'),source);
  assert.equal(fs.existsSync(copiedGroup),false);assert.equal(fs.existsSync(path.join(app.root,result.detachedFile)),false);
});
test('parent definition changes and ambiguous rendered block paths refuse detachment or mapping',t=>{
  const app=fixture(t),r=app.index.resolve(theme.bindings(app.root,context)[0].element.id),component=liquid.describeComponent(r);
  fs.appendFileSync(path.join(app.root,'blocks/group.liquid'),'\n');
  assert.equal(liquid.planOp(r,{type:'detachComponent',fileHash:r.hash,definitionHash:component.hash}).ok,false);
  const repeated=structuredClone(data);repeated.sections.first.blocks.other=structuredClone(repeated.sections.first.blocks.group);
  fs.writeFileSync(path.join(app.root,'templates/index.json'),JSON.stringify(repeated));
  assert.equal(theme.bindings(app.root,{section:'template__first',block:'child__title',template:'index'}).length,0);
  assert.equal(theme.bindings(app.root,context).length,3);
});
test('static call spans ignore documentation, quoted argument content and multiline liquid commands',()=>{
  const source=`{% doc %}{% content_for 'block', type: 'fake', id: 'title' %}{% enddoc %}{% content_for 'block', label: "type: 'fake', id: 'fake'",\n type: 'card', id: 'title' %}{% liquid\n content_for 'block', type: 'group', id: 'group'\n%}`;
  const calls=theme.staticCalls(source);assert.deepEqual(calls.map(c=>[c.type,c.key]),[['card','title'],['group','group']]);
  for(const call of calls)assert.equal(source.slice(call.start,call.end),call.type);
});
