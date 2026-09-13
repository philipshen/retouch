'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const states=[read()],shape=app.locator('h1'),screen=page.getByLabel('Screen size',{exact:true}),scope=page.getByLabel('Style screen scope',{exact:true});
 const values=()=>shape.evaluate(el=>{const css=getComputedStyle(el);return ['Top','Right','Bottom','Left'].map(s=>parseFloat(css['border'+s+'Width']));});
 const paint=()=>shape.evaluate(el=>{const css=getComputedStyle(el);return ['Top','Right','Bottom','Left'].map(s=>[css['border'+s+'Color'],css['border'+s+'Style']]);}),initialPaint=await paint();
 const check=async expected=>{await wait(async()=>JSON.stringify(await values())===JSON.stringify(expected));assert.deepEqual(await paint(),initialPaint);};
 const record=async()=>{await wait(()=>read()!==states.at(-1));states.push(read());};
 const field=side=>page.getByLabel('Border '+side+' width ('+(kind==='html'?'CSS':'px')+')',{exact:true});
 await page.locator('.border-edges > summary').click();await field('top').waitFor();await check([3,3,3,3]);
 await field('top').fill(kind==='html'?'-1px':'-1');await field('top').press('Tab');await settled();assert.equal(read(),states[0]);assert.equal(await field('top').evaluate(el=>el.checkValidity()),false);
 for(const [side,value,expected]of [['top',7,[7,3,3,3]],['right',0,[7,0,3,3]],['bottom',5,[7,0,5,3]]]){await field(side).fill(value+(kind==='html'?'px':''));await field(side).press('Tab');await settled();await record();await check(expected);}
 await screen.focus();await screen.selectOption('768x1024');await settled();await scope.selectOption(kind==='html'?'min-[768px]:':'md:');await settled();
 await field('left').fill(kind==='html'?'11px':'11');await field('left').press('Tab');await settled();await record();await check([7,0,5,11]);
 await screen.focus();await screen.selectOption('390x844');await settled();await check([7,0,5,3]);await screen.focus();await screen.selectOption('768x1024');await settled();await check([7,0,5,11]);
 await page.getByRole('button',{name:'Reset border left width',exact:true}).click();await settled();await record();await check([7,0,5,3]);
 await scope.focus();await scope.selectOption('');await settled();await page.getByRole('button',{name:'Reset border top width',exact:true}).click();await settled();await record();await check([3,0,5,3]);
 if(process.env.RT_E2E_BORDER_EDGES_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_BORDER_EDGES_SCREENSHOT});
 const all=page.getByLabel('Border width ('+(kind==='html'?'CSS':'px')+')',{exact:true});await all.fill(kind==='html'?'2px':'2');await all.press('Tab');await settled();await record();await check([2,2,2,2]);
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[i]);}await check([3,3,3,3]);
 for(let i=1;i<states.length;i++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[i]);}await check([2,2,2,2]);
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[i]);}await check([3,3,3,3]);
 console.log('INDIVIDUAL BORDER EDGES PASS',kind);
};
