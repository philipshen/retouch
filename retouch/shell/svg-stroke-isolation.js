(function(root){
 'use strict';
 function sheetText(sheet,seen=new Set()){
  if(seen.has(sheet)||sheet.disabled)return '';seen.add(sheet);let text;
  try{text=[...sheet.cssRules].map(rule=>rule.styleSheet?sheetText(rule.styleSheet,seen):rule.cssText).join('\n');}catch{throw Error('Page CSS cannot be copied into an isolated stroke preview.');}
  return sheet.media?.mediaText?'@media '+sheet.media.mediaText+'{'+text+'}':text;
 }
 function formState(el){return ['input','textarea','select','option'].includes(el.localName)?JSON.stringify([el.value,el.checked,el.selected,el.selectedIndex]):null;}
 function textBoxes(document){const result=[],walker=document.createTreeWalker(document.documentElement,4);let node;while((node=walker.nextNode()))if(node.textContent.trim()){const range=document.createRange();range.selectNodeContents(node);result.push({node,text:node.textContent,boxes:[...range.getClientRects()].map(box=>[box.x,box.y,box.width,box.height])});}return result;}
 function sameBoxes(a,b){return a.length===b.length&&a.every((box,i)=>box.every((value,j)=>Math.abs(value-b[i][j])<.01));}
 async function prepare(el,candidate,position,id){
  const original=el?.ownerDocument,P=root.RetouchSVGStrokeProbe;
  if(!original||original===root.document||el.getRootNode()!==original)throw Error('Choose a shape in a separate preview document.');
  const captured=root.RetouchSVGStrokeSnapshot.capture(el,candidate),elements=[...original.querySelectorAll('*')];
  if(elements.some(node=>node.shadowRoot||node.localName==='iframe'||node.localName==='frame'||node.namespaceURI==='http://www.w3.org/1999/xhtml'&&(node.localName.includes('-')||node.hasAttribute('is'))))throw Error('Nested documents and custom/shadow content need a separate isolated preview proof.');
  if(original.getAnimations?.().some(animation=>animation.playState!=='finished'))throw Error('Pause page animations before making an isolated stroke preview.');
  const rules=P.selectors(original),baseline=elements.map(node=>P.state(node,rules)),forms=elements.map(formState),text=textBoxes(original),markup=original.documentElement.outerHTML;
  const sheets=[...original.styleSheets,...(original.adoptedStyleSheets||[])].map(sheet=>sheetText(sheet)),viewport=[original.defaultView.innerWidth,original.defaultView.innerHeight,original.defaultView.devicePixelRatio];
  const frame=root.document.createElement('iframe');frame.setAttribute('sandbox','allow-same-origin');frame.setAttribute('aria-hidden','true');frame.setAttribute('data-rt-stroke-isolation','');frame.tabIndex=-1;
  frame.style.cssText='all:initial!important;position:fixed!important;left:-100000px!important;top:0!important;display:block!important;border:0!important;opacity:0!important;pointer-events:none!important;width:'+original.defaultView.innerWidth+'px!important;height:'+original.defaultView.innerHeight+'px!important;';
  let loadTimer;
  try{
   await new Promise((resolve,reject)=>{const timer=loadTimer=root.setTimeout(()=>reject(Error('The isolated stroke preview did not load.')),10000);frame.onload=()=>{root.clearTimeout(timer);resolve();};frame.onerror=()=>{root.clearTimeout(timer);reject(Error('The isolated stroke preview could not load.'));};frame.src='about:blank';root.document.body.append(frame);});
   frame.onload=frame.onerror=null;
   const d=frame.contentDocument;d.open();d.write((original.compatMode==='CSS1Compat'?'<!doctype html>':'')+'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; form-action \'none\'">');d.close();
   const copy=d.importNode(original.documentElement,true),clones=[copy,...copy.querySelectorAll('*')];
   if(clones.length!==elements.length)throw Error('The page structure changed during preview creation.');
   for(const node of clones){node.removeAttribute('autofocus');if(node.localName==='meta'&&/^(refresh|content-security-policy)$/i.test(node.getAttribute('http-equiv')||''))node.removeAttribute('http-equiv');}
   d.replaceChild(copy,d.documentElement);
   for(const sheet of [...d.styleSheets])sheet.disabled=true;
   for(const css of sheets){const style=d.createElement('style');style.textContent=css;d.head.append(style);}
   elements.forEach((node,i)=>{const clone=clones[i];if(['input','textarea','select'].includes(node.localName))clone.value=node.value;if(node.localName==='input')clone.checked=node.checked;if(node.localName==='option')clone.selected=node.selected;clone.scrollLeft=node.scrollLeft;clone.scrollTop=node.scrollTop;});
   d.defaultView.scrollTo(original.defaultView.scrollX,original.defaultView.scrollY);
   await d.fonts?.ready;
   for(let i=0;i<elements.length;i++){
    const actual=P.state(clones[i],rules);if(!P.equivalent(baseline[i],actual)||formState(clones[i])!==forms[i]){
     let reason=['matches','css','before','after'].find(key=>baseline[i][key]!==actual[key])||'bounds or form state';
     if(['css','before','after'].includes(reason)){const parts=baseline[i][reason].split(';'),other=actual[reason].split(';');const at=parts.findIndex((value,index)=>value!==other[index]);reason+=' '+(parts[at]||'').split(':')[0];}
     throw Error('The isolated preview does not match the page '+elements[i].localName+' '+reason+'.');
    }
   }
   // Compare the copied original text nodes; added stylesheet text is not page
   // content and has no rendered range boxes.
   const cloneText=textBoxes(d).filter(item=>item.boxes.length),originalText=text.filter(item=>item.boxes.length);
   if(cloneText.length!==originalText.length||cloneText.some((item,i)=>item.text!==originalText[i].text||!sameBoxes(item.boxes,originalText[i].boxes)))throw Error('The isolated preview does not match the page text layout.');
   const target=clones[elements.indexOf(el)],snapshot=root.RetouchSVGStrokeSnapshot.capture(target,candidate);
   if(JSON.stringify(snapshot)!==JSON.stringify(captured))throw Error('The isolated preview changes the selected stroke.');
   const result=P.prepare(target,candidate,position,id);
   const finalText=textBoxes(original),currentSheets=[...original.styleSheets,...(original.adoptedStyleSheets||[])].map(sheet=>sheetText(sheet));
   if(!el.isConnected||original.documentElement.outerHTML!==markup||JSON.stringify(sheets)!==JSON.stringify(currentSheets)||viewport.some((value,i)=>value!==[original.defaultView.innerWidth,original.defaultView.innerHeight,original.defaultView.devicePixelRatio][i])||finalText.length!==text.length||finalText.some((item,i)=>item.node!==text[i].node||item.text!==text[i].text||!sameBoxes(item.boxes,text[i].boxes))||original.getAnimations?.().some(animation=>animation.playState!=='finished')||elements.some((node,i)=>!node.isConnected||!P.equivalent(baseline[i],P.state(node,rules))||formState(node)!==forms[i]))throw Error('The page changed while checking the isolated stroke preview.');
   return {...result,isolated:true};
  }finally{root.clearTimeout(loadTimer);frame.onload=frame.onerror=null;frame.remove();}
 }
 const api={prepare};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGStrokeIsolation=api;
})(typeof window==='object'?window:globalThis);
