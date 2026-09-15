'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const original=read();await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Meta']});await settled();
 for(const axis of ['Vertical','Horizontal','Normal']){
  const label='Shared '+axis+(axis==='Normal'?' flow':' stack'),button=page.getByRole('button',{name:label,exact:true});await button.click();await wait(()=>read()!==original);await settled();assert.equal(await button.getAttribute('aria-pressed'),'true');
  const matches=async()=>app.locator('h1,p.other-font').evaluateAll((nodes,axis)=>nodes.every(el=>{const css=getComputedStyle(el);if(axis==='Normal')return css.display==='block';const [a,b]=[...el.children].map(el=>el.getBoundingClientRect());return css.display==='flex'&&css.flexWrap==='nowrap'&&(axis==='Vertical'?Math.abs(a.x-b.x)<.1&&Math.abs(a.y-b.y)>=29.9:Math.abs(a.y-b.y)<.1&&Math.abs(a.x-b.x)>=39.9);}),axis);await wait(matches);const changed=read();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===changed);await settled();await wait(matches);await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();
 }
 const normal=page.getByRole('button',{name:'Shared Normal flow',exact:true});await normal.focus();await normal.press('ArrowRight');assert.equal(await page.getByRole('button',{name:'Shared Vertical stack',exact:true}).evaluate(el=>el===document.activeElement),true);assert.equal(read(),original);await page.screenshot({path:'/tmp/retouch-shared-stack-presets-'+kind+'.png'});
 console.log(kind+': PASS shared normal/vertical/horizontal layout presets across horizontal and vertical writing modes, physical child geometry, pressed state, keyboard navigation and exact undo/redo');
};
