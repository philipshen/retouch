(function(root){
 'use strict';
 const V=typeof module==='object'&&module.exports?require('./html-css-values.js'):root.RetouchHTMLCSSValues;
 const P=typeof module==='object'&&module.exports?require('./paint-order.js'):root.RetouchPaintOrder;
 const I=typeof module==='object'&&module.exports?require('./inspector.js'):root.RetouchInspector;
 function source(value){const match=/^url\("([^"\\]*)"\)$/.exec(value||'');return match?.[1]||null;}
 function paint(url){
  if(typeof url!=='string'||!url.trim()||/[\x00-\x1f\x7f]/.test(url))throw Error('Enter an image URL or choose a file.');
  const escaped=url.trim().replace(/[\s"'()\\<>\[\]`]/g,char=>char.charCodeAt(0)<128?'%'+char.charCodeAt(0).toString(16).toUpperCase():encodeURIComponent(char)),value='url("'+escaped+'")';if(!V.imageURL(value))throw Error('Use an image path or an HTTP image URL.');return value;
 }
 function scale(size,width,height){
  if(size==='auto'||size==='auto auto')return 100;
  const parts=size.split(/\s+/),number=value=>/^\d+(?:\.\d+)?px$/.test(value)?parseFloat(value):NaN,w=number(parts[0]),h=parts[1]===undefined||parts[1]==='auto'?w*height/width:number(parts[1]);
  return w>0&&h>0&&Math.abs(w/width-h/height)<1e-6?w/width*100:null;
 }
 function framing(mode,width,height,percent=100){
  if(!['fill','fit','tile'].includes(mode))throw Error('Choose Fill, Fit or Tile.');
  if(mode==='tile'&&(![width,height,percent].every(Number.isFinite)||width<=0||height<=0||percent<1||percent>1000))throw Error('Choose a tile scale from 1% to 1000%.');
  const px=value=>Number(value.toFixed(6))+'px';
  return {'background-size':mode==='tile'?px(width*percent/100)+' '+px(height*percent/100):mode==='fill'?'cover':'contain','background-repeat':mode==='tile'?'repeat':'no-repeat','background-position':mode==='tile'?'0% 0%':'50% 50%'};
 }
 function cropFrame(css,width,height){
  const mode=css.backgroundRepeat==='no-repeat'&&['cover','contain'].includes(css.backgroundSize)?css.backgroundSize:null;
  if(!mode)return {width,height,objectFit:'contain',objectPosition:'50% 50%'};
  const px=name=>parseFloat(css[name])||0,borderX=px('borderLeftWidth')+px('borderRightWidth'),borderY=px('borderTopWidth')+px('borderBottomWidth'),paddingX=px('paddingLeft')+px('paddingRight'),paddingY=px('paddingTop')+px('paddingBottom');
  const contentWidth=px('width')-(css.boxSizing==='border-box'?paddingX+borderX:0),contentHeight=px('height')-(css.boxSizing==='border-box'?paddingY+borderY:0),origin=css.backgroundOrigin||'padding-box';
  return {width:contentWidth+(origin==='content-box'?0:paddingX)+(origin==='border-box'?borderX:0),height:contentHeight+(origin==='content-box'?0:paddingY)+(origin==='border-box'?borderY:0),objectFit:mode,objectPosition:css.backgroundPosition};
 }
 function reset(){return Object.fromEntries(['background-image',...P.properties].map(property=>[property,null]));}
 function classes(before,changes){
  let next=before;
  for(const [property,value]of Object.entries(changes)){
   const kind=property.replace('background-','');if(!['image','size','repeat','position'].includes(kind)){next=P.frameClasses(next,{[property]:value});continue;}if(kind==='image'){if(value!==null&&value!=='none'&&!V.imageURL(value))throw Error('Choose a supported image URL.');next=I.replace(next,imageToken,value===null?'':value==='none'?'!bg-none':'!bg-[url('+source(value)+')]');continue;}const match=token=>token.startsWith('['+property+':')||(kind==='size'?/^bg-(?:cover|contain|auto|\[length:.*\]|size-\[.*\])$/.test(token):kind==='repeat'?/^bg-(?:repeat(?:-x|-y|-round|-space)?|no-repeat)$/.test(token):/^bg-(?:center|top|bottom|left|right|(?:left|right)-(?:top|bottom)|\[position:.*\]|position-\[.*\])$/.test(token));
   if(value===null){next=I.replace(next,match,'');continue;}
   const token=kind==='size'?(value==='cover'||value==='contain'?'bg-'+value:'bg-[length:'+value.replaceAll(' ','_')+']'):kind==='repeat'?'bg-'+value:'bg-[position:'+value.replaceAll(' ','_')+']';
   next=I.replace(next,match,token);
  }
  return next;
 }
 const imageToken=token=>/^\[background-image:/.test(token)||/^bg-(?:none|gradient-to-|linear-|radial|conic|\[(?:image:|url\(|(?:repeating-)?(?:linear|radial|conic)-gradient\())/.test(token);
 function stackValue(layers){return layers.map(layer=>layer.replace(/url\("([^"\\]*)"\)/g,(_,url)=>'url('+source(paint(url))+')')).join(', ').replace(/\s/g,'_');}
 function stackClasses(before,layers){
  const value=layers.join(', ');if(!V.imageLayers(value))throw Error('Choose a supported image and gradient stack.');
  return I.replace(before,imageToken,'![background-image:'+stackValue(layers)+']');
 }
 function stackReferences(info,el,layers){
  const css=el.ownerDocument.defaultView.getComputedStyle(el),url=value=>{value=value.replace(/\\([0-9a-f]{1,6})(?:\s)?|\\([^\r\n\f])/gi,(_,hex,char)=>hex?String.fromCodePoint(Math.min(parseInt(hex,16)||65533,1114111)):char);const match=/^url\((?:"([^"\\]*)"|'([^'\\]*)'|([^\s'"\\()]+))\)$/.exec(value.trim());try{return match?new URL(match[1]??match[2]??match[3],el.ownerDocument.baseURI).href:null;}catch{return null;}};
  const token=(info.className||'').split(/\s+/).map(I.base).find(value=>value?.startsWith('[background-image:')),prior=token?V.splitLayers(token.slice('[background-image:'.length,-1).replace(/_/g,' ')):null;
  return layers.map((value,i)=>{const reference=prior?.length===layers.length&&/^var\((--rt-image-fill-[a-f0-9]{10})\)$/.exec(prior[i]);if(reference&&url(css.getPropertyValue(reference[1]))===url(value)&&url(value))return prior[i];for(const key of el.style){if(/^--rt-image-fill-[a-f0-9]{10}$/.test(key)&&url(css.getPropertyValue(key))===url(value)&&url(value))return 'var('+key+')';}return value;});
 }
 let openedPaint=null;
 function paintPopover(section,button,body,key,title){
  const popup=document.createElement('div'),header=document.createElement('header'),label=document.createElement('strong'),close=I.button('Close '+title,()=>{openedPaint=null;popup.hidePopover();focusBack();});popup.className='image-paint-popover';popup.setAttribute('popover','auto');popup.setAttribute('role','dialog');popup.setAttribute('aria-label',title);close.textContent='×';close.setAttribute('aria-label','Close '+title);label.textContent=title;header.append(label,close);popup.append(header,body);section.append(popup);button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
  const focusBack=()=>{const target=popup.retouchReturnFocus;(target?.isConnected?target:button).focus({preventScroll:true});};
  const position=()=>{const box=button.getBoundingClientRect(),width=popup.offsetWidth;popup.style.left='clamp(8px, '+(box.left-width-8)+'px, calc(100vw - '+width+'px - 8px))';popup.style.top='clamp(8px, '+box.top+'px, calc(100vh - '+popup.offsetHeight+'px - 8px))';};
  const resize=new ResizeObserver(()=>{if(popup.matches(':popover-open'))position();});
  const open=()=>{if(!section.isConnected||section.closest('[data-collapsed="true"]'))return;popup.showPopover();openedPaint=key;button.setAttribute('aria-expanded','true');position();};
  popup.retouchOpen=open;
  button.onclick=()=>{popup.retouchReturnFocus=button;if(popup.matches(':popover-open')){openedPaint=null;popup.hidePopover();}else{open();close.focus({preventScroll:true});}};
  popup.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();openedPaint=null;popup.hidePopover();focusBack();}});
  popup.addEventListener('beforetoggle',event=>{button.setAttribute('aria-expanded',String(event.newState==='open'));if(event.newState==='open')resize.observe(popup);else resize.disconnect();});
  popup.addEventListener('toggle',event=>{if(!popup.isConnected)return;button.setAttribute('aria-expanded',String(event.newState==='open'));if(event.newState==='closed'&&openedPaint===key)openedPaint=null;});
  if(openedPaint===key)queueMicrotask(open);return popup;
 }
 function paintActions(row,more,popup,commands,current){
  const items=()=>[...commands.querySelectorAll('button:not(:disabled)')],editable=target=>target.closest('input,textarea,select,[contenteditable]');
  const open=(opener,last=false)=>{if(!current()||more.matches(':disabled'))return;popup.retouchReturnFocus=opener;popup.retouchOpen();const buttons=items();(last?buttons.at(-1):buttons[0])?.focus();};
  row.addEventListener('contextmenu',event=>{if(editable(event.target)||!current()||more.matches(':disabled'))return;event.preventDefault();event.stopPropagation();open(row.contains(document.activeElement)?document.activeElement:row.querySelector('.paint-row-editor'));});
  row.addEventListener('keydown',event=>{if(editable(event.target)||event.altKey||event.ctrlKey||event.metaKey)return;if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey){event.preventDefault();event.stopPropagation();open(event.target);}else if(event.target===more&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();event.stopPropagation();open(more,event.key==='ArrowUp');}});
  more.addEventListener('click',()=>{if(popup.matches(':popover-open'))items()[0]?.focus();});
  popup.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;const buttons=items();if(!buttons.length)return;event.preventDefault();event.stopPropagation();const at=buttons.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:at<0?(event.key==='ArrowDown'?0:buttons.length-1):(at+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next].focus();});
 }
 const uploadFeedback=new WeakMap();
 function feedbackFor(info,el,status,slot){
  let slots=uploadFeedback.get(el);if(!slots){slots=new Map();uploadFeedback.set(el,slots);}
  const key=JSON.stringify([info.file,info.id,info.hash,info.styleScope??document.querySelector('[aria-label="Style screen scope"]')?.value??'']);let state=slots.get(slot);
  if(!state||state.key!==key){state={key,message:''};slots.set(slot,state);}state.status=new WeakRef(status);status.textContent=state.message;
  const update=message=>{if(slots.get(slot)!==state)return;state.message=message;const current=state.status.deref();if(current)current.textContent=message;};update.state=state;return update;
 }
 function paintKey(info,index){return [info.file,info.id,info.styleScope||'',index].join('|');}
 function additions(section,info,el,save,saveCSS,layers,upload,saveImage,browseImages){
  const group=document.createElement('fieldset'),status=document.createElement('p');group.className='paint-add-actions';status.setAttribute('role','status');status.className='image-fill-status';group.append(status);const opener=I.button('Add paint',()=>{});opener.textContent='+';opener.classList.add('section-add');opener.setAttribute('aria-label','Add paint');opener.title='Add paint';opener.disabled=layers.length>=8;section.append(opener);const popup=paintPopover(section,opener,group,paintKey(info,'add'),'Add paint');group.disabled=layers.length>=8;const closeMenu=()=>{openedPaint=null;popup.hidePopover();};
  const add=async(src=null,solid=false)=>{
   if(!el.isConnected)throw Error('The selected layer changed.');
   if(!saveCSS&&['background','background-image',...P.properties].some(property=>el.style.getPropertyPriority(property)))throw Error('This layer has an important inline background. Edit that style in source first.');
   const css=el.ownerDocument.defaultView.getComputedStyle(el),framing=Object.fromEntries(P.properties.map(property=>[property,css.getPropertyValue(property)])),layer=src?paint(src):solid?'linear-gradient(0deg, #d9d9d9 0%, #d9d9d9 100%)':'linear-gradient(180deg, #d9d9d9 0%, #ffffff 100%)',changes=P.prepend(layers,framing,layer);
   if(saveImage)await saveImage(src,false,'add',{layers:stackReferences(info,el,layers),framing,value:src?null:layer});
   else if(saveCSS)await saveCSS(changes);else await save(P.frameClasses(stackClasses(info.className,[layer,...layers]),changes));
   const actual=V.imageLayers(el.ownerDocument.defaultView.getComputedStyle(el).backgroundImage);
   if(!actual||actual.length!==layers.length+1||actual.slice(1).some((value,index)=>value!==layers[index]))throw Error('The new paint could not be verified in the preview.');
   if(src){const expected=new URL(src,el.ownerDocument.baseURI),received=source(actual[0]);if(!received||!(received===expected.href||saveImage&&new URL(received,expected).pathname.endsWith('/'+expected.pathname.split('/').pop())))throw Error('The new image paint could not be verified in the preview.');}
   else if(V.parseGradients(actual[0])?.length!==1)throw Error('The new gradient could not be verified in the preview.');
  };
  group.append(I.button('Add solid paint',async()=>{closeMenu();group.disabled=true;try{await add(null,true);}catch(error){status.textContent=error.message;}finally{group.disabled=layers.length>=8;}}));
  const gradient=I.button('Add gradient paint',async()=>{closeMenu();group.disabled=true;try{await add();}catch(error){status.textContent=error.message;}finally{group.disabled=layers.length>=8;}});group.append(gradient);
  if(browseImages)group.append(I.button('Add image paint',event=>{closeMenu();event.currentTarget.focus({preventScroll:true});browseImages(src=>add(src));}));
  if(upload){const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;input.setAttribute('aria-label','Upload new image paint');const button=I.button('Upload new image paint',()=>{closeMenu();input.click();});group.append(button,input);input.onchange=async()=>{const file=input.files[0];if(!file)return;group.disabled=true;status.textContent='Uploading image…';try{await add(await upload(file));status.textContent='';}catch(error){status.textContent=error.message;}finally{group.disabled=layers.length>=8;input.value='';}};}
 }
 function mountStack(info,el,save,saveCSS,layers,upload,saveImage,browseImages){
  const section=I.section('Image fill'),css=el.ownerDocument.defaultView.getComputedStyle(el);if(info.classNameDynamic&&!saveCSS){I.note(section,info.classNameReason||'Image fill styles are computed.','refused');return section;}I.note(section,'Paints are listed from front to back. Edits preserve neighboring paints and framing.');
  additions(section,info,el,save,saveCSS,layers,upload,saveImage,browseImages);
  const order=document.createElement('div');order.className='paint-order';section.append(order);
  const currentPaint=()=>el.isConnected&&JSON.stringify(V.imageLayers(el.ownerDocument.defaultView.getComputedStyle(el).backgroundImage))===JSON.stringify(layers),currentOrder=()=>section.isConnected&&currentPaint();
  const move=async indices=>{try{if(!currentOrder())throw Error('The paint stack changed. Select it again.');if(!saveCSS&&['background','background-image',...root.RetouchPaintOrder.properties].some(property=>el.style.getPropertyPriority(property)))throw Error('This paint stack has an important inline background. Edit that style in source first.');if(!indices.length){if(saveImage)await saveImage(null,false,'remove');else if(saveCSS)await saveCSS({'background-image':'none'});else await save(classes(info.className,{'background-image':'none'}));if(el.ownerDocument.defaultView.getComputedStyle(el).backgroundImage!=='none')throw Error('The removed paint could not be verified in the preview.');return;}const framing=Object.fromEntries(root.RetouchPaintOrder.properties.map(property=>[property,css.getPropertyValue(property)])),changes=root.RetouchPaintOrder.reorder(layers,framing,indices);if(saveImage)await saveImage(null,false,'order',{layers:stackReferences(info,el,layers),order:indices,framing});else if(saveCSS)await saveCSS(changes);else await save(root.RetouchPaintOrder.frameClasses(stackClasses(info.className,indices.map(index=>layers[index])),changes));const actual=V.imageLayers(el.ownerDocument.defaultView.getComputedStyle(el).backgroundImage);if(!actual||actual.length!==indices.length||actual.some((value,index)=>value!==layers[indices[index]]))throw Error('The paint order could not be verified in the preview.');}catch(error){I.note(order,error.message,'refused');}};
  const editFrame=async(index,patch)=>{
   if(!currentOrder())throw Error('The paint stack changed. Select it again.');
   if(!saveCSS&&['background',...Object.keys(patch)].some(property=>el.style.getPropertyPriority(property)))throw Error('An important inline style controls this paint. Edit that style in source first.');
   const framing=Object.fromEntries(P.properties.map(property=>[property,css.getPropertyValue(property)])),changes=P.edit(layers,framing,index,patch);
   if(saveImage)await saveImage(null,false,'frame',{layers:stackReferences(info,el,layers),index,framing,changes:patch});else if(saveCSS)await saveCSS(changes);else await save(P.frameClasses(info.className,changes));
   if(JSON.stringify(V.imageLayers(el.ownerDocument.defaultView.getComputedStyle(el).backgroundImage))!==JSON.stringify(layers))throw Error('The paint images changed unexpectedly.');
   const rendered=el.ownerDocument.defaultView.getComputedStyle(el),probe=el.ownerDocument.createElement('div');for(const [property,value]of Object.entries(changes)){probe.style.setProperty(property,value);if(rendered.getPropertyValue(property).replace(/\s/g,'')!==probe.style.getPropertyValue(property).replace(/\s/g,''))throw Error('The paint framing could not be verified in the preview.');}
  };
  const frameControls=(group,index,image)=>{
   const prefix='Paint '+(index+1),read=property=>{const values=V.splitLayers(css.getPropertyValue(property));return values[index%values.length];},controls=document.createElement('div'),status=document.createElement('p');controls.className='paint-framing-controls';status.className='image-fill-status';status.setAttribute('role','status');group.append(controls,status);
   const write=async patch=>{try{await editFrame(index,patch);}catch(error){status.textContent=error.message;}};
   const blend=I.select(controls,prefix+' blend mode',['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity'].map(value=>[value,value.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase())]),read('background-blend-mode'),value=>write({'background-blend-mode':value}));blend.closest('label').querySelector('span').textContent='Blend';
   if(!image)return;
   const size=read('background-size'),repeat=read('background-repeat'),mode=repeat==='no-repeat'&&size==='cover'?'fill':repeat==='no-repeat'&&size==='contain'?'fit':repeat==='repeat'&&(size==='auto'||size==='auto auto'||/px/.test(size))?'tile':'custom';
   const sizing=I.select(controls,prefix+' image mode',[['fill','Fill'],['fit','Fit'],['tile','Tile'],...(mode==='custom'?[['custom','Custom']]:[])],mode,value=>{if(value!=='custom')write(framing(value,image.naturalWidth,image.naturalHeight));});sizing.closest('label').querySelector('span').textContent='Image mode';sizing.querySelector('[value=tile]').disabled=!image.naturalWidth;
   const tile=I.number(controls,prefix+' tile scale (%)',100,1,1000,value=>write(framing('tile',image.naturalWidth,image.naturalHeight,value)));tile.closest('label').querySelector('span').textContent='Scale (%)';tile.closest('label').hidden=mode!=='tile';tile.disabled=true;const loaded=()=>{const value=scale(size,image.naturalWidth,image.naturalHeight);tile.disabled=!image.naturalWidth;sizing.querySelector('[value=tile]').disabled=!image.naturalWidth;tile.value=value===null?'':String(value);tile.placeholder='Custom';};image.addEventListener('load',loaded);if(image.complete&&image.naturalWidth)loaded();
   const position=read('background-position'),pair=/^(-?[\d.]+)% (-?[\d.]+)%$/.exec(position);
   if(pair)for(const [axis,label]of [[1,'X'],[2,'Y']]){const input=I.number(controls,prefix+' position '+label+' (%)',Number(pair[axis]),-1000000,1000000,value=>write({'background-position':axis===1?value+'% '+pair[2]+'%':pair[1]+'% '+value+'%'}));input.value=pair[axis];input.closest('label').querySelector('span').textContent='Position '+label+' (%)';}
   else{const input=document.createElement('input');input.value=position;I.field(controls,prefix+' position',input);input.closest('label').querySelector('span').textContent='Position';input.onchange=()=>write({'background-position':input.value});I.fieldDraft(input);}
  };
  const editors=[];layers.forEach((layer,index)=>{const row=document.createElement('div'),label=document.createElement('span'),editor=I.button('Edit '+(source(layer)?'image':root.RetouchClassGradients.solidColor(V.parseGradients(layer)?.[0])?'solid':'gradient')+' paint '+(index+1),()=>{}),swatch=document.createElement('span');row.className='paint-order-row';label.textContent=source(layer)?'Image':root.RetouchClassGradients.solidColor(V.parseGradients(layer)?.[0])?'Solid':V.parseGradients(layer)?.[0]?.type==='radial'?'Radial':V.parseGradients(layer)?.[0]?.type==='conic'?'Angular':'Linear';editor.setAttribute('aria-label','Edit '+(source(layer)?'image':root.RetouchClassGradients.solidColor(V.parseGradients(layer)?.[0])?'solid':'gradient')+' paint '+(index+1));editor.classList.add('paint-row-editor');swatch.className='paint-row-swatch';swatch.style.backgroundImage=layer;editor.replaceChildren(swatch,label);editors[index]=editor;row.append(editor);const commands=document.createElement('div'),more=I.button('Paint '+(index+1)+' actions',()=>{});commands.className='paint-add-actions';more.classList.add('paint-row-more');more.textContent='⋯';more.setAttribute('aria-label','Paint '+(index+1)+' actions');more.title='Paint actions';row.append(more);const actions=paintPopover(section,more,commands,paintKey(info,'actions:'+index),'Paint '+(index+1)+' actions');for(const [action,text,disabled,indices]of [['up','↑',index===0,()=>{const next=layers.map((_,i)=>i);[next[index-1],next[index]]=[next[index],next[index-1]];return next;}],['down','↓',index===layers.length-1,()=>{const next=layers.map((_,i)=>i);[next[index],next[index+1]]=[next[index+1],next[index]];return next;}],['duplicate','+',layers.length>=8,()=>layers.flatMap((_,i)=>i===index?[i,i]:[i])],['remove','−',false,()=>layers.map((_,i)=>i).filter(i=>i!==index)]]){const name=(action==='up'||action==='down'?'Move paint '+(index+1)+' '+action:action[0].toUpperCase()+action.slice(1)+' paint '+(index+1)),button=I.button(name,()=>{const next=indices();if(action!=='remove'){openedPaint=null;actions.hidePopover();root.RetouchPanelFocus?.queue(more,'Paint '+(next.indexOf(index)+1)+' actions');}return move(next);});button.textContent=action==='remove'?text:name;button.setAttribute('aria-label',name);button.title=name;button.disabled=disabled;if(action==='remove')row.append(button);else commands.append(button);}paintActions(row,more,actions,commands,currentOrder);order.append(row);});
  root.RetouchPaintDrag.mount(order,move,currentOrder);
  const paints=layers.map(value=>V.parseGradients(value)?.[0]||{type:'image',value});
  if(paints.some(paint=>paint.type!=='image'))root.RetouchClassGradients.mount(section,info,el,save,{gradients:paints,fixedStack:true,write:async next=>{
   const index=next.findIndex((paint,i)=>V.serializeGradients([paint])!==V.serializeGradients([paints[i]]));if(index<0)return;
   const values=next.map(paint=>V.serializeGradients([paint]));
   if(saveImage)await saveImage(null,false,'gradient',{layers:stackReferences(info,el,layers),index,value:values[index]});
   else if(saveCSS)await saveCSS({'background-image':values.join(', ')});else await save(stackClasses(info.className,values));
  }});
  const gradientDetails=section.querySelector(':scope > details');if(gradientDetails){for(const group of [...gradientDetails.querySelectorAll(':scope > .gradient-controls')]){const index=Number(group.querySelector('legend').textContent.match(/\d+/)[0])-1;frameControls(group,index,null);const solid=root.RetouchClassGradients.solidColor(paints[index]),editor=editors[index];paintPopover(section,editor,group,paintKey(info,index),(solid?'Solid ':'Gradient ')+(index+1));if(solid){const color=group.querySelector('[aria-label="Solid paint '+(index+1)+' color"]'),swatch=editor.querySelector('.paint-row-swatch'),button=I.button('Choose solid paint '+(index+1)+' color',()=>{button.focus({preventScroll:true});root.RetouchPaintPicker.open(color,{anchor:button,restorePopover:false,onClose:()=>{if(button.isConnected)button.focus({preventScroll:true});},onApply:next=>{if(!color.isConnected)return;root.RetouchPanelFocus?.queue(button);color.value=next;color.dispatchEvent(new Event('input',{bubbles:true}));color.dispatchEvent(new Event('change',{bubbles:true}));}});});button.classList.add('paint-row-color');button.setAttribute('aria-label','Choose solid paint '+(index+1)+' color');button.title='Choose color';button.disabled=color.matches(':disabled');swatch.style.backgroundImage+=', conic-gradient(#fff 25%, #e5e5e5 0 50%, #fff 0 75%, #e5e5e5 0)';button.replaceChildren(swatch);editor.before(button);let value=solid;try{value=root.RetouchPaletteValues.fromComputed(solid);}catch{}editor.querySelector('span:last-child').textContent=/^#[a-f\d]{8}$/i.test(value)?value.slice(1,value.endsWith('ff')?-2:undefined).toUpperCase():value;editor.title=solid;}}gradientDetails.remove();}
  for(const [index,layer]of layers.entries()){
   const url=source(layer);if(!url)continue;const intrinsic=new Image();intrinsic.src=url;
   const group=document.createElement('fieldset'),legend=document.createElement('legend'),status=document.createElement('p');legend.textContent='Image paint '+(index+1);group.className='image-fill-stack-paint';group.append(legend);const preview=document.createElement('img');preview.className='image-fill-stack-preview';preview.src=url;preview.alt='Image paint '+(index+1)+' preview';group.append(preview);status.setAttribute('role','status');status.className='image-fill-status';const feedback=feedbackFor(info,el,status,'paint:'+index);
   let pending=false;const current=()=>section.isConnected&&el.isConnected&&!pending;
   const replace=async(next,confirmed=false)=>{
    if(!el.isConnected||!confirmed&&!current())throw Error('The selected image changed.');
    if(!saveCSS&&(el.style.getPropertyPriority('background-image')||el.style.getPropertyPriority('background')))throw Error('This image has an important inline background. Edit that style in source first.');
    const updated=layers.map((value,i)=>i===index?paint(next):value);
    if(saveImage&&next.startsWith('/assets/')){
     const authored=stackReferences(info,el,layers);
     await saveImage(next,false,'apply',{layers:authored,index});
    }else if(saveCSS)await saveCSS({'background-image':updated.join(', ')});else await save(stackClasses(info.className,updated));
    const actual=source(V.imageLayers(el.ownerDocument.defaultView.getComputedStyle(el).backgroundImage)?.[index]),expected=new URL(next,el.ownerDocument.location.href);
    if(!actual||!(actual===expected.href||saveImage&&next.startsWith('/assets/')&&new URL(actual,expected).pathname.endsWith('/'+expected.pathname.split('/').pop())))throw Error('The image paint could not be applied.');
   };
   const field=document.createElement('input');field.type='text';field.value=url;I.field(group,'Image paint '+(index+1)+' source',field);field.parentElement.querySelector('span').textContent='Image';field.onchange=async()=>{try{await replace(field.value);}catch(error){feedback(error.message);}};I.fieldDraft(field);
   if(browseImages){const browse=I.button('Browse image paint '+(index+1),event=>{event.currentTarget.focus({preventScroll:true});browseImages(next=>replace(next,true));});browse.setAttribute('aria-label','Browse image paint '+(index+1));browse.textContent='Browse images';group.append(browse);}
   if(upload){const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;input.setAttribute('aria-label','Upload image paint '+(index+1));const choose=I.button('Replace image paint '+(index+1),()=>input.click());choose.setAttribute('aria-label','Replace image paint '+(index+1));choose.textContent='Replace image';group.append(choose,input);input.onchange=async()=>{const file=input.files[0];if(!file||pending||!el.isConnected)return;pending=true;group.disabled=choose.disabled=true;feedback('Uploading image…');try{const next=await upload(file);feedback('');pending=false;await replace(next,true);}catch(error){feedback(error.message);}finally{pending=false;group.disabled=choose.disabled=false;input.value='';}};}
   if(upload){const crop=I.button('Crop image paint '+(index+1),event=>{event.currentTarget.focus({preventScroll:true});root.RetouchImageCrop.open({target:el,source:intrinsic,frame:layers.length===1?cropFrame(css,intrinsic.naturalWidth,intrinsic.naturalHeight):{width:intrinsic.naturalWidth,height:intrinsic.naturalHeight,objectFit:'contain',objectPosition:'50% 50%'},scopeNote:'Edits this image paint in the selected screen scope. Other paints are kept.',current:()=>el.isConnected&&V.imageLayers(el.ownerDocument.defaultView.getComputedStyle(el).backgroundImage)?.[index]===layer,onError:message=>{feedback(message);},onApply:async blob=>{const next=await upload(new File([blob],layers.length===1?'cropped-fill.svg':'cropped-stack.svg',{type:'image/svg+xml'}));await replace(next,true);}});});crop.setAttribute('aria-label','Crop image paint '+(index+1));crop.textContent='Crop image';crop.disabled=true;intrinsic.onload=()=>{crop.disabled=!intrinsic.naturalWidth;};if(intrinsic.complete&&intrinsic.naturalWidth)crop.disabled=false;group.append(crop);}
   frameControls(group,index,intrinsic);group.append(status);const popup=paintPopover(section,editors[index],group,paintKey(info,index),'Image '+(index+1));if(upload)root.RetouchImageOpacity.mount({popup,group,row:editors[index].parentElement,source:intrinsic,index,current:currentOrder,currentPaint,upload,replace,feedback:status=>feedbackFor(info,el,status,'opacity:'+index)});
  }
  return section;
 }
 function mount(info,el,save,saveCSS,own={},upload=null,saveImage=null,browseImages=null){
  if(!el)return null;const layer=el.ownerDocument.defaultView.getComputedStyle(el).backgroundImage;
  if(!source(layer))return mountOriginal(info,el,save,saveCSS,own,upload,saveImage,browseImages);
  const section=mountStack(info,el,save,saveCSS,[layer],upload,saveImage,browseImages);
  if(!section.querySelector('.paint-order'))return section;
  const legacy=mountOriginal(info,el,save,saveCSS,own,upload,saveImage,browseImages,true);legacy.querySelector(':scope > h3')?.remove();legacy.className='legacy-image-controls';legacy.dataset.legacyImageControls='';section.append(legacy);return section;
 }
 function mountOriginal(info,el,save,saveCSS,own={},upload=null,saveImage=null,browseImages=null,legacy=false){
  if(!el)return null;const css=el.ownerDocument.defaultView.getComputedStyle(el),url=source(css.backgroundImage);if(!url&&css.backgroundImage!=='none'){const layers=V.imageLayers(css.backgroundImage);if(!layers)return null;if(layers.every(layer=>source(layer)||V.parseGradients(layer)?.length===1))return mountStack(info,el,save,saveCSS,layers,upload,saveImage,browseImages);const section=I.section('Image fill');if(info.classNameDynamic&&!saveCSS)I.note(section,info.classNameReason||'Image fill styles are computed.','refused');else additions(section,info,el,save,saveCSS,layers,upload,saveImage,browseImages);return section;}
  const section=I.section('Image fill'),image=new Image(),content=document.createElement('div');section.append(content);
  if(info.classNameDynamic&&!saveCSS){I.note(section,info.classNameReason||'Image fill styles are computed.','refused');return section;}
  if(!legacy)additions(section,info,el,save,saveCSS,url?[css.backgroundImage]:[],upload,saveImage,browseImages);
  if(url)I.note(content,'Loading image dimensions…');
  const write=(changes,confirmed=false)=>{if(!confirmed&&!section.isConnected||!el.isConnected)return;return saveCSS?saveCSS(changes):save(classes(info.className,changes));};
  const asset=document.createElement('div'),status=document.createElement('p');status.setAttribute('role','status');status.className='image-fill-status';section.insertBefore(asset,content);section.append(status);const feedback=feedbackFor(info,el,status,'single');
  const input=document.createElement('input');input.type='text';input.placeholder='/images/example.png';input.value=url||'';I.field(asset,'Image fill source',input);input.parentElement.querySelector('span').textContent='Image';
  let pending=false;const allowed=()=>section.isConnected&&el.isConnected&&!pending;
  const replace=async(next,confirmed=false)=>{if(!confirmed&&!allowed())return;const value=paint(next);if(!saveCSS&&el.style.getPropertyPriority('background-image'))throw Error('This image has an important inline style. Edit that style in source first.');if(saveImage&&next.startsWith('/assets/'))await saveImage(next,!url);else await write({...(!url?framing('fill',1,1):{}),'background-image':value},confirmed);};
  input.onchange=async()=>{try{await replace(input.value);}catch(error){feedback(error.message);}};I.fieldDraft(input);
  if(upload){const picker=document.createElement('input');picker.type='file';picker.accept='image/*';picker.hidden=true;picker.setAttribute('aria-label','Upload image fill');asset.append(picker);const choose=I.button(url?'Replace image':'Choose image',()=>picker.click());asset.append(choose);picker.onchange=async()=>{
   // A native file chooser can outlive a harmless panel rebuild; upload checks selection, hash and scope.
   const file=picker.files[0];if(!file||pending||!el.isConnected)return;
   if(!saveCSS&&el.style.getPropertyPriority('background-image')){feedback('This image has an important inline style. Edit that style in source first.');return;}
   pending=true;choose.disabled=input.disabled=actions.disabled=true;feedback('Uploading image…');
   try{const next=await upload(file);feedback('');pending=false;await replace(next,true);}catch(error){feedback(error.message);}finally{pending=false;choose.disabled=input.disabled=actions.disabled=false;picker.value='';}
  };}
  if(browseImages){const browse=I.button('Browse project images',event=>{if(allowed()){event.currentTarget.focus({preventScroll:true});browseImages(src=>replace(src));}});browse.setAttribute('aria-label','Browse images for fill');asset.append(browse);}
  const actions=document.createElement('fieldset');actions.className='image-fill-actions';asset.append(actions);
  const change=async action=>{if(!allowed())return;try{if(action==='remove'&&!saveCSS&&el.style.getPropertyPriority('background-image'))throw Error('This image has an important inline style. Edit that style in source first.');if(saveImage)await saveImage(null,false,action);else await write(action==='reset'?reset():{'background-image':'none'});}catch(error){feedback(error.message);}};
  const remove=I.button('Remove image fill',()=>change('remove'));remove.disabled=!url;actions.append(remove);
  const resetButton=I.button('Reset image fill',()=>change('reset'));resetButton.disabled=saveCSS?!Object.keys(reset()).some(key=>Object.hasOwn(own,key)):classes(info.className,reset())===info.className;resetButton.title='Remove this screen size’s image and framing overrides to reveal inherited styling.';actions.append(resetButton);
  if(!url)return section;
  image.onload=()=>{
   if(!section.isConnected)return;content.replaceChildren();const width=image.naturalWidth,height=image.naturalHeight;if(!width||!height){I.note(content,'Image dimensions are unavailable.');return;}
   const percent=scale(css.backgroundSize,width,height),mode=css.backgroundRepeat==='no-repeat'&&css.backgroundSize==='cover'?'fill':css.backgroundRepeat==='no-repeat'&&css.backgroundSize==='contain'?'fit':css.backgroundRepeat==='repeat'&&percent!==null?'tile':'custom';
   I.select(content,'Image fill mode',[...(mode==='custom'?[['custom','Custom']]:[]),['fill','Fill'],['fit','Fit'],['tile','Tile']],mode,value=>{if(value!=='custom')write(framing(value,width,height,value==='tile'&&percent>=1&&percent<=1000?percent:100));});
   if(mode==='tile'){
    const input=I.number(content,'Image tile scale (%)',percent,1,1000,value=>{if(value>=1&&value<=1000)write({'background-size':framing('tile',width,height,value)['background-size']});});input.step='any';input.value=String(Number(percent.toFixed(6)));
    I.note(content,'Scale is relative to the original image. Tiles repeat as the frame grows.');
   }
   if(upload){
    const crop=I.button('Crop image fill',event=>{
     if(!allowed())return;event.currentTarget.focus({preventScroll:true});
     const frame=cropFrame(css,width,height);
     root.RetouchImageCrop.open({target:el,source:image,frame,scopeNote:'Applies to this screen scope and inheriting sizes. The original is kept.',current:()=>allowed()&&source(el.ownerDocument.defaultView.getComputedStyle(el).backgroundImage)===url,onError:message=>{feedback(message);},onApply:async blob=>{
      const next=await upload(new File([blob],'cropped-fill.svg',{type:'image/svg+xml'}));await replace(next,true);
      const rendered=source(el.ownerDocument.defaultView.getComputedStyle(el).backgroundImage),filename=new URL(next,el.ownerDocument.location.href).pathname.split('/').pop();
      if(!rendered||!new URL(rendered,el.ownerDocument.location.href).pathname.endsWith('/'+filename))throw Error('The cropped fill could not be applied.');
     }});
    });content.append(crop);if(mode==='tile'||mode==='custom')I.note(content,'Edit the source image; existing size, position and repetition are preserved.');
   }
   const coordinates=css.backgroundPosition.split(/\s+/),fields=[];
   for(const [index,label]of ['Image fill horizontal position (%)','Image fill vertical position (%)'].entries()){
    const input=document.createElement('input');input.type='number';input.min='0';input.max='100';input.step='any';input.required=true;input.value=/^[-\d.]+%$/.test(coordinates[index]||'')?parseFloat(coordinates[index]):'';input.placeholder=coordinates[index]||'Custom';I.field(content,label,input);fields.push(input);
    input.onchange=()=>{if(fields.every(field=>field.value!==''&&field.checkValidity()))write({'background-position':fields.map(field=>field.value+'%').join(' ')});};
   }
   for(const row of content.querySelectorAll('.inspector-field')){const input=row.querySelector('input,select');row.querySelector('span').textContent={'Image fill mode':'Mode','Image tile scale (%)':'Scale (%)','Image fill horizontal position (%)':'Position X (%)','Image fill vertical position (%)':'Position Y (%)'}[input.getAttribute('aria-label')]||input.getAttribute('aria-label');}
   if(saveCSS){const reset=I.button('Reset image fill framing',()=>write(Object.fromEntries(['background-size','background-repeat','background-position'].map(key=>[key,null]))));reset.disabled=!['background-size','background-repeat','background-position'].some(key=>Object.hasOwn(own,key));content.append(reset);}
  };
  image.onerror=()=>{if(section.isConnected){content.replaceChildren();I.note(content,'The background image could not be loaded.');}};
  image.src=url;return section;
 }
 const api={source,paint,scale,framing,cropFrame,reset,classes,imageToken,stackValue,stackClasses,stackReferences,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchImageFill=api;
})(typeof window==='object'?window:globalThis);
