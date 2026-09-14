'use strict';
const path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{const browser=await browserType.launch();try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<div id="editor" contenteditable="true"></div>');await page.addScriptTag({path:path.resolve(__dirname,'../../shell/list-editing.js')});
 async function scenario(endOffset,backward=false,nested=false){return page.evaluate(({endOffset,backward,nested})=>{
  const el=document.querySelector('#editor');el.innerHTML='<ul><li>Before</li><li><strong>Selected</strong></li><li><span><em>Untouched</em></span></li></ul>';
  if(nested)el.innerHTML='<ul><li>Parent<ul><li><strong>Selected</strong></li><li><span><em>Untouched</em></span></li></ul></li><li>After</li></ul>';
  const from=el.querySelector('strong').firstChild,to=el.querySelector('em').firstChild,selection=document.getSelection();
  selection.removeAllRanges();selection.setBaseAndExtent(backward?to:from,backward?endOffset:0,backward?from:to,backward?0:endOffset);
  const items=RetouchListEditing.listContext(el).items.map(item=>item.textContent);
  const changed=RetouchListEditing.indent(el,nested);return {items,changed,html:el.innerHTML,text:selection.getRangeAt(0).cloneContents().textContent,top:[...el.firstElementChild.children].map(item=>item.childNodes[0].textContent)};
 },{endOffset,backward,nested});}
 for(const backward of [false,true]){const result=await scenario(0,backward);assert.deepEqual(result.items,['Selected']);assert.equal(result.changed,true);assert.deepEqual(result.top,['Before','Untouched']);assert.match(result.html,/<li>Before<ul[^>]*><li><strong>Selected/);assert.equal(result.text,'Selected');}
 const partial=await scenario(1);assert.deepEqual(partial.items,['Selected','Untouched']);assert.deepEqual(partial.top,['Before']);
 const outdent=await scenario(0,false,true);assert.deepEqual(outdent.items,['Selected']);assert.equal(outdent.changed,true);assert.deepEqual(outdent.top,['Parent','Selected','After']);assert.match(outdent.html,/<strong>Selected<\/strong><ul[^>]*><li><span><em>Untouched/);
 assert.deepEqual(errors,[]);console.log('LIST SELECTION BOUNDARIES PASS '+engine+': exclusive end, reverse selection, partial next item and nested outdent');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
