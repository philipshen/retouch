(function(root){
 'use strict';
 const clamp=n=>Math.max(0,Math.min(1,n));
 function hsv(rgb){const max=Math.max(...rgb),min=Math.min(...rgb),delta=max-min;let h=0;if(delta){const i=rgb.indexOf(max);h=60*(i===0?(rgb[1]-rgb[2])/delta:i===1?(rgb[2]-rgb[0])/delta+2:(rgb[0]-rgb[1])/delta+4);}return [(h+360)%360,max?delta/max:0,max];}
 function rgb(h,s,v){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;return (h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x]).map(n=>n+m);}
 function hsl(channels){const max=Math.max(...channels),min=Math.min(...channels),l=(max+min)/2,delta=max-min;return [hsv(channels)[0],delta?delta/(1-Math.abs(2*l-1))*100:0,l*100];}
 function hslRGB(h,s,l){s/=100;l/=100;const v=l+s*Math.min(l,1-l);return rgb((h%360+360)%360,v?2*(1-l/v):0,v);}
 function gradientPreview({el,group,preview,gradient,gradients,index,stopIndex}){
  const serialize=root.RetouchHTMLCSSValues.serializeGradients,canvas=propertyPreview({el,input:group,property:'background-image'});let restored=false;
  const paint=next=>{preview.style.backgroundImage=serialize([next]);const strip=group.querySelector('.gradient-stop-strip'),handle=group.querySelector('[data-stop-index="'+stopIndex+'"]');if(strip)strip.style.backgroundImage=serialize([{...next,type:'linear',angle:90}]);if(handle)handle.style.backgroundColor=next.stops[stopIndex].color;};
  return {update(color){if(restored||!el.isConnected||!group.isConnected)return;const next={...gradient,stops:gradient.stops.map((stop,i)=>i===stopIndex?{...stop,color}:stop)};canvas.update(serialize(gradients.map((item,i)=>i===index?next:item)));paint(next);},restore(){if(restored)return;restored=true;canvas.restore();paint(gradient);}};
 }
 function shadowPreview({el,group,shadows,index}){
  const canvas=propertyPreview({el,input:group,property:'box-shadow'});
  return {update:color=>canvas.update(root.RetouchHTMLCSSValues.serializeShadows(shadows.map((shadow,i)=>i===index?{...shadow,color}:shadow))),restore:()=>canvas.restore()};
 }
 function propertyPreview({el,input,property,respectScope=true}){
  const properties=property==='border-color'?['border-top-color','border-right-color','border-bottom-color','border-left-color']:root.RetouchHTMLCSSValues.families[property]||[property],originalStyle=el.getAttribute('style'),original=properties.map(name=>({name,value:el.style.getPropertyValue(name),priority:el.style.getPropertyPriority(name)}));let lastStyle=null,last=null,restored=false;
  return {update(color){if(restored||!el.isConnected||!input.isConnected||respectScope&&input.ownerDocument.querySelector('[aria-label="Edit range status"]')?.dataset.match==='false')return;el.style.setProperty(property,color,'important');last=properties.map(name=>el.style.getPropertyValue(name));lastStyle=el.getAttribute('style');},restore(){if(restored)return;restored=true;if(last===null)return;if(el.getAttribute('style')===lastStyle){if(originalStyle===null)el.removeAttribute('style');else el.setAttribute('style',originalStyle);}else original.forEach(({name,value,priority},index)=>{if(el.style.getPropertyValue(name)===last[index]&&el.style.getPropertyPriority(name)==='important'){if(value)el.style.setProperty(name,value,priority);else el.style.removeProperty(name);}});}};
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
 const recentKey='retouch:recent-colors:v1';let recentMemory=[];
 function colorKey(value){try{const color=parsePaint(value);return JSON.stringify([color.space,color.channels.map(n=>Number(n.toPrecision(12))),Number(color.alpha.toPrecision(12))]);}catch{return null;}}
 function recentColors(){
  let entries=recentMemory;try{const saved=JSON.parse(localStorage.getItem(recentKey)||'[]');if(Array.isArray(saved))entries=[...recentMemory,...saved];}catch{}
  const seen=new Set(),colors=[];for(const value of entries.slice(0,48)){if(typeof value!=='string'||value.length>256||!CSS.supports('color',value))continue;const key=colorKey(value);if(!key||seen.has(key))continue;seen.add(key);colors.push(value);if(colors.length===12)break;}return colors;
 }
 function rememberColor(value){const key=colorKey(value);if(!key)return;recentMemory=[value,...recentColors().filter(color=>colorKey(color)!==key)].slice(0,12);try{localStorage.setItem(recentKey,JSON.stringify(recentMemory));}catch{}}
 function open(input){
  if(!input.isConnected||input.matches(':disabled'))return;
  const draftPreview=input.retouchPaintPreview?.();
  const original=input.value,I=root.RetouchInspector,dialog=document.createElement('dialog');dialog.className='paint-picker';dialog.retouchSourceInput=input;dialog.setAttribute('aria-label','Edit '+input.getAttribute('aria-label'));document.body.append(dialog);
  let recentButtons=[];const updateRecent=()=>{const key=colorKey(value.value);for(const button of recentButtons)button.setAttribute('aria-pressed',String(key!==null&&key===colorKey(button.dataset.color)));};
  const header=document.createElement('div');header.className='paint-picker-header';const heading=document.createElement('h3');heading.textContent='Color';header.append(heading);dialog.append(header);
  if(document.querySelector('[aria-label="Edit range status"]')?.dataset.match==='false'){const scope=document.querySelector('[aria-label="Style screen scope"]')?.selectedOptions[0]?.textContent||'the selected breakpoint',note=document.createElement('p');note.className='paint-scope-note';note.setAttribute('role','status');note.setAttribute('aria-label','Color edit range');note.textContent='Applies to '+scope+'. The current canvas is outside this range.';dialog.append(note);}
  const plane=document.createElement('div');plane.className='paint-plane';plane.tabIndex=0;plane.setAttribute('role','slider');plane.setAttribute('aria-label','Saturation and brightness');plane.setAttribute('aria-valuemin','0');plane.setAttribute('aria-valuemax','100');const handle=document.createElement('span');plane.append(handle);dialog.append(plane);
  const hue=document.createElement('input');hue.type='range';hue.min=0;hue.max=359;hue.step=1;I.field(dialog,'Hue',hue);hue.className='paint-hue';
  const profile=I.select(dialog,'Color profile',[['srgb','sRGB'],['display-p3','Display P3']],'srgb',space=>convertProfile(space));
  let channelModel='rgb';const model=I.select(dialog,'Color model',[['hex','Hex'],['rgb','RGB'],['hsb','HSB'],['hsl','HSL'],['css','CSS']],'rgb',next=>{channelModel=next;syncChannels();});
  const conversion=document.createElement('div');conversion.className='paint-conversion';dialog.append(conversion);
  function convertProfile(space,clip=false){
   const color=read();if(!color){sync();return;}
   const palette=root.RetouchPaletteValues,source=color.space==='display-p3'?palette.p3(color.channels,1):srgbValue(color.channels,1),result=palette.convert(source,space,clip);
   if(result.clipped&&!clip){profile.value=color.space;conversion.replaceChildren();I.note(conversion,'This color is outside sRGB. Clipping may change its appearance.');conversion.append(I.button('Convert to sRGB',()=>convertProfile('srgb',true)),I.button('Keep Display P3',()=>{conversion.replaceChildren();profile.focus();}));return;}
   const converted=palette.parse(result.value);value.value=space==='display-p3'?palette.p3(converted.channels,color.alpha):srgbValue(converted.channels,color.alpha);sync();
  }
  const channels=document.createElement('div');channels.className='paint-channels';const channelNames=['Red','Green','Blue'],channelInputs=channelNames.map((label,index)=>{const field=document.createElement('input');field.type='number';field.min=0;field.required=true;I.field(channels,label,field);field.parentElement.querySelector('span').textContent=label[0];field.oninput=()=>{if(!parsed||field.value===''||!field.checkValidity())return;let nextHSV=null,nextHSL=null;if(['hsl','hsb'].includes(channelModel)){const values=channelModel==='hsl'?[...hslDraft]:[h,s*100,v*100];values[index]=Number(field.value);parsed.channels=channelModel==='hsl'?hslRGB(...values):rgb(values[0]%360,values[1]/100,values[2]/100);if(channelModel==='hsb')nextHSV=[values[0]%360,values[1]/100,values[2]/100];else{nextHSL=values;nextHSV=hsv(parsed.channels);nextHSV[0]=values[0]%360;}}else parsed.channels[index]=Number(field.value)/(parsed.space==='srgb'?255:1);value.value=parsed.space==='srgb'?srgbValue(parsed.channels,parsed.alpha):root.RetouchPaletteValues.p3(parsed.channels,parsed.alpha);sync(false,field,nextHSV,nextHSL);};return field;});dialog.append(channels);
  const hex=document.createElement('input');hex.type='text';hex.spellcheck=false;hex.required=true;hex.placeholder='RRGGBB';I.field(dialog,'Hex',hex);hex.setAttribute('aria-label','Hex color');const hexRow=hex.parentElement;hexRow.hidden=true;hex.oninput=()=>{const text=hex.value.trim(),valid=/^#?(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(text);hex.setCustomValidity(valid?'':'Enter three, four, six or eight hexadecimal digits.');if(!valid||!parsed)return;let digits=text.replace(/^#/,'');if(digits.length<=4)digits=[...digits].map(c=>c+c).join('');value.value=paintValue([0,2,4].map(index=>parseInt(digits.slice(index,index+2),16)/255),digits.length===8?parseInt(digits.slice(6),16)/255:parsed.alpha);sync(false,hex);};
  const opacity=document.createElement('input');opacity.type='range';opacity.min=0;opacity.max=100;opacity.step=.1;opacity.className='paint-opacity';opacity.setAttribute('aria-label','Opacity (%)');
  const opacityNumber=document.createElement('input');opacityNumber.type='number';opacityNumber.min=0;opacityNumber.max=100;opacityNumber.step='any';opacityNumber.setAttribute('aria-label','Opacity value (%)');
  const opacityRow=document.createElement('div');opacityRow.className='inspector-field';const opacityLabel=document.createElement('span');opacityLabel.textContent='Opacity %';const opacityControls=document.createElement('div');opacityControls.className='paint-opacity-controls';opacityControls.append(opacity,opacityNumber);opacityRow.append(opacityLabel,opacityControls);dialog.append(opacityRow);
  const preview=document.createElement('div');preview.className='paint-preview';preview.setAttribute('role','img');preview.setAttribute('aria-label','Color preview');dialog.append(preview);
  const value=document.createElement('input');value.value=original==='none'&&['fill','stroke'].includes(input.dataset.paintProperty)?'#000000':original;value.spellcheck=false;I.field(dialog,'Color value',value);
  const status=I.note(dialog,'');status.setAttribute('role','status');
  let sampling=null;const EyeDropper=typeof root.EyeDropper==='function'?root.EyeDropper:root.RetouchNativeEyeDropper;
  const sampleStatus=I.note(dialog,'');sampleStatus.hidden=true;sampleStatus.setAttribute('role','status');sampleStatus.setAttribute('aria-label','Screen color sampling');
  const sample=I.button('',async()=>{
   if(sampling)return;const controller=new AbortController();sampling=controller;sample.disabled=true;sample.setAttribute('aria-busy','true');sampleStatus.hidden=true;const sampleColor=read(),alpha=sampleColor?.alpha??1;
   try{const result=await new EyeDropper().open({signal:controller.signal});if(controller.signal.aborted||!dialog.open||!input.isConnected)return;if(!/^#[a-f\d]{6}$/i.test(result?.sRGBHex))throw Error('Invalid sampled color');if(sampleColor?.space==='display-p3'){const palette=root.RetouchPaletteValues,converted=palette.parse(palette.convert(result.sRGBHex,'display-p3').value);value.value=palette.p3(converted.channels,alpha);}else value.value=srgbValue([1,3,5].map(index=>parseInt(result.sRGBHex.slice(index,index+2),16)/255),alpha);sync();}
   catch(error){if(dialog.open&&!controller.signal.aborted&&error?.name!=='AbortError'){sampleStatus.textContent='Could not sample a screen color. Try again or enter a color.';sampleStatus.hidden=false;}}
   finally{if(sampling===controller){sampling=null;sample.disabled=false;sample.removeAttribute('aria-busy');if(dialog.open)sample.focus();}}
  });
  sample.className='paint-eyedropper';sample.setAttribute('aria-label','Pick color from screen');sample.title=typeof EyeDropper==='function'?'Pick color from screen':'Screen color sampling is unavailable in this browser';sample.disabled=typeof EyeDropper!=='function';
  sample.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 5 5 5M13 6 4 15v5h5l9-9M15 7l3-3a2.1 2.1 0 0 1 3 3l-3 3M4 20l-1 1"/></svg>';header.append(sample);
  let parsed=null,h=0,s=0,v=0,drag=null,hslDraft=[0,0,0];
  function read(){try{return parsePaint(value.value.trim());}catch{return null;}}
  function valid(){const color=value.value.trim();return root.RetouchHTMLCSSValues.valid('color',color)&&CSS.supports('color',color);}
  function paintValue(channels,alpha){return parsed?.space==='display-p3'?root.RetouchPaletteValues.p3(channels.map(n=>Number(clamp(n).toPrecision(12))),alpha):srgbValue(channels,alpha);}
  function paint(){
   const p3=parsed?.space==='display-p3';plane.style.backgroundColor=p3?paintValue(rgb(h,1,1),1):'hsl('+h+' 100% 50%)';
   if(p3){plane.style.backgroundImage='linear-gradient(to top in display-p3,color(display-p3 0 0 0),color(display-p3 0 0 0 / 0)),linear-gradient(to right in display-p3,color(display-p3 1 1 1),color(display-p3 1 1 1 / 0))';hue.style.backgroundImage='linear-gradient(to right in display-p3,'+[0,60,120,180,240,300,360].map(angle=>paintValue(rgb(angle%360,1,1),1)).join(',')+')';}
   else{plane.style.removeProperty('background-image');hue.style.removeProperty('background-image');}
handle.style.left=s*100+'%';handle.style.top=(1-v)*100+'%';plane.setAttribute('aria-valuenow',String(Math.round(v*100)));plane.setAttribute('aria-valuetext',Math.round(s*100)+'% saturation, '+Math.round(v*100)+'% brightness');hue.value=String(h);}
  function sync(preserveOpacity=false,preserveChannel=null,preserveHSV=null,preserveHSL=null){
   value.setCustomValidity(valid()?'':'Enter a supported CSS color.');if(valid())draftPreview?.update(value.value.trim());if(valid())preview.style.setProperty('--paint-color',value.value);
   parsed=read();conversion.replaceChildren();profile.disabled=!parsed;profile.value=parsed?.space||'srgb';plane.hidden=!parsed;hue.parentElement.hidden=!parsed;channels.hidden=!parsed;hexRow.hidden=true;opacity.disabled=!parsed;opacityNumber.disabled=!parsed;model.disabled=!parsed;model.value=channelModel;
   status.textContent=parsed?'':valid()?'Use the CSS value to edit this color.':'';
   if(parsed){opacity.value=String(parsed.alpha*100);if(preserveOpacity!==true)opacityNumber.value=String(Number((parsed.alpha*100).toPrecision(12)));paintOpacity();[h,s,v]=preserveHSV||hsv(parsed.channels);hslDraft=preserveHSL||hsl(parsed.channels);if(!preserveHSL)hslDraft[0]=h;paint();syncChannels(preserveChannel);}updateRecent();
  }
  function syncChannels(preserve=null){
   if(!parsed)return;const srgb=parsed.space==='srgb',asHex=channelModel==='hex',asHSL=channelModel==='hsl',asHSB=channelModel==='hsb',polar=asHSL||asHSB;
   channels.hidden=asHex||channelModel==='css';hexRow.hidden=!asHex;alphaField.hidden=channelModel==='css';if(channelModel==='css')notationRow.insertBefore(value.parentElement,alphaField);else dialog.insertBefore(value.parentElement,conversion);hex.title=srgb?'Hex channels in sRGB':'Hex channels in Display P3';hexRow.querySelector('span').textContent=srgb?'Hex':'P3 Hex';
   if(preserve!==hex){hex.value=parsed.channels.map(n=>Math.round(clamp(n)*255).toString(16).padStart(2,'0')).join('').toUpperCase();hex.setCustomValidity('');}
   const values=asHSL?hslDraft:asHSB?[h,s*100,v*100]:parsed.channels.map(n=>srgb?Math.round(n*255):n),names=polar?['Hue (deg)','Saturation (%)',asHSL?'Lightness (%)':'Brightness (%)']:channelNames.map(name=>srgb?name+' (0–255)':'Display P3 '+name.toLowerCase());
   channelInputs.forEach((field,index)=>{field.max=polar?(index===0?360:100):srgb?255:1;field.step=srgb&&!polar?1:'any';field.setAttribute('aria-label',names[index]);field.title=names[index];field.parentElement.querySelector('span').textContent=polar?(asHSL?'HSL':'HSB')[index]:channelNames[index][0];if(field!==preserve)field.value=String(polar?Number(values[index].toFixed(2)):Number(values[index].toPrecision(12)));});
  }

  function paintOpacity(){if(!parsed)return;const [clear,solid]=[0,1].map(alpha=>parsed.space==='display-p3'?root.RetouchPaletteValues.p3(parsed.channels,alpha):'rgb('+parsed.channels.map(n=>Math.round(n*255)).join(' ')+' / '+alpha+')');opacity.style.backgroundImage='linear-gradient(to right,'+clear+','+solid+'),repeating-conic-gradient(#ddd 0% 25%,white 0% 50%)';}
  function fromHSV(){const alpha=parsed?.alpha??1;value.value=paintValue(rgb(h,s,v),alpha);parsed=read();hslDraft=hsl(parsed.channels);hslDraft[0]=h;conversion.replaceChildren();preview.style.setProperty('--paint-color',value.value);value.setCustomValidity('');draftPreview?.update(value.value);paint();paintOpacity();syncChannels();updateRecent();}
  hue.oninput=()=>{h=Number(hue.value);fromHSV();};
  const setAlpha=(percent,preserve)=>{if(!parsed)return;const alpha=percent/100;value.value=parsed.space==='display-p3'?root.RetouchPaletteValues.p3(parsed.channels,alpha):srgbValue(parsed.channels,alpha);sync(preserve,null,[h,s,v],hslDraft);};
  opacity.oninput=()=>setAlpha(Number(opacity.value),false);opacityNumber.oninput=()=>{if(opacityNumber.value!==''&&opacityNumber.checkValidity())setAlpha(Number(opacityNumber.value),true);};opacityNumber.onblur=()=>{if(opacityNumber.value!==''&&opacityNumber.checkValidity())sync(false,null,parsed?[h,s,v]:null,hslDraft);};
  value.oninput=sync;
  const point=event=>{const box=plane.getBoundingClientRect();s=clamp((event.clientX-box.left)/box.width);v=1-clamp((event.clientY-box.top)/box.height);fromHSV();};
  plane.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();plane.focus();drag=event.pointerId;plane.setPointerCapture(drag);point(event);};plane.onpointermove=event=>{if(event.pointerId===drag)point(event);};plane.onpointerup=plane.onpointercancel=()=>{drag=null;};
  plane.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return;event.preventDefault();event.stopPropagation();const step=event.shiftKey?0.1:0.01;if(event.key==='ArrowLeft')s=clamp(s-step);if(event.key==='ArrowRight')s=clamp(s+step);if(event.key==='ArrowUp')v=clamp(v+step);if(event.key==='ArrowDown')v=clamp(v-step);fromHSV();};
  function apply(){if(!hexRow.hidden&&!hex.checkValidity()){hex.reportValidity();return;}const invalidChannel=!channels.hidden&&channelInputs.find(field=>!field.checkValidity());if(invalidChannel){invalidChannel.reportValidity();return;}if(!opacityNumber.disabled&&(opacityNumber.value===''||!opacityNumber.checkValidity())){opacityNumber.required=true;opacityNumber.reportValidity();return;}if(!valid()){value.reportValidity();return;}const next=value.value.trim();rememberColor(next);draftPreview?.restore();dialog.close();if(input.isConnected&&next!==original){root.RetouchPanelFocus?.queue(input);input.value=next;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}}
  const recent=recentColors();if(recent.length){
   const section=document.createElement('section');section.className='paint-recents';const heading=document.createElement('div');heading.className='paint-recents-heading';const title=document.createElement('span');title.textContent='Recent colors';const clear=I.button('Clear',()=>{recentMemory=[];try{localStorage.removeItem(recentKey);}catch{}recentButtons=[];section.remove();value.focus();});clear.setAttribute('aria-label','Clear recent colors');heading.append(title,clear);section.append(heading);
   const row=document.createElement('div');row.className='paint-recent-swatches';row.setAttribute('role','toolbar');row.setAttribute('aria-label','Recent colors');
   recentButtons=recent.map((color,index)=>{const button=document.createElement('button');button.type='button';button.dataset.color=color;button.tabIndex=index===0?0:-1;button.title=color;button.setAttribute('aria-label','Use recent color '+color);button.style.backgroundImage='linear-gradient('+color+','+color+'),repeating-conic-gradient(#ddd 0% 25%,white 0% 50%)';button.onfocus=()=>recentButtons.forEach(item=>item.tabIndex=item===button?0:-1);button.onclick=()=>{value.value=color;sync();};row.append(button);return button;});
   row.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return;const index=recentButtons.indexOf(document.activeElement);if(index<0)return;event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?recentButtons.length-1:(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+recentButtons.length)%recentButtons.length;recentButtons[next].focus();});section.append(row);dialog.append(section);
  }
  const actions=document.createElement('div');actions.className='paint-picker-actions';actions.append(I.button('Cancel',()=>{draftPreview?.restore();dialog.close();}),I.button('Apply color',apply));dialog.append(actions);
  const close=I.button('×',()=>{draftPreview?.restore();dialog.close();});close.className='paint-close';close.setAttribute('aria-label','Close color picker');close.title='Close color picker';
  profile.parentElement.classList.add('paint-profile-field');profile.title='Color profile';header.prepend(preview);header.append(profile.parentElement,close);heading.textContent='Solid';
  const sliders=document.createElement('div');sliders.className='paint-sliders';const tracks=document.createElement('div');tracks.className='paint-slider-tracks';hue.title='Hue';opacity.title='Opacity';hue.parentElement.classList.add('paint-hue-row');tracks.append(hue.parentElement,opacityRow);sliders.append(sample,tracks);dialog.insertBefore(sliders,conversion);
  const notationRow=document.createElement('div');notationRow.className='paint-notation-row';model.parentElement.classList.add('paint-model-field');model.title='Color model';
  const alphaField=document.createElement('div');alphaField.className='paint-alpha-field';const percent=document.createElement('span');percent.textContent='%';percent.setAttribute('aria-hidden','true');alphaField.append(opacityNumber,percent);opacityNumber.title='Opacity (%)';
  value.parentElement.classList.add('paint-css-field');value.title='CSS color value';notationRow.append(model.parentElement,channels,hexRow,alphaField);dialog.insertBefore(notationRow,conversion);dialog.insertBefore(value.parentElement,conversion);
  const position=()=>{if(!dialog.open)return;const anchor=input.getBoundingClientRect(),box=dialog.getBoundingClientRect();dialog.style.left=Math.max(8,Math.min(innerWidth-box.width-8,anchor.left-box.width-16))+'px';dialog.style.top=Math.max(8,Math.min(innerHeight-box.height-8,anchor.top-box.height/2))+'px';};
  const resizeObserver=new ResizeObserver(position);resizeObserver.observe(dialog);
  const observer=new MutationObserver(()=>{if(!input.isConnected){draftPreview?.restore();dialog.close();}});observer.observe(document.body,{childList:true,subtree:true});
  dialog.addEventListener('cancel',()=>draftPreview?.restore());
  dialog.addEventListener('close',()=>{sampling?.abort();resizeObserver.disconnect();observer.disconnect();draftPreview?.restore();root.removeEventListener('resize',position);dialog.remove();if(input.isConnected)input.focus();},{once:true});
  dialog.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Enter'&&!event.isComposing&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&event.target.matches('input:not([type=range])')){event.preventDefault();apply();}});sync();dialog.showModal();position();root.addEventListener('resize',position);value.focus();
 }
 root.RetouchPaintPicker={open,gradientPreview,shadowPreview,propertyPreview};
})(window);
