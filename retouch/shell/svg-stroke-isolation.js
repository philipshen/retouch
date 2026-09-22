(function(root){
 'use strict';
 function sheetText(sheet,seen=new Set()){
  if(seen.has(sheet)||sheet.disabled)return '';seen.add(sheet);let text;
  try{text=[...sheet.cssRules].map(rule=>rule.styleSheet?sheetText(rule.styleSheet,seen):rule.cssText).join('\n');}catch{throw Error('Page CSS cannot be copied into an isolated stroke preview.');}
  // CSSOM can serialize pending shorthand substitutions as empty longhands.
  // Keep inline author text when reparsing it produces the current rule list.
  const owner=sheet.ownerNode;
  if(owner?.localName==='style')try{const parsed=new owner.ownerDocument.defaultView.CSSStyleSheet();parsed.replaceSync(owner.textContent);if(JSON.stringify([...parsed.cssRules].map(rule=>rule.cssText))===JSON.stringify([...sheet.cssRules].map(rule=>rule.cssText)))text=owner.textContent;}catch{}
  return sheet.media?.mediaText?'@media '+sheet.media.mediaText+'{'+text+'}':text;
 }
 function formState(el){return ['input','textarea','select','option'].includes(el.localName)?JSON.stringify([el.value,el.checked,el.selected,el.selectedIndex]):null;}
 function textBoxes(tree){const document=tree.ownerDocument||tree,result=[],walker=document.createTreeWalker(tree.documentElement||tree,4);let node;while((node=walker.nextNode()))if(node.textContent.trim()){const range=document.createRange();range.selectNodeContents(node);result.push({node,text:node.textContent,boxes:[...range.getClientRects()].map(box=>[box.x,box.y,box.width,box.height])});}return result;}
 function sheetsOf(tree){return [...new Set([...(tree.styleSheets||[]),...[...tree.querySelectorAll('style,link[rel=stylesheet]')].map(node=>node.sheet).filter(Boolean),...(tree.adoptedStyleSheets||[])])];}
 function branchMarkup(tree){return tree.documentElement?.outerHTML||tree.innerHTML;}
 function animated(branches){return branches.some(tree=>tree.getAnimations?.().some(animation=>animation.playState!=='finished'));}
 function sameBoxes(a,b){return a.length===b.length&&a.every((box,i)=>box.every((value,j)=>Math.abs(value-b[i][j])<.01));}
 async function prepare(el,candidate,position,id){
  const original=el?.ownerDocument,P=root.RetouchSVGStrokeProbe;
  if(!original||original===root.document||el.getRootNode()!==original)throw Error('Choose a shape in a separate preview document.');
  const captured=root.RetouchSVGStrokeSnapshot.capture(el,candidate),branches=P.roots(original),elements=branches.flatMap(tree=>[...tree.querySelectorAll('*')]);
  if(elements.some(node=>node.shadowRoot?.slotAssignment==='manual'||node.localName==='iframe'||node.localName==='frame'||node.namespaceURI==='http://www.w3.org/1999/xhtml'&&(node.hasAttribute('is')||node.localName.includes('-')&&!node.shadowRoot)))throw Error('Nested documents, closed custom content and manual slots need a separate isolated preview proof.');
  if(animated(branches))throw Error('Pause page animations before making an isolated stroke preview.');
  const rules=new Map(branches.map(tree=>[tree,P.selectors(tree)])),baseline=elements.map(node=>P.state(node,rules.get(node.getRootNode()))),forms=elements.map(formState),text=branches.flatMap(textBoxes),markup=branches.map(branchMarkup);
  const sheets=branches.map(tree=>sheetsOf(tree).map(sheet=>sheetText(sheet))),viewport=[original.defaultView.innerWidth,original.defaultView.innerHeight,original.defaultView.devicePixelRatio];
  const frame=root.document.createElement('iframe');frame.setAttribute('sandbox','allow-same-origin');frame.setAttribute('aria-hidden','true');frame.setAttribute('data-rt-stroke-isolation','');frame.tabIndex=-1;
  frame.style.cssText='all:initial!important;position:fixed!important;left:-100000px!important;top:0!important;display:block!important;border:0!important;opacity:0!important;pointer-events:none!important;width:'+original.defaultView.innerWidth+'px!important;height:'+original.defaultView.innerHeight+'px!important;';
  let loadTimer;
  try{
   await new Promise((resolve,reject)=>{const timer=loadTimer=root.setTimeout(()=>reject(Error('The isolated stroke preview did not load.')),10000);frame.onload=()=>{root.clearTimeout(timer);resolve();};frame.onerror=()=>{root.clearTimeout(timer);reject(Error('The isolated stroke preview could not load.'));};frame.src='about:blank';root.document.body.append(frame);});
   frame.onload=frame.onerror=null;
   const d=frame.contentDocument;d.open();d.write((original.compatMode==='CSS1Compat'?'<!doctype html>':'')+'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; form-action \'none\'">');d.close();
   const copy=d.importNode(original.documentElement,true),clones=[copy,...copy.querySelectorAll('*')];
   const cloneBranches=[d];
   for(const branch of branches.slice(1)){const host=clones[elements.indexOf(branch.host)],shadow=host.shadowRoot||host.attachShadow({mode:'open',delegatesFocus:branch.delegatesFocus});shadow.replaceChildren(...[...branch.childNodes].map(node=>d.importNode(node,true)));cloneBranches.push(shadow);clones.push(...shadow.querySelectorAll('*'));}
   if(clones.length!==elements.length)throw Error('The page structure changed during preview creation.');
   for(const node of clones){node.removeAttribute('autofocus');if(node.localName==='meta'&&/^(refresh|content-security-policy)$/i.test(node.getAttribute('http-equiv')||''))node.removeAttribute('http-equiv');}
   d.replaceChild(copy,d.documentElement);
   cloneBranches.forEach((tree,i)=>{for(const sheet of sheetsOf(tree))sheet.disabled=true;for(const css of sheets[i]){const style=d.createElement('style');style.textContent=css;(tree.head||tree).append(style);}});
   elements.forEach((node,i)=>{const clone=clones[i];if(['input','textarea','select'].includes(node.localName))clone.value=node.value;if(node.localName==='input')clone.checked=node.checked;if(node.localName==='option')clone.selected=node.selected;clone.scrollLeft=node.scrollLeft;clone.scrollTop=node.scrollTop;});
   d.defaultView.scrollTo(original.defaultView.scrollX,original.defaultView.scrollY);
   await d.fonts?.ready;
   for(let i=0;i<elements.length;i++){
    const actual=P.state(clones[i],rules.get(elements[i].getRootNode()));if(!P.equivalent(baseline[i],actual)||formState(clones[i])!==forms[i]){
     let reason=['matches','css','before','after'].find(key=>baseline[i][key]!==actual[key])||'bounds or form state';
     if(['css','before','after'].includes(reason)){const parts=baseline[i][reason].split(';'),other=actual[reason].split(';');const at=parts.findIndex((value,index)=>value!==other[index]);reason+=' '+(parts[at]||'').split(':')[0];}
     throw Error('The isolated preview does not match the page '+elements[i].localName+' '+reason+'.');
    }
   }
   // Compare the copied original text nodes; added stylesheet text is not page
   // content and has no rendered range boxes.
   const cloneText=cloneBranches.flatMap(textBoxes).filter(item=>item.boxes.length),originalText=text.filter(item=>item.boxes.length);
   if(cloneText.length!==originalText.length||cloneText.some((item,i)=>item.text!==originalText[i].text||!sameBoxes(item.boxes,originalText[i].boxes)))throw Error('The isolated preview does not match the page text layout.');
   const target=clones[elements.indexOf(el)],snapshot=root.RetouchSVGStrokeSnapshot.capture(target,candidate);
   if(JSON.stringify(snapshot)!==JSON.stringify(captured))throw Error('The isolated preview changes the selected stroke.');
   const result=P.prepare(target,candidate,position,id);
   // Call again immediately before submitting the source operation. This is
   // a synchronous freshness check, not an atomic browser/server transaction.
   const assertCurrent=()=>{
    const finalText=branches.flatMap(textBoxes),currentSheets=branches.map(tree=>sheetsOf(tree).map(sheet=>sheetText(sheet)));const currentBranches=P.roots(original);
    if(original.defaultView.document!==original||!el.isConnected||currentBranches.length!==branches.length||currentBranches.some((tree,i)=>tree!==branches[i]||branchMarkup(tree)!==markup[i])||JSON.stringify(sheets)!==JSON.stringify(currentSheets)||viewport.some((value,i)=>value!==[original.defaultView.innerWidth,original.defaultView.innerHeight,original.defaultView.devicePixelRatio][i])||finalText.length!==text.length||finalText.some((item,i)=>item.node!==text[i].node||item.text!==text[i].text||!sameBoxes(item.boxes,text[i].boxes))||animated(branches)||elements.some((node,i)=>!node.isConnected||!P.equivalent(baseline[i],P.state(node,rules.get(node.getRootNode())))||formState(node)!==forms[i]))throw Error('The page changed while checking the isolated stroke preview.');
    return true;
   };
   assertCurrent();
   return {...result,isolated:true,assertCurrent};
  }finally{root.clearTimeout(loadTimer);frame.onload=frame.onerror=null;frame.remove();}
 }
 const api={prepare};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGStrokeIsolation=api;
})(typeof window==='object'?window:globalThis);
