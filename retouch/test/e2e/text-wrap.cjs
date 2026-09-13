'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),initial=read(),original=await target.textContent(),states=[initial],field=()=>page.getByLabel('Wrap style',{exact:true});
 const geometry=()=>target.evaluate(el=>{const lines=new Map(),walker=el.ownerDocument.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){for(let i=0;i<node.length;i++){const r=el.ownerDocument.createRange();r.setStart(node,i);r.setEnd(node,i+1);const b=r.getBoundingClientRect();if(!b.width)continue;const old=lines.get(b.top);lines.set(b.top,old?{left:Math.min(old.left,b.left),right:Math.max(old.right,b.right)}:{left:b.left,right:b.right});}}const css=getComputedStyle(el);return {wrap:css.getPropertyValue('text-wrap'),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,lines:[...lines.values()].map(b=>b.right-b.left)};});
 const previewFits=async()=>{await wait(async()=>page.frameLocator('iframe.type-preview').locator('body > div').evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect();return b.right<=d.documentElement.clientWidth-10&&b.bottom<=d.documentElement.clientHeight-10&&b.width>0&&b.height>0;}));};
 const open=async()=>{const groups=field().locator('xpath=ancestor::details');for(let i=0;i<await groups.count();i++){const group=groups.nth(i);if(!await group.evaluate(el=>el.open))await group.locator(':scope > summary').click();}const tab=page.getByRole('tab',{name:'Basics',exact:true});if(await tab.getAttribute('aria-selected')!=='true')await tab.click();};
 const check=async wrap=>{await wait(async()=>(await geometry()).wrap===wrap);assert.equal(await target.textContent(),original);};
 const edit=async value=>{await open();await field().selectOption(value);await settled();await wait(()=>read()!==states.at(-1));states.push(read());await check(value);};
 await page.getByLabel('Style screen scope').selectOption('');await settled();const baseline=await geometry();assert.ok(baseline.lines.length>1);
 await edit('balance');const balanced=await geometry(),spread=lines=>Math.max(...lines)-Math.min(...lines);assert.equal(balanced.width,baseline.width);assert.equal(balanced.lines.length,baseline.lines.length);assert.ok(spread(balanced.lines)<spread(baseline.lines)-10,JSON.stringify({baseline,balanced}));
 await previewFits();
 if(process.env.RT_E2E_TEXT_WRAP_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_TEXT_WRAP_SCREENSHOT});
 await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();await edit('nowrap');await previewFits();assert.equal((await geometry()).lines.length,1);assert.equal((await geometry()).width,baseline.width);
 await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await check('balance');assert.ok((await geometry()).lines.length>1);
 await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await check('nowrap');await edit('pretty');assert.ok((await geometry()).lines.length>1);
 await open();await page.getByRole('button',{name:'Reset wrap style',exact:true}).click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());await check('balance');
 await page.getByLabel('Style screen scope').selectOption('');await settled();await edit('wrap');assert.deepEqual((await geometry()).lines,baseline.lines);
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 assert.deepEqual((await geometry()).lines,baseline.lines);console.log('TEXT WRAP PASS '+kind+': balanced line geometry, no-wrap height, pretty wrapping, unchanged text/width, screen isolation, reset and exact source undo/redo');
};
