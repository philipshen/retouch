'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const original=read(),surface=page.locator('.canvas-move-surface'),heading=page.getByRole('treeitem',{name:'h1 · Headline',exact:true}),focusPage=()=>app.locator('body').evaluate(el=>{el.tabIndex=-1;el.focus({preventScroll:true});});
 await heading.click();await settled();await page.evaluate(()=>RetouchZoom.toSelection(groupMovementRoots(true)));await settled();
 assert.equal(await page.getByRole('button',{name:'Scale selection on canvas',exact:true}).getAttribute('aria-keyshortcuts'),'K');
 for(const origin of ['tree','canvas']){
  if(origin==='tree')await heading.focus();else await focusPage();await page.keyboard.press('k');await surface.waitFor();assert.equal(await surface.count(),1);const handle=page.getByRole('button',{name:'Scale bottom right',exact:true});await handle.press('ArrowRight');assert.equal(read(),original);await handle.press('k');assert.equal(await surface.count(),1,'K during a live gesture does not replace it');await handle.press('Escape');await surface.waitFor({state:'detached'});assert.equal(read(),original);
 }
 const search=page.getByRole('searchbox',{name:'Find a layer',exact:true});await search.fill('');await search.press('k');assert.equal(await search.inputValue(),'k');assert.equal(await surface.count(),0);await search.fill('');
 await focusPage();await page.keyboard.press('Control+k');const dialog=page.getByRole('dialog',{name:'Actions',exact:true});await dialog.waitFor();const actions=page.getByRole('combobox',{name:'Search actions',exact:true});await actions.fill('Scale tool');await actions.press('Enter');await surface.waitFor();await page.keyboard.press('Escape');await surface.waitFor({state:'detached'});
 await heading.click({button:'right'});const menu=page.getByRole('menu',{name:'Canvas actions',exact:true});await menu.waitFor();await menu.getByRole('menuitem',{name:'Scale tool',exact:true}).click();await surface.waitFor();await page.keyboard.press('Escape');await surface.waitFor({state:'detached'});
 await app.locator('body').evaluate(el=>{const input=el.ownerDocument.createElement('input');input.id='shortcut-input';el.append(input);input.focus({preventScroll:true});});await page.keyboard.press('k');assert.equal(await app.locator('#shortcut-input').inputValue(),'k');assert.equal(await surface.count(),0);await app.locator('#shortcut-input').evaluate(el=>el.remove());
 await heading.focus();await page.keyboard.press('Shift+k');assert.equal(await surface.count(),0);await heading.dispatchEvent('keydown',{key:'k',code:'KeyK',isComposing:true});assert.equal(await surface.count(),0);
 for(const origin of ['tree','canvas']){
 const id=await app.locator('h1').getAttribute('data-rt');let release,entered=false,active=0;const ready=new Promise(resolve=>release=resolve),handler=async route=>{if(new URL(route.request().url()).searchParams.get('id')!==id)return route.continue();entered=true;active++;try{await ready;await route.continue();}finally{active--;}};await page.route('**/rt/__api/resolve?*',handler);
 try{if(origin==='tree')await heading.focus();else await focusPage();await page.keyboard.press('k');await wait(()=>entered);await page.keyboard.press('k');await page.keyboard.press('Escape');release();await wait(()=>active===0);await wait(async()=>await page.evaluate(()=>stopDrawing===null));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await surface.count(),0,'late lookup cannot mount cancelled scale tool');assert.equal(read(),original);}finally{release();await page.unroute('**/rt/__api/resolve?*',handler);}
 }
 await heading.focus();await page.keyboard.press('k');await surface.waitFor();await page.keyboard.press('v');await surface.waitFor({state:'detached'});assert.equal(read(),original,'Move tool cancels scale');
 console.log(kind+': PASS K from tree/canvas, Actions and context menu, typing/composition/modifier guards, repeated activation, delayed lookup Escape and V cancellation');
};
