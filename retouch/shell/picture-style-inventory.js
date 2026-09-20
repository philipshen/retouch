(function(root){
 'use strict';
 function collect(doc=globalThis.document){
  doc=doc?.ownerDocument||doc;
  const sheets=[],issues=[];let size=0;
  if(!doc?.documentElement)return {sheets,issues:['The preview document is unavailable.']};
  if(doc.adoptedStyleSheets?.length)issues.push('Constructed stylesheets need source mapping.');
  const nodes=[...doc.querySelectorAll('style,link[rel~="stylesheet"]')];
  if(nodes.length>256)return {sheets,issues:['The preview has too many stylesheets.']};
  for(const node of nodes){
   if(node.tagName!=='STYLE'){issues.push('Document-linked stylesheets need source mapping.');continue;}
   const vite=node.getAttribute('data-vite-dev-id'),managed=node.getAttribute('data-rt-svelte-css');
   if(!vite&&!managed){issues.push('An inline or injected stylesheet needs source mapping.');continue;}
   const text=node.textContent||'';size+=text.length;if(text.length>2*1024*1024||size>20*1024*1024){issues.push('The preview stylesheets are too large.');break;}
   try{
    const fresh=doc.implementation.createHTMLDocument(''),copy=fresh.createElement('style');copy.textContent=text;fresh.head.append(copy);
    const rules=sheet=>JSON.stringify([...sheet.cssRules].map(rule=>rule.cssText));
    if(rules(copy.sheet)!==rules(node.sheet))throw Error('Changed rules');
   }catch{issues.push('A stylesheet has runtime rule changes or cannot be inspected.');continue;}
   sheets.push({kind:vite?'vite':'managed',id:vite||managed,text});
  }
  for(const sheet of doc.styleSheets)if(!sheet.ownerNode||!nodes.includes(sheet.ownerNode))issues.push('A stylesheet has no mapped document owner.');
  return {sheets,issues};
 }
 async function snapshot(doc){const inventory=collect(doc);return {...inventory,sheets:await Promise.all(inventory.sheets.map(async({kind,id,text})=>{const bytes=new TextEncoder().encode(text),digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);return {kind,id,hash:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')};}))};}
 const api={collect,snapshot};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPictureStyleInventory=api;
})(typeof globalThis==='object'?globalThis:this);
