'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {once}=require('node:events');
const {Liquid}=require('liquidjs');
const liquid=require('../src/adapters/liquid.cjs');
const {Index}=require('../src/indexer.cjs');
const {startServer}=require('../src/server.cjs');
const sources=require('../src/liquid-sources.cjs');
const engine=new Liquid();
function fixture(t,files) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-liquid-parity-'));
  for (const [name,source] of Object.entries(files)) {
    const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,source);
  }
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const index=new Index(root,liquid);index.scanAll();
  return {root,index,resolve(name,context={}){
    const source=fs.readFileSync(path.join(root,name),'utf8');
    const el=liquid.collect(source,name).elements.find(e=>e.kind==='host');
    return {...index.resolve(el.id),context};
  }};
}
test('dynamic class edits preserve expressions, inactive branches and breakpoint styles across repeated edits',async t=>{
  const source=`{% assign tone = 'bg-red-500' %}<div class="flex {{ tone }} {% if wide %}p-8{% else %}p-4{% endif %} md:p-12">Hello</div>`;
  const app=fixture(t,{'sections/hero.liquid':source});
  const snapshot={className:'flex bg-red-500 p-4 md:p-12'};
  let r=app.resolve('sections/hero.liquid',snapshot),info=liquid.describe(r);
  assert.equal(info.classNameDynamic,false);
  const result=liquid.applyOp(r,{type:'setClasses',classes:'flex bg-blue-500 p-6 md:p-12',fileHash:r.hash});
  assert.ok(result.ok,result.reason);
  const edited=fs.readFileSync(r.file,'utf8');
  assert.ok(edited.includes(source.slice(source.indexOf('flex'),source.indexOf('">'))),'authored expression is retained');
  for (const wide of [true,false]) {
    const rendered=await engine.parseAndRender(edited,{wide});
    assert.match(rendered,/bg-blue-500/);assert.match(rendered,/p-6/);assert.match(rendered,/md:p-12/);
    assert.doesNotMatch(rendered,/bg-red-500|\bp-[48]\b/);
  }
  r=app.resolve('sections/hero.liquid',snapshot);
  assert.equal(r.element.id,info.id,'attribute patch preserves source IDs');
  assert.ok(liquid.applyOp(r,{type:'setClasses',classes:'flex bg-green-500 p-2 md:p-12',fileHash:r.hash}).ok);
  const again=fs.readFileSync(r.file,'utf8');
  assert.equal((again.match(/capture __rt_classes_/g)||[]).length,1,'subsequent edits update one patch');
  const rendered=await engine.parseAndRender(again,{wide:true});
  assert.match(rendered,/bg-green-500/);assert.doesNotMatch(rendered,/bg-blue-500|\bp-6\b/);
});
test('attribute parsing skips Liquid delimiters containing the HTML quote',()=>{
  const source=`<div class="{{ "p-4" }} {% if label == "A" %}bg-red-500{% endif %}" title="kept">Text</div>`;
  const el=liquid.collect(source,'x.liquid').elements[0];
  assert.equal(el.classAttr.value,`{{ "p-4" }} {% if label == "A" %}bg-red-500{% endif %}`);
});
test('dynamic heading tags edit the executed source assignment and preserve other branches',t=>{
  const source=`{% if heading %}{% assign tag = 'h1' %}{% else %}{% assign tag = 'p' %}{% endif %}<{{ tag }}>Text</{{ tag }}>`;
  const app=fixture(t,{'sections/heading.liquid':source});
  const origin=sources.plan(source,'sections/heading.liquid').assignments[0].binding.id;
  const r=app.resolve('sections/heading.liquid',{tag:'h1',tagOrigin:origin}),info=liquid.describe(r);
  assert.ok(info.canSetTag);assert.ok(info.tagSource);
  const result=liquid.applyOp(r,{type:'setTag',tag:'h2',fileHash:r.hash,sourceId:info.tagSource.id,sourceHash:info.tagSource.hash});
  assert.ok(result.ok,result.reason);
  assert.equal(fs.readFileSync(r.file,'utf8'),source.replace("tag = 'h1'","tag = 'h2'"));
  assert.match(liquid.stamp(source,r.file,app.root).code,/data-rt-tag-origin="\{\{ __rt_origin_tag \| escape \}\}"/);
});
test('Liquid snippet instances preserve render props, detach one usage, and use the shared undo path',async t=>{
  const caller=`{% render 'card', title: 'First' %}{% render 'card', title: 'Second' %}`;
  const definition=`{% doc %}@param {string} title{% enddoc %}{% assign tone = tone | default: 'quiet' %}<article class="p-4"><h2>{{ title }}</h2></article>`;
  const app=fixture(t,{'sections/cards.liquid':caller,'snippets/card.liquid':definition});
  const calls=liquid.collect(caller,'sections/cards.liquid').elements;
  const usage=app.index.resolve(calls[0].id),info=liquid.describeComponent(usage);
  assert.ok(info.ok,info.reason);assert.equal(info.props.find(p=>p.name==='title').value,"'First'");
  assert.equal(info.props.find(p=>p.name==='tone').default,"'quiet'");
  const preview=path.join(app.root,'preview');fs.mkdirSync(preview);
  fs.writeFileSync(path.join(preview,'card.liquid'),liquid.stamp(definition,path.join(app.root,'snippets/card.liquid'),app.root).code);
  const renderer=new Liquid({root:preview,extname:'.liquid'});
  // Documentation blocks are absent in production rendering; LiquidJS has no
  // Shopify doc block, so remove only that test fixture block before rendering.
  const stamped=fs.readFileSync(path.join(preview,'card.liquid'),'utf8').replace(/\{% doc %\}[\s\S]*?\{% enddoc %\}/g,'');
  fs.writeFileSync(path.join(preview,'card.liquid'),stamped);
  const html=await renderer.parseAndRender(liquid.stamp(caller,path.join(app.root,'sections/cards.liquid'),app.root).code,{});
  for (const call of calls) assert.ok(html.includes(`data-rt-i="${call.id}"`));
  const server=startServer({appRoot:app.root,adapter:liquid,port:0,quiet:true});await once(server,'listening');
  t.after(()=>{server.retouchIndex.close();server.close();});
  const base='http://127.0.0.1:'+server.address().port,shell=await(await fetch(base+'/rt')).text();
  const headers={'x-retouch-token':/__RT_TOKEN = "([a-f0-9]+)"/.exec(shell)[1],'content-type':'application/json'};
  const post=async body=>(await fetch(base+'/rt/__api/op',{method:'POST',headers,body:JSON.stringify(body)})).json();
  const result=await post({type:'detachComponent',id:usage.element.id,fileHash:usage.hash,definitionHash:info.hash});
  assert.ok(result.ok,result.reason);assert.ok(result.undoId);
  assert.equal(fs.readFileSync(path.join(app.root,result.detachedFile),'utf8'),definition);
  assert.ok(fs.readFileSync(usage.file,'utf8').endsWith("{% render 'card', title: 'Second' %}"));
  const fresh=app.index.resolve(usage.element.id);assert.ok(liquid.describeComponent(fresh).detached);
  const reference=path.join(app.root,'sections/extra.liquid');
  fs.writeFileSync(reference,`{% render '${result.name}' %}`);
  assert.equal((await post({type:'undo',undoId:result.undoId})).ok,false);
  fs.unlinkSync(reference);
  assert.ok((await post({type:'undo',undoId:result.undoId})).ok);
  assert.equal(fs.readFileSync(usage.file,'utf8'),caller);
  assert.equal(fs.existsSync(path.join(app.root,result.detachedFile)),false);
});
test('Liquid rich text uses the shared tree grammar and preserves kept child attributes',t=>{
  const source='<p>Hello <span class="text-red-500">world</span> again</p>';
  const app=fixture(t,{'sections/x.liquid':source}),r=app.resolve('sections/x.liquid');
  const child=r.elements[1];
  assert.ok(liquid.applyOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'wrap',tag:'strong',children:[{t:'text',value:'Hello '}]},{t:'keep',id:child.id,children:[{t:'text',value:'friend'}]}]}).ok);
  assert.equal(fs.readFileSync(r.file,'utf8'),'<p><strong>Hello </strong><span class="text-red-500">friend</span></p>');
});
test('shared API snapshots Liquid backing files and restores exact bytes with stale undo protection',async t=>{
  const original='/* retain formatting */\n{ "label": "Account", "other": "Account" }\n';
  const app=fixture(t,{'sections/x.liquid':'<span>{{ "label" | t }}</span>','locales/en.default.json':original,'assets/sample.svg':'<svg/>'});
  const server=startServer({appRoot:app.root,adapter:liquid,port:0,quiet:true});await once(server,'listening');
  t.after(()=>{server.retouchIndex.close();server.close();});
  const base='http://127.0.0.1:'+server.address().port;
  const shell=await(await fetch(base+'/rt')).text();
  const headers={'x-retouch-token':/__RT_TOKEN = "([a-f0-9]+)"/.exec(shell)[1],'content-type':'application/json'};
  const context={attributes:{'data-rt-locale':'en'},ancestors:[]};
  const r=app.resolve('sections/x.liquid',context),info=liquid.describe(r);
  const post=async body=>(await fetch(base+'/rt/__api/op',{method:'POST',headers,body:JSON.stringify(body)})).json();
  const op={type:'setText',id:info.id,text:'Profile',context,fileHash:info.hash,sourceHash:info.textSource.hash,sourceId:info.textSource.id};
  const result=await post(op);assert.ok(result.ok,result.reason);assert.ok(result.undoId);
  const file=path.join(app.root,'locales/en.default.json');
  assert.equal(fs.readFileSync(file,'utf8'),original.replace('"label": "Account"','"label": "Profile"'));
  assert.equal(result.element.text,'Profile','fresh description retains opaque renderer context');
  fs.appendFileSync(file,'\n');assert.equal((await post({type:'undo',undoId:result.undoId})).ok,false);
  fs.writeFileSync(file,original.replace('"label": "Account"','"label": "Profile"'));
  assert.ok((await post({type:'undo',undoId:result.undoId})).ok);
  assert.equal(fs.readFileSync(file,'utf8'),original);
  const images=await(await fetch(base+'/rt/__api/images',{headers})).json();assert.equal(images.images[0].src,'/assets/sample.svg');
});
test('translation rich text edits its backing value and preserves interpolation and source hashes',t=>{
  const value='<p>Hello <span class="brand">friend</span> {{ name }}</p>';
  const app=fixture(t,{'sections/x.liquid':'<div>{{ "copy_html" | t: name: customer.name }}</div>','locales/en.default.json':JSON.stringify({copy_html:value})});
  const r=app.resolve('sections/x.liquid',{locale:'en'}),info=liquid.describe(r),p=info.richText.children[0],span=p.children[1];
  assert.ok(info.canSetChildren);assert.ok(info.mixedText);
  const payload={type:'setChildren',fileHash:r.hash,sourceId:info.textSource.id,sourceHash:info.textSource.hash};
  const children=[{t:'keep',id:p.id,children:[{t:'text',value:'Welcome '},{t:'keep',id:span.id,children:[{t:'wrap',tag:'strong',children:[{t:'text',value:'friend'}]}]},{t:'text',value:' '},{t:'keep',id:p.children[2].parts[1].id}]}];
  const missing=liquid.applyOp(r,{...payload,children:[{t:'text',value:'Flattened'}]});
  assert.equal(missing.ok,false);assert.match(missing.reason,/placeholders/);
  const result=liquid.applyOp(r,{...payload,children});assert.ok(result.ok,result.reason);
  assert.equal(JSON.parse(fs.readFileSync(path.join(app.root,'locales/en.default.json'),'utf8')).copy_html,'<p>Welcome <span class="brand"><strong>friend</strong></span> {{ name }}</p>');
  assert.equal(fs.readFileSync(r.file,'utf8'),r.source);
  assert.equal(liquid.applyOp(r,{...payload,children}).ok,false,'stale backing hash refused');
});

