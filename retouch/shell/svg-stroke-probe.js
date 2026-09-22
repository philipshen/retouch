(function(root){
 'use strict';
 // This synchronous probe retains the actual original element and restores it
 // in finally. MutationObserver records still exist: callers must not mistake
 // exact DOM restoration for absence of observable mutations.
 function style(el,pseudo){const css=el.ownerDocument.defaultView.getComputedStyle(el,pseudo);return [...css].map(name=>name+':'+css.getPropertyValue(name)).join(';');}
 // Resolve CSSOM nesting for Element.matches without touching authored rules.
 // Each selector-list branch inherits the complete parent list through :is().
 function resolveSelector(selector,parent){
  if(selector.length>65536||parent?.length>65536)throw Error('A nested selector is too large.');
  const subject=parent?':is('+parent+')':':where(:scope)',result=[];let entry='',explicit=false,quote='',brackets=0,parens=0;
  const finish=()=>{result.push(parent&&!explicit?subject+' '+entry.trim():entry.trim());entry='';explicit=false;};
  for(let i=0;i<selector.length;i++){
   const char=selector[i];
   if(char==='\\'){entry+=char+(selector[++i]||'');continue;}
   if(quote){entry+=char;if(char===quote)quote='';continue;}
   if(char==='"'||char==="'"){quote=char;entry+=char;continue;}
   if(char==='/'&&selector[i+1]==='*'){const end=selector.indexOf('*/',i+2);if(end<0)throw Error('An incomplete selector cannot be inspected.');entry+=selector.slice(i,end+2);i=end+1;continue;}
   if(char==='[')brackets++;if(char===']')brackets--;
   if(!brackets){if(char==='(')parens++;if(char===')')parens--;if(char==='&'){entry+=subject;if(entry.length>65536)throw Error('A nested selector is too large.');explicit=true;continue;}if(char===','&&!parens){finish();continue;}}
   entry+=char;if(entry.length>65536)throw Error('A nested selector is too large.');
  }
  finish();const joined=result.join(', ');if(joined.length>65536)throw Error('A nested selector is too large.');return joined;
 }
 function selectors(tree){
  const found=new Set(),seen=new Set(),window=(tree.ownerDocument||tree).defaultView;
  const rules=(list,parent=null,depth=0)=>{if(depth>64)throw Error('The stylesheet nesting is too deep.');for(const rule of list){if(rule.media?.mediaText&&!window.matchMedia(rule.media.mediaText).matches)continue;const selector=rule.selectorText?resolveSelector(rule.selectorText,parent):parent;if(rule.selectorText)found.add(selector);if(rule.styleSheet)sheet(rule.styleSheet);else if(rule.cssRules)rules(rule.cssRules,selector,depth+1);}};
  const sheet=value=>{if(!value||value.disabled||seen.has(value)||value.media?.mediaText&&!window.matchMedia(value.media.mediaText).matches)return;seen.add(value);try{rules(value.cssRules);}catch{throw Error('Page CSS cannot be fully inspected before wrapping this stroke.');}};
  for(const value of [...(tree.styleSheets||[]),...(tree.adoptedStyleSheets||[]),...[...tree.querySelectorAll('style,link[rel=stylesheet]')].map(el=>el.sheet)])sheet(value);
  return [...found];
 }
 function roots(tree){const result=[tree];for(const node of tree.querySelectorAll('*'))if(node.shadowRoot)result.push(...roots(node.shadowRoot));return result;}
 function matches(el,selectors){try{return selectors.map(selector=>el.matches(selector)?'1':'0').join('');}catch{throw Error('A page CSS selector cannot be inspected before wrapping this stroke.');}}
 function state(el,selectors){const box=el.getBoundingClientRect();return {el,matches:matches(el,selectors),css:style(el),before:style(el,'::before'),after:style(el,'::after'),box:[box.x,box.y,box.width,box.height]};}
 function equivalent(before,next){return ['matches','css','before','after'].every(key=>before[key]===next[key])&&before.box.every((value,i)=>Math.abs(value-next.box[i])<.01);}
 function unchanged(before,selectors){return before.el.isConnected&&equivalent(before,state(before.el,selectors));}
 function prepare(el,candidate,position,id){
  if(typeof id!=='string'||!/^rt-stroke-[a-f0-9]{16}$/.test(id))throw Error('Choose a valid stroke definition identity.');
  const tree=el.getRootNode();if(tree.querySelector('[id="'+id+'"],[data-rt-stroke-id="'+id+'"]'))throw Error('Choose an unused stroke definition identity.');
  const captured=root.RetouchSVGStrokeSnapshot.capture(el,candidate),document=root.RetouchSVGPath.parseCompound(captured.path),model=root.RetouchSVGStrokeAlignment.normalize({...captured,document,position});
  const parent=el.parentElement,d=el.ownerDocument,create=name=>d.createElementNS(el.namespaceURI,name),group=create('g'),original=create('g');
  group.setAttribute('data-rt-stroke-alignment','1');group.setAttribute('data-rt-stroke-id',id);original.setAttribute('data-rt-stroke-original','');original.setAttribute('display','none');group.innerHTML=root.RetouchSVGStrokeAlignment.render({...model,document},id);group.prepend(original);
  // Inspect surrounding elements and open shadow trees, including ancestor
  // and sibling effects such as body:has(...) and ::part styling. Closed roots
  // and nested documents still require separate fidelity proof.
  const surroundings=roots(tree).flatMap(branch=>{const rules=selectors(branch);return [...branch.querySelectorAll('*')].filter(node=>node!==el&&!el.contains(node)).map(node=>({before:state(node,rules),rules}));});
  try{
   parent.insertBefore(group,el);original.append(el);
   root.RetouchSVGStrokeFidelity.check(group,model,id);
   if(surroundings.some(({before,rules})=>!unchanged(before,rules)))throw Error('Wrapping this stroke changes another element through page CSS or layout.');
   return {model,definitionId:id};
  }finally{
   if(el.parentElement===original)parent.insertBefore(el,group);
   group.remove();
  }
 }
 const api={prepare,selectors,state,equivalent,roots,resolveSelector};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGStrokeProbe=api;
})(typeof window==='object'?window:globalThis);
