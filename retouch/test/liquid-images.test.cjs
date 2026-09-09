'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {Liquid}=require('liquidjs');
const liquid=require('../src/adapters/liquid.cjs');
const {Index}=require('../src/indexer.cjs');
const engine=new Liquid();
engine.registerFilter('image_url',()=>'/cdn/original.png?v=1&width=800');
engine.registerFilter('asset_url',name=>'/cdn/assets/'+name);
engine.registerFilter('asset_img_url',(name,size)=>'/cdn/assets/'+name+'?size='+size);
engine.registerFilter('image_tag',(url,...args)=>{
  const attrs=Object.fromEntries(args),widths=String(attrs.widths||'400,800').split(',').map(v=>v.trim());delete attrs.widths;
  const escape=v=>String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  return `<img src="${escape(url)}" alt="Original alt" srcset="${widths.map(w=>escape('/cdn/original.png?width='+w)+' '+w+'w').join(', ')}" width="800" height="600" style="object-position:20% 30%" ${Object.entries(attrs).map(([k,v])=>k+'="'+escape(v)+'"').join(' ')}>`;
});
function fixture(t,source) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-images-')),file=path.join(root,'image.liquid');fs.writeFileSync(file,source);
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const index=new Index(root,liquid);index.scanAll();
  const initial=liquid.collect(source,'image.liquid').elements.find(e=>e.generatedImage);
  return {root,file,id:initial.id,resolve(context={className:'w-full object-cover md:w-1/2',src:'/cdn/original.png'}){return {...index.resolve(initial.id),context};}};
}
test('image_tag outputs occupy host tree positions and stamping preserves filter arguments',async()=>{
  const source=`<div>{{ image | image_url: width: 800 | image_tag: widths: '400, 800', sizes: '(max-width: 600px) 100vw, 50vw', class: 'w-full' }}<p>After</p></div>`;
  const elements=liquid.collect(source,'image.liquid').elements;
  assert.deepEqual(elements.map(e=>e.tag),['div','img','p']);
  assert.equal(elements[1].parent.id,elements[0].id);
  const output=await engine.parseAndRender(liquid.stamp(source,'/theme/image.liquid','/theme').code,{});
  assert.match(output,new RegExp('data-rt="'+elements[1].id+'"'));assert.match(output,/sizes="\(max-width: 600px\) 100vw, 50vw"/);
  assert.equal(liquid.collect('{% comment %}'+source+'{% endcomment %}','x.liquid').elements.length,0);
  const stamped=liquid.stamp(source,'/theme/image.liquid','/theme').code;
  const twice=liquid.stamp(stamped,'/theme/image.liquid','/theme').code;
  assert.deepEqual(liquid.collect(twice,'image.liquid').elements.map(e=>e.id),elements.map(e=>e.id));
});
test('generated image swaps use the shared API undo and retain the same selected element',async t=>{
  const {once}=require('node:events'),{startServer}=require('../src/server.cjs');
  const source=`{{ product.image | image_url: width: 400 | image_tag: widths: '200,400', class: 'w-full' }}`;
  const app=fixture(t,source),r=app.resolve();
  const server=startServer({appRoot:app.root,port:0,adapter:liquid,quiet:true});await once(server,'listening');
  t.after(()=>{server.retouchIndex.close();server.close();});
  const base='http://127.0.0.1:'+server.address().port,shell=await(await fetch(base+'/rt')).text();
  const headers={'x-retouch-token':/__RT_TOKEN = "([a-f0-9]+)"/.exec(shell)[1],'content-type':'application/json'};
  const post=async body=>(await fetch(base+'/rt/__api/op',{method:'POST',headers,body:JSON.stringify(body)})).json();
  const saved=await post({type:'setSrc',id:app.id,src:'/assets/replacement.png',fileHash:r.hash,context:r.context});
  assert.ok(saved.ok,saved.reason);assert.equal(saved.element.id,app.id);assert.equal(saved.element.src,'/assets/replacement.png');assert.ok(saved.undoId);
  const changed=fs.readFileSync(app.file,'utf8');fs.appendFileSync(app.file,'\n');
  assert.equal((await post({type:'undo',undoId:saved.undoId})).ok,false);
  fs.writeFileSync(app.file,changed);assert.ok((await post({type:'undo',undoId:saved.undoId})).ok);
  assert.equal(fs.readFileSync(app.file,'utf8'),source);
});
test('image_url attributes can be swapped while authored picture choices retain their boundary',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-image-url-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const source of ['<img src="{{ product.image | image_url: width: 800 }}">','<picture>{{ image | image_url: width: 800 | image_tag }}</picture>']) {
    const file=path.join(root,'image.liquid');fs.writeFileSync(file,source);
    const elements=liquid.collect(source,'image.liquid').elements,element=elements.find(e=>e.tag==='img');
    const r={appRoot:root,file,relPath:'image.liquid',source,element,elements,hash:liquid.contentHash(source),context:{src:'/cdn/old.png'}};
    if(source.startsWith('<picture>'))assert.equal(liquid.describe(r).canSetSrc,false);
    else {assert.ok(liquid.describe(r).canSetSrc);assert.ok(liquid.applyOp(r,{type:'setSrc',fileHash:r.hash,src:'/assets/new.png'}).ok);assert.equal(fs.readFileSync(file,'utf8'),`<img src="{{ 'new.png' | asset_url }}">`);}
  }
});
test('generated image styles use literal params and dynamic class patches without changing image sources',async t=>{
  for(const classValue of ["'w-full object-cover md:w-1/2'",'image_class']) {
    const source=`{{ image | image_url: width: 800 | image_tag: class: ${classValue}, widths: '400,800' }}`;
    const app=fixture(t,source),r=app.resolve();assert.equal(liquid.describe(r).classNameDynamic,false);
    const desired='w-full object-contain md:w-1/2 opacity-50';
    const result=liquid.applyOp(r,{type:'setClasses',fileHash:r.hash,classes:desired});assert.ok(result.ok,result.reason);
    const edited=fs.readFileSync(app.file,'utf8');
    const html=await engine.parseAndRender(edited,{image_class:'w-full object-cover md:w-1/2'});
    assert.match(html,/class="[^\"]*object-contain/);assert.match(html,/md:w-1\/2/);assert.match(html,/src="\/cdn\/original.png/);
    assert.equal(app.resolve().element.id,app.id);
  }
});
test('image swaps retain generator attributes and responsive width choices, support repeated edits, and preserve IDs',async t=>{
  const source=`<div>{{ image | image_url: width: 800 | image_tag: class: image_class, widths: sizes, sizes: '(max-width: 600px) 100vw, 50vw', loading: 'lazy' }}<span>After</span></div>`;
  const app=fixture(t,source),ids=liquid.collect(source,'image.liquid').elements.map(e=>e.id);
  let r=app.resolve();assert.ok(liquid.describe(r).canSetSrc);
  assert.ok(liquid.applyOp(r,{type:'setSrc',fileHash:r.hash,src:'/assets/new.png'}).ok);
  let edited=fs.readFileSync(app.file,'utf8');
  assert.ok(edited.includes(source.slice(5,source.indexOf('<span>'))),'the original image expression remains intact');
  const ctx={sizes:'300, 600',image_class:'w-full object-cover md:w-1/2'};
  let html=await engine.parseAndRender(edited,ctx);
  assert.match(html,/src="\/cdn\/assets\/new.png"/);assert.match(html,/new.png\?size=300x 300w, \/cdn\/assets\/new.png\?size=600x 600w/);
  for(const attr of ['alt="Original alt"','width="800"','height="600"','style="object-position:20% 30%"','sizes="(max-width: 600px) 100vw, 50vw"','loading="lazy"'])assert.ok(html.includes(attr),attr);
  assert.deepEqual(liquid.collect(edited,'image.liquid').elements.map(e=>e.id),ids);
  r=app.resolve();assert.equal(liquid.describe(r).src,'/assets/new.png');
  assert.ok(liquid.applyOp(r,{type:'setClasses',fileHash:r.hash,classes:'w-full rounded-lg md:w-1/2'}).ok);
  r=app.resolve();assert.ok(liquid.applyOp(r,{type:'setSrc',fileHash:r.hash,src:'/assets/second.png'}).ok);
  edited=fs.readFileSync(app.file,'utf8');html=await engine.parseAndRender(edited,ctx);
  assert.match(html,/src="\/cdn\/assets\/second.png"/);assert.match(html,/rounded-lg/);assert.doesNotMatch(html,/new.png/);
  assert.equal((edited.match(/retouch-image-v1:/g)||[]).length,1);
  r=app.resolve();assert.ok(liquid.applyOp(r,{type:'setClasses',fileHash:r.hash,classes:'w-full shadow-lg md:w-1/2'}).ok);
  html=await engine.parseAndRender(fs.readFileSync(app.file,'utf8'),ctx);assert.match(html,/shadow-lg/);assert.doesNotMatch(html,/rounded-lg/);
});

test('generated image class arguments preserve quoted families and literal underscores',async t=>{
 for(const classValue of ["'w-full'",'image_class']){
  const app=fixture(t,`{{ image | image_url: width: 800 | image_tag: class: ${classValue} }}`);
  let snapshot={className:'w-full'};
  for(const desired of [String.raw`w-full [font-family:"Page_Face",Studio\_Test,serif]`,"w-full [font-family:'Single_Face',serif]",'w-full [font-family:"Next_Face",serif]','w-full']){
   const r=app.resolve(snapshot),result=liquid.applyOp(r,{type:'setClasses',classes:desired,fileHash:r.hash});assert.ok(result.ok,result.reason);
   const html=await engine.parseAndRender(fs.readFileSync(app.file,'utf8'),{image_class:'w-full'}),img=require('parse5').parseFragment(html).childNodes.find(n=>n.tagName==='img');
   assert.equal(img.attrs.find(a=>a.name==='class').value.trim(),desired);snapshot={className:desired};
  }
 }
});
