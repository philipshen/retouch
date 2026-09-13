'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,file,wait,settled})=>{
 const read=()=>fs.readFileSync(file,'utf8'),original=read(),surface=page.getByLabel('Edit gradient on canvas',{exact:true});
 await page.getByRole('button',{name:'Fit screen',exact:true}).click();await settled();await page.getByRole('treeitem',{name:'rect · Gradient box',exact:true}).click();await settled();
 const open=async()=>{await page.getByRole('button',{name:'Edit fill gradient on canvas',exact:true}).click();await wait(async()=>await surface.count()===1);};
 const drag=async(name,dx,dy)=>{const handle=page.getByRole('button',{name:'Gradient '+name+' handle',exact:true}),b=await handle.boundingBox();assert.ok(b);assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.getAttribute('aria-label'),{x:b.x+b.width/2,y:b.y+b.height/2}),'Gradient '+name+' handle','Color stops must not cover geometry handles');await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps:4});await page.mouse.up();};
 await open();await drag('end',-24,20);await settled();await wait(()=>read()!==original);const first=read();await wait(async()=>await surface.count()===1);await wait(async()=>await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))==='Gradient end handle');
 await drag('start',16,12);await settled();await wait(()=>read()!==first);const second=read();await wait(async()=>await surface.count()===1);await wait(async()=>await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))==='Gradient start handle');
 if(process.env.RT_E2E_GRADIENT_SESSION_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_GRADIENT_SESSION_SCREENSHOT});
 await page.getByRole('button',{name:'Finish gradient editing',exact:true}).click();await wait(async()=>await surface.count()===0);assert.equal(read(),second);
 const history=async(name,text)=>{await page.getByRole('button',{name,exact:true}).click();await settled();await wait(()=>read()===text);};await history('Undo',first);await history('Undo',original);await history('Redo',first);await history('Redo',second);await history('Undo',first);await history('Undo',original);
 // A completed gesture remains committed when Escape cancels only its pending re-entry.
 let release,seen=false;const gate=new Promise(resolve=>{release=resolve;}),handler=async route=>{if(!seen&&route.request().method()==='POST'&&route.request().postDataJSON()?.type==='setSVGGradient'){seen=true;await gate;}await route.continue();};await page.route('**/rt/__api/op',handler);
 try{await open();await drag('end',-20,16);await wait(()=>seen);await page.keyboard.press('Escape');release();await settled();await wait(()=>read()!==original);await wait(async()=>await surface.count()===0);assert.equal(await page.getByRole('button',{name:'Gradient end handle',exact:true}).count(),0);await history('Undo',original);}finally{release();await page.unroute('**/rt/__api/op',handler);}
 console.log('PASS persistent gradient session: consecutive gestures, restored focus, Done, individual undo/redo and Escape during pending save');
};
