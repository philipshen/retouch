(function(root){
 'use strict';
 const clamp=n=>Math.max(0,Math.min(1,n));
 function hsv(rgb){const max=Math.max(...rgb),min=Math.min(...rgb),delta=max-min;let h=0;if(delta){const i=rgb.indexOf(max);h=60*(i===0?(rgb[1]-rgb[2])/delta:i===1?(rgb[2]-rgb[0])/delta+2:(rgb[0]-rgb[1])/delta+4);}return [(h+360)%360,max?delta/max:0,max];}
 function rgb(h,s,v){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;return (h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x]).map(n=>n+m);}
 function hsl(channels){const max=Math.max(...channels),min=Math.min(...channels),l=(max+min)/2,delta=max-min;return [hsv(channels)[0],delta?delta/(1-Math.abs(2*l-1))*100:0,l*100];}
 function hslRGB(h,s,l){s/=100;l/=100;const v=l+s*Math.min(l,1-l);return rgb((h%360+360)%360,v?2*(1-l/v):0,v);}
 function gradientPreview({el,group,preview,gradient,gradients,index,stopIndex}){
  const serialize=root.RetouchHTMLCSSValues.serializeGradients,originalStyle=el.getAttribute('style'),originalValue=el.style.getPropertyValue('background-image'),priority=el.style.getPropertyPriority('background-image');
  let lastStyle=originalStyle,lastValue=null,restored=false;
  const paint=next=>{preview.style.backgroundImage=serialize([next]);const strip=group.querySelector('.gradient-stop-strip'),handle=group.querySelector('[data-stop-index="'+stopIndex+'"]');if(strip)strip.style.backgroundImage=serialize([{...next,type:'linear',angle:90}]);if(handle)handle.style.backgroundColor=next.stops[stopIndex].color;};
  return {update(color){if(restored||!el.isConnected||!group.isConnected)return;const next={...gradient,stops:gradient.stops.map((stop,i)=>i===stopIndex?{...stop,color}:stop)};el.style.setProperty('background-image',serialize(gradients.map((item,i)=>i===index?next:item)),'important');lastValue=el.style.getPropertyValue('background-image');lastStyle=el.getAttribute('style');paint(next);},restore(){
   if(restored)return;restored=true;if(lastValue!==null){if(el.getAttribute('style')===lastStyle){if(originalStyle===null)el.removeAttribute('style');else el.setAttribute('style',originalStyle);}else if(el.style.getPropertyValue('background-image')===lastValue&&el.style.getPropertyPriority('background-image')==='important'){if(originalValue)el.style.setProperty('background-image',originalValue,priority);else el.style.removeProperty('background-image');}}paint(gradient);
  }};
 }
 function srgbValue(channels,alpha){const bytes=channels.map(n=>Math.round(clamp(n)*255));return Math.abs(alpha*255-Math.round(alpha*255))<1e-8?'#'+[...bytes,Math.round(alpha*255)].map(n=>n.toString(16).padStart(2,'0')).join(''):'rgb('+bytes.join(' ')+' / '+alpha+')';}
 const contextualColors=new Set('currentcolor inherit initial unset revert revert-layer accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext field fieldtext graytext highlight highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext activeborder activecaption appworkspace background buttonhighlight buttonshadow captiontext inactiveborder inactivecaption inactivecaptiontext infobackground infotext menu menutext scrollbar threeddarkshadow threedface threedhighlight threedlightshadow threedshadow window windowframe windowtext'.split(' '));
 function parsePaint(raw){
  let normalized;
  try{normalized=root.RetouchColorStyles.fromComputed(raw);}catch{
   const literalHSL=/^hsla?\([^()]+\)$/i.test(raw)&&! /\bfrom\b/i.test(raw),named=/^[a-z]+$/i.test(raw)&&!contextualColors.has(raw.toLowerCase());
   if((!literalHSL&&!named)||!CSS.supports('color',raw))return null;
   const probe=document.createElement('span');probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none';probe.style.color=raw;document.body.append(probe);
   try{normalized=root.RetouchColorStyles.fromComputed(getComputedStyle(probe).color);}finally{probe.remove();}
  }
  const color=root.RetouchPaletteValues.parse(normalized);
  if(color.space==='srgb'&&raw.endsWith(')')){const body=raw.slice(raw.indexOf('(')+1,-1),parts=body.split(','),alpha=body.includes('/')?body.split('/').at(-1).trim():parts.length===4?parts[3].trim():null;if(alpha!==null&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/i.test(alpha))color.alpha=clamp(parseFloat(alpha)/(alpha.endsWith('%')?100:1));}
  return color;
 }
 function open(input){
  if(!input.isConnected||input.matches(':disabled'))return;
  const draftPreview=input.retouchPaintPreview?.();
  const original=input.value,I=root.RetouchInspector,dialog=document.createElement('dialog');dialog.className='paint-picker';dialog.retouchSourceInput=input;dialog.setAttribute('aria-label','Edit '+input.getAttribute('aria-label'));document.body.append(dialog);
  const heading=document.createElement('h3');heading.textContent='Color';dialog.append(heading);
  const plane=document.createElement('div');plane.className='paint-plane';plane.tabIndex=0;plane.setAttribute('role','slider');plane.setAttribute('aria-label','Saturation and brightness');plane.setAttribute('aria-valuemin','0');plane.setAttribute('aria-valuemax','100');const handle=document.createElement('span');plane.append(handle);dialog.append(plane);
  const hue=document.createElement('input');hue.type='range';hue.min=0;hue.max=359;hue.step=1;I.field(dialog,'Hue',hue);hue.className='paint-hue';
  let channelModel='rgb';const model=I.select(dialog,'Color model',[['rgb','RGB'],['hsl','HSL'],['p3','Display P3']],'rgb',next=>{channelModel=next;syncChannels();});model.querySelector('[value=p3]').disabled=true;
  const channels=document.createElement('div');channels.className='paint-channels';const channelNames=['Red','Green','Blue'],channelInputs=channelNames.map((label,index)=>{const field=document.createElement('input');field.type='number';field.min=0;field.required=true;I.field(channels,label,field);field.parentElement.querySelector('span').textContent=label[0];field.oninput=()=>{if(!parsed||field.value===''||!field.checkValidity())return;if(parsed.space==='srgb'&&channelModel==='hsl'){const values=hsl(parsed.channels);values[index]=Number(field.value);parsed.channels=hslRGB(...values);}else parsed.channels[index]=Number(field.value)/(parsed.space==='srgb'?255:1);value.value=parsed.space==='srgb'?srgbValue(parsed.channels,parsed.alpha):root.RetouchPaletteValues.p3(parsed.channels,parsed.alpha);sync(false,field);};return field;});dialog.append(channels);
  const opacity=document.createElement('input');opacity.type='range';opacity.min=0;opacity.max=100;opacity.step=.1;opacity.className='paint-opacity';opacity.setAttribute('aria-label','Opacity (%)');
  const opacityNumber=document.createElement('input');opacityNumber.type='number';opacityNumber.min=0;opacityNumber.max=100;opacityNumber.step='any';opacityNumber.setAttribute('aria-label','Opacity value (%)');
  const opacityRow=document.createElement('div');opacityRow.className='inspector-field';const opacityLabel=document.createElement('span');opacityLabel.textContent='Opacity %';const opacityControls=document.createElement('div');opacityControls.className='paint-opacity-controls';opacityControls.append(opacity,opacityNumber);opacityRow.append(opacityLabel,opacityControls);dialog.append(opacityRow);
  const preview=document.createElement('div');preview.className='paint-preview';preview.setAttribute('role','img');preview.setAttribute('aria-label','Color preview');dialog.append(preview);
  const value=document.createElement('input');value.value=original;value.spellcheck=false;I.field(dialog,'Color value',value);
  const status=I.note(dialog,'');status.setAttribute('role','status');
  let parsed=null,h=0,s=0,v=0,drag=null;
  function read(){try{return parsePaint(value.value.trim());}catch{return null;}}
  function valid(){const color=value.value.trim();return root.RetouchHTMLCSSValues.valid('color',color)&&CSS.supports('color',color);}
  function paint(){plane.style.backgroundColor='hsl('+h+' 100% 50%)';handle.style.left=s*100+'%';handle.style.top=(1-v)*100+'%';plane.setAttribute('aria-valuenow',String(Math.round(v*100)));plane.setAttribute('aria-valuetext',Math.round(s*100)+'% saturation, '+Math.round(v*100)+'% brightness');hue.value=String(h);}
  function sync(preserveOpacity=false,preserveChannel=null){
   value.setCustomValidity(valid()?'':'Enter a supported CSS color.');if(valid())draftPreview?.update(value.value.trim());if(valid())preview.style.backgroundImage='linear-gradient('+value.value+','+value.value+'),repeating-conic-gradient(#ddd 0% 25%,white 0% 50%)';
   parsed=read();const srgb=parsed?.space==='srgb';plane.hidden=!srgb;hue.parentElement.hidden=!srgb;channels.hidden=!parsed;opacity.disabled=!parsed;opacityNumber.disabled=!parsed;model.disabled=!srgb;model.value=srgb?channelModel:parsed?'p3':channelModel;
   status.textContent=parsed?'':valid()?'Use the CSS value to edit this color.':'';
   if(parsed){opacity.value=String(parsed.alpha*100);if(preserveOpacity!==true)opacityNumber.value=String(Number((parsed.alpha*100).toPrecision(12)));paintOpacity();syncChannels(preserveChannel);if(srgb){[h,s,v]=hsv(parsed.channels);paint();}}
  }
  function syncChannels(preserve=null){if(!parsed)return;const srgb=parsed.space==='srgb',asHSL=srgb&&channelModel==='hsl',values=asHSL?hsl(parsed.channels):parsed.channels.map(n=>srgb?Math.round(n*255):n),names=asHSL?['Hue (deg)','Saturation (%)','Lightness (%)']:channelNames.map(name=>srgb?name+' (0–255)':'Display P3 '+name.toLowerCase());channelInputs.forEach((field,index)=>{field.max=asHSL?(index===0?360:100):srgb?255:1;field.step=srgb&&!asHSL?1:'any';field.setAttribute('aria-label',names[index]);field.parentElement.querySelector('span').textContent=asHSL?'HSL'[index]:channelNames[index][0];if(field!==preserve)field.value=String(asHSL?Number(values[index].toFixed(2)):Number(values[index].toPrecision(12)));});}

  function paintOpacity(){if(!parsed)return;const [clear,solid]=[0,1].map(alpha=>parsed.space==='display-p3'?root.RetouchPaletteValues.p3(parsed.channels,alpha):'rgb('+parsed.channels.map(n=>Math.round(n*255)).join(' ')+' / '+alpha+')');opacity.style.backgroundImage='linear-gradient(to right,'+clear+','+solid+'),repeating-conic-gradient(#ddd 0% 25%,white 0% 50%)';}
  function fromHSV(){const alpha=parsed?.alpha??1;value.value=srgbValue(rgb(h,s,v),alpha);parsed=read();preview.style.backgroundImage='linear-gradient('+value.value+','+value.value+'),repeating-conic-gradient(#ddd 0% 25%,white 0% 50%)';value.setCustomValidity('');draftPreview?.update(value.value);paint();paintOpacity();syncChannels();}
  hue.oninput=()=>{h=Number(hue.value);fromHSV();};
  const setAlpha=(percent,preserve)=>{if(!parsed)return;const alpha=percent/100;value.value=parsed.space==='display-p3'?root.RetouchPaletteValues.p3(parsed.channels,alpha):srgbValue(parsed.channels,alpha);sync(preserve);};
  opacity.oninput=()=>setAlpha(Number(opacity.value),false);opacityNumber.oninput=()=>{if(opacityNumber.value!==''&&opacityNumber.checkValidity())setAlpha(Number(opacityNumber.value),true);};opacityNumber.onblur=()=>{if(opacityNumber.value!==''&&opacityNumber.checkValidity())sync();};
  value.oninput=sync;
  const point=event=>{const box=plane.getBoundingClientRect();s=clamp((event.clientX-box.left)/box.width);v=1-clamp((event.clientY-box.top)/box.height);fromHSV();};
  plane.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();plane.focus();drag=event.pointerId;plane.setPointerCapture(drag);point(event);};plane.onpointermove=event=>{if(event.pointerId===drag)point(event);};plane.onpointerup=plane.onpointercancel=()=>{drag=null;};
  plane.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return;event.preventDefault();event.stopPropagation();const step=event.shiftKey?0.1:0.01;if(event.key==='ArrowLeft')s=clamp(s-step);if(event.key==='ArrowRight')s=clamp(s+step);if(event.key==='ArrowUp')v=clamp(v+step);if(event.key==='ArrowDown')v=clamp(v-step);fromHSV();};
  function apply(){const invalidChannel=!channels.hidden&&channelInputs.find(field=>!field.checkValidity());if(invalidChannel){invalidChannel.reportValidity();return;}if(!opacityNumber.disabled&&(opacityNumber.value===''||!opacityNumber.checkValidity())){opacityNumber.required=true;opacityNumber.reportValidity();return;}if(!valid()){value.reportValidity();return;}const next=value.value.trim();draftPreview?.restore();dialog.close();if(input.isConnected&&next!==original){root.RetouchPanelFocus?.queue(input);input.value=next;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}}
  const actions=document.createElement('div');actions.className='paint-picker-actions';actions.append(I.button('Cancel',()=>{draftPreview?.restore();dialog.close();}),I.button('Apply color',apply));dialog.append(actions);
  const position=()=>{if(!dialog.open)return;const anchor=input.getBoundingClientRect(),box=dialog.getBoundingClientRect();dialog.style.left=Math.max(8,Math.min(innerWidth-box.width-8,anchor.left-box.width-16))+'px';dialog.style.top=Math.max(8,Math.min(innerHeight-box.height-8,anchor.top-box.height/2))+'px';};
  const resizeObserver=new ResizeObserver(position);resizeObserver.observe(dialog);
  const observer=new MutationObserver(()=>{if(!input.isConnected){draftPreview?.restore();dialog.close();}});observer.observe(document.body,{childList:true,subtree:true});
  dialog.addEventListener('cancel',()=>draftPreview?.restore());
  dialog.addEventListener('close',()=>{resizeObserver.disconnect();observer.disconnect();draftPreview?.restore();root.removeEventListener('resize',position);dialog.remove();if(input.isConnected)input.focus();},{once:true});
  dialog.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Enter'&&!event.isComposing&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&event.target.matches('input:not([type=range])')){event.preventDefault();apply();}});sync();dialog.showModal();position();root.addEventListener('resize',position);value.focus();
 }
 root.RetouchPaintPicker={open,gradientPreview};
})(window);
