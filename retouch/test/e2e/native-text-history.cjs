'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),initial=read(),text=await target.textContent(),states=[];
 const select=async(from,to=from)=>target.evaluate((el,{from,to})=>{
  const d=el.ownerDocument,walker=d.createTreeWalker(el,NodeFilter.SHOW_TEXT),r=d.createRange();let offset=0,started=false;
  while(walker.nextNode()){const node=walker.currentNode,end=offset+node.length;if(!started&&from<=end){r.setStart(node,from-offset);started=true;}if(started&&to<=end){r.setEnd(node,to-offset);break;}offset=end;}
  const selection=d.getSelection();selection.removeAllRanges();selection.addRange(r);el.focus();
 },{from,to});
 const remember=async()=>{states.push(await target.innerHTML());assert.equal(read(),initial);};
 await target.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');await select(1,4);await remember();
 await page.getByRole('button',{name:'Underline selected text',exact:true}).click();await remember();
 await select(text.length);await page.keyboard.insertText('X');await remember();assert.equal(await target.textContent(),text+'X');
 await page.keyboard.press('Backspace');await remember();assert.equal(await target.textContent(),text);
 await select(1,3);await page.keyboard.insertText('Y');await remember();assert.equal(await target.textContent(),text.slice(0,1)+'Y'+text.slice(3));
 await select(0);await page.keyboard.press('Delete');await remember();assert.equal(await target.textContent(),'Y'+text.slice(3));
 for(let n=states.length-2;n>=0;n--){
  if(n%2)await page.getByRole('button',{name:'Undo',exact:true}).click();else{await target.evaluate(el=>el.focus());await page.keyboard.press('Control+z');}
  assert.equal(await target.innerHTML(),states[n]);assert.equal(await target.getAttribute('contenteditable'),'true');assert.equal(read(),initial);
 }
 // Exhausted snapshot history must not replay the browser's old native stack.
 await target.evaluate(el=>el.focus());await page.keyboard.press('Control+z');assert.equal(await target.innerHTML(),states[0]);assert.equal(read(),initial);
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal(await target.innerHTML(),states[n]);assert.equal(await target.getAttribute('contenteditable'),'true');assert.equal(read(),initial);}
 await page.getByRole('button',{name:'Undo',exact:true}).click();await select(0);await page.keyboard.insertText('Z');assert.equal(await page.getByRole('button',{name:'Redo',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();const saved=read();assert.notEqual(saved,initial);
 for(const [name,state]of [['Undo',initial],['Redo',saved],['Undo',initial]]){await page.getByRole('button',{name,exact:true}).click();await settled();await wait(()=>read()===state);}
 console.log('NATIVE TEXT HISTORY PASS '+kind+': formatting, ordinary typing, backward/forward deletion, selection replacement, local buttons/keyboard, exhausted-stack protection, redo branching and exact source history');
};
