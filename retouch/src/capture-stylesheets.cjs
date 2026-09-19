'use strict';
// Keep the exact stylesheet responses used by the rendering browser. Refetching
// could return different CSS due to redirects, cookies or user-agent negotiation.
function collect(page){
 const sheets=new Map(),pending=new Set();let count=0,bytes=0;
 const response=reply=>{
  if(reply.request().resourceType()!=='stylesheet'||!reply.ok()||count++>=256)return;
  const task=(async()=>{try{
   const declared=Number(reply.headers()['content-length']);if(declared>2*1024*1024)return;
   const body=await reply.body();if(body.length>2*1024*1024||bytes+body.length>20*1024*1024)return;bytes+=body.length;
   const entry={url:reply.url(),css:body.toString('utf8')};sheets.set(reply.url(),entry);
   for(let request=reply.request();request;request=request.redirectedFrom())sheets.set(request.url(),entry);
  }catch{}})();pending.add(task);task.finally(()=>pending.delete(task));
 };
 page.on('response',response);
 async function drain(){let timer;try{await Promise.race([Promise.all([...pending]),new Promise(resolve=>{timer=setTimeout(resolve,5000);})]);}finally{clearTimeout(timer);}}
 return {async resolveStyles(entries){
  await drain();const styleSheets=[],warnings=[];
  let total=0;
  for(const entry of entries||[]){
   if(styleSheets.length>=256){warnings.push('Author stylesheets exceed the capture count limit.');break;}
   const cached=typeof entry.css==='string'?{css:entry.css,url:entry.base}:sheets.get(entry.sheet);
   if(!cached){warnings.push('An author stylesheet was unavailable in the captured responses.');continue;}
   const size=Buffer.byteLength(cached.css);if(size>2*1024*1024||total+size>20*1024*1024){warnings.push('Author stylesheets exceed the capture size limit.');continue;}total+=size;
   styleSheets.push({css:cached.css,media:entry.media,base:cached.url});
  }
  return {styleSheets,warnings,stylesheetCache:[...sheets].map(([url,value])=>({...value,requestURL:url}))};
 },async resolve(fontFaces,context){
  // load has finished by this point; bound draining for failed/streaming CSS.
  let timer;try{await Promise.race([Promise.all([...pending]),new Promise(resolve=>{timer=setTimeout(resolve,5000);})]);}finally{clearTimeout(timer);page.off('response',response);}
  const warnings=new Set(),faces=[];let parser,parsed=0;
  async function read(entry,ancestors=new Set()){
   if(typeof entry.css==='string'){faces.push(entry);return;}
   const cached=sheets.get(entry.sheet);if(!cached){warnings.add('A cross-origin font stylesheet was unavailable in the captured responses.');return;}
   if(ancestors.has(cached.url)){warnings.add('A cyclic font stylesheet import was omitted.');return;}
   if(parsed++>=256){warnings.add('Some font stylesheet imports exceed the capture limit.');return;}
   const chain=new Set(ancestors);chain.add(cached.url);
   try{
    if(!parser){parser=await context.newPage();await parser.route('**/*',route=>route.abort());}
    const entries=await parser.evaluate(({css,url})=>{
     const base=document.createElement('base'),style=document.createElement('style');base.href=url;style.textContent=css;document.head.replaceChildren(base,style);const entries=[];
     function scan(rules){for(const rule of rules){
      if(rule.type===CSSRule.FONT_FACE_RULE)entries.push({css:rule.cssText,base:url});
      else if(rule.type===CSSRule.IMPORT_RULE){if(rule.media.mediaText&&!matchMedia(rule.media.mediaText).matches||rule.supportsText&&!CSS.supports(rule.supportsText))continue;entries.push({sheet:new URL(rule.href,url).href});}
      else if(rule.cssRules){if(rule.type===CSSRule.MEDIA_RULE&&!matchMedia(rule.conditionText).matches)continue;if(rule.type===CSSRule.SUPPORTS_RULE&&!CSS.supports(rule.conditionText))continue;scan(rule.cssRules);}
     }}scan(style.sheet.cssRules);return entries;
    },cached);
    for(const child of entries)await read(child,chain);
   }catch{warnings.add('A captured font stylesheet could not be parsed.');}
  }
  try{for(const entry of fontFaces||[])await read(entry);return {fontFaces:faces,warnings:[...warnings]};}finally{await parser?.close();}
 },stop(){page.off('response',response);}};
}
module.exports={collect};
