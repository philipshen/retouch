'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright'),{unzipSync}=require('fflate'),{render}=require('../../src/screen-export.cjs');
const PNG=require(require.resolve('pngjs',{paths:[process.env.RT_BUILD_FIXTURE||process.env.RT_INSPECTOR_FIXTURE]})).PNG;
const body={html:'<body data-capture-node="0" style="margin:0"><div data-capture-node="1" style="visibility:visible;width:40px;height:30px;background:lime"></div><div data-capture-node="2" style="visibility:visible;width:50px;height:20px;background:blue"></div><div data-capture-node="3" style="visibility:visible;width:60px;height:10px;background:red"></div></body>',width:390,height:844,scale:1,baseURL:'http://example.test/',fontFaces:[],scroll:[],rootScroll:{x:0,y:0},area:'selection',selectionIds:['1','2','3'],separate:true,transparent:true};
(async()=>{
 for(const mode of ['success','failure','cancel','cancel-opening']){
  let launches=0,contexts=0,active=0,maxActive=0,browser;const controller=new AbortController();
  const browserType={launch:async()=>{launches++;browser=await chromium.launch();return {close:()=>browser.close(),newContext:async options=>{contexts++;const ordinal=contexts,context=await browser.newContext(options);active++;maxActive=Math.max(maxActive,active);assert.deepEqual(await context.cookies(),[],'cookies cannot leak between layer contexts');await context.addCookies([{name:'previous-layer',value:String(ordinal),url:'http://example.test/'}]);let closed=false;const close=context.close.bind(context);context.close=async()=>{if(!closed){closed=true;active--;}return close();};const newPage=context.newPage.bind(context);context.newPage=async()=>{const page=await newPage();if(mode==='failure'&&ordinal===2)page.screenshot=async()=>{throw Error('Injected screenshot failure');};if(mode==='cancel')page.screenshot=async()=>{controller.abort();throw Error('Canceled screenshot');};return page;};if(mode==='cancel-opening')controller.abort();return context;}};}};
  const started=performance.now();try{
   if(mode==='success'){const files=unzipSync(await render(body,{browserType}));assert.equal(Object.keys(files).length,3);for(const [index,file]of Object.values(files).entries()){const png=PNG.sync.read(Buffer.from(file));assert.equal(png.width,40+index*10);assert.equal(png.height,30-index*10);assert.deepEqual([...png.data.subarray(0,4)],[[0,255,0,255],[0,0,255,255],[255,0,0,255]][index]);}assert.equal(contexts,3);}
   else{await assert.rejects(render(body,{browserType,signal:controller.signal}),mode==='failure'?/Layer 2: Injected screenshot failure/:/abort/i);assert.equal(contexts,mode==='failure'?2:1);}
   assert.equal(launches,1);assert.equal(maxActive,1);assert.equal(active,0);assert.equal(browser.isConnected(),false);console.log(mode+': one browser, '+contexts+' isolated contexts, all closed ('+Math.round(performance.now()-started)+' ms)');
  }finally{await browser?.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
