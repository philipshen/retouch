'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
exports.run=async({page,app,phone,file,original,state,server})=>{
 const geometry=frame=>frame.locator('#art img, #art span').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el);return [r.x,r.y,r.width,r.height,c.marginLeft,c.opacity,c.borderTopLeftRadius,c.paddingRight];}));
 const before=await Promise.all([app,phone].map(geometry));
 const root=fs.realpathSync(path.dirname(file)),actualFile=fs.realpathSync(file),documents=await Promise.all([app,phone].map(frame=>frame.locator('html').evaluate(require('../../shell/picture-style-inventory.js').collect))),inventory=await require('../../src/vite-picture-styles.cjs').validate(server,{root,documents});assert.ok(inventory.files.includes(actualFile));assert.ok(inventory.files.includes(path.join(root,'art.css')));
 const snapshot=()=>app.locator('html').evaluate(require('../../shell/picture-style-inventory.js').collect),validate=document=>require('../../src/vite-picture-styles.cjs').validate(server,{root,documents:[document]});
 await app.locator('html').evaluate(node=>{const style=node.ownerDocument.createElement('style');style.id='picture-coverage-unmapped';style.textContent='.unrelated-coverage{color:red}';node.ownerDocument.head.append(style);});
 const injected=await snapshot();await assert.rejects(()=>validate(injected),/inline or injected/);await app.locator('#picture-coverage-unmapped').evaluate(node=>node.remove());
 const rule=await app.locator('style[data-vite-dev-id]').first().evaluate(node=>node.sheet.insertRule('.unrelated-coverage{color:red}',node.sheet.cssRules.length));
 const mutated=await snapshot();await assert.rejects(()=>validate(mutated),/runtime rule changes/);await app.locator('style[data-vite-dev-id]').first().evaluate((node,index)=>node.sheet.deleteRule(index),rule);
 await validate(await snapshot());
 const tracked=[actualFile,path.join(root,'art.css'),path.join(root,'art-spacing.css')],readAll=()=>tracked.map(file=>fs.readFileSync(file,'utf8')),originalFiles=readAll();
 const idle=()=>page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks),press=async name=>{await page.getByRole('button',{name,exact:true}).click();await idle();};
 await page.getByRole('treeitem',{name:'img · Art',exact:true}).click();await idle();
 const details=page.locator('details').filter({has:page.locator(':scope > summary',{hasText:'Artwork by screen'})});if(!await details.evaluate(el=>el.open))await details.locator(':scope > summary').click();
 await page.getByLabel('Artwork image path',{exact:true}).fill('/small.svg');await page.getByLabel('Artwork maximum width (px)',{exact:true}).fill('600');
 await app.locator('html').evaluate(node=>{const style=node.ownerDocument.createElement('style');style.id='picture-ui-unmapped';style.textContent='.unrelated-coverage{color:red}';node.ownerDocument.head.append(style);});
 await press('Add picture source');assert.deepEqual(readAll(),originalFiles);await page.getByRole('alert').filter({hasText:'inline or injected'}).waitFor();await app.locator('#picture-ui-unmapped').evaluate(node=>node.remove());
 await press('Add picture source');const changedFiles=readAll();assert.notDeepEqual(changedFiles,originalFiles);
 async function settled(wrapped){
  for(const frame of [app,phone])await frame.locator(wrapped?'#art > picture > img':'#art > img').waitFor();
  await page.waitForFunction(({expected,wrapped})=>{const frames=[document.querySelector('#app'),document.querySelector('iframe[title="Phone comparison preview"]')];return frames.every((frame,index)=>{const d=frame.contentDocument,img=d?.querySelector('#art img');if(!img?.complete||!img.naturalWidth||!img.currentSrc.endsWith('/'+(wrapped&&d.defaultView.innerWidth<=600?'small.svg':'wide.svg')))return false;const actual=[...d.querySelectorAll('#art img,#art span')].map(el=>{const r=el.getBoundingClientRect(),c=d.defaultView.getComputedStyle(el);return [r.x,r.y,r.width,r.height,c.marginLeft,c.opacity,c.borderTopLeftRadius,c.paddingRight];});return JSON.stringify(actual)===JSON.stringify(expected[index]);});},{expected:before,wrapped});
  assert.deepEqual(await Promise.all([app,phone].map(geometry)),before);await state();
 }
 await settled(true);await page.screenshot({path:'/tmp/retouch-svelte-picture-style-'+(process.env.RT_E2E_BROWSER||'chromium')+'.png'});
 for(const [direction,wrapped] of [['Undo',false],['Redo',true],['Undo',false]]){await press(direction);await settled(wrapped);assert.deepEqual(readAll(),wrapped?changedFiles:originalFiles);}
 await page.getByRole('treeitem',{name:'h1 · Hello Svelte',exact:true}).click();await idle();
 console.log('SVELTE PICTURE CREATION UI, CSS COVERAGE REFUSAL, RESPONSIVE GEOMETRY, EXACT MULTI-FILE HISTORY AND RETAINED STATE PASS');
};
