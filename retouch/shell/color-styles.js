(function(root){
 'use strict';
 let expanded=false,preferred='',target='color';
 function normalize(value){return root.RetouchPaletteValues.parse(value).value;}
 function fromComputed(value){
  const refuse=()=>{throw Error('This paint is not a supported solid color. Enter hex or Display P3 explicitly.');};
  if(typeof value!=='string')return refuse();value=value.trim();if(value.startsWith('#')||value.startsWith('color(display-p3 '))return normalize(value);if(value==='transparent')return '#00000000';
  const rgb=/^rgba?\(([^()]+)\)$/.exec(value),srgb=/^color\(srgb\s+([^()]+)\)$/.exec(value);if(!rgb&&!srgb)return refuse();
  const raw=(rgb||srgb)[1];let channels,alpha='1';
  if(raw.includes(',')){if(!rgb||raw.includes('/'))return refuse();channels=raw.split(',').map(part=>part.trim());if(channels.length===4)alpha=channels.pop();}
  else {const parts=raw.split('/');if(parts.length>2)return refuse();channels=parts[0].trim().split(/\s+/);if(parts.length===2)alpha=parts[1].trim();}
  if(channels.length!==3)return refuse();
  const number=(part,max)=>{if(!/^(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(part))return refuse();const n=parseFloat(part),limit=part.endsWith('%')?100:max;if(n>limit)return refuse();return Math.round(n/limit*255).toString(16).padStart(2,'0');};
  return '#'+channels.map(part=>number(part,srgb?1:255)).join('')+number(alpha,1);
 }
 // Resolve each paint property independently: an unrelated link at a nearer
 // breakpoint must not hide this property's narrower-scope connection.
 function inheritedLink(links,width,property){
  if(!Number.isInteger(width)||width<=0||links?.[width]?.[property])return null;
  const scope=Object.keys(links||{}).map(Number).filter(value=>Number.isInteger(value)&&value>=0&&value<width&&links[value]?.[property]).sort((a,b)=>b-a)[0];
  return scope===undefined?null:{link:links[scope][property],width:scope,label:scope?scope+'px and larger':'All sizes'};
 }
 function mount(parent,options={}){
  const I=root.RetouchInspector,details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Saved color styles';details.append(summary);parent.append(details);
  const status=I.note(details,'');status.setAttribute('role','status');status.setAttribute('aria-live','polite');const controls=document.createElement('fieldset');controls.style.cssText='border:0;padding:0;margin:0;min-width:0';details.append(controls);
  let library=null,selected=preferred,busy=false;
  async function request(operation){if(operation)return root.RetouchColorStyleRequest(operation);const response=await fetch('/rt/__api/color-styles',{headers:{'x-retouch-token':root.__RT_TOKEN},signal:AbortSignal.timeout(15000)}),value=await response.json();if(!response.ok||!value.ok)throw Error(value.reason||'Could not load color styles.');return value;}
  async function run(action,message=''){if(busy)return;busy=true;controls.disabled=true;status.textContent='Working…';try{await action();if(details.isConnected){render();status.textContent=message;}}catch(error){if(details.isConnected)status.textContent=error.message;}finally{busy=false;controls.disabled=false;}}
  const load=()=>run(async()=>{library=await request();});
  function render(){
   controls.replaceChildren();controls.append(I.button('Reload color styles',load));if(!library)return;
   const style=library.styles.find(item=>item.id===selected);if(!style)selected='';
   I.select(controls,'Saved color style',[['','New color…'],...library.styles.map(item=>[item.id,item.name])],selected,value=>{selected=value;preferred=value;render();});
   if(options.apply){
    I.select(controls,'Color target',[['color','Text'],['background-color','Background'],['border-color','Border'],['fill','SVG fill'],['stroke','SVG stroke']],target,value=>{target=value;render();});
    if(options.selection){
     const links=options.selection.map(info=>info.colorStyleLinks?.[options.width]?.[target]).filter(Boolean),overrides=options.selection.filter(info=>info.colorStyleOverrides?.[options.width]?.includes(target)).length;
     I.note(controls,links.length+' of '+options.selection.length+' layers linked in this screen scope'+(new Set(links.map(link=>link.id)).size>1?' · Mixed colors.':'.'));
     if(links.length){
      I.note(controls,overrides+' local '+(overrides===1?'override.':'overrides.'));
      const reset=I.button('Reset selected color overrides',()=>run(()=>options.resetSelection(library.revision,target),'Selected colors reset.'));reset.disabled=!overrides;controls.append(reset,I.button('Detach selected colors',()=>run(()=>options.detachSelection(target),'Selected colors detached.')));
      I.note(controls,'Reset follows each layer’s linked color. Detach keeps its appearance. Unlinked layers stay unchanged.');
     }
    }
    const link=options.links?.[target];
    if(link){const definition=library.styles.find(item=>item.id===link.id),overridden=options.overrides?.includes(target);I.note(controls,'Linked color: '+(definition?.name||'Unavailable style')+(overridden?' · Local override.':'.'));
     const reset=I.button('Reset linked color',()=>run(()=>options.reset(link.id,library.revision,target),'Linked color reset.'));reset.disabled=!definition||!overridden;controls.append(reset,I.button('Detach linked color',()=>run(()=>options.detach(target),'Color detached.')));
    }
    const inherited=!link&&(options.inherited?options.inherited(target):inheritedLink(options.allLinks,options.width,target));
    if(inherited){
     const definition=library.styles.find(item=>item.id===inherited.link.id);
     I.note(controls,'Inherited color: '+(definition?.name||'Unavailable style')+' · '+inherited.label);
     I.note(controls,'Local paint can override this inherited color. Apply it here to create a link for this screen scope and larger, leaving smaller screens unchanged.');
     const applyHere=I.button('Apply inherited color at this scope',()=>run(()=>options.apply(inherited.link.id,library.revision,target),'Color applied.'));applyHere.disabled=!definition;controls.append(applyHere);
    }
    if(style)controls.append(I.button('Apply color style',()=>run(()=>options.apply(style.id,library.revision,target),'Color applied.')));
    I.note(controls,'Applies at the selected screen scope. Palette updates follow links across project pages; local overrides are preserved.');
   }
   const name=document.createElement('input');name.type='text';name.maxLength=80;name.value=style?.name||'';name.placeholder='Brand, Surface, Accent…';I.field(controls,'Color style name',name);
   const hex=document.createElement('input');hex.type='text';hex.value=normalize(style?.properties.color||'#2563eb');hex.spellcheck=false;hex.placeholder='#RRGGBBAA or color(display-p3 1 0 0 / 1)';I.field(controls,'Color value with alpha',hex);
   const conversion=document.createElement('div'),spacePicker=I.select(controls,'Color space',[['srgb','sRGB'],['display-p3','Display P3']],root.RetouchPaletteValues.parse(hex.value).space,space=>{
    try{const result=root.RetouchPaletteValues.convert(hex.value.trim(),space);if(result.clipped){spacePicker.value=root.RetouchPaletteValues.parse(hex.value.trim()).space;conversion.replaceChildren();I.note(conversion,'This color is outside sRGB. Clipping changes its appearance and stores 8-bit channels.');conversion.append(I.button('Convert to sRGB with clipping',()=>{hex.value=root.RetouchPaletteValues.convert(hex.value.trim(),'srgb',true).value;sync();}),I.button('Keep Display P3',()=>conversion.replaceChildren()));}else{hex.value=result.value;sync();}}catch(error){status.textContent=error.message;}
   });controls.append(conversion);
   const picker=document.createElement('input');picker.type='color';I.field(controls,'Color RGB',picker);
   const p3Group=document.createElement('div'),p3Inputs=['Red','Green','Blue'].map((label,index)=>{const input=document.createElement('input');input.type='number';input.min=0;input.max=1;input.step='any';I.field(p3Group,'Display P3 '+label.toLowerCase()+' (0–1)',input);input.onchange=()=>{if(input.value===''||!input.checkValidity())return;try{const parsed=root.RetouchPaletteValues.parse(hex.value.trim());if(parsed.space!=='display-p3')return;parsed.channels[index]=Number(input.value);hex.value=root.RetouchPaletteValues.p3(parsed.channels,parsed.alpha);sync();}catch{}};return input;});controls.append(p3Group);
   const opacity=document.createElement('input');opacity.type='number';opacity.min=0;opacity.max=100;opacity.step='any';I.field(controls,'Color opacity (%)',opacity);
   const background=document.createElement('div');background.style.cssText='height:32px;background:conic-gradient(#bbb 25%,#fff 0 50%,#bbb 0 75%,#fff 0) 0 0/12px 12px';const swatch=document.createElement('div');swatch.style.height='100%';swatch.setAttribute('role','img');background.append(swatch);controls.append(background);
   function sync(updateOpacity=true){try{const value=normalize(hex.value.trim());hex.setCustomValidity('');const parsed=root.RetouchPaletteValues.parse(value);spacePicker.value=parsed.space;conversion.replaceChildren();picker.disabled=parsed.space!=='srgb';p3Group.hidden=parsed.space!=='display-p3';if(!p3Group.hidden)p3Inputs.forEach((input,index)=>{input.value=String(parsed.channels[index]);});picker.title=picker.disabled?'Display P3: edit the color value to retain its gamut.':'';if(!picker.disabled)picker.value=value.slice(0,7);if(updateOpacity)opacity.value=String(Math.round(parsed.alpha*10000)/100);swatch.style.backgroundColor=value;swatch.setAttribute('aria-label','Color preview '+value);}catch(error){hex.setCustomValidity(error.message);}}
   if(options.readColor)controls.append(I.button('Use selected layer color',()=>{try{hex.value=fromComputed(options.readColor(target));sync();status.textContent='Layer color copied into the editor. Save to update the palette.';}catch(error){status.textContent=error.message;}}));
   hex.oninput=sync;picker.oninput=()=>{let alpha='ff';try{alpha=normalize(hex.value.trim()).slice(7);}catch{}hex.value=picker.value+alpha;sync();};opacity.oninput=()=>{if(opacity.value!==''&&opacity.checkValidity()){try{const parsed=root.RetouchPaletteValues.parse(hex.value.trim());hex.value=parsed.space==='display-p3'?root.RetouchPaletteValues.p3(parsed.channels,Number(opacity.value)/100):picker.value+Math.round(Number(opacity.value)/100*255).toString(16).padStart(2,'0');sync(false);}catch{}}};sync();
   controls.append(I.button(style?'Update color style':'Create color style',()=>{if(!name.value.trim()){name.setCustomValidity('Give the color style a name.');name.reportValidity();return;}name.setCustomValidity('');if(!hex.checkValidity()){hex.reportValidity();return;}if(!opacity.checkValidity()){opacity.reportValidity();return;}run(async()=>{library=await request({type:style?'update':'create',revision:library.revision,...(style?{id:style.id}:{}),name:name.value.trim(),properties:{color:normalize(hex.value.trim())}});selected=library.id;preferred=selected;},'Color style saved.');}));name.oninput=()=>name.setCustomValidity('');
   if(style){const remove=I.button('Delete color style',()=>{const confirm=I.button('Confirm delete color '+style.name,()=>run(async()=>{library=await request({type:'delete',revision:library.revision,id:style.id});selected='';preferred='';},'Color style deleted.'));remove.replaceWith(confirm,I.button('Cancel color deletion',render));confirm.focus();});controls.append(remove);}
   const transfer=document.createElement('details'),title=document.createElement('summary');title.textContent='Import / export colors';transfer.append(title);controls.append(transfer);
   transfer.append(I.button('Export color styles',()=>run(async()=>{library=await request();const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,styles:library.styles},null,2)+'\n'],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='retouch-color-styles.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);},'Color styles exported.')));
   const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.setAttribute('aria-label','Color style library file');transfer.append(I.button('Import color styles',()=>file.click()),file);
   file.onchange=()=>{const chosen=file.files[0];file.value='';if(!chosen)return;run(async()=>{if(chosen.size>512*1024)throw Error('Color style files must be 512 KB or smaller.');let incoming;try{incoming=JSON.parse(await chosen.text());}catch{throw Error('Choose a valid color-style JSON library.');}if(!details.isConnected)return;library=await request({type:'import',revision:library.revision,library:incoming});},'Colors imported. Existing styles were preserved.');};
   I.note(controls,'Palette colors support sRGB hex and Display P3 with alpha. Import adds styles without replacing existing definitions.');
  }
  render();details.ontoggle=()=>{if(!details.isConnected)return;expanded=details.open;if(details.open&&!library)load();};details.open=expanded;
 }
 root.RetouchColorStyles={mount,normalize,inheritedLink,fromComputed};
})(window);
