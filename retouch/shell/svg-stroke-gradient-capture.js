(function(root){
 'use strict';
 const coordinates={linearGradient:['x1','y1','x2','y2'],radialGradient:['cx','cy','r','fx','fy','fr']},common=['gradientUnits','gradientTransform','spreadMethod'];
 function reference(document,value){
  let url;try{url=new URL(value,document.baseURI);}catch{throw Error('Resolve the gradient reference before aligning the stroke.');}
  if(!url.hash||url.href.split('#')[0]!==document.URL.split('#')[0])throw Error('External gradient resources need a local definition before alignment.');
  let id;try{id=decodeURIComponent(url.hash.slice(1));}catch{throw Error('Resolve the gradient identity.');}
  const nodes=[...document.querySelectorAll('[id]')].filter(node=>node.id===id);
  if(nodes.length!==1||!coordinates[nodes[0].localName]||nodes[0].namespaceURI!=='http://www.w3.org/2000/svg')throw Error('Choose one local linear or radial gradient definition.');return nodes[0];
 }
 function styledTransform(node){
  const changes=style=>['transform','transform-origin','transform-box'].some(name=>style?.getPropertyValue(name));
  if(changes(node.style))return true;
  const inspect=rules=>{for(const rule of rules){if(changes(rule.style)){let matches=true;try{matches=node.matches(rule.selectorText);}catch{}if(matches)return true;}if(rule.cssRules&&inspect(rule.cssRules))return true;}return false;};
  try{return [...node.ownerDocument.styleSheets,...(node.ownerDocument.adoptedStyleSheets||[])].some(sheet=>inspect(sheet.cssRules));}catch{throw Error('Gradient styles cannot be fully inspected.');}
 }
 function capture(el,value){
  const match=/^url\(["']?([^"')]+)["']?\)(?:\s+.*)?$/.exec(value);if(!match)return null;
  const d=el.ownerDocument,w=d.defaultView,first=reference(d,match[1]),chain=[],fields={};let node=first,stops;
  while(node){
   if(styledTransform(node))throw Error('Resolve CSS gradient transforms before alignment.');
   if(chain.includes(node)||chain.length>=32)throw Error('Resolve the cyclic or deeply nested gradient template.');chain.push(node);
   if(node.getAnimations?.({subtree:true}).some(animation=>animation.playState!=='finished')||node.querySelector('animate,animateTransform,animateMotion,set'))throw Error('Pause gradient animations before aligning the stroke.');
   if([...node.children].some(child=>!['stop','title','desc','metadata'].includes(child.localName)))throw Error('Resolve unsupported gradient content before alignment.');
   for(const name of [...common,...(node.localName===first.localName?coordinates[first.localName]:[])])if(fields[name]===undefined&&node.hasAttribute(name))fields[name]=node.getAttribute(name);
   if(!stops&&node.querySelector(':scope > stop')){stops=[...node.children].filter(child=>child.localName==='stop');
    const actual=w.getComputedStyle(node),host=w.getComputedStyle(first);if(node!==first&&['color','stop-color','stop-opacity','color-interpolation'].some(name=>actual.getPropertyValue(name)!==host.getPropertyValue(name)))throw Error('Resolve differing gradient-template styles before alignment.');
   }
   const href=node.getAttribute('href')??node.getAttributeNS('http://www.w3.org/1999/xlink','href');node=href?reference(d,href):null;
  }
  if(!stops?.length)throw Error('Choose a gradient with color stops.');
  const css=w.getComputedStyle(first),interpolation=css.getPropertyValue('color-interpolation').trim();if(interpolation)fields['color-interpolation']=interpolation;
  const transform=root.RetouchSVGAffine.parse(fields.gradientTransform||''),computed=css.getPropertyValue('transform').trim();if(!transform)throw Error('Resolve the gradient transform.');
  if(computed&&computed!=='none'&&!root.RetouchSVGAffine.equivalent(root.RetouchSVGAffine.parse(computed),transform))throw Error('Page CSS changes the gradient transform.');
  const values=stops.map(stop=>{const css=w.getComputedStyle(stop),opacity=css.stopOpacity.trim();return {offset:String(Math.max(0,Math.min(1,stop.offset.baseVal))),color:css.stopColor,opacity};});
  if(values.length===1)values.push({...values[0],offset:'1'});
  return root.RetouchSVGStrokeGradient.normalize({type:first.localName,fields,stops:values});
 }
 const api={capture};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGStrokeGradientCapture=api;
})(typeof window==='object'?window:globalThis);
