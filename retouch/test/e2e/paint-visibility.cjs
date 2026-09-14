'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),P=require('../../shell/paint-order.js'),V=require('../../shell/html-css-values.js');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{const browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch(),page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));try{
 await page.setContent('<style>body{margin:0}#paint{width:120px;height:120px;background-color:lime}</style><div id="paint"></div>');
 const target=page.locator('#paint'),read=()=>target.evaluate(el=>({layers:getComputedStyle(el).backgroundImage,framing:Object.fromEntries(['background-size','background-position','background-repeat','background-origin','background-clip','background-attachment','background-blend-mode'].map(property=>[property,getComputedStyle(el).getPropertyValue(property)])),stored:getComputedStyle(el).getPropertyValue('--rt-hidden-paints').trim()||'none'})),write=changes=>target.evaluate((el,changes)=>{for(const [property,value]of Object.entries(changes))el.style.setProperty(property,value);},changes),pixels=async()=>{const result=await require(path.join(fixture,'node_modules/sharp'))(await target.screenshot()).removeAlpha().raw().toBuffer();return result;};
 for(const gradient of ['linear-gradient(0deg, rgb(255 0 0 / 50%) 0%, rgb(255 0 0 / 50%) 100%)','linear-gradient(37deg, red 0%, blue 100%)','radial-gradient(ellipse at 20% 70%, red 0%, blue 100%)','conic-gradient(from 30deg at 20% 70%, red 0%, blue 100%)','repeating-linear-gradient(40deg, red 0%, blue 25%)'])for(const repeat of ['repeat','no-repeat','round','space']){
  await target.evaluate(el=>el.removeAttribute('style'));
  await write({'background-image':gradient,'background-size':'37px 51px','background-position':'23% 71%','background-repeat':repeat,'background-blend-mode':'multiply'});
  const before=await read(),rendered=await pixels(),layers=V.imageLayers(before.layers),hidden=P.toggleVisibility(layers,before.framing,'none',0,true);await write(hidden);
  const hiddenState=await read();assert.equal(hiddenState.layers,before.layers);assert.equal(hiddenState.framing['background-repeat'],repeat);assert.deepEqual(P.visibility(layers,hiddenState.framing,hiddenState.stored),V.parsePaintVisibility(hidden[V.paintVisibilityProperty]));
  const absent=await pixels();for(let offset=0;offset<absent.length;offset+=3)assert.deepEqual([...absent.subarray(offset,offset+3)],[0,255,0],gradient+' '+repeat);
  // Reconstruct from serialized DOM as a browser reload would, discarding JS state.
  const html=await page.content();await page.setContent(html);const restoredState=await read();await write(P.toggleVisibility(V.imageLayers(restoredState.layers),restoredState.framing,restoredState.stored,0,false));
  assert.deepEqual((await read()).framing,before.framing);assert.deepEqual(await pixels(),rendered,'Showing restores the complete rendered paint: '+gradient+' '+repeat);
 }
 assert.deepEqual(errors,[]);console.log(engine+': PASS hidden solid/linear/radial/angular/repeating paints, four tiling modes, serialized DOM restoration and exact restored pixels');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
