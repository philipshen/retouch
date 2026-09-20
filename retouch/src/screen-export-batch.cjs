'use strict';
const {zipSync}=require('fflate');
function screenRequest(body,screen){return {...screen,screens:undefined,separate:false,combined:false,selectionIds:undefined,selectionNames:undefined,area:body.area||'viewport',scale:body.scale,format:body.format,quality:body.quality,transparent:body.transparent};}
async function renderBatch(body,{signal,render}){
 const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(Error('Batch export timed out after two minutes. Export fewer items.')),120000),combined=signal?AbortSignal.any([signal,timeout.signal]):timeout.signal;
 try{
  const files=Object.create(null),document=body.combined?await require('pdf-lib').PDFDocument.create():null;let bytes=0;
  const items=body.screens?body.screens.map(screen=>({request:screenRequest(body,screen),name:screen.name})):body.selectionIds.map((id,index)=>({request:{...body,separate:false,combined:false,selectionIds:[id]},name:body.selectionNames?.[index]}));
  for(let index=0;index<items.length;index++){
   combined.throwIfAborted();const item=items[index];let image;
   try{image=await render(item.request,{signal:combined});}catch(error){combined.throwIfAborted();throw Error((body.screens?'Screen ':'Layer ')+(index+1)+': '+error.message);}
   bytes+=image.length;if(bytes>128*1024*1024)throw Error('The export exceeds 128 MiB. Export fewer items or use a smaller scale.');
   combined.throwIfAborted();
   if(document){
    const source=await require('pdf-lib').PDFDocument.load(image);combined.throwIfAborted();
    if(source.getPageCount()!==1)throw Error('Each exported item must contain exactly one PDF page.');
    const [page]=await document.copyPages(source,[0]);combined.throwIfAborted();document.addPage(page);require('./screen-export-pdf-links.cjs').rebindLocalLinks(source.getPage(0),page);continue;
   }
   const name=Array.from((item.name||(body.screens?'screen':'layer')).normalize('NFC').replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/^-+|-+$/g,'')).slice(0,80).join('')||'layer';
   const filename=String(index+1).padStart(2,'0')+'-'+name+(body.area==='page'?'-full-page':'')+'@'+body.scale+'x.'+(body.format==='pdf'?'pdf':body.format==='jpeg'?'jpg':'png');files[filename]=image;
  }
  combined.throwIfAborted();
  if(document){
   document.setTitle(body.screens?'Retouch screens':body.title||'Retouch layers');document.setCreator('Retouch');
   const result=Buffer.from(await document.save());combined.throwIfAborted();if(result.length>128*1024*1024)throw Error('The PDF exceeds 128 MiB. Export fewer items or use a smaller scale.');return result;
  }
  return Buffer.from(zipSync(files,{level:0}));
 }finally{clearTimeout(timer);}
}
module.exports={renderBatch,screenRequest};
