'use strict';
const {zipSync}=require('fflate');
async function renderBatch(body,{signal,render}){
 const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(Error('Layer export timed out after two minutes. Export fewer layers.')),120000),combined=signal?AbortSignal.any([signal,timeout.signal]):timeout.signal;
 try{
  const files=Object.create(null);let bytes=0;
  for(let index=0;index<body.selectionIds.length;index++){
   combined.throwIfAborted();const id=body.selectionIds[index];let image;
   try{image=await render({...body,separate:false,selectionIds:[id]},{signal:combined});}catch(error){combined.throwIfAborted();throw Error('Layer '+(index+1)+': '+error.message);}
   bytes+=image.length;if(bytes>128*1024*1024)throw Error('The layer archive exceeds 128 MiB. Export fewer layers or use a smaller scale.');
   const name=Array.from((body.selectionNames?.[index]||'layer').normalize('NFC').replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/^-+|-+$/g,'')).slice(0,80).join('')||'layer';
   const filename=String(index+1).padStart(2,'0')+'-'+name+'@'+body.scale+'x.'+(body.format==='jpeg'?'jpg':'png');files[filename]=image;
  }
  combined.throwIfAborted();return Buffer.from(zipSync(files,{level:0}));
 }finally{clearTimeout(timer);}
}
module.exports={renderBatch};
