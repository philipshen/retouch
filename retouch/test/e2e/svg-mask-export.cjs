'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE,engine=process.env.RT_E2E_BROWSER||'chromium',sharp=require(path.join(fixture,'node_modules/sharp'));
(async()=>{const browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();try{
 const page=await browser.newPage({viewport:{width:800,height:500}});let checks=0,appliedOverrides=0;
 for(const mode of ['alpha','luminance'])for(const shared of [false,true])for(const override of [false,true]){
  const definition='<mask id="paint-mask" data-rt-mask="editor" mask-type="'+(mode==='alpha'?'luminance':'alpha')+'" x="25%" y="0%" width="25%" height="100%"><circle cx="100" cy="50" r="40" fill="red"/></mask>';
  await page.setContent('<style>body{margin:0;background:white}#paint-mask{mask-type:'+(override?(mode==='alpha'?'luminance':'alpha'):mode)+'}.masked{mask-image:url(#paint-mask);mask-mode:'+(override?mode:'match-source')+'}</style>'+(shared?'<svg width="0" height="0"><defs>'+definition+'</defs></svg>':'')+'<svg id="art" xmlns="http://www.w3.org/2000/svg" width="200" height="100">'+(shared?'':'<defs>'+definition+'</defs>')+'<rect width="200" height="100" fill="white"/><g class="masked" data-rt-mask-content=""><rect width="200" height="100" fill="blue"/></g></svg>');
  await page.addScriptTag({path:path.resolve(__dirname,'../../shell/svg-export.js')});
  const original=await page.locator('#art').evaluate(el=>el.outerHTML),before=await sharp(await page.locator('#art').screenshot()).raw().toBuffer({resolveWithObject:true});
  const result=await page.evaluate(async()=>{
   const target=document.getElementById('art'),snapshot=RetouchSVGExport.snapshot(target),outputs=[];
   for(const scale of [1,2]){const png=await RetouchSVGExport.png(target,scale);outputs.push({scale,width:png.width,height:png.height,bytes:Array.from(new Uint8Array(await png.blob.arrayBuffer()))});}
   const image=new Image();image.src=URL.createObjectURL(new Blob([snapshot.text],{type:'image/svg+xml'}));await image.decode();const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);URL.revokeObjectURL(image.src);return {text:snapshot.text,pixels:Array.from(ctx.getImageData(0,0,200,100).data),outputs};
  });
  assert.doesNotMatch(result.text,/data-rt|<style/);assert.match(result.text,/<mask/);assert.match(result.text,/url\(&quot;#paint-mask&quot;\)|url\("#paint-mask"\)/);
  const requested=mode==='alpha'?[0,0,255]:[201,201,255],sample=(data,channels,width,x,y)=>[...data.slice((y*width+x)*channels,(y*width+x)*channels+3)];
  const live=sample(before.data,before.info.channels,200,80,50),expected=override?live:requested;if(override&&live.every((n,i)=>Math.abs(n-requested[i])<=3))appliedOverrides++;assert.ok([[0,0,255],[201,201,255]].some(color=>live.every((n,i)=>Math.abs(n-color[i])<=3)));
  for(const [x,y,color]of [[80,50,expected],[120,50,[255,255,255]],[20,50,[255,255,255]]]){
   assert.ok(sample(before.data,before.info.channels,200,x,y).every((n,i)=>Math.abs(n-color[i])<=3),'live '+mode);
   assert.ok(sample(result.pixels,4,200,x,y).every((n,i)=>Math.abs(n-color[i])<=3),'SVG '+mode+' shared='+shared);checks++;
   for(const output of result.outputs){const png=await sharp(Buffer.from(output.bytes)).raw().toBuffer({resolveWithObject:true});assert.equal(output.width,200*output.scale);assert.equal(output.height,100*output.scale);assert.ok(sample(png.data,png.info.channels,png.info.width,x*output.scale,y*output.scale).every((n,i)=>Math.abs(n-color[i])<=3),'PNG '+mode+' '+output.scale);checks++;}
  }
  assert.equal(await page.locator('#art').evaluate(el=>el.outerHTML),original);
 }
 console.log(engine+': native mask-mode overrides applied in '+appliedOverrides+' of 4 cases');
 console.log(engine+': PASS '+checks+' SVG/PNG mask export color checks, CSS alpha/luminance and mask-mode overrides, shared definitions, bounds, two raster scales, metadata cleanup and unchanged DOM');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
