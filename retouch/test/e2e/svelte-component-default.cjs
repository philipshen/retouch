'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
exports.run=async({page,app,phone,file,original,state})=>{
 const settled=()=>page.waitForFunction(()=>!undoBusy&&!panelTasks&&!sourceRequests);
 for(const [component,selector,initial,next,expected]of [['DefaultCard','[data-default-card]','quiet','bold',['bold','bold','quiet']],['LegacyDefault','[data-legacy-default]','Legacy','Changed',['Changed','Override']]]){
  const definition=path.join(path.dirname(file),component+'.svelte'),before=fs.readFileSync(definition,'utf8');
  await page.getByRole('treeitem',{name:component+' · component',exact:true}).first().click();await page.getByRole('button',{name:'Edit default for label',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Edit component default',exact:true}),input=dialog.getByLabel('Default value',{exact:true});
  if(component==='DefaultCard')await input.selectOption({label:next});else await input.fill(next);
  await dialog.getByRole('button',{name:'Update default',exact:true}).click();await dialog.waitFor({state:'hidden'});await settled();
  const after=fs.readFileSync(definition,'utf8');assert.notEqual(after,before);assert.equal(fs.readFileSync(file,'utf8'),original);
  for(const frame of [app,phone]){assert.deepEqual(await frame.locator(selector).allTextContents(),expected);}await state();
  await page.screenshot({path:'/tmp/retouch-svelte-default-'+component+'-'+(process.env.RT_E2E_BROWSER||'chromium')+'.png'});
  for(const direction of ['Undo','Redo','Undo']){await page.getByRole('button',{name:direction,exact:true}).click();await settled();assert.equal(fs.readFileSync(definition,'utf8'),direction==='Redo'?after:before);for(const frame of [app,phone])assert.deepEqual(await frame.locator(selector).allTextContents(),direction==='Redo'?expected:expected.map((text,index)=>component==='DefaultCard'||index===0?initial:text));await state();}
 }
 await page.getByRole('treeitem',{name:'h1 · Hello Svelte',exact:true}).click();await settled();console.log('SVELTE RUNE AND LEGACY SHARED DEFAULT UI, INHERITING INSTANCES, EXPLICIT OVERRIDES, TWO-PREVIEW SYNC AND EXACT HISTORY PASS');
};
