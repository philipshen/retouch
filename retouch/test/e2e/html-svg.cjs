'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('RT_E2E_BROWSER must be chromium or webkit');
const browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-svg-'));
 const original='<html><head></head><body><svg width="300" height="150" viewBox="0 0 200 100"><rect aria-label="Box" x="5" y="5" width="40" height="20" fill="red"/><g><circle cx="100" cy="30" r="10" fill="blue"/><ellipse cx="30" cy="70" rx="10" ry="5" fill="green"/></g><line x1="60" y1="70" x2="100" y2="70" stroke="black"/></svg><p>Unchanged</p></body></html>';
 const file=path.join(root,'index.html');fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
 const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const app=page.frameLocator('#app');
 const wait=async fn=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(100);}throw Error('Timed out waiting for layout');};
 const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true');
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);await app.locator('rect').click();await settled();await wait(async()=>await page.getByLabel('Shape Width',{exact:true}).count()===1);
  await wait(async()=>await page.getByRole('treeitem',{name:'rect · Box',exact:true}).getAttribute('aria-selected')==='true');
  const fill=async(label,value)=>{await page.getByLabel('Shape '+label,{exact:true}).fill(value);await page.getByLabel('Shape '+label,{exact:true}).press('Tab');await settled();};
  await fill('Width','80');await wait(async()=>await app.locator('rect').evaluate(el=>el.getBBox().width)===80);assert.equal(await app.locator('rect').evaluate(el=>el.getBoundingClientRect().width),120,'SVG viewBox scales source geometry');const wideSource=read();
  if(process.env.RT_E2E_SVG_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SVG_SCREENSHOT});
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(async()=>await app.locator('rect').evaluate(el=>el.getBBox().width)===40);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===wideSource);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  for(const [tag,label,value,attribute]of [['circle','Radius','20','r'],['ellipse','Horizontal radius','15','rx'],['line','End X','180','x2']]){
   await page.getByRole('treeitem',{name:tag,exact:true}).click();await settled();await fill(label,value);await wait(async()=>await app.locator(tag).getAttribute(attribute)===value);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  }
  await page.getByRole('treeitem',{name:'rect · Box',exact:true}).click();await settled();
  const paint=async(label,value)=>{const field=page.getByLabel('SVG '+label,{exact:true});if(await field.evaluate(el=>el.tagName)==='SELECT')await field.selectOption(value);else{await field.fill(value);await field.press('Tab');}await settled();};
  const computed=p=>app.locator('rect').evaluate((el,p)=>getComputedStyle(el).getPropertyValue(p),p);
  const snapshots=[original];
  for(const [label,value,property,expected]of [['fill','#00ff00','fill','rgb(0, 255, 0)'],['stroke','#0000ff','stroke','rgb(0, 0, 255)'],['stroke width','4','stroke-width','4px'],['line ends','round','stroke-linecap','round'],['line joins','bevel','stroke-linejoin','bevel'],['dash pattern','4 2','stroke-dasharray','4px, 2px']]){
   await paint(label,value);await wait(async()=>await computed(property)===expected);snapshots.push(read());
  }
  assert.equal(await app.locator('rect').getAttribute('fill'),'red','original attribute is retained');
  const size=async value=>{await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption(value);await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===Number(value.split('x')[0]));};
  await size('768x1024');await wait(async()=>await page.getByLabel('Style screen scope').locator('option[value="min-[768px]:"]').count()===1);await page.getByLabel('Style screen scope').selectOption('min-[768px]:');await paint('fill','none');snapshots.push(read());await wait(async()=>await computed('fill')==='none');
  if(process.env.RT_E2E_SVG_PAINT_SCREENSHOT){await page.getByLabel('SVG fill',{exact:true}).evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:process.env.RT_E2E_SVG_PAINT_SCREENSHOT});}
  await size('390x844');await wait(async()=>await computed('fill')==='rgb(0, 255, 0)');await size('768x1024');await wait(async()=>await computed('fill')==='none');
  await page.getByRole('button',{name:'Reset svg fill',exact:true}).click();await settled();await wait(async()=>await computed('fill')==='rgb(0, 255, 0)');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===snapshots.at(-1));
  for(let i=snapshots.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===snapshots[i]);}
  await wait(async()=>await computed('fill')==='rgb(255, 0, 0)');
  for(const [preset,tag]of [['rectangle','rect'],['circle','circle'],['ellipse','ellipse'],['line','line']]){
   await page.getByRole('treeitem',{name:'body',exact:true}).click();await settled();
   await page.getByRole('button',{name:'Add '+preset,exact:true}).click();await settled();await wait(async()=>await app.locator('svg').count()===2);
   const created=app.locator('svg').last().locator(tag);await wait(async()=>await created.count()===1);const id=await created.getAttribute('data-rt');
   await wait(async()=>await page.locator('[role=treeitem][aria-selected=true]').count()===1&&await page.locator('[role=treeitem][aria-selected=true]').textContent()===tag);
   assert.ok(await created.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>0;}));const added=read();
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);assert.equal(await page.getByRole('treeitem',{name:'body',exact:true}).getAttribute('aria-selected'),'true');
   await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===added);await wait(async()=>await app.locator('[data-rt="'+id+'"]').count()===1);assert.equal(await page.getByRole('treeitem',{name:tag,exact:true}).last().getAttribute('aria-selected'),'true');
   if(preset==='rectangle'&&process.env.RT_E2E_SVG_INSERT_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SVG_INSERT_SCREENSHOT});
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  }
  await page.getByRole('treeitem',{name:'svg',exact:true}).click();await settled();await page.getByRole('button',{name:'Add circle',exact:true}).click();await settled();await wait(async()=>await app.locator('circle').count()===2);
  assert.equal(await app.locator('svg').count(),1);assert.equal(await app.locator('circle').last().getAttribute('r'),'30');assert.equal(await app.locator('circle').last().getAttribute('cy'),'50');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  await page.getByRole('treeitem',{name:'rect · Box',exact:true}).click();await settled();await paint('fill','#ff00ff');const painted=read();
  await page.getByRole('button',{name:'Delete layer',exact:true}).click();await settled();await wait(async()=>await app.locator('rect').count()===0);const deleted=read();assert.equal(await page.getByRole('treeitem',{name:'svg',exact:true}).getAttribute('aria-selected'),'true');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===painted);assert.equal(await page.getByRole('treeitem',{name:'rect · Box',exact:true}).getAttribute('aria-selected'),'true');await wait(async()=>await computed('fill')==='rgb(255, 0, 255)');
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===deleted);await wait(async()=>await app.locator('rect').count()===0);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===painted);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  await page.getByRole('treeitem',{name:'svg',exact:true}).click();await settled();await page.getByRole('button',{name:'Delete layer',exact:true}).click();await settled();await wait(async()=>await app.locator('svg').count()===0);assert.equal(await page.getByRole('treeitem',{name:'body',exact:true}).getAttribute('aria-selected'),'true');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);assert.equal(await page.getByRole('treeitem',{name:'svg',exact:true}).getAttribute('aria-selected'),'true');
  await page.getByRole('button',{name:'Lock circle',exact:true}).click();await page.getByRole('button',{name:'Lock line',exact:true}).click();
  const survivingLocks=()=>page.evaluate(()=>layerLocks.direct(doc().querySelector('line'))&&!layerLocks.direct(doc().querySelector('rect'))),restoredLocks=()=>page.evaluate(()=>layerLocks.direct(doc().querySelector('circle'))&&layerLocks.direct(doc().querySelector('line'))&&!layerLocks.direct(doc().querySelector('rect')));
  await page.getByRole('treeitem',{name:'g',exact:true}).click();await settled();await page.getByRole('button',{name:'Delete layer',exact:true}).click();await settled();await wait(async()=>await app.locator('g').count()===0);assert.equal(await app.locator('circle,ellipse').count(),0);assert.equal(await app.locator('rect,line').count(),2);await wait(survivingLocks);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(restoredLocks);assert.equal(await page.getByRole('treeitem',{name:'g',exact:true}).getAttribute('aria-selected'),'true');
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(async()=>await app.locator('g').count()===0);await wait(survivingLocks);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(restoredLocks);
  for(const tag of ['line','circle']){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(async()=>!await page.evaluate(tag=>layerLocks.direct(doc().querySelector(tag)),tag));}console.log('SVG DELETE/SUBTREE AND SIBLING LOCKS/UNDO/REDO PASS',engine);
  await page.getByRole('treeitem',{name:'circle',exact:true}).click();await settled();await fill('Center X','20');const repositionX=read();await fill('Center Y','15');const overlapping=read();
  await page.getByRole('treeitem',{name:'rect · Box',exact:true}).click();await settled();await paint('fill','#ff00ff');const overlapPainted=read();
  await page.getByRole('button',{name:'Lock circle',exact:true}).click();await page.getByRole('treeitem',{name:'rect · Box',exact:true}).click();await settled();
  const retainedSvgLocks=()=>page.evaluate(()=>layerLocks.direct(doc().querySelector('circle'))&&!layerLocks.direct(doc().querySelector('rect'))&&!layerLocks.direct(doc().querySelector('line')));
  const topShape=()=>app.locator('svg').evaluate(svg=>{const point=new DOMPoint(20,15).matrixTransform(svg.getScreenCTM());return document.elementFromPoint(point.x,point.y)?.tagName;});
  await wait(async()=>await topShape()==='circle');assert.equal(await page.getByRole('button',{name:'Send backward',exact:true}).isDisabled(),true);await wait(retainedSvgLocks);
  await page.getByRole('button',{name:'Bring forward',exact:true}).click();await settled();await wait(async()=>await topShape()==='rect');const reordered=read();if(process.env.RT_E2E_SVG_MOVE_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SVG_MOVE_SCREENSHOT});assert.equal(await page.getByRole('treeitem',{name:'rect · Box',exact:true}).getAttribute('aria-selected'),'true');assert.equal(await computed('fill'),'rgb(255, 0, 255)');await wait(retainedSvgLocks);
  await page.getByRole('button',{name:'Send backward',exact:true}).click();await settled();await wait(()=>read()===overlapPainted);await wait(async()=>await topShape()==='circle');await wait(retainedSvgLocks);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===reordered);await wait(async()=>await topShape()==='rect');assert.equal(await page.getByRole('treeitem',{name:'rect · Box',exact:true}).getAttribute('aria-selected'),'true');await wait(retainedSvgLocks);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===overlapPainted);await wait(retainedSvgLocks);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===reordered);await wait(async()=>await topShape()==='rect');await wait(retainedSvgLocks);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===overlapPainted);await wait(retainedSvgLocks);
  await page.getByRole('button',{name:'Bring to front',exact:true}).click();await settled();await wait(async()=>await topShape()==='rect');const frontSource=read();assert.ok(frontSource.indexOf('<line')<frontSource.indexOf('<rect'));assert.equal(await page.getByRole('treeitem',{name:'rect · Box',exact:true}).getAttribute('aria-selected'),'true');assert.equal(await page.getByRole('button',{name:'Bring to front',exact:true}).isDisabled(),true);await wait(retainedSvgLocks);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===overlapPainted);await wait(async()=>await topShape()==='circle');await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===frontSource);await wait(async()=>await topShape()==='rect');await wait(retainedSvgLocks);
  await page.getByRole('button',{name:'Send to back',exact:true}).click();await settled();await wait(()=>read()===overlapPainted);await wait(async()=>await topShape()==='circle');assert.equal(await page.getByRole('button',{name:'Send to back',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===frontSource);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===overlapPainted);await wait(retainedSvgLocks);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(async()=>!await page.evaluate(()=>layerLocks.direct(doc().querySelector('circle'))));console.log('SVG ORDER/DESCENDANT LOCKS/UNDO/REDO PASS',engine);
  for(const snapshot of [overlapping,repositionX,original]){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===snapshot);}
  await page.getByRole('treeitem',{name:'rect · Box',exact:true}).click();await settled();await paint('fill','#ff00ff');const originalPaint=read();
  await page.getByRole('button',{name:'Duplicate layer',exact:true}).click();await settled();await wait(async()=>await app.locator('rect').count()===2);const copiedSource=read();
  assert.equal(await page.getByRole('treeitem',{name:'rect · Box',exact:true}).last().getAttribute('aria-selected'),'true');
  assert.notEqual(await app.locator('rect').first().getAttribute('data-rt-style'),await app.locator('rect').last().getAttribute('data-rt-style'));
  await paint('fill','#00ff00');await wait(async()=>await app.locator('rect').last().evaluate(el=>getComputedStyle(el).fill)==='rgb(0, 255, 0)');assert.equal(await app.locator('rect').first().evaluate(el=>getComputedStyle(el).fill),'rgb(255, 0, 255)');
  const copyPaint=read();await fill('X','60');await wait(async()=>await app.locator('rect').last().getAttribute('x')==='60');assert.equal(await app.locator('rect').first().getAttribute('x'),'5');
  if(process.env.RT_E2E_SVG_DUPLICATE_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SVG_DUPLICATE_SCREENSHOT});
  for(const snapshot of [copyPaint,copiedSource,originalPaint]){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===snapshot);}
  assert.equal(await app.locator('rect').count(),1);assert.equal(await page.getByRole('treeitem',{name:'rect · Box',exact:true}).getAttribute('aria-selected'),'true');
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===copiedSource);assert.equal(await page.getByRole('treeitem',{name:'rect · Box',exact:true}).last().getAttribute('aria-selected'),'true');
  for(const snapshot of [originalPaint,original]){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===snapshot);}
  for(const tag of ['g','svg']){
   await page.getByRole('treeitem',{name:tag,exact:true}).click();await settled();await page.getByRole('button',{name:'Duplicate layer',exact:true}).click();await settled();await wait(async()=>await app.locator(tag).count()===2);assert.equal(await app.locator('circle').count(),2);assert.equal(await app.locator('ellipse').count(),2);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);assert.equal(await page.getByRole('treeitem',{name:tag,exact:true}).getAttribute('aria-selected'),'true');
  }
  for(const label of ['rect · Box','circle','line'])await page.getByRole('button',{name:'Lock '+label,exact:true}).click();
  const copyLocks=()=>page.evaluate(()=>['rect','circle','line'].every(tag=>[...doc().querySelectorAll(tag)].every((el,i)=>layerLocks.direct(el)===(i===0))));
  for(const tag of ['rect','g','svg']){
   await page.getByRole('treeitem',{name:tag==='rect'?'rect · Box':tag,exact:true}).click();await settled();await page.getByRole('button',{name:'Duplicate layer',exact:true}).click();await settled();await wait(async()=>await app.locator(tag).count()===2);await wait(copyLocks);const copy=read();
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(copyLocks);
   await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===copy);await wait(copyLocks);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(copyLocks);
  }
  console.log('SVG COPY/ORIGINAL AND SIBLING LOCKS/UNLOCKED COPIES/UNDO/REDO PASS',engine);
  assert.equal(await app.locator('p').textContent(),'Unchanged');
  assert.deepEqual(errors,[]);console.log(engine+': PASS inline SVG canvas/tree selection, primitive geometry, viewBox scaling, responsive paint, stroke styles, shape creation/deletion/reordering/duplication and exact source/selection undo/redo');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