function renderedClasses(html){const tree=require('parse5').parseFragment(html),node=tree.childNodes.find(n=>n.tagName);return node.attrs.find(a=>a.name==='class')?.value.trim().split(/\s+/).join(' ');}
test('page fonts round-trip literal Liquid attributes and keep raw Tailwind candidates',async t=>{
 const desired=String.raw`font-bold [font-family:"Page_Face",Studio\_Test,serif] [&:hover]:opacity-50`;
 for(const attr of ['class="font-bold"',"class='font-bold'",'class=font-bold','class','']){
  const app=fixture(t,{'sections/hero.liquid':`<h1 ${attr} title="Kept">Headline</h1>`});
  let r=app.resolve('sections/hero.liquid');const result=liquid.applyOp(r,{type:'setClasses',classes:desired,fileHash:r.hash});assert.ok(result.ok,result.reason);
  const edited=fs.readFileSync(r.file,'utf8');assert.ok(edited.includes('[font-family:"Page_Face",Studio\\_Test,serif]'));assert.ok(edited.includes('[&:hover]:opacity-50'));assert.ok(edited.includes(' title="Kept"'));
  assert.equal(renderedClasses(await engine.parseAndRender(edited)),desired);
  r=app.resolve('sections/hero.liquid');assert.equal(liquid.describe(r).className,desired);assert.equal(liquid.describe(r).classNameDynamic,false);
  assert.ok(liquid.applyOp(r,{type:'setClasses',classes:'font-bold',fileHash:r.hash}).ok);
  assert.equal(renderedClasses(await engine.parseAndRender(fs.readFileSync(r.file,'utf8'))),'font-bold');
 }
});
test('conditional Liquid font edits preserve branches and replace quoted families repeatedly',async t=>{
 const original=`<h1 class="font-bold {% if wide %}font-mono{% else %}font-serif{% endif %} {{ tone }} md:opacity-90">Headline</h1>`;
 const app=fixture(t,{'sections/hero.liquid':original});
 const font=String.raw`[font-family:"Page_Face",Studio\_Test,serif]`;
 let snapshot={className:'font-bold font-serif text-red-500 md:opacity-90'};
 for(const family of [font,"[font-family:'Single_Face',serif]",'[font-family:"Other_Face",serif]',null]){
  const desired='font-bold text-red-500 md:opacity-90'+(family?' '+family:'');
  const r=app.resolve('sections/hero.liquid',snapshot),result=liquid.applyOp(r,{type:'setClasses',classes:desired,fileHash:r.hash});assert.ok(result.ok,result.reason);
  const edited=fs.readFileSync(r.file,'utf8');assert.ok(edited.includes('{% if wide %}font-mono{% else %}font-serif{% endif %} {{ tone }}'));
  for(const wide of [true,false])assert.equal(renderedClasses(await engine.parseAndRender(edited,{wide,tone:'text-red-500'})),desired);
  assert.equal((edited.match(/capture __rt_classes_/g)||[]).length,1);snapshot={className:desired};
 }
});

test('Liquid font edits remove conflicting quoted families in inactive assignments',async t=>{
 const source=`{% if alternate %}{% assign family = '[font-family:"Other_Face",serif]' %}{% else %}{% assign family = '[font-family:"First_Face",serif]' %}{% endif %}<h1 class="font-bold {{ family }} md:font-mono">Headline</h1>`;
 const app=fixture(t,{'sections/hero.liquid':source}),r=app.resolve('sections/hero.liquid',{className:'font-bold [font-family:"First_Face",serif] md:font-mono'}),desired='font-bold md:font-mono [font-family:"Chosen_Face",serif]';
 const result=liquid.applyOp(r,{type:'setClasses',classes:desired,fileHash:r.hash});assert.ok(result.ok,result.reason);
 for(const alternate of [true,false])assert.equal(renderedClasses(await engine.parseAndRender(fs.readFileSync(r.file,'utf8'),{alternate})),desired);
});
