'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{unzipSync}=require('fflate'),{renderBatch}=require('../src/screen-export-batch.cjs'),{validate}=require('../src/screen-export.cjs');
const body=()=>({html:'<p>Layer</p>',width:390,height:844,scale:1,baseURL:'http://localhost/',fontFaces:[],scroll:[],rootScroll:{x:0,y:0},area:'selection',selectionIds:['1','2'],selectionNames:['../Card','Card'],separate:true});
test('batch validates its options, names and layer count',()=>{assert.doesNotThrow(()=>validate(body()));for(const patch of [{separate:'yes'},{area:'page'},{selectionIds:Array(21).fill('1')},{selectionNames:['one']},{selectionNames:[null,'two']},{selectionNames:['x'.repeat(201),'two']}])assert.throws(()=>validate({...body(),...patch}));});
test('batch isolates each selection and generates unique flat filenames',async()=>{const calls=[],zip=await renderBatch(body(),{render:async(item,{signal})=>{assert.equal(signal.aborted,false);calls.push(item);return Buffer.from(item.selectionIds[0]);}}),files=unzipSync(zip);assert.deepEqual(Object.keys(files),['01-Card@1x.png','02-Card@1x.png']);assert.equal(Buffer.from(files['02-Card@1x.png']).toString(),'2');assert.deepEqual(calls.map(item=>item.selectionIds),[['1'],['2']]);assert.ok(calls.every(item=>item.separate===false));});
test('batch stops after cancellation and identifies failed layers',async()=>{const controller=new AbortController();let calls=0;await assert.rejects(renderBatch(body(),{signal:controller.signal,render:async()=>{calls++;controller.abort();return Buffer.from('image');}}),/abort/i);assert.equal(calls,1);await assert.rejects(renderBatch(body(),{render:async item=>{if(item.selectionIds[0]==='2')throw Error('Missing image');return Buffer.from('image');}}),/Layer 2: Missing image/);});

test('batch refuses an oversized archive before adding another file',async()=>{let calls=0;await assert.rejects(renderBatch(body(),{render:async()=>{calls++;return {length:128*1024*1024+1};}}),/exceeds 128 MiB/);assert.equal(calls,1);});
test('screen batches validate every independent snapshot and reject nested or selection batches',()=>{const snapshot={...body(),separate:false,name:'Phone'},batch={screens:[snapshot],area:'page',scale:1,format:'png'};assert.doesNotThrow(()=>validate(batch));for(const patch of [{screens:[]},{screens:Array(21).fill(snapshot)},{area:'selection'},{separate:true},{screens:[{...snapshot,width:0}]},{screens:[{...snapshot,html:null}]},{screens:[{...snapshot,name:null}]},{screens:[{...snapshot,screens:[]}]},{screens:[{...snapshot,baseURL:'file:///tmp/x'}]}])assert.throws(()=>validate({...batch,...patch}));});
test('screen batches keep per-screen geometry and common export settings',async()=>{const calls=[],request={screens:[{...body(),name:'Phone',width:390,height:844,separate:false},{...body(),name:'Tablet',width:768,height:1500,separate:false}],area:'page',scale:0.5,format:'jpeg',quality:80};const files=unzipSync(await renderBatch(request,{render:async item=>{calls.push(item);return Buffer.from('image');}}));assert.deepEqual(Object.keys(files),['01-Phone-full-page@0.5x.jpg','02-Tablet-full-page@0.5x.jpg']);assert.deepEqual(calls.map(item=>[item.width,item.height,item.scale,item.area,item.format,item.quality]),[[390,844,0.5,'page','jpeg',80],[768,1500,0.5,'page','jpeg',80]]);assert.ok(calls.every(item=>!item.separate&&!item.screens&&!item.selectionIds));});

test('combined output requires a PDF batch and rejects ambiguous options',()=>{
 const request={...body(),format:'pdf',combined:true};assert.doesNotThrow(()=>validate(request));
 for(const patch of [{format:'png'},{format:'jpeg'},{combined:'true'},{combined:null},{separate:false}])assert.throws(()=>validate({...request,...patch}));
 assert.doesNotThrow(()=>validate({screens:[{...body(),separate:false,name:'Phone'}],format:'pdf',scale:1,combined:true}));
});
test('combined PDFs preserve page order, dimensions and vector resources for screens and layers',async()=>{
 const {PDFDocument,StandardFonts}=require('pdf-lib');
 for(const screens of [false,true]){
  const request=screens?{screens:[{...body(),name:'Phone',separate:false},{...body(),name:'Tablet',separate:false}],format:'pdf',scale:1,combined:true}:{...body(),format:'pdf',combined:true};
  let index=0;const bytes=await renderBatch(request,{render:async item=>{assert.equal(item.combined,false);assert.equal(item.separate,false);const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage([100+index*100,300+index*50]).drawText('Page '+(++index),{x:10,y:10,font});return Buffer.from(await pdf.save());}}),document=await PDFDocument.load(bytes);
  assert.deepEqual(document.getPages().map(page=>[page.getWidth(),page.getHeight()]),[[100,300],[200,350]]);assert.ok(document.getPages().every(page=>page.node.Resources().toString().includes('/Font')));
 }
});
test('combined PDFs cancel between pages and refuse unexpected multipage inputs',async()=>{
 const {PDFDocument}=require('pdf-lib'),controller=new AbortController();let calls=0;
 await assert.rejects(renderBatch({...body(),format:'pdf',combined:true},{signal:controller.signal,render:async()=>{calls++;controller.abort();return Buffer.from('unused');}}),/abort/i);assert.equal(calls,1);
 const document=await PDFDocument.create();document.addPage();document.addPage();const bytes=Buffer.from(await document.save());await assert.rejects(renderBatch({...body(),format:'pdf',combined:true},{render:async()=>bytes}),/exactly one PDF page/);
});
