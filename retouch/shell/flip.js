(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchFlip=api;})(typeof window==='object'?window:globalThis,function(root){
 function parse(value){
  if(value==='none')return [1,1];
  if(typeof value!=='string')return null;
  const parts=value.trim().split(/\s+/);if(parts.length<1||parts.length>3)return null;
  if(parts.some(part=>!/^[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?%?$/i.test(part)))return null;
  const values=parts.map(part=>parseFloat(part)/(part.endsWith('%')?100:1));if(values.some(value=>!Number.isFinite(value)||Math.abs(value)>10000))return null;
  if(values.length===1)values.push(values[0]);return values;
 }
 function flip(value,axis){const values=parse(value);if(!values||!['x','y'].includes(axis))return null;values[axis==='x'?0:1]*=-1;return values.map(value=>Object.is(value,-0)?'0':String(value)).join(' ');}
 const token=word=>/^-?scale-(?:(?:x|y|z)-)?(?:\d+(?:\.\d+)?|\[[^\]]+\]|\([^)]*\)|none|3d)$|^\[scale:.+\]$/.test(word);
 function mount(el,save){
  const group=document.createElement('div');group.className='flip-controls';group.setAttribute('role','group');group.setAttribute('aria-label','Flip layer');
  for(const [axis,label,path]of [['x','Flip horizontally','M10 2v16 M7 5v10L2 10Z M13 5v10l5-5Z'],['y','Flip vertically','M2 10h16 M5 7h10l-5-5Z M5 13h10l-5 5Z']]){
   const button=document.createElement('button');button.type='button';button.className='control-button flip-action';button.dataset.flipAxis=axis;button.setAttribute('aria-keyshortcuts','Shift+'+(axis==='x'?'H':'V'));button.setAttribute('aria-label',label);button.title=label+' around the layer’s transform origin';button.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="'+path+'"/></svg>';
   const next=()=>el.isConnected&&el.style.getPropertyPriority('scale')!=='important'?flip(el.ownerDocument.defaultView.getComputedStyle(el).scale,axis):null;
   button.disabled=next()===null;if(button.disabled)button.title='Edit this layer’s important inline or unsupported scale in source first.';
   button.onclick=()=>{const value=next();if(value!==null){root.RetouchPanelFocus?.queue(button);save(value);}};group.append(button);
  }
  return group;
 }
 function selectionPlan(measured,axis){
  if(!['x','y'].includes(axis)||measured.length<2)throw Error('Choose at least two layers to reflect.');
  const horizontal=axis==='x',edge=horizontal?'left':'top',size=horizontal?'width':'height',start=Math.min(...measured.map(item=>item.rect[edge])),end=Math.max(...measured.map(item=>item.rect[edge]+item.rect[size]));
  const I=root.RetouchInspector||require('./inspector.js');
  return measured.map(({geometry:g,rect,scale,origin})=>{
   const nextScale=flip(scale,axis),values=parse(nextScale);if(!values||values.length!==2)throw Error('Selection reflection needs a two-dimensional scale.');
   const target={left:rect.left,top:rect.top};target[edge]=start+end-rect[edge]-rect[size];
   const layout=I.rotationLayoutRect(target,g.width,g.height,-g.rotation,origin,values),next={...g,x:g.x+layout.left-g.layoutLeft,y:g.y+layout.top-g.layoutTop,rotation:-g.rotation};
   if(!['x','y','width','height','rotation'].every(key=>Number.isFinite(next[key])&&Math.abs(next[key])<=100000))throw Error('Keep layer bounds within 100,000 pixels.');
   return {geometry:next,scale:nextScale};
  });
 }
 function mountSelection(infos,elements,width,save,strategy=null){
  const I=root.RetouchInspector,P=root.RetouchHTMLPosition,section=I.section('Flip selection');
  function measure(){
   strategy?.validate();
   if(!Number.isInteger(width)||elements.some(el=>!el?.isConnected)||infos.some(info=>info.cssReason))throw Error('Re-select the layers and choose a pixel screen scope.');
   if(width>elements[0].ownerDocument.defaultView.innerWidth)throw Error('Choose a screen where this style scope is active.');
   return elements.map(el=>{
    const css=el.ownerDocument.defaultView.getComputedStyle(el);
    if(el.namespaceURI!=='http://www.w3.org/1999/xhtml'||elements.some(other=>other!==el&&other.contains(el))||css.position!=='absolute'||css.visibility!=='visible'||!el.getClientRects().length)throw Error('Choose separate, visible absolute layers to reflect the selection.');
    if(['scale','rotate'].some(property=>el.style.getPropertyPriority(property)==='important'))throw Error('Edit important inline scale or rotation in source first.');
    for(let ancestor=el;ancestor;ancestor=ancestor.parentElement){const style=el.ownerDocument.defaultView.getComputedStyle(ancestor);if(ancestor.namespaceURI!=='http://www.w3.org/1999/xhtml'||style.perspective!=='none'||style.offsetPath&&style.offsetPath!=='none'||ancestor===el&&style.transformBox==='content-box')throw Error('Selection reflection for SVG, perspective, motion paths or content-box transforms is not available yet.');}
    const geometry=I.geometry(el,{allowRotation:true,allowScale:true}),origin=css.transformOrigin.split(/\s+/).slice(0,2).map(parseFloat);
    return {geometry,rect:el.getBoundingClientRect(),scale:css.scale||'none',origin};
   });
  }
  const group=mount(elements[0],()=>{});group.setAttribute('aria-label','Flip selection');section.append(group);
  for(const button of group.querySelectorAll('button')){
   const axis=button.dataset.flipAxis;button.title='Reflect all layers across the selection '+(axis==='x'?'horizontal':'vertical')+' center';
   try{selectionPlan(measure(),axis);button.disabled=false;}catch(error){button.disabled=true;button.title=error.message;}
   button.onclick=()=>{try{
    const planned=selectionPlan(measure(),axis);root.RetouchPanelFocus?.queue(button);
    if(strategy)return strategy.flip(planned);
    return save(Object.fromEntries(infos.map((info,i)=>{
     const el=elements[i],css=el.ownerDocument.defaultView.getComputedStyle(el),effective=Object.entries(info.cssRules||{}).filter(([w])=>Number(w)<=el.ownerDocument.defaultView.innerWidth).sort(([a],[b])=>Number(a)-Number(b)).reduce((all,[,values])=>Object.assign(all,values),{}),next=planned[i];
     return [info.id,{...root.RetouchSelectionLayout.preserveBox(P.placement(next.geometry,effective),next.geometry,css),scale:next.scale,rotate:next.geometry.rotation+'deg'}];
    })),width);
   }catch(error){I.note(section,error.message,'refused');}};
  }
  return section;
 }
 return {parse,flip,token,mount,selectionPlan,mountSelection};
});
