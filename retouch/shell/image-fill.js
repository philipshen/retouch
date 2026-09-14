(function(root){
 'use strict';
 const I=typeof module==='object'&&module.exports?require('./inspector.js'):root.RetouchInspector;
 function source(value){const match=/^url\("([^"\\]*)"\)$/.exec(value||'');return match?.[1]||null;}
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
 function classes(before,changes){
  let next=before;
  for(const [property,value]of Object.entries(changes)){
   const kind=property.replace('background-',''),match=token=>kind==='size'?/^bg-(?:cover|contain|auto|\[length:.*\]|size-\[.*\])$/.test(token):kind==='repeat'?/^bg-(?:repeat(?:-x|-y|-round|-space)?|no-repeat)$/.test(token):/^bg-(?:center|top|bottom|left|right|(?:left|right)-(?:top|bottom)|\[position:.*\]|position-\[.*\])$/.test(token);
   const token=kind==='size'?(value==='cover'||value==='contain'?'bg-'+value:'bg-[length:'+value.replaceAll(' ','_')+']'):kind==='repeat'?'bg-'+value:'bg-[position:'+value.replaceAll(' ','_')+']';
   next=I.replace(next,match,token);
  }
  return next;
 }
 function mount(info,el,save,saveCSS,own={}){
  if(!el)return null;const css=el.ownerDocument.defaultView.getComputedStyle(el),url=source(css.backgroundImage);if(!url)return null;
  const section=I.section('Image fill'),image=new Image(),content=document.createElement('div');section.append(content);
  if(info.classNameDynamic&&!saveCSS){I.note(section,info.classNameReason||'Image fill styles are computed.','refused');return section;}
  I.note(content,'Loading image dimensions…');
  const write=changes=>{if(!section.isConnected||!el.isConnected)return;return saveCSS?saveCSS(changes):save(classes(info.className,changes));};
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
 const api={source,scale,framing,classes,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchImageFill=api;
})(typeof window==='object'?window:globalThis);
