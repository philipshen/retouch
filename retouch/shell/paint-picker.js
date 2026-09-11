(function(root){
 'use strict';
 const clamp=n=>Math.max(0,Math.min(1,n));
 function hsv(rgb){const max=Math.max(...rgb),min=Math.min(...rgb),delta=max-min;let h=0;if(delta){const i=rgb.indexOf(max);h=60*(i===0?(rgb[1]-rgb[2])/delta:i===1?(rgb[2]-rgb[0])/delta+2:(rgb[0]-rgb[1])/delta+4);}return [(h+360)%360,max?delta/max:0,max];}
 function rgb(h,s,v){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;return (h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x]).map(n=>n+m);}
 function gradientPreview({el,group,preview,gradient,gradients,index,stopIndex}){
  const serialize=root.RetouchHTMLCSSValues.serializeGradients,originalStyle=el.getAttribute('style'),originalValue=el.style.getPropertyValue('background-image'),priority=el.style.getPropertyPriority('background-image');
  let lastStyle=originalStyle,lastValue=null,restored=false;
  const paint=next=>{preview.style.backgroundImage=serialize([next]);const strip=group.querySelector('.gradient-stop-strip'),handle=group.querySelector('[data-stop-index="'+stopIndex+'"]');if(strip)strip.style.backgroundImage=serialize([{...next,type:'linear',angle:90}]);if(handle)handle.style.backgroundColor=next.stops[stopIndex].color;};
  return {update(color){if(restored||!el.isConnected||!group.isConnected)return;const next={...gradient,stops:gradient.stops.map((stop,i)=>i===stopIndex?{...stop,color}:stop)};el.style.setProperty('background-image',serialize(gradients.map((item,i)=>i===index?next:item)),'important');lastValue=el.style.getPropertyValue('background-image');lastStyle=el.getAttribute('style');paint(next);},restore(){
   if(restored)return;restored=true;if(lastValue!==null){if(el.getAttribute('style')===lastStyle){if(originalStyle===null)el.removeAttribute('style');else el.setAttribute('style',originalStyle);}else if(el.style.getPropertyValue('background-image')===lastValue&&el.style.getPropertyPriority('background-image')==='important'){if(originalValue)el.style.setProperty('background-image',originalValue,priority);else el.style.removeProperty('background-image');}}paint(gradient);
  }};
 }
 function srgbValue(channels,alpha){const bytes=channels.map(n=>Math.round(clamp(n)*255));return Math.abs(alpha*255-Math.round(alpha*255))<1e-8?'#'+[...bytes,Math.round(alpha*255)].map(n=>n.toString(16).padStart(2,'0')).join(''):'rgb('+bytes.join(' ')+' / '+alpha+')';}
 function open(input){
  if(!input.isConnected||input.matches(':disabled'))return;
  const draftPreview=input.retouchPaintPreview?.();
  const original=input.value,I=root.RetouchInspector,dialog=document.createElement('dialog');dialog.className='paint-picker';dialog.setAttribute('aria-label','Edit '+input.getAttribute('aria-label'));document.body.append(dialog);
  const heading=document.createElement('h3');heading.textContent='Color';dialog.append(heading);
  const plane=document.createElement('div');plane.className='paint-plane';plane.tabIndex=0;plane.setAttribute('role','slider');plane.setAttribute('aria-label','Saturation and brightness');plane.setAttribute('aria-valuemin','0');plane.setAttribute('aria-valuemax','100');const handle=document.createElement('span');plane.append(handle);dialog.append(plane);
  const hue=document.createElement('input');hue.type='range';hue.min=0;hue.max=359;hue.step=1;I.field(dialog,'Hue',hue);hue.className='paint-hue';
  const channels=document.createElement('div');channels.className='paint-channels';const p3=['Red','Green','Blue'].map((label,index)=>{const field=document.createElement('input');field.type='number';field.min=0;field.max=1;field.step='any';I.field(channels,'Display P3 '+label.toLowerCase(),field);field.oninput=()=>{if(!parsed||field.value===''||!field.checkValidity())return;parsed.channels[index]=Number(field.value);value.value=root.RetouchPaletteValues.p3(parsed.channels,parsed.alpha);sync();};return field;});dialog.append(channels);
  const opacity=document.createElement('input');opacity.type='range';opacity.min=0;opacity.max=100;opacity.step=.1;opacity.className='paint-opacity';opacity.setAttribute('aria-label','Opacity (%)');
  const opacityNumber=document.createElement('input');opacityNumber.type='number';opacityNumber.min=0;opacityNumber.max=100;opacityNumber.step='any';opacityNumber.setAttribute('aria-label','Opacity value (%)');
  const opacityRow=document.createElement('div');opacityRow.className='inspector-field';const opacityLabel=document.createElement('span');opacityLabel.textContent='Opacity %';const opacityControls=document.createElement('div');opacityControls.className='paint-opacity-controls';opacityControls.append(opacity,opacityNumber);opacityRow.append(opacityLabel,opacityControls);dialog.append(opacityRow);
  const preview=document.createElement('div');preview.className='paint-preview';preview.setAttribute('role','img');preview.setAttribute('aria-label','Color preview');dialog.append(preview);
  const value=document.createElement('input');value.value=original;value.spellcheck=false;I.field(dialog,'Color value',value);
  const status=I.note(dialog,'');status.setAttribute('role','status');
  let parsed=null,h=0,s=0,v=0,drag=null;
  function read(){try{const raw=value.value.trim(),color=root.RetouchPaletteValues.parse(root.RetouchColorStyles.fromComputed(raw));if(color.space==='srgb'&&raw.endsWith(')')){const body=raw.slice(raw.indexOf('(')+1,-1),parts=body.split(','),alpha=body.includes('/')?body.split('/').at(-1).trim():parts.length===4?parts[3].trim():null;if(alpha!==null)color.alpha=parseFloat(alpha)/(alpha.endsWith('%')?100:1);}return color;}catch{return null;}}
  function valid(){const color=value.value.trim();return root.RetouchHTMLCSSValues.valid('color',color)&&CSS.supports('color',color);}
  function paint(){plane.style.backgroundColor='hsl('+h+' 100% 50%)';handle.style.left=s*100+'%';handle.style.top=(1-v)*100+'%';plane.setAttribute('aria-valuenow',String(Math.round(v*100)));plane.setAttribute('aria-valuetext',Math.round(s*100)+'% saturation, '+Math.round(v*100)+'% brightness');hue.value=String(h);}
  function sync(preserveOpacity=false){
   value.setCustomValidity(valid()?'':'Enter a supported CSS color.');if(valid())draftPreview?.update(value.value.trim());if(valid())preview.style.backgroundImage='linear-gradient('+value.value+','+value.value+'),repeating-conic-gradient(#ddd 0% 25%,white 0% 50%)';
   parsed=read();const srgb=parsed?.space==='srgb';plane.hidden=!srgb;hue.parentElement.hidden=!srgb;channels.hidden=parsed?.space!=='display-p3';opacity.disabled=!parsed;opacityNumber.disabled=!parsed;
   status.textContent=parsed?'':valid()?'Use the CSS value to edit this color.':'';
   if(parsed){opacity.value=String(parsed.alpha*100);if(preserveOpacity!==true)opacityNumber.value=String(Math.round(parsed.alpha*10000)/100);paintOpacity();if(srgb){[h,s,v]=hsv(parsed.channels);paint();}else p3.forEach((field,index)=>field.value=String(parsed.channels[index]));}
  }
  function paintOpacity(){if(!parsed)return;const [clear,solid]=[0,1].map(alpha=>parsed.space==='display-p3'?root.RetouchPaletteValues.p3(parsed.channels,alpha):'rgb('+parsed.channels.map(n=>Math.round(n*255)).join(' ')+' / '+alpha+')');opacity.style.backgroundImage='linear-gradient(to right,'+clear+','+solid+'),repeating-conic-gradient(#ddd 0% 25%,white 0% 50%)';}
  function fromHSV(){const alpha=parsed?.alpha??1;value.value=srgbValue(rgb(h,s,v),alpha);parsed=read();preview.style.backgroundImage='linear-gradient('+value.value+','+value.value+'),repeating-conic-gradient(#ddd 0% 25%,white 0% 50%)';value.setCustomValidity('');draftPreview?.update(value.value);paint();paintOpacity();}
  hue.oninput=()=>{h=Number(hue.value);fromHSV();};
  const setAlpha=(percent,preserve)=>{if(!parsed)return;const alpha=percent/100;value.value=parsed.space==='display-p3'?root.RetouchPaletteValues.p3(parsed.channels,alpha):srgbValue(parsed.channels,alpha);sync(preserve);};
  opacity.oninput=()=>setAlpha(Number(opacity.value),false);opacityNumber.oninput=()=>{if(opacityNumber.value!==''&&opacityNumber.checkValidity())setAlpha(Number(opacityNumber.value),true);};opacityNumber.onblur=()=>{if(opacityNumber.value!==''&&opacityNumber.checkValidity())sync();};
  value.oninput=sync;
  const point=event=>{const box=plane.getBoundingClientRect();s=clamp((event.clientX-box.left)/box.width);v=1-clamp((event.clientY-box.top)/box.height);fromHSV();};
  plane.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();plane.focus();drag=event.pointerId;plane.setPointerCapture(drag);point(event);};plane.onpointermove=event=>{if(event.pointerId===drag)point(event);};plane.onpointerup=plane.onpointercancel=()=>{drag=null;};
  plane.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return;event.preventDefault();event.stopPropagation();const step=event.shiftKey?0.1:0.01;if(event.key==='ArrowLeft')s=clamp(s-step);if(event.key==='ArrowRight')s=clamp(s+step);if(event.key==='ArrowUp')v=clamp(v+step);if(event.key==='ArrowDown')v=clamp(v-step);fromHSV();};
  const actions=document.createElement('div');actions.className='paint-picker-actions';actions.append(I.button('Cancel',()=>{draftPreview?.restore();dialog.close();}),I.button('Apply color',()=>{if(!opacityNumber.disabled&&(opacityNumber.value===''||!opacityNumber.checkValidity())){opacityNumber.required=true;opacityNumber.reportValidity();return;}if(!valid()){value.reportValidity();return;}const next=value.value.trim();draftPreview?.restore();dialog.close();if(input.isConnected&&next!==original){root.RetouchPanelFocus?.queue(input);input.value=next;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}}));dialog.append(actions);
  const position=()=>{const anchor=input.getBoundingClientRect(),box=dialog.getBoundingClientRect();dialog.style.left=Math.max(8,Math.min(innerWidth-box.width-8,anchor.left-box.width-16))+'px';dialog.style.top=Math.max(8,Math.min(innerHeight-box.height-8,anchor.top-box.height/2))+'px';};
  const observer=new MutationObserver(()=>{if(!input.isConnected){draftPreview?.restore();dialog.close();}});observer.observe(document.body,{childList:true,subtree:true});
  dialog.addEventListener('cancel',()=>draftPreview?.restore());
  dialog.addEventListener('close',()=>{observer.disconnect();draftPreview?.restore();root.removeEventListener('resize',position);dialog.remove();if(input.isConnected)input.focus();},{once:true});
  dialog.addEventListener('keydown',event=>event.stopPropagation());sync();dialog.showModal();position();root.addEventListener('resize',position);value.focus();
 }
 root.RetouchPaintPicker={open,gradientPreview};
})(window);
