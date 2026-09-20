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
 await page.getByRole('treeitem',{name:'h1 · Hello Svelte',exact:true}).click();await page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks);
 console.log('SVELTE COMPONENT LITERAL PROPERTIES, ISOLATED INSTANCES, EXACT HISTORY AND RETAINED CHILD STATE PASS');
};
