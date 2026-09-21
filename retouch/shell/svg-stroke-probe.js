(function(root){
 'use strict';
 // This synchronous probe retains the actual original element and restores it
 // in finally. MutationObserver records still exist: callers must not mistake
 // exact DOM restoration for absence of observable mutations.
 function style(el,pseudo){const css=el.ownerDocument.defaultView.getComputedStyle(el,pseudo);return [...css].map(name=>name+':'+css.getPropertyValue(name)).join(';');}
 function selectors(tree){
  const found=new Set(),seen=new Set(),window=(tree.ownerDocument||tree).defaultView;
  const rules=list=>{for(const rule of list){if(rule.media?.mediaText&&!window.matchMedia(rule.media.mediaText).matches)continue;if(rule.selectorText){if(rule.parentRule?.selectorText)throw Error('Nested selectors need a scoped CSS proof.');found.add(rule.selectorText);}if(rule.styleSheet)sheet(rule.styleSheet);else if(rule.cssRules)rules(rule.cssRules);}};
  const sheet=value=>{if(!value||value.disabled||seen.has(value)||value.media?.mediaText&&!window.matchMedia(value.media.mediaText).matches)return;seen.add(value);try{rules(value.cssRules);}catch{throw Error('Page CSS cannot be fully inspected before wrapping this stroke.');}};
  for(const value of [...(tree.styleSheets||[]),...(tree.adoptedStyleSheets||[]),...[...tree.querySelectorAll('style,link[rel=stylesheet]')].map(el=>el.sheet)])sheet(value);
  return [...found];
 }
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
  // Inspect all current elements in this DOM root, including ancestor/sibling
  // rules such as body:has(...). Separate shadow/iframe roots need their own
  // proof before creation can become a general public operation.
  const rules=selectors(tree),surroundings=[...tree.querySelectorAll('*')].filter(node=>node!==el&&!el.contains(node)).map(node=>state(node,rules));
  try{
   parent.insertBefore(group,el);original.append(el);
   root.RetouchSVGStrokeFidelity.check(group,model,id);
   if(surroundings.some(before=>!unchanged(before,rules)))throw Error('Wrapping this stroke changes another element through page CSS or layout.');
   return {model,definitionId:id};
  }finally{
   if(el.parentElement===original)parent.insertBefore(el,group);
   group.remove();
  }
 }
 const api={prepare,selectors,state,equivalent};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGStrokeProbe=api;
})(typeof window==='object'?window:globalThis);
