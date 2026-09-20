'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,phone,file,original,state})=>{
 const read=()=>fs.readFileSync(file,'utf8'),settled=()=>page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks),field=name=>page.getByLabel(name,{exact:true}),press=async name=>{await page.getByRole('button',{name,exact:true}).click();await settled();};
 const current=async(frame,name)=>{await frame.locator('img[aria-label=Artwork]').evaluate((img,name)=>new Promise((resolve,reject)=>{const start=Date.now();const check=()=>{if(img.complete&&img.naturalWidth&&img.currentSrc.endsWith('/'+name))resolve();else if(Date.now()-start>6000)reject(Error('Expected '+name+', got '+img.currentSrc));else setTimeout(check,25);};check();}),name);};
 const history=async(name,text)=>{await press(name);assert.equal(read(),text);await state();};
 const open=async label=>{const details=page.locator('details').filter({has:page.locator(':scope > summary',{hasText:label})});if(!await details.evaluate(el=>el.open))await details.locator(':scope > summary').click();};
 await page.getByRole('treeitem',{name:'img · Artwork',exact:true}).click();await settled();await current(app,'wide.svg');await current(phone,'small.svg');
 await field('Image candidate').selectOption('0:0');await field('Candidate image path').fill('/new.svg');await press('Apply candidate image');const replaced=read();await current(phone,'new.svg');await current(app,'wide.svg');await state();assert.ok(replaced.includes('onload={()=>loaded++}'));
 await history('Undo',original);await current(phone,'small.svg');await history('Redo',replaced);await current(phone,'new.svg');
 await open('Source settings');await field('Screen range').selectOption('from');await field('Minimum width (px)').fill('600');await press('Apply source settings');const condition=read();await current(app,'new.svg');await current(phone,'fallback.svg');await state();await history('Undo',replaced);await current(app,'wide.svg');await current(phone,'new.svg');
 await open('Candidate options');await field('New candidate image path').fill('/small.svg');await field('New resolution value').fill('2');await press('Add image candidate');const added=read();assert.equal(await field('Image candidate').inputValue(),'0:1');assert.ok(added.includes('/new.svg 1x, /small.svg 2x'));
 await field('Candidate resolution value').fill('3');await press('Apply candidate resolution');const higher=read();assert.ok(higher.includes('/small.svg 3x'));await history('Undo',added);await history('Redo',higher);
 await press('Remove image candidate');assert.equal(read(),replaced);await history('Undo',higher);await history('Redo',replaced);
 await press('Remove image candidate');const empty=read();await current(phone,'fallback.svg');await current(app,'wide.svg');await field('New candidate source').selectOption('0');await field('New candidate image path').fill('/small.svg');await field('New resolution type').selectOption('w');await field('New resolution value').fill('640');await press('Add image candidate');const width=read();await current(phone,'small.svg');await current(app,'wide.svg');await history('Undo',empty);await current(phone,'fallback.svg');await history('Redo',width);await current(phone,'small.svg');
 // Restore every accepted operation, including the branch after the source-condition undo.
 for(let i=0;i<6;i++)await press('Undo');assert.equal(read(),original);await current(phone,'small.svg');await current(app,'wide.svg');await state();
 assert.equal(await page.getByRole('button',{name:'Add picture source',exact:true}).count(),0);
 await page.getByRole('treeitem',{name:'h1 · Hello Svelte',exact:true}).click();await settled();console.log('SVELTE RESPONSIVE CANDIDATES, SCREEN CONDITIONS, EMPTY SOURCE RECOVERY AND EXACT HISTORY PASS');
};
