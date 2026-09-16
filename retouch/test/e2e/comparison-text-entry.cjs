'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const original=read(),states=[original],screen=page.getByLabel('Screen size',{exact:true}),scope=page.getByLabel('Style screen scope',{exact:true});await screen.selectOption('768x1024');await settled();await scope.selectOption(kind==='html'?'min-[768px]:':'md:');const selectedScope=await scope.inputValue();await page.getByRole('button',{name:'Compare screens',exact:true}).click();
 const preview=page.frameLocator('iframe[title="Phone comparison preview"]'),viewport=page.getByRole('button',{name:'Edit from Phone comparison',exact:true}),target=app.locator('h1');await preview.locator('h1').waitFor();await wait(()=>preview.locator('h1').evaluate(el=>el.ownerDocument.readyState==='complete'&&[...el.ownerDocument.querySelectorAll('[data-rt-client-revision]')].every(node=>node.getAttribute('data-rt-client-revision')===node.getAttribute('data-rt-client-mounted'))));await settled();
 const doubleClick=async(selector='h1')=>{const bounds=await viewport.boundingBox(),point=await preview.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.left+Math.min(30,r.width/2),y:r.top+r.height/2,width:innerWidth};});await viewport.dblclick({position:{x:point.x*bounds.width/point.width,y:point.y*bounds.width/point.width}});};
 await doubleClick();await wait(async()=>await target.getAttribute('contenteditable')==='true');assert.deepEqual(await target.evaluate(()=>[innerWidth,innerHeight]),[390,844]);assert.equal(read(),original);if(process.env.RT_E2E_COMPARISON_TEXT_ENTRY_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_COMPARISON_TEXT_ENTRY_SCREENSHOT,caret:'initial'});
 const save=async text=>{await target.fill(text);await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await wait(()=>read()!==states.at(-1));await settled();states.push(read());await wait(async()=>await preview.locator('h1').textContent()===text);assert.equal(await scope.inputValue(),selectedScope);};
 await save('Phone headline');await viewport.focus();await viewport.press('F2');await wait(async()=>await target.getAttribute('contenteditable')==='true');assert.equal(read(),states.at(-1));assert.equal(await target.evaluate(el=>el.ownerDocument.getSelection().toString()),'Phone headline');
 // Hold each source write so click/click/dblclick overlaps a real pending save.
 const handoff=async(text,selector)=>{
  await target.fill(text);let releaseWrite,writeStarted=false;const writeGate=new Promise(resolve=>releaseWrite=resolve);
  const holdWrite=async route=>{writeStarted=true;await writeGate;await route.continue();};await page.route('**/rt/__api/op',holdWrite,{times:1});
  try{await doubleClick(selector);await wait(()=>writeStarted);}finally{releaseWrite();}
  await wait(()=>read()!==states.at(-1));await settled();states.push(read());await wait(async()=>await app.locator(selector).getAttribute('contenteditable')==='true');assert.equal(await target.textContent(),text);await wait(async()=>await preview.locator('h1').textContent()===text);
 };
 await handoff('Pending headline','h1');
 await handoff('Switching headline','p.other-font');
 await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();assert.equal(read(),states.at(-1));await doubleClick();await wait(async()=>await target.getAttribute('contenteditable')==='true');
 await save('Keyboard headline');
 await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Shift']});await settled();assert.equal(await page.getByRole('treeitem',{selected:true}).count(),2);await viewport.focus();await viewport.press('F2');await wait(async()=>await page.getByText('Select one text layer before pressing F2.',{exact:true}).count()===1);assert.notEqual(await target.getAttribute('contenteditable'),'true');assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}await wait(async()=>await preview.locator('h1').textContent()==='Headline');
 for(let i=1;i<states.length;i++){await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}await wait(async()=>await preview.locator('h1').textContent()==='Keyboard headline');
 await page.getByRole('button',{name:'Lock main',exact:true}).click();await settled();await doubleClick();await wait(async()=>await page.getByText('No unlocked editable layer here. Select locked layers in Layers.',{exact:true}).count()===1);assert.notEqual(await target.getAttribute('contenteditable'),'true');assert.equal(read(),states.at(-1));
 assert.equal(await scope.inputValue(),selectedScope);console.log(kind+': PASS comparison double-click/F2 text entry, pending-save same/different-layer handoff, size and scope preservation, linked preview updates, multi-selection and lock refusal, exact undo/redo');
};
