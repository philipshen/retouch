'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),initial=read(),text=await target.textContent();
 const underline=()=>page.getByRole('button',{name:'Underline selected text',exact:true});
 const select=async(from,to)=>target.evaluate((el,{from,to})=>{
  const d=el.ownerDocument,walker=d.createTreeWalker(el,NodeFilter.SHOW_TEXT),range=d.createRange();let offset=0,started=false;
  while(walker.nextNode()){const node=walker.currentNode,end=offset+node.length;if(!started&&from<end){range.setStart(node,from-offset);started=true;}if(started&&to<=end){range.setEnd(node,to-offset);break;}offset=end;}
  const selection=d.getSelection();selection.removeAllRanges();selection.addRange(range);
 },{from,to});
 const edit=async(from,to)=>{await target.click({position:{x:(await target.boundingBox()).width-10,y:12}});await wait(async()=>await target.getAttribute('contenteditable')==='true');await select(from,to);await wait(async()=>await underline().getAttribute('aria-pressed')==='true');};
 const done=async()=>{await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();};
 const structure=async()=>{
  assert.equal(await target.textContent(),text);assert.equal(await target.locator('br').count(),1);
  assert.equal(await target.locator('s').allTextContents().then(values=>values.join('')),'Head');assert.equal(await target.locator('em').allTextContents().then(values=>values.join('')),'li');
  assert.equal(await target.locator('#owned-format').textContent(),'ne');assert.equal(await target.locator('#owned-format').getAttribute('data-note'),'keep');
 };
 const history=async saved=>{for(const [name,state]of [['Undo',initial],['Redo',saved],['Undo',initial]]){await page.getByRole('button',{name,exact:true}).click();await settled();await wait(()=>read()===state);await structure();}};
 // A later protected wrapper must refuse the entire command before any edit.
 await edit(0,8);const before=await target.innerHTML();await underline().click();assert.equal(await target.innerHTML(),before);assert.equal(read(),initial);await done();assert.equal(read(),initial);
 // Only the selected portions of separate runs lose underline.
 await edit(2,5);await underline().click();assert.deepEqual(await target.locator('u').allTextContents(),['He','i','ne']);await structure();
 assert.equal(await target.evaluate(el=>el.ownerDocument.getSelection().toString()),'adl');
 const partialMarkup=await target.innerHTML();await target.evaluate(el=>el.focus());await page.keyboard.press('Control+z');assert.deepEqual(await target.locator('u').allTextContents(),['Head','li','ne']);await structure();assert.equal(read(),initial);
 await page.keyboard.press('Control+Shift+z');assert.equal(await target.innerHTML(),partialMarkup);await structure();assert.equal(read(),initial);
 await done();const partial=read();assert.notEqual(partial,initial);await structure();await history(partial);
 // Whole-run removal retains nested emphasis and the structural line break.
 await edit(0,6);await underline().click();assert.deepEqual(await target.locator('u').allTextContents(),['ne']);await structure();
 assert.equal(await target.evaluate(el=>el.ownerDocument.getSelection().getRangeAt(0).toString()),'Headli');
 if(process.env.RT_E2E_SPLIT_FORMATTING_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SPLIT_FORMATTING_SCREENSHOT});
 await done();const whole=read();assert.notEqual(whole,initial);await structure();await history(whole);
 console.log('SPLIT FORMATTING PASS '+kind+': partial/whole multi-run removal, nested emphasis and breaks retained, selected text retained, atomic owned-wrapper refusal and exact source undo/redo');
};
