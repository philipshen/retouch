'use strict';
const path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const browser=await browserType.launch();
 try{
  const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<div id="layersPanel" style="height:100vh"></div><iframe id="source"></iframe>');
  await page.addStyleTag({path:path.resolve(__dirname,'../../shell/shell.css')});await page.addScriptTag({path:path.resolve(__dirname,'../../shell/layers.js')});
  await page.evaluate(()=>{
   window.source=document.querySelector('iframe').contentDocument;
   source.body.innerHTML='<main data-rt="main"><h1 data-rt="heading"><span data-rt="paragraph" data-retouch-paragraph style="display:block">Hello <strong data-rt="strong">beautiful <a data-rt="link" href="/">world</a></strong></span><span data-rt="second" data-retouch-paragraph style="display:block">Again</span></h1><div data-rt="list"><ol data-rt="ol"><li data-rt="li">First<ul data-rt="ul"><li data-rt="nested">Nested</li></ul></li></ol></div><div data-rt="layout"><p data-rt="p1">One</p><p data-rt="p2">Two</p></div><p data-rt="component"><span data-rt="host" data-rt-i="instance">Component</span></p><p data-rt="image"><img data-rt="img" alt="Image"></p><p data-rt="block"><span data-rt="blockspan" style="display:block">Block</span></p><h2 data-rt="flex" style="display:flex"><span data-rt="flexspan">Flex</span></h2><p data-rt="position"><span data-rt="absolute" style="position:absolute">Positioned</span></p></main>';
   window.get=id=>source.querySelector('[data-rt="'+id+'"]');window.locked=new Set();
   window.layers=RetouchLayers.mount({host:document.querySelector('#layersPanel'),onSelect(el){layers.selection(el,{classSelection:true});},onAction(){},locks:{direct:el=>locked.has(el),locked:el=>locked.has(el)}});layers.attach(source);
  });
  const result=await page.evaluate(()=>{
   const nodes=[];const visit=items=>items.forEach(item=>{nodes.push([item.el.getAttribute('data-rt'),item.atomicText,item.label]);visit(item.children);});visit(RetouchLayers.collect(source));
   return {nodes,owner:layers.textOwner(get('link')).getAttribute('data-rt'),component:layers.textOwner(get('host')).getAttribute('data-rt')};
  });
  assert.equal(result.owner,'heading');assert.equal(result.component,'host');
  const ids=result.nodes.map(n=>n[0]);for(const id of ['paragraph','strong','link','second','ol','li','ul','nested'])assert.ok(!ids.includes(id),id+' is a text run');
  for(const id of ['layout','p1','p2','component','host','image','img','block','blockspan','flex','flexspan','position','absolute'])assert.ok(ids.includes(id),id+' remains a layer');
  assert.equal(result.nodes.find(n=>n[0]==='heading')[2],'h1 · Hello beautiful world Again');
  assert.equal(await page.getByRole('treeitem',{name:'div · First Nested',exact:true}).getAttribute('data-layer-kind'),'text');
  await page.getByText('Layer actions',{exact:true}).click();await page.getByLabel('Show text runs',{exact:true}).check();
  await page.getByRole('treeitem',{name:'a · world',exact:true}).waitFor();assert.equal(await page.evaluate(()=>layers.textOwner(get('link')).getAttribute('data-rt')),'link');
  await page.getByRole('treeitem',{name:'a · world',exact:true}).click();await page.getByLabel('Show text runs',{exact:true}).uncheck();
  assert.equal(await page.getByRole('treeitem',{name:'a · world',exact:true}).getAttribute('aria-selected'),'true','a selected source run stays visible');
  await page.evaluate(()=>layers.selection(get('heading'),{classSelection:true}));assert.equal(await page.getByRole('treeitem',{name:'a · world',exact:true}).count(),0);
  await page.evaluate(async()=>{locked.add(get('link'));await layers.refresh();});await page.getByRole('treeitem',{name:'a · world',exact:true}).waitFor();assert.equal(await page.evaluate(()=>layers.textOwner(get('link')).getAttribute('data-rt')),'link','direct locks prevent enclosing text grouping');
  await page.evaluate(async()=>{locked.clear();await layers.refresh();});assert.equal(await page.getByRole('treeitem',{name:'a · world',exact:true}).count(),0);
  await page.evaluate(()=>get('link').textContent='everyone');await page.getByRole('treeitem',{name:'h1 · Hello beautiful everyone Again',exact:true}).waitFor();
  await page.evaluate(()=>layers.selection(get('heading'),{classSelection:true}));assert.equal(await page.evaluate(()=>layers.canNavigate('child')),false);assert.equal(await page.evaluate(()=>layers.canNavigate('next')),true);
  await page.evaluate(()=>get('blockspan').style.display='inline');await page.getByRole('treeitem',{name:'p · Block',exact:true}).waitFor();assert.equal(await page.getByRole('treeitem',{name:'span · Block',exact:true}).count(),0,'style changes recompute grouping');
  await page.evaluate(()=>{const style=source.createElement('style');style.textContent='@media (max-width: 250px){[data-rt="blockspan"]{display:block!important}}';source.head.append(style);document.querySelector('iframe').style.width='200px';});await page.getByRole('treeitem',{name:'span · Block',exact:true}).waitFor();
  await page.evaluate(()=>document.querySelector('iframe').style.width='400px');await page.waitForFunction(()=>![...document.querySelectorAll('[role=treeitem]')].some(el=>el.title==='span · Block'));
  await page.evaluate(async()=>{const root=source.createElement('div');root.innerHTML='<div data-rt="group" data-rt-group="" data-rt-frame="" aria-label="List group" style="display:contents"><ol data-rt="group-list"><li data-rt="group-item">Grouped item</li></ol><div data-rt="nested-group" data-rt-group="" data-rt-frame="" aria-label="Nested group" style="display:contents"><p data-rt="nested-child">Nested child</p></div></div><div data-rt="frame" data-rt-frame="" aria-label="List frame"><ol data-rt="frame-list"><li data-rt="frame-item">Framed item</li></ol></div>';source.body.append(...root.childNodes);await layers.refresh();});
  const group=page.getByRole('treeitem',{name:'div · List group',exact:true}),frame=page.getByRole('treeitem',{name:'div · List frame',exact:true});
  assert.equal(await group.getAttribute('data-layer-kind'),'group');assert.equal(await group.getAttribute('aria-description'),'group layer');assert.equal(await frame.getAttribute('data-layer-kind'),'frame');assert.equal(await page.getByRole('treeitem',{name:'div · Nested group',exact:true}).getAttribute('data-layer-kind'),'group');
  assert.notEqual(await group.evaluate(el=>getComputedStyle(el,'::before').maskImage),await frame.evaluate(el=>getComputedStyle(el,'::before').maskImage));
  for(const name of ['li · Grouped item','li · Framed item','p · Nested child'])await page.getByRole('treeitem',{name,exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>['group','frame','nested-group'].map(id=>RetouchLayers.atomicText(get(id)))),[false,false,false]);
  assert.equal(await page.evaluate(()=>layers.textOwner(get('group-item')).getAttribute('data-rt')),'group-item');
  await group.click();assert.equal(await page.evaluate(()=>layers.canNavigate('child')),true);
  if(process.env.RT_E2E_TEXT_LAYERS_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_TEXT_LAYERS_SCREENSHOT});
  assert.deepEqual(errors,[]);console.log(engine+': PASS atomic text layers, list layers, layout/component boundaries, source runs, selection reveal, locks, live labels and keyboard targets');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
