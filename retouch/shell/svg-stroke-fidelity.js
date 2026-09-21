(function(root){
 'use strict';
 const base=['display','visibility','opacity','filter','mask-image','mask-mode','clip-path','mix-blend-mode','isolation','overflow'];
 const transforms=['transform','transform-origin','transform-box','translate','rotate','scale'];
 const stroke=['stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','vector-effect'];
 const coordinates={path:['d'],rect:['x','y','width','height','rx','ry']};
 const matrix=value=>value&&[value.a,value.b,value.c,value.d,value.e,value.f];
 function model(input){return root.RetouchSVGStrokeAlignment.normalize({...input,document:input.document||root.RetouchSVGPath.parseCompound(input.path)});}
 function relative(el,parent){
  const a=el.getScreenCTM?.(),b=parent.getScreenCTM?.();
  if(!a||!b||a.is2D===false||b.is2D===false)throw Error('The stroke has no measurable two-dimensional transform.');
  let result;try{result=matrix(b.inverse().multiply(a));}catch{throw Error('The stroke parent transform cannot be measured.');}
  if(!root.RetouchSVGAffine.valid(result))throw Error('The stroke parent transform cannot be measured.');return result;
 }
 function value(css,property,el){
  const raw=css.getPropertyValue(property).trim();
  if(!['mask-image','clip-path'].includes(property)||!raw.startsWith('url('))return raw;
  const match=/^url\(["']?([^"')]+)["']?\)$/.exec(raw);if(!match)throw Error('Resolve the stroke clipping reference.');
  const url=new URL(match[1],el.baseURI),documentURL=new URL(el.ownerDocument.URL);
  if(url.href.split('#')[0]!==documentURL.href.split('#')[0])throw Error('The stroke uses an external clipping reference.');
  return 'url('+url.hash+')';
 }
 // Reference nodes live in the editor document, inside a shadow root. No
 // reference styles, IDs or probe nodes are inserted into the authored page.
 function check(group,input,id){
  if(!group?.isConnected||group.localName!=='g'||group.namespaceURI!=='http://www.w3.org/2000/svg')throw Error('Select a connected SVG stroke.');
  if(typeof id!=='string'||!/^rt-stroke-[a-f0-9]{16}$/.test(id))throw Error('Re-select a stroke with a valid definition identity.');
  const m=model(input),tree=group.getRootNode(),original=group.children[0],rendered=group.children[1],d=group.ownerDocument,w=d.defaultView;
  if(root.document===d)throw Error('Check the preview from a separate editor document.');
  if(group.children.length!==2||original?.localName!=='g'||!original.hasAttribute('data-rt-stroke-original')||rendered?.localName!=='g'||group.getAttribute('data-rt-stroke-id')!==id||tree.querySelectorAll('[data-rt-stroke-id="'+id+'"]').length!==1)throw Error('Re-select one unchanged stroke rendered once on this page.');
  if(w.getComputedStyle(original).display!=='none')throw Error('Page CSS reveals the retained original shape.');
  if(group.getAnimations?.({subtree:true}).some(animation=>animation.playState!=='finished')||group.querySelector('animate,animateTransform,animateMotion,set'))throw Error('Pause or remove the stroke animation before editing alignment.');
  const definitions=[...tree.querySelectorAll('[id="'+id+'"]')];
  if(m.position==='center'?definitions.length!==0:definitions.length!==1||!rendered.contains(definitions[0]))throw Error('The stroke definition identity is duplicated or belongs to another shape.');
  const host=root.document.createElement('div');
  host.style.cssText='all:initial!important;position:fixed!important;left:-100000px!important;top:0!important;display:block!important;opacity:0!important;pointer-events:none!important;';
  host.setAttribute('aria-hidden','true');host.setAttribute('data-rt-stroke-reference','');
  try{
   const shadow=host.attachShadow({mode:'closed'}),svg=root.document.createElementNS(group.namespaceURI,'svg'),expected=root.document.createElementNS(group.namespaceURI,'g');
   svg.style.cssText='all:initial!important;display:block!important;';svg.setAttribute('width','100');svg.setAttribute('height','100');svg.setAttribute('viewBox','0 0 100 100');
   expected.innerHTML=root.RetouchSVGStrokeAlignment.render({...m,document:root.RetouchSVGPath.parseCompound(m.path)},id);svg.append(expected);shadow.append(svg);root.document.body.append(host);
   const reference=expected.firstElementChild,actualNodes=[group,rendered,...rendered.querySelectorAll('*')],expectedNodes=[expected,reference,...reference.querySelectorAll('*')];
   if(actualNodes.length!==expectedNodes.length||actualNodes.some((el,i)=>el.localName!==expectedNodes[i].localName))throw Error('The generated stroke structure changed. Re-select the vector.');
   for(let i=0;i<actualNodes.length;i++){
    const actual=actualNodes[i],ref=expectedNodes[i],css=w.getComputedStyle(actual),wanted=root.getComputedStyle(ref),properties=[...base];
    if(i>0)for(const attribute of ref.attributes)if(actual.getAttribute(attribute.name)!==attribute.value)throw Error('A generated stroke attribute changed: '+attribute.name+'. Re-select the vector.');
    if(actual.localName==='path'&&actual.getAttribute('pathLength')!==ref.getAttribute('pathLength'))throw Error('A generated stroke attribute changed: pathLength. Re-select the vector.');
    if(actual.localName==='mask')properties.push('mask-type');
    if(i>1)properties.push(...transforms);
    if(coordinates[actual.localName]){
     properties.push(...coordinates[actual.localName],'clip-rule','marker-start','marker-mid','marker-end');
     // clipPath uses geometry; its children's fill/stroke colors do not paint.
     if(!ref.closest('clipPath')){
      properties.push('fill','stroke');
      if(wanted.fill!=='none')properties.push('fill-opacity','fill-rule');
      if(wanted.stroke!=='none')properties.push(...stroke);
     }
    }
    for(const property of properties)if(value(css,property,actual)!==value(wanted,property,ref))throw Error('Page CSS changes the stroke '+property+'. Resolve that override before changing alignment.');
   }
   const A=root.RetouchSVGAffine;
   if(!A.equivalent(relative(group,group.parentElement),A.identity())||!A.equivalent(relative(rendered,group),m.matrix))throw Error('Page CSS changes the stroke coordinate space.');
   for(const path of [...rendered.children].filter(el=>el.localName==='path'))if(!A.equivalent(relative(path,rendered),A.identity()))throw Error('Page CSS transforms a generated stroke path.');
   return true;
  }finally{host.remove();}
 }
 // Scrubbing changes only the generated stroke and mask bounds. Preserve DOM
 // identities and restore only values still owned by this preview.
 function previewWeight(group,input,id){
  check(group,input,id);
  const m=model(input),rendered=group.children[1],parent=group.parentElement,strokePath=[...rendered.children].filter(el=>el.localName==='path').at(-1),changes=[];
  let markup=group.innerHTML,active=true;
  const remember=(el,name)=>{const item={el,name,before:el.getAttribute(name),last:el.getAttribute(name)};changes.push(item);return item;};
  const weight=remember(strokePath,'stroke-width'),bounds=m.position==='outside'?[rendered.querySelector('mask'),rendered.querySelector('mask > rect')].flatMap(el=>Object.keys(m.bounds).map(name=>remember(el,name))):[];
  const current=()=>active&&group.isConnected&&group.parentElement===parent&&group.children[1]===rendered&&group.innerHTML===markup;
  const set=(item,value)=>{item.last=String(value);item.el.setAttribute(item.name,item.last);};
  return {current,update(width){
   if(!current())throw Error('The stroke changed during the weight preview.');
   const next=model({...m,width});set(weight,next.width*(m.position==='center'?1:2));for(const item of bounds)set(item,next.bounds[item.name]);markup=group.innerHTML;
  },restore(){
   if(!active)return;active=false;
   for(const item of changes)if(item.el.getAttribute(item.name)===item.last){if(item.before===null)item.el.removeAttribute(item.name);else item.el.setAttribute(item.name,item.before);}
  }};
 }
 const api={check,previewWeight};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGStrokeFidelity=api;
})(typeof window==='object'?window:globalThis);
