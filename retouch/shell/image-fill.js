(function(root){
 'use strict';
 const V=typeof module==='object'&&module.exports?require('./html-css-values.js'):root.RetouchHTMLCSSValues;
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
 function reset(){return Object.fromEntries(['background-image','background-size','background-repeat','background-position'].map(property=>[property,null]));}
 function classes(before,changes){
  let next=before;
  for(const [property,value]of Object.entries(changes)){
   const kind=property.replace('background-','');if(kind==='image'){if(value!==null&&value!=='none'&&!V.imageURL(value))throw Error('Choose a supported image URL.');next=I.replace(next,token=>/^bg-(?:none|\[(?:image:)?(?:url|var)\(.*\)\])$/.test(token),value===null?'':value==='none'?'!bg-none':'!bg-[url('+source(value)+')]');continue;}const match=token=>kind==='size'?/^bg-(?:cover|contain|auto|\[length:.*\]|size-\[.*\])$/.test(token):kind==='repeat'?/^bg-(?:repeat(?:-x|-y|-round|-space)?|no-repeat)$/.test(token):/^bg-(?:center|top|bottom|left|right|(?:left|right)-(?:top|bottom)|\[position:.*\]|position-\[.*\])$/.test(token);
   if(value===null){next=I.replace(next,match,'');continue;}
   const token=kind==='size'?(value==='cover'||value==='contain'?'bg-'+value:'bg-[length:'+value.replaceAll(' ','_')+']'):kind==='repeat'?'bg-'+value:'bg-[position:'+value.replaceAll(' ','_')+']';
   next=I.replace(next,match,token);
  }
  return next;
 }
 function mount(info,el,save,saveCSS,own={},upload=null,saveImage=null,browseImages=null){
  if(!el)return null;const css=el.ownerDocument.defaultView.getComputedStyle(el),url=source(css.backgroundImage);if(!url&&css.backgroundImage!=='none')return null;
  const section=I.section('Image fill'),image=new Image(),content=document.createElement('div');section.append(content);
  if(info.classNameDynamic&&!saveCSS){I.note(section,info.classNameReason||'Image fill styles are computed.','refused');return section;}
  if(url)I.note(content,'Loading image dimensions…');
  const write=(changes,confirmed=false)=>{if(!confirmed&&!section.isConnected||!el.isConnected)return;return saveCSS?saveCSS(changes):save(classes(info.className,changes));};
  const asset=document.createElement('div'),status=document.createElement('p');status.setAttribute('role','status');status.className='image-fill-status';section.insertBefore(asset,content);section.append(status);
  const input=document.createElement('input');input.type='text';input.placeholder='/images/example.png';input.value=url||'';I.field(asset,'Image fill source',input);input.parentElement.querySelector('span').textContent='Image';
  let pending=false;const allowed=()=>section.isConnected&&el.isConnected&&!pending;
  const replace=async(next,confirmed=false)=>{if(!confirmed&&!allowed())return;const value=paint(next);if(!saveCSS&&el.style.getPropertyPriority('background-image'))throw Error('This image has an important inline style. Edit that style in source first.');if(saveImage&&next.startsWith('/assets/'))await saveImage(next,!url);else await write({...(!url?framing('fill',1,1):{}),'background-image':value},confirmed);};
  input.onchange=async()=>{try{await replace(input.value);}catch(error){status.textContent=error.message;}};I.fieldDraft(input);
  if(upload){const picker=document.createElement('input');picker.type='file';picker.accept='image/*';picker.hidden=true;picker.setAttribute('aria-label','Upload image fill');asset.append(picker);const choose=I.button(url?'Replace image':'Choose image',()=>picker.click());asset.append(choose);picker.onchange=async()=>{
   const file=picker.files[0];if(!file||!allowed())return;
   if(!saveCSS&&el.style.getPropertyPriority('background-image')){status.textContent='This image has an important inline style. Edit that style in source first.';return;}
   pending=true;choose.disabled=input.disabled=actions.disabled=true;status.textContent='Uploading image…';
   try{const next=await upload(file);pending=false;await replace(next,true);}catch(error){if(section.isConnected)status.textContent=error.message;}finally{pending=false;choose.disabled=input.disabled=actions.disabled=false;picker.value='';}
  };}
  if(browseImages){const browse=I.button('Browse project images',event=>{if(allowed()){event.currentTarget.focus({preventScroll:true});browseImages(src=>replace(src));}});browse.setAttribute('aria-label','Browse images for fill');asset.append(browse);}
  const actions=document.createElement('fieldset');actions.className='image-fill-actions';asset.append(actions);
  const change=async action=>{if(!allowed())return;try{if(action==='remove'&&!saveCSS&&el.style.getPropertyPriority('background-image'))throw Error('This image has an important inline style. Edit that style in source first.');if(saveImage)await saveImage(null,false,action);else await write(action==='reset'?reset():{'background-image':'none'});}catch(error){status.textContent=error.message;}};
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
 const api={source,paint,scale,framing,reset,classes,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchImageFill=api;
})(typeof window==='object'?window:globalThis);
