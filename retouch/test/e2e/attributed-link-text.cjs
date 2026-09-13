'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),anchor=target.locator('a'),initial=read(),field=page.getByLabel('Selected text link',{exact:true});
 const attrs=()=>anchor.evaluate(el=>Object.fromEntries([...el.attributes].filter(a=>!a.name.startsWith('data-rt')&&a.name!=='href').map(a=>[a.name,a.value]))),expected=await attrs();
 const select=async()=>anchor.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,1);r.setEnd(el.firstChild,3);const selection=d.getSelection();selection.removeAllRanges();selection.addRange(r);});
 await target.click({position:{x:10,y:12}});await wait(async()=>await target.getAttribute('contenteditable')==='true');await select();await wait(async()=>await field.inputValue()==='/old');assert.equal(await field.evaluate(el=>el.readOnly),false);assert.equal(await page.getByRole('button',{name:'Remove selected text link',exact:true}).isDisabled(),true);
 await field.fill('/new?x=1&y=%22two%22');await field.press('Enter');assert.equal(await anchor.getAttribute('href'),'/new?x=1&y=%22two%22');assert.deepEqual(await attrs(),expected);assert.equal(await anchor.count(),1);assert.equal(read(),initial);
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await anchor.getAttribute('href'),'/old');await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal(await anchor.getAttribute('href'),'/new?x=1&y=%22two%22');assert.deepEqual(await attrs(),expected);
 await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();await wait(()=>read()!==initial);const saved=read();assert.equal(saved.replace(/href=(?:\{[^}]+\}|"[^"]*")/,'href="/old"'),initial);assert.deepEqual(await attrs(),expected);
 for(const [name,state]of [['Undo',initial],['Redo',saved],['Undo',initial]]){await page.getByRole('button',{name,exact:true}).click();await settled();await wait(()=>read()===state);assert.deepEqual(await attrs(),expected);}
 console.log('ATTRIBUTED LINK TEXT PASS '+kind+': URL update from partial selection preserves the unique anchor and every other source byte, local and exact source undo/redo');
};
