'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),source=require('../../src/svelte-source.cjs'),props=require('../../src/svelte-component-props.cjs'),{SourceHistory}=require('../../src/history.cjs'),adapter=require('../../src/adapters/svelte.cjs');
exports.run=async({page,app,phone,file,original,state})=>{
 const history=new SourceHistory(),root=fs.realpathSync(path.dirname(file)),actual=fs.realpathSync(file);
 await page.locator('#modeBtn').click();for(const frame of [app,phone])await frame.locator('#badge-one button').evaluate(button=>button.click());await page.locator('#modeBtn').click();
 async function verify(text){for(const frame of [app,phone]){await frame.locator('#badge-one output').evaluate((node,text)=>new Promise((resolve,reject)=>{const start=Date.now(),poll=()=>{if(node.textContent===text)return resolve();if(Date.now()-start>10000)return reject(Error('Component property did not update: '+node.textContent));node.ownerDocument.defaultView.dispatchEvent(new Event('retouch:source-sync'));setTimeout(poll,100);};poll();}),text);assert.equal(await frame.locator('#badge-one output').textContent(),text);assert.equal(await frame.locator('#badge-two output').textContent(),'Second|2|true');assert.equal(await frame.locator('#badge-one button').textContent(),'Hits 1');assert.equal(await frame.locator('#badge-two button').textContent(),'Hits 0');}await state();}
 await verify('First|1|true');
 for(const [name,value,text]of [['amount',7,'First|7|true'],['enabled',false,'First|1|false'],['label','Updated <&>{}','Updated <&>{}|1|true']]){
  const resolved={appRoot:root,file:actual,relPath:'App.svelte',source:original,hash:source.contentHash(original),element:source.collect(original,'App.svelte').components[0]},plan=props.plan(resolved,{fileHash:resolved.hash,name,value});assert.equal(plan.ok,true,plan.reason);const saved=history.commit(root,plan);assert.equal(saved.ok,true,saved.reason);await verify(text);
  for(const [direction,expected]of [['undo','First|1|true'],['redo',text],['undo','First|1|true']]){const result=history.apply(root,direction,saved.undoId,adapter);assert.equal(result.ok,true,result.reason);await verify(expected);assert.equal(fs.readFileSync(file,'utf8'),direction==='redo'?plan.edits[0].after:original);}
 }
 const instanceId=source.collect(original,'App.svelte').components[0].id;
 for(const frame of [app,phone])assert.equal(await frame.locator('#badge-one').getAttribute('data-rt-i'),instanceId);
 await app.locator('#badge-one').click({position:{x:500,y:5}});
 const field=()=>page.getByLabel('Component property amount',{exact:true});await field().waitFor();assert.equal(await field().inputValue(),'1');
 await field().fill('9');await field().press('Enter');await page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks);await verify('First|9|true');const changed=fs.readFileSync(file,'utf8');assert.notEqual(changed,original);
 for(const [action,expected,bytes]of [['Undo','First|1|true',original],['Redo','First|9|true',changed],['Undo','First|1|true',original]]){await page.getByRole('button',{name:action,exact:true}).click();await page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks);await verify(expected);assert.equal(fs.readFileSync(file,'utf8'),bytes);}
 async function groups(expectedTag){
  const result=await page.evaluate(async id=>{const info=await api('GET',componentUrl(id));return [doc(),...RetouchComparisons.exportFrames().map(frame=>frame.contentDocument)].map(d=>RetouchComponentInstances.group(matchingInDocument(d,id,info),info.rootGroups).map(group=>({complete:group.complete,tags:group.elements.map(el=>el.tagName)})));},instanceId);
  assert.ok(result.length>=2);for(const frame of result)assert.deepEqual(frame,[{complete:true,tags:['SECTION',expectedTag]}]);
  await page.getByRole('treeitem',{name:'Badge · component',exact:true}).nth(3).waitFor();assert.equal(await page.getByRole('treeitem',{name:'Badge · component',exact:true}).count(),4);
 }
 await groups('ASIDE');
 const repeatedId=source.collect(original,'App.svelte').components[2].id;
 const repeated=await page.evaluate(async id=>{const info=await api('GET',componentUrl(id));return [doc(),...RetouchComparisons.exportFrames().map(frame=>frame.contentDocument)].map(d=>RetouchComponentInstances.group(matchingInDocument(d,id,info),info.rootGroups).map(group=>({complete:group.complete,tags:group.elements.map(el=>el.tagName)})));},repeatedId);
 for(const frame of repeated)assert.deepEqual(frame,[{complete:true,tags:['SECTION','ASIDE']},{complete:true,tags:['SECTION','FOOTER']}]);

 await page.getByLabel('Component property enabled',{exact:true}).uncheck();await page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks);await verify('First|1|false');await groups('FOOTER');const disabled=fs.readFileSync(file,'utf8');
 await app.locator('#badge-one-details').click({position:{x:500,y:5}});await page.getByLabel('Component property enabled',{exact:true}).waitFor();assert.equal(await page.getByLabel('Component property enabled',{exact:true}).isChecked(),false);
 for(const [action,expected,bytes,tag]of [['Undo','First|1|true',original,'ASIDE'],['Redo','First|1|false',disabled,'FOOTER'],['Undo','First|1|true',original,'ASIDE']]){await page.getByRole('button',{name:action,exact:true}).click();await page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks);await verify(expected);await groups(tag);assert.equal(fs.readFileSync(file,'utf8'),bytes);}
 await page.screenshot({path:'/tmp/retouch-svelte-component-branches-'+(process.env.RT_E2E_BROWSER||'chromium')+'.png'});
 console.log('SVELTE CONDITIONAL COMPONENT ROOT GROUPS, BRANCH SELECTION AND BOOLEAN UI HISTORY PASS');
 console.log('SVELTE CANVAS COMPONENT SELECTION, INSPECTOR PROPERTY AND EXACT UI HISTORY PASS');
 await page.getByRole('treeitem',{name:'h1 · Hello Svelte',exact:true}).click();await page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks);
 console.log('SVELTE COMPONENT LITERAL PROPERTIES, ISOLATED INSTANCES, EXACT HISTORY AND RETAINED CHILD STATE PASS');
};
