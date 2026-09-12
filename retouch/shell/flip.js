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
   const next=()=>el.isConnected&&!el.style.getPropertyValue('scale')?flip(el.ownerDocument.defaultView.getComputedStyle(el).scale,axis):null;
   button.disabled=next()===null;if(button.disabled)button.title='Edit this layer’s inline or unsupported scale in source first.';
   button.onclick=()=>{const value=next();if(value!==null){root.RetouchPanelFocus?.queue(button);save(value);}};group.append(button);
  }
  return group;
 }
 return {parse,flip,token,mount};
});
