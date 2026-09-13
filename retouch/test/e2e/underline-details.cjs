'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),initial=read(),states=[initial],props=['text-decoration-style','text-decoration-thickness','text-underline-offset','text-decoration-skip-ink','text-decoration-color'];
 const values=()=>target.evaluate((el,props)=>{const css=getComputedStyle(el);return Object.fromEntries([...props,'color','text-decoration-line'].map(p=>[p,css.getPropertyValue(p)]));},props),baseline=await values();
 const field=label=>page.getByLabel(label,{exact:true});
 const open=async()=>{const groups=field('Underline style').locator('xpath=ancestor::details');for(let i=0;i<await groups.count();i++){const group=groups.nth(i);if(!await group.evaluate(el=>el.open))await group.locator(':scope > summary').click();}const tab=page.getByRole('tab',{name:'Basics',exact:true});if(await tab.getAttribute('aria-selected')!=='true')await tab.click();};
 const check=async(property,value)=>{await wait(async()=>(await values())[property]===value);const actual=await values();assert.equal(actual.color,baseline.color);assert.equal(actual['text-decoration-line'],baseline['text-decoration-line']);};
 const edit=async(label,value,property,expected=value)=>{await open();const input=field(label);if(await input.evaluate(el=>el.tagName)==='SELECT')await input.selectOption(value);else{await input.fill(value);await input.press('Enter');}await settled();await wait(()=>read()!==states.at(-1));states.push(read());await check(property,expected);};
 await page.getByLabel('Style screen scope').selectOption('');await settled();
 await edit('Underline style','wavy',props[0]);await edit('Underline thickness','4px',props[1]);await edit('Underline offset','6px',props[2]);await edit('Underline skip ink','none',props[3]);await edit('Underline color','#cc3300',props[4],'rgb(204, 51, 0)');
 await open();await page.getByRole('button',{name:'Edit Underline color',exact:true}).click();const picker=page.getByRole('dialog',{name:'Edit Underline color',exact:true});await picker.getByLabel('Color value',{exact:true}).fill('#0066cc');await check(props[4],'rgb(0, 102, 204)');assert.equal(read(),states.at(-1));await page.keyboard.press('Escape');await picker.waitFor({state:'detached'});await check(props[4],'rgb(204, 51, 0)');assert.equal(read(),states.at(-1));
 await open();const thickness=field('Underline thickness');await thickness.scrollIntoViewIfNeeded();const box=await thickness.locator('xpath=..').locator('[data-numeric-scrub]').boundingBox();assert.ok(box);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+12,box.y+box.height/2,{steps:3});await wait(async()=>(await values())[props[1]]!=='4px');assert.equal(read(),states.at(-1));await page.keyboard.press('Escape');await page.mouse.up();await check(props[1],'4px');
 if(process.env.RT_E2E_UNDERLINE_DETAILS_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_UNDERLINE_DETAILS_SCREENSHOT});
 await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();await edit('Underline style','dotted',props[0]);await edit('Underline offset','-2px',props[2]);
 await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await check(props[0],'wavy');await check(props[2],'6px');
 await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await check(props[0],'dotted');await check(props[2],'-2px');
 await open();await page.getByRole('button',{name:'Reset underline offset',exact:true}).click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());await check(props[2],'6px');
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 assert.deepEqual(await values(),baseline);console.log('UNDERLINE DETAILS PASS '+kind+': five independent properties, picker and scrub preview/cancel, retained text color and decoration, negative screen offset, phone isolation, reset and exact source undo/redo');
};
