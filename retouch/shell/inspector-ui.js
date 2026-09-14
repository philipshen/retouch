(function(root){
 'use strict';
const layoutIcons={flow:'M3 3h5v5H3z M12 3h5v5h-5z M3 12h5v5H3z M12 12h5v5h-5z',row:'M3 5v10 M8 5v10 M13 5v10 M16 10h4 M18 8l2 2-2 2',column:'M5 3h10 M5 8h10 M5 13h10 M10 16v4 M8 18l2 2 2-2',grid:'M3 3h14v14H3z M10 3v14 M3 10h14'};
 let activeTypeTab='Basics',typeTabId=0;
 const openGroups=new Set(),collapsedSections=new Set(),expandedEmptySections=new Set();
 const sectionPreferenceKey='retouch.inspector.sections.v1';
 try{const saved=JSON.parse(root.localStorage.getItem(sectionPreferenceKey));if(Array.isArray(saved))for(const name of saved.slice(0,64))if(typeof name==='string'&&name.length<=64)collapsedSections.add(name);}catch{}
 const expandedPreferenceKey='retouch.inspector.expanded-empty.v1';
 try{const saved=JSON.parse(root.localStorage.getItem(expandedPreferenceKey));if(Array.isArray(saved))for(const name of saved.slice(0,64))if(typeof name==='string'&&name.length<=64)expandedEmptySections.add(name);}catch{}
 function saveSectionPreferences(){try{root.localStorage.setItem(sectionPreferenceKey,JSON.stringify([...collapsedSections].slice(0,64)));root.localStorage.setItem(expandedPreferenceKey,JSON.stringify([...expandedEmptySections].slice(0,64)));}catch{}}

 function disclosure(title,key){const d=document.createElement('details'),s=document.createElement('summary');d.className='inspector-disclosure';s.textContent=title;d.append(s);d.open=openGroups.has(key);d.ontoggle=()=>d.open?openGroups.add(key):openGroups.delete(key);return d;}
 function compactPaint(section,input){
  const svgMatch=input.getAttribute('aria-label')?.match(/^(SVG|Combined) (fill|stroke)$/),svg=svgMatch?.[2],paint=svg||({'background-color':'Fill','border-color':'Stroke'})[input.dataset.paintProperty];if(!paint||/^url\(/i.test(input.value.trim()))return;
  const control=input.closest('.paint-field-control'),previous=input.closest('.inspector-field');if(!control||!previous)return;
  const field=document.createElement('div');field.className=previous.className+' compact-paint-row';field.append(...previous.childNodes);previous.replaceWith(field);input.classList.add('compact-paint-value');
  const type=svg?section.querySelector('[aria-label="'+(paint==='fill'?'Fill type':'Stroke type')+'"]'):null;if(type){const row=type.closest('.property-row')||type.closest('.inspector-field');type.classList.add('compact-paint-type');if(!type.title)type.title='Paint type';control.append(type);row?.remove();control.classList.add('has-paint-type');}
  const display=document.createElement('span');display.className='compact-paint-label';display.setAttribute('aria-hidden','true');control.append(display);
  const opacity=document.createElement('input'),alpha=document.createElement('span'),unit=document.createElement('span');alpha.className='compact-paint-alpha';opacity.type='number';opacity.min=0;opacity.max=100;opacity.step='any';opacity.required=true;opacity.setAttribute('aria-label',(svg?svgMatch[1]+' ':'')+paint+' opacity (%)');unit.textContent='%';unit.setAttribute('aria-hidden','true');alpha.append(opacity,unit);control.append(alpha);
  const colors=()=>{try{const values=input.dataset.paintProperty==='border-color'?root.RetouchHTMLCSSValues.parseBorderColors(input.value.trim()):[input.value.trim()],parsed=values?.map(value=>root.RetouchPaintPicker.parsePaint(value));return parsed?.length&&parsed.every(Boolean)?parsed:null;}catch{return null;}},sync=()=>{const values=colors(),value=values?.[0],mixed=values?.some(item=>item.space!==value.space||item.alpha!==value.alpha||item.channels.some((channel,i)=>channel!==value.channels[i])),mixedAlpha=values?.some(item=>item.alpha!==value.alpha);control.classList.toggle('has-compact-label',!!value);display.textContent=value?(mixed?'Mixed':value.space==='display-p3'?'Display P3':value.channels.every(n=>Math.abs(n*255-Math.round(n*255))<1e-6)?value.channels.map(n=>Math.round(n*255).toString(16).padStart(2,'0')).join('').toUpperCase():'RGB'):'';opacity.disabled=input.disabled||!value;opacity.title=input.disabled?input.title:value?'Paint opacity':'Choose a literal color to edit its opacity.';opacity.placeholder=mixedAlpha?'Mixed':'';opacity.value=value&&!mixedAlpha?String(Number((value.alpha*100).toFixed(8))):'';};
  opacity.oninput=()=>opacity.setCustomValidity('');opacity.onchange=()=>{if(!opacity.checkValidity()||input.disabled)return;const current=colors(),value=Number(opacity.value)/100;if(!current||current.every(item=>Math.abs(item.alpha-value)<1e-10))return;root.RetouchPanelFocus?.queue(opacity);input.value=current.map(item=>item.space==='display-p3'?root.RetouchPaletteValues.p3(item.channels,value):root.RetouchPaletteValues.srgb(item.channels,value)).join(' ');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
  let editColors=colors();input.addEventListener('focus',()=>{const current=colors();if(current)editColors=current;});
  // Bare hex edits the color channels; opacity remains an independent field.
  // Explicit CSS (# included) retains its usual alpha semantics.
  input.addEventListener('change',()=>{const hex=input.value.trim();if(input.disabled||!/^(?:[a-f\d]{3}|[a-f\d]{6}|[a-f\d]{8})$/i.test(hex))return;const parsed=root.RetouchPaletteValues.parse('#'+hex),values=hex.length===8?[parsed]:editColors?.length?editColors.map(item=>({...parsed,alpha:item.alpha})):[parsed];input.value=values.map(item=>root.RetouchPaletteValues.srgb(item.channels,item.alpha)).join(' ');},true);
  input.addEventListener('input',sync);input.addEventListener('change',sync);new MutationObserver(sync).observe(input,{attributes:true,attributeFilter:['disabled','title']});sync();root.RetouchNumericExpression.calculation(opacity,{unit:'%'});root.RetouchInspector.fieldDraft(opacity);
 }
 let strokeMode={key:null,custom:false};
 function strokePatternControls(settings,key){
  const raw=settings.querySelector('[aria-label="SVG dash pattern"]');if(!raw)return;
  if(strokeMode.key!==key)strokeMode={key,custom:false};
  const I=root.RetouchInspector,P=root.RetouchSVGPaint,rawRow=raw.closest('.property-row')||raw.closest('.inspector-field'),group=document.createElement('div'),style=document.createElement('select'),dash=document.createElement('input'),gap=document.createElement('input');group.className='stroke-pattern-controls';
  for(const value of ['solid','dashed','custom']){const option=document.createElement('option');option.value=value;option.textContent=value[0].toUpperCase()+value.slice(1);style.append(option);}
  I.field(group,'Stroke style',style);const reset=rawRow.querySelector('.property-reset');if(reset){const row=document.createElement('div');row.className='property-row';const field=style.closest('.inspector-field');field.before(row);row.append(field,reset);reset.addEventListener('click',()=>{strokeMode.custom=false;},true);}I.field(group,'Dash length',dash);I.field(group,'Dash gap',gap);dash.closest('.inspector-field').querySelector('span').textContent='Dash';gap.closest('.inspector-field').querySelector('span').textContent='Gap';
  for(const input of [style,dash,gap]){input.disabled=raw.disabled;input.title=raw.title;}
  const sync=()=>{const parsed=P.pattern(raw.value),parts=parsed?.parts||[];style.value=strokeMode.custom?'custom':parsed?.type||'custom';dash.value=parts[0]||'4';gap.value=parts[1]||parts[0]||'4';for(const input of [dash,gap]){input.setCustomValidity('');input.closest('.inspector-field').hidden=style.value!=='dashed';}rawRow.hidden=style.value!=='custom';};
  const write=value=>{if(raw.disabled||value===null)return;if(value===raw.value){sync();return;}raw.value=value;raw.dispatchEvent(new Event('input',{bubbles:true}));raw.dispatchEvent(new Event('change',{bubbles:true}));sync();};
  style.onchange=()=>{strokeMode.custom=style.value==='custom';if(style.value==='custom')sync();else write(style.value==='solid'?'none':P.dashPair(raw.value));};
  for(const [input,key]of [[dash,'dash'],[gap,'gap']]){input.type='text';input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{const next=P.dashPair(raw.value,{[key]:input.value.trim()});if(next===null){input.setCustomValidity('Enter a nonnegative dash length in pixels or percent.');input.reportValidity();return;}write(next);};}
  settings.insertBefore(group,settings.children[1]||null);group.append(rawRow);sync();
 }
 function strokeIconControls(settings){
  const configurations=[['SVG line ends','Stroke caps',[['butt','No caps','M3 6h10v12H3 M13 3v18'],['square','Square caps','M3 6h15v12H3 M13 3v18'],['round','Round caps','M3 6h10a6 6 0 0 1 0 12H3 M13 3v18']]],['SVG line joins','Stroke joins',[['miter','Miter join','M4 4h16v16 M4 10h10v10'],['bevel','Bevel join','M4 4h10l6 6v10 M4 10h10v10'],['round','Round join','M4 4h10a6 6 0 0 1 6 6v10 M4 10h10v10']]]];
  for(const [label,name,choices]of configurations){
   const select=settings.querySelector('[aria-label="'+label+'"]');if(!select||!choices.some(([value])=>value===select.value))continue;
   const previous=select.closest('.inspector-field'),field=document.createElement('div');field.className=previous.className+' stroke-icon-field';field.append(...previous.childNodes);previous.replaceWith(field);
   const group=document.createElement('div');group.className='layout-mode-segments stroke-icon-controls';
   for(const [value,title,path]of choices){const button=document.createElement('button');button.type='button';button.disabled=select.disabled;button.title=select.disabled?select.title:title;button.setAttribute('aria-label',title);button.setAttribute('aria-pressed',String(select.value===value));button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';button.onclick=()=>{if(select.disabled||select.value===value)return;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));};group.append(button);}
   select.hidden=true;select.setAttribute('aria-hidden','true');select.tabIndex=-1;field.append(group);keyboardToolbar(group,name);
  }
 }
 function strokePopover(settings,weight,key='svg-stroke-settings',dialogTitle='Stroke settings',openerLabel='Advanced stroke settings'){
  const summary=settings.firstElementChild,body=document.createElement('div'),heading=document.createElement('header'),name=document.createElement('strong'),closeButton=document.createElement('button');
  settings.classList.add('stroke-settings-popover');summary.setAttribute('aria-label',openerLabel);summary.title=openerLabel;summary.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v7m0 4v7M17 3v3m0 4v11M4 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M14 8a3 3 0 1 0 6 0a3 3 0 1 0-6 0"/></svg>';
  if(dialogTitle==='Type settings'){settings.classList.add('type-settings-popover');const label=document.createElement('span');label.className='settings-name';label.textContent=dialogTitle;summary.append(label);}
  body.className='stroke-settings-body';body.hidden=true;body.setAttribute('role','dialog');body.setAttribute('aria-label',dialogTitle);name.textContent=dialogTitle;closeButton.type='button';closeButton.className='control-button';closeButton.textContent='×';closeButton.setAttribute('aria-label','Close '+dialogTitle.toLowerCase());heading.append(name,closeButton);body.append(heading);
  for(const child of [...settings.children])if(child!==summary)body.append(child);settings.append(body);weight.append(settings);
  let cleanup=()=>{},observing=false;
  const close=(focus=false)=>{settings.open=false;openGroups.delete(key);cleanup();if(focus&&summary.isConnected)summary.focus({preventScroll:true});};
  const position=()=>{if(!settings.isConnected){cleanup();return;}body.hidden=false;const box=summary.getBoundingClientRect(),panel=summary.closest('#panel')?.getBoundingClientRect();body.style.left=Math.max(8,Math.min(innerWidth-body.offsetWidth-8,(panel?.left??box.left)-body.offsetWidth-8))+'px';body.style.top=Math.max(8,Math.min(innerHeight-body.offsetHeight-8,box.top))+'px';};
  const outside=event=>{if(!settings.contains(event.target))close();};
  const watch=()=>{if(observing||!settings.isConnected||!settings.open)return;observing=true;const observer=new MutationObserver(()=>{if(!settings.isConnected)cleanup();else position();});observer.observe(document.body,{childList:true,subtree:true});const sizeObserver=new ResizeObserver(position);sizeObserver.observe(body);document.addEventListener('pointerdown',outside,true);root.addEventListener('resize',position);root.addEventListener('scroll',position,true);cleanup=()=>{observer.disconnect();sizeObserver.disconnect();document.removeEventListener('pointerdown',outside,true);root.removeEventListener('resize',position);root.removeEventListener('scroll',position,true);observing=false;};position();};
  settings.retouchOpen=()=>{settings.open=true;openGroups.add(key);watch();};
  summary.onclick=event=>{event.preventDefault();if(settings.open)close();else settings.retouchOpen();};
  settings.ontoggle=()=>{if(!settings.isConnected){cleanup();return;}if(settings.open){openGroups.add(key);watch();}else{openGroups.delete(key);cleanup();}};
  settings.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}});closeButton.onclick=()=>close(true);requestAnimationFrame(watch);
 }
 function title(section){return section.querySelector(':scope > h3')?.textContent||(section.classList.contains('boolean-originals')?'Original shapes':'');}
 let closePaintMenu=null;
 function addSVGPaint(input,type,opener,paint){
  closePaintMenu?.();root.RetouchActions?.closeContext();
  const menu=document.createElement('div');menu.className='rt-context-menu svg-paint-menu';menu.retouchSourceInput=input;menu.setAttribute('role','menu');menu.setAttribute('aria-label','Add '+paint);
  const close=(focus=false)=>{menu.remove();observer.disconnect();document.removeEventListener('pointerdown',outside,true);root.removeEventListener('resize',cancel);root.removeEventListener('scroll',position,true);opener.setAttribute('aria-expanded','false');closePaintMenu=null;if(focus&&opener.isConnected)opener.focus({preventScroll:true});root.dispatchEvent(new Event('retouch:paint-menu-close'));};
  const outside=event=>{if(!menu.contains(event.target))close();},cancel=()=>close(),observer=new MutationObserver(()=>{if(!opener.isConnected)close();});
  for(const [value,label]of [['solid','Solid'],['linearGradient','Linear gradient'],['radialGradient','Radial gradient']]){
   const item=document.createElement('button');item.type='button';item.setAttribute('role','menuitem');item.textContent=label;item.disabled=value==='solid'?input.disabled:!type||type.disabled;
   if(item.disabled)item.title=value==='solid'?input.title:type?.title||'Gradient creation is unavailable for this paint.';
   item.onclick=()=>{if(item.disabled)return;close();if(value==='solid')root.RetouchPaintPicker.open(input,{anchor:opener,onClose:()=>{if(opener.isConnected)opener.focus({preventScroll:true});}});else{type.value=value;type.dispatchEvent(new Event('change',{bubbles:true}));}};menu.append(item);
  }
  const reset=opener.closest('.inspector-section')?.querySelector('[aria-label="Reset svg '+paint+'"]');
  if(reset&&!reset.disabled){const item=document.createElement('button');item.type='button';item.setAttribute('role','menuitem');item.textContent='Reset override';item.onclick=()=>{if(!reset.isConnected||reset.disabled)return;close();reset.click();};menu.append(item);}
  menu.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}if(event.key==='Tab'){close(true);return;}if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const items=[...menu.querySelectorAll('button:not(:disabled)')],at=items.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?items.length-1:(at+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();};
  const position=()=>{const box=opener.getBoundingClientRect(),panel=opener.closest('#panel')?.getBoundingClientRect();if(!opener.isConnected||panel&&(box.bottom<=panel.top||box.top>=panel.bottom)){close();return false;}menu.style.left=Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,box.right-menu.offsetWidth))+'px';menu.style.top=Math.max(8,Math.min(innerHeight-menu.offsetHeight-8,box.bottom+4))+'px';};
  document.body.append(menu);if(position()===false)return;
  opener.setAttribute('aria-expanded','true');document.addEventListener('pointerdown',outside,true);root.addEventListener('resize',cancel);root.addEventListener('scroll',position,true);observer.observe(document.body,{subtree:true,childList:true});closePaintMenu=close;menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
 }
 // A paint swatch has its own accessible name but does not identify the property.
 function fieldControl(row){return row.querySelector('input[aria-label],select[aria-label],textarea[aria-label]')||row.querySelector('[aria-label]');}
 function pair(section,names){
  const rows=names.map(name=>[...section.querySelectorAll('.inspector-field')].find(row=>fieldControl(row)?.getAttribute('aria-label')===name)).map(row=>row?.closest('.property-row')||row);
  if(rows.some(row=>!row)||rows[0].parentElement!==section||rows[1].parentElement!==section)return;
  const group=document.createElement('div');group.className='property-pair';section.insertBefore(group,rows[0]);rows.forEach(row=>group.append(row));
 }
 function keyboardToolbar(group,label,{columns=1,role='toolbar'}={}){
  group.setAttribute('role',role);group.setAttribute('aria-label',label);
  const buttons=[...group.querySelectorAll(':scope > button')],enabled=()=>buttons.filter(button=>!button.disabled);
  for(const button of buttons){button.tabIndex=-1;button.addEventListener('focus',()=>buttons.forEach(item=>item.tabIndex=item===button?0:-1));const activate=button.onclick;button.onclick=event=>{root.RetouchPanelFocus?.queue(button);return activate?.call(button,event);};}
  const selected=enabled().find(button=>button.getAttribute('aria-pressed')==='true')||enabled()[0];if(selected)selected.tabIndex=0;
  group.addEventListener('keydown',event=>{
   const keys=columns>1?['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End']:['ArrowLeft','ArrowRight','Home','End'];if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!keys.includes(event.key))return;
   const items=enabled(),index=items.indexOf(document.activeElement);if(index<0)return;event.preventDefault();event.stopPropagation();
   if(event.key==='Home'||event.key==='End'){items[event.key==='Home'?0:items.length-1].focus();return;}
   if(columns===1){items[(index+(event.key==='ArrowRight'?1:-1)+items.length)%items.length].focus();return;}
   const start=buttons.indexOf(document.activeElement),step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns}[event.key];
   for(let next=start+step;next>=0&&next<buttons.length;next+=step){if(Math.abs(step)===1&&Math.floor(next/columns)!==Math.floor(start/columns))break;if(!buttons[next].disabled){buttons[next].focus();break;}}
  });
 }
 function compactTypeSettings(body,section){
  const targets={
   'Reset font weight':['Font weight (1–1000)','Font weight (CSS)'],
   'Reset font size':['Font size (px)','Font size (CSS)'],
   'Reset line height':['Line height (px)','Line height (CSS)'],
   'Reset letter spacing':['Letter spacing (px)','Letter spacing (CSS)'],
   'Reset text alignment':['Text alignment','Text alignment (CSS)'],
   'Reset text color':['Text color (CSS)'],
   'Reset font style':['Font slant','Font style (CSS)'],
   'Reset text decoration':['Text decoration','Text decoration (CSS)'],
   'Reset text case':['Text case','Text case (CSS)'],
   'Reset optical sizing':['Optical sizing'],
   'Reset paragraph indent':['Paragraph indent (px)','Paragraph indent (CSS)']
  };
  for(const button of [...body.querySelectorAll(':scope > button')]){
   const label=button.getAttribute('aria-label')||button.textContent,labels=targets[label];if(!labels)continue;
   const control=labels.map(name=>section.querySelector('[aria-label="'+name+'"]')).find(Boolean),field=control?.closest('.inspector-field');if(!field)continue;
   let row=field.closest('.property-row');if(!row){row=document.createElement('div');row.className='property-row';if(field.dataset.typeCategory)row.dataset.typeCategory=field.dataset.typeCategory;field.before(row);row.append(field);}
   button.setAttribute('aria-label',label);button.title=label;button.textContent='↺';button.classList.add('property-reset');row.append(button);
  }
  for(const [labels,caption,names]of [
   [['Font slant','Font style (CSS)'],'Style',{normal:'Normal',italic:'Italic',oblique:'Oblique'}],
   [['Text decoration','Text decoration (CSS)'],'Decoration',{none:'None',underline:'Underline','line-through':'Strikethrough',overline:'Overline','underline line-through':'Underline + strikethrough'}],
   [['Text case','Text case (CSS)'],'Case',{none:'As written',uppercase:'Uppercase',lowercase:'Lowercase',capitalize:'Capitalize'}]
  ]){const control=labels.map(label=>body.querySelector('[aria-label="'+label+'"]')).find(Boolean);if(!control)continue;const label=control.closest('.inspector-field')?.querySelector(':scope > span');if(label)label.textContent=caption;for(const option of control.options||[])if(names[option.value])option.textContent=names[option.value];}
  const fontSettings=disclosure('More font settings','type-font-settings');
  for(const label of ['Font weight (1–1000)','Font weight (CSS)','Font family (CSS)','Font size','Font weight','HTML element']){
   const control=body.querySelector('[aria-label="'+label+'"]'),field=control?.closest('.inspector-field'),row=field?.closest('.property-row')||field;if(row?.parentElement===body)fontSettings.append(row);
  }
  const automatic=[...body.querySelectorAll(':scope > button')].find(button=>button.textContent==='Automatic line height');
  if(automatic){automatic.setAttribute('aria-label','Automatic line height');automatic.textContent='Auto';automatic.title='Automatic line height';fontSettings.append(automatic);}
  const resetAll=[...body.querySelectorAll(':scope > button')].find(button=>button.textContent==='Reset text overrides');if(resetAll)fontSettings.append(resetAll);
  if(fontSettings.children.length>1)body.append(fontSettings);
 }
 function typeSettingsTabs(settings,section){
  const body=settings.querySelector('.stroke-settings-body');compactTypeSettings(body,section);
  const children=[...body.children].filter(el=>el.tagName!=='HEADER');
  const tabs=document.createElement('div');tabs.className='type-settings-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Type settings categories');
  const preview=section.querySelector('.type-preview'),groups=new Map();
  const samples={'Number position':'123 abc','Capital forms':'Aa Bb Cc Abc','Number width':'111111 · 888888','Number style':'0123456789','Fractions':'1/2 1/3 3/4','Ordinals':'1st 2nd 3rd','Zero style':'0 O 00 OO','Common ligatures':'fi fl ffi ffl','Rare ligatures':'st ct','Historical ligatures':'st ct tz','Contextual alternates':'affinity office'};
  const defaultSample=()=>activeTypeTab==='Details'?'0123456789':null;
  const focusedSample=()=>{const control=body.contains(document.activeElement)?document.activeElement:null;return control&&!control.closest('[hidden]')?samples[control.getAttribute('aria-label')]??defaultSample():defaultSample();};
  for(const name of ['Basics','Details','Variable']){
   const tab=document.createElement('button'),panel=document.createElement('div'),id='type-tab-'+(++typeTabId);tab.type='button';tab.textContent=name;tab.id=id;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',id+'-panel');panel.id=id+'-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',id);panel.className='type-settings-page';groups.set(name,{tab,panel});tabs.append(tab);
  }
  for(const child of children){const summary=child.querySelector(':scope > summary')?.textContent;groups.get(summary==='Variable font axes'?'Variable':child.dataset.typeCategory==='Details'||['Number formatting','Ligatures','Capital forms','Number position'].includes(summary)?'Details':'Basics').panel.append(child);}
  const select=(name,focus=false)=>{activeTypeTab=name;for(const [key,{tab,panel}]of groups){const chosen=key===name;tab.setAttribute('aria-selected',String(chosen));tab.tabIndex=chosen?0:-1;panel.hidden=!chosen;}body.scrollTop=0;preview?.retouchSample?.(defaultSample());if(focus)groups.get(name).tab.focus();};
  for(const [name,{tab,panel}]of groups){tab.onclick=()=>select(name);panel.retouchReveal=()=>select(name);}
  tabs.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||event.altKey||event.metaKey||event.ctrlKey)return;const names=[...groups.keys()],index=names.findIndex(name=>groups.get(name).tab===event.target);if(index<0)return;event.preventDefault();event.stopPropagation();select(names[event.key==='Home'?0:event.key==='End'?names.length-1:(index+(event.key==='ArrowRight'?1:-1)+names.length)%names.length],true);};
  for(const [label,text]of Object.entries(samples)){const control=[...groups.values()].map(({panel})=>panel.querySelector('[aria-label="'+label+'"]')).find(Boolean);if(!control)continue;const field=control.closest('.inspector-field')||control;field.addEventListener('pointerenter',()=>preview?.retouchSample?.(text));field.addEventListener('pointerleave',()=>preview?.retouchSample?.(focusedSample()));control.addEventListener('focus',()=>preview?.retouchSample?.(text));control.addEventListener('blur',()=>queueMicrotask(()=>preview?.retouchSample?.(focusedSample())));}
  if(preview){const old=preview.closest('details');body.append(preview);if(old&&old!==settings)old.remove();}
  body.append(tabs,...[...groups.values()].map(group=>group.panel));select(groups.has(activeTypeTab)?activeTypeTab:'Basics');
 }
 function typographyPrimary(section){
  const find=labels=>labels.map(label=>section.querySelector('[aria-label="'+label+'"]')).find(Boolean),row=control=>control?.closest('.property-row')||control?.closest('.inspector-field');
  const font=row(find(['Page font'])),weight=find(['Font weight (1–1000)','Font weight (CSS)']),spacing=find(['Line height (px)','Line height (CSS)']),align=row(find(['Text alignment','Text alignment (CSS)']));
  const sizePair=weight?.closest('.property-pair'),spacingPair=spacing?.closest('.property-pair'),parts=[font,sizePair,spacingPair,align,section.querySelector(':scope > [data-text-vertical-alignment]')].filter(part=>part?.parentElement===section);
  if(!parts.length)return;
  const primary=document.createElement('div');primary.className='typography-primary';section.querySelector(':scope > h3').after(primary);parts.forEach(part=>primary.append(part));
  const vertical=primary.querySelector('[aria-label="Vertical text alignment"]');
  if(vertical){const field=vertical.closest('.inspector-field'),group=document.createElement('div');field.classList.add('vertical-text-modes');field.querySelector(':scope > span').textContent='Vertical';group.className='layout-mode-segments';
   for(const [value,label,lines]of [['top','top','M4 3h12 M6 6h8 M6 9h8'],['center','middle','M4 10h2 M14 10h2 M7 7h6 M7 13h6'],['bottom','bottom','M6 11h8 M6 14h8 M4 17h12']]){const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','Align text '+label);button.title='Align text '+label;button.setAttribute('aria-pressed',String(vertical.value===value));button.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="'+lines+'"/></svg>';button.onclick=()=>{vertical.value=value;vertical.dispatchEvent(new Event('change',{bubbles:true}));};group.append(button);}field.insertBefore(group,vertical);keyboardToolbar(group,'Vertical text alignment buttons');
  }
  font?.classList.add('typography-family');sizePair?.classList.add('typography-size');spacingPair?.classList.add('typography-spacing');
  if(weight&&sizePair){
   const weightRow=row(weight),settings=[...section.querySelectorAll('details')].find(details=>details.querySelector(':scope > summary')?.textContent==='Type settings');
   if(weightRow&&settings){
    const select=document.createElement('select'),cell=document.createElement('label');cell.className='inspector-field typography-weight-style';select.setAttribute('aria-label','Font weight style');
    select.title='Choose a weight; use Custom for a numeric value.';select.disabled=weight.disabled;
    const target=weight.retouchPreviewTarget,current=target?target.ownerDocument.defaultView.getComputedStyle(target).fontWeight:weight.value;
    const names=[['100','Thin'],['200','Extra Light'],['300','Light'],['400','Regular'],['500','Medium'],['600','Semi Bold'],['700','Bold'],['800','Extra Bold'],['900','Black']];
    for(const [value,name] of names){const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);}
    if(!names.some(([value])=>value===current)){const option=document.createElement('option');option.value=current;option.textContent=current||'Custom';select.prepend(option);}
    const custom=document.createElement('option');custom.value='custom';custom.textContent='Custom…';select.append(custom);select.value=current;
    weightRow.before(cell);cell.append(select);settings.querySelector(':scope > summary').after(weightRow);
    root.RetouchNumericExpression.calculation(weight);root.RetouchInspector.fieldDraft(weight);
    select.onchange=()=>{
     if(select.value==='custom'){select.value=current;weight.closest('[role=tabpanel]')?.retouchReveal?.();if(settings.retouchOpen)settings.retouchOpen();else settings.open=true;for(let parent=weight.parentElement;parent&&parent!==settings;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;weight.focus();weight.select();return;}
     weight.value=select.value;weight.dispatchEvent(new Event('change',{bubbles:true}));
    };
   }
  }

  for(const [labels,title,path] of [[['Line height (px)','Line height (CSS)'],'Line height','M4 3h12 M4 17h12 M6 14l4-8 4 8 M8 11h4'],[['Letter spacing (px)','Letter spacing (CSS)'],'Letter spacing','M3 4v12 M17 4v12 M6 14l4-8 4 8 M8 11h4']]){
   const input=find(labels),field=input?.closest('.inspector-field');if(!field)continue;
   const icon=field.querySelector(':scope > span');icon.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="'+path+'"/></svg>';
   const cell=field.closest('.property-row')||field;cell.classList.add('typography-spacing-cell');cell.dataset.caption=title;
  }
  if(align){align.classList.add('typography-alignment');const label=align.querySelector('.inspector-field > span, :scope > span');if(label)label.textContent='Alignment';}
  const typeSettings=[...section.querySelectorAll('details')].find(details=>details.querySelector(':scope > summary')?.textContent==='Type settings');
  if(align&&typeSettings){
   const tools=document.createElement('div');tools.className='typography-alignment-tools';align.before(tools);tools.append(align);
   strokePopover(typeSettings,tools,'type-settings','Type settings','Type settings');typeSettingsTabs(typeSettings,section);
  }

 }
 function collapsibleSection(section){
  const heading=section.querySelector(':scope > h3');if(!heading)return;
  const name=heading.textContent,key=section.dataset.section||name,button=document.createElement('button');button.type='button';button.className='section-toggle';button.textContent=name;
  const set=(collapsed,persist=false)=>{if(collapsed)for(const popup of section.querySelectorAll('[popover]'))if(popup.matches(':popover-open'))popup.hidePopover();section.dataset.collapsed=String(collapsed);button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',(collapsed?'Expand ':'Collapse ')+name+' section');if(persist){if(collapsed){collapsedSections.add(key);expandedEmptySections.delete(key);}else{collapsedSections.delete(key);expandedEmptySections.add(key);}saveSectionPreferences();}};
  section.retouchSetCollapsed=set;button.onclick=()=>set(section.dataset.collapsed!=='true',true);heading.setAttribute('aria-label',name);heading.replaceChildren(button);set(collapsedSections.has(key)||(section.dataset.emptyEffects==='true'&&!expandedEmptySections.has(key)));
  for(const action of section.querySelectorAll(':scope > .section-add'))action.addEventListener('click',()=>set(false,true),true);
 }
 function organize(panel){
  if(panel.dataset.organized==='true')return;panel.dataset.organized='true';
  const head=panel.firstElementChild;if(!head)return;head.classList.add('selection-heading');
  const componentScope=panel.querySelector(':scope > .scopes');if(componentScope){componentScope.classList.remove('sec');head.append(componentScope);}
  const file=head.querySelector(':scope > .filepath');if(file){const source=disclosure('Source','source');source.append(file);head.append(source);}
  const scope=head.querySelector('.screen-scope');if(scope){const more=disclosure('Breakpoint options','breakpoint');[...scope.children].filter(el=>el.tagName!=='LABEL'&&!el.classList.contains('scope-status')&&el.id!=='previewBreakpoint'&&el.id!=='editPreviewBreakpoint').forEach(el=>more.append(el));if(more.children.length>1)scope.append(more);}
  // Put properties in the same reading order as the Design panel reference.
  for(const section of [...panel.children]){const aliases={'Shared styles':'Layout','Align selected layers':'Position','SVG geometry':'Geometry'},name=aliases[title(section)];if(name)section.querySelector(':scope > h3').textContent=name;}

  for(const container of [...panel.children])if(container!==head&&[...container.children].some(el=>title(el)==='CSS properties')){[...container.children].forEach(el=>panel.insertBefore(el,container));container.remove();}
  const css=[...panel.children].find(el=>title(el)==='CSS properties');
  if(css){
   const getSection=name=>{let section=[...panel.children].find(el=>title(el)===name);if(!section){section=document.createElement('section');section.className='sec inspector-section';const h=document.createElement('h3');h.textContent=name;section.append(h);panel.append(section);}return section;};
   for(const row of [...css.querySelectorAll(':scope > .inspector-field')]){const label=fieldControl(row)?.getAttribute('aria-label')||'',target=getSection(label.startsWith('Border ')?'Stroke':label.startsWith('Background ')?'Fill':'Layout'),reset=row.nextElementSibling;target.append(row);if(reset?.classList.contains('control-button'))target.append(reset);}
   for(const [from,to] of [['Grid','Layout'],['Flex sizing','Layout'],['Blur','Effects'],['Shadows','Effects'],['Gradient fills','Fill']]){const source=[...panel.children].find(el=>title(el)===from);if(source){const target=getSection(to);if(source.dataset.emptyEffects)target.dataset.emptyEffects=source.dataset.emptyEffects;[...source.children].filter(el=>el.tagName!=='H3').forEach(el=>target.append(el));source.remove();}}
   const corners=[...panel.children].find(el=>title(el)==='Corners');if(corners){const appearance=getSection('Appearance');[...corners.children].filter(el=>el.tagName!=='H3').forEach(el=>appearance.append(el));corners.remove();}
  }
  const layer=[...panel.children].find(el=>title(el)==='Layer'),nameField=layer?.querySelector('[aria-label="Layer name"]')?.closest('.inspector-field');if(nameField){nameField.classList.add('layer-title');const badge=head.querySelector('.kindbadge');nameField.querySelector('input').placeholder=badge?.textContent||'Layer';if(badge)badge.style.display='none';head.prepend(nameField);}
  const paints=[],appearance=[...panel.children].find(el=>title(el)==='Appearance');
  if(appearance){
   const colors=disclosure('Color overrides','color-overrides');
   for(const row of [...appearance.querySelectorAll(':scope > .inspector-field')])if(/with alpha$/.test(fieldControl(row)?.getAttribute('aria-label')||'')){
    const value=row.nextElementSibling,clear=value?.nextElementSibling,property=row.querySelector('input')?.dataset.paintProperty;if(['color','background-color','border-color'].includes(property)){paints.push({property,row,clear});row.remove();value?.remove();if(clear?.classList.contains('control-button'))clear.remove();continue;}colors.append(row);if(value?.classList.contains('computed-value'))colors.append(value);if(clear?.classList.contains('control-button'))colors.append(clear);
   }
   if(colors.children.length>1)appearance.append(colors);
   const options=disclosure('More appearance options','appearance-options');
   for(const row of [...appearance.querySelectorAll(':scope > .inspector-field')])if(['Visibility','Blend group'].includes(fieldControl(row)?.getAttribute('aria-label'))){const reset=row.nextElementSibling;options.append(row);if(reset?.classList.contains('control-button'))options.append(reset);}
   const slider=appearance.querySelector(':scope > .opacity-row');if(slider){const field=slider.querySelector('.inspector-field');if(field)appearance.insertBefore(field,slider);options.append(slider);}if(options.children.length>1)appearance.append(options);
  }

  if(appearance){const stroke=document.createElement('section');stroke.className='sec inspector-section';const h=document.createElement('h3');h.textContent='Stroke';stroke.append(h);for(const row of [...appearance.querySelectorAll(':scope > .inspector-field')]){if(/^Border /.test(fieldControl(row)?.getAttribute('aria-label')||'')){const next=row.nextElementSibling;stroke.append(row);if(next?.classList.contains('computed-value')||next?.classList.contains('control-button'))stroke.append(next);}}if(stroke.children.length>1)panel.append(stroke);}
  for(const {property,row,clear}of paints){
   const name=property==='background-color'?'Fill':property==='border-color'?'Stroke':'Typography';let target=[...panel.children].find(el=>title(el)===name);if(!target){target=document.createElement('section');target.className='sec inspector-section';const heading=document.createElement('h3');heading.textContent=name;target.append(heading);panel.append(target);}
   if(property==='border-color'){const old=target.querySelector('[aria-label="Border color"]')?.closest('.inspector-field'),note=old?.nextElementSibling;old?.remove();if(note?.classList.contains('computed-value'))note.remove();}
   else{const old=property==='background-color'?target:[...panel.children].find(el=>title(el)==='Text color'),palette=old?.querySelector('.palette');if(palette){const input=row.querySelector('input'),apply=value=>{root.RetouchPanelFocus?.queue(input);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};for(const button of palette.querySelectorAll('.palbtn')){button.setAttribute('aria-label',button.title);button.onclick=()=>apply(button.style.backgroundColor);}const hex=palette.querySelector('.hexinput');if(hex)hex.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();const value='#'+hex.value.trim().replace(/^#/,'');if(/^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value))apply(value);}};const presets=disclosure('Color presets','paint-presets-'+property);palette.hidden=false;presets.append(palette);if(old===target)[...old.children].filter(el=>el.tagName!=='H3').forEach(el=>el.remove());else old.remove();target.append(presets);}}
   row.querySelector(':scope > span').textContent='Color';target.insertBefore(row,target.children[1]||null);if(clear?.classList.contains('control-button'))row.after(clear);
  }
  const svgPaint=[...panel.children].find(el=>title(el)==='SVG paint');if(svgPaint){for(const row of [...svgPaint.querySelectorAll(':scope > .inspector-field')]){const name=fieldControl(row)?.getAttribute('aria-label')==='SVG fill'?'Fill':'Stroke';let target=[...panel.children].find(el=>title(el)===name);if(!target){target=document.createElement('section');target.className='sec inspector-section';const h=document.createElement('h3');h.textContent=name;target.append(h);panel.append(target);}const reset=row.nextElementSibling;target.append(row);if(reset?.classList.contains('control-button'))target.append(reset);}if(!svgPaint.querySelector('.refused'))svgPaint.remove();}
  const fill=[...panel.children].find(el=>title(el)==='Fill');if(fill&&appearance){const gradients=[...appearance.children].find(el=>el.tagName==='DETAILS'&&el.querySelector('summary')?.textContent==='Gradient fills');if(gradients)fill.append(gradients);}
  // Graphical SVG elements paint with fill/stroke, not CSS box backgrounds/borders.
  // Keep box controls on SVG viewports and foreignObject containers.
  if(svgPaint&&panel.querySelector('[aria-label="SVG fill"]')&&!['svg','foreignobject'].includes((head.dataset.layerTag||'').toLowerCase())){
   for(const name of ['Fill','Stroke'])for(const section of [...panel.children].filter(el=>title(el)===name)){
    const keep=new Set([...section.children].filter(el=>el.tagName==='H3'));
    for(const row of section.querySelectorAll(':scope > .inspector-field'))if(fieldControl(row)?.getAttribute('aria-label')?.startsWith('SVG ')){keep.add(row);if(row.nextElementSibling?.classList.contains('control-button'))keep.add(row.nextElementSibling);const label=fieldControl(row).getAttribute('aria-label');if(['SVG fill','SVG stroke'].includes(label))row.querySelector(':scope > span').textContent='Color';}
    for(const child of [...section.children])if(!keep.has(child))child.remove();
   }
   if(appearance){for(const row of [...appearance.querySelectorAll('.inspector-field')])if(/^(?:Corner radius|(?:Top|Bottom) (?:left|right) corner)/.test(fieldControl(row)?.getAttribute('aria-label')||'')){const reset=row.nextElementSibling;row.remove();if(reset?.classList.contains('control-button'))reset.remove();}appearance.querySelectorAll('.radius-corners').forEach(el=>el.remove());}
  }
  const creation=[...panel.children].find(el=>title(el)==='Create gradient');if(creation&&!creation.querySelector('.refused')){
   for(const row of [...creation.querySelectorAll(':scope > .inspector-field')]){const name=fieldControl(row)?.getAttribute('aria-label')==='Fill type'?'Fill':'Stroke';let target=[...panel.children].find(el=>title(el)===name);if(!target){target=document.createElement('section');target.className='sec';const h=document.createElement('h3');h.textContent=name;target.append(h);panel.append(target);}row.querySelector(':scope > span').textContent='Type';target.insertBefore(row,target.children[1]||null);const hint=creation.querySelector('.hint');if(hint)target.append(hint.cloneNode(true));}creation.remove();
  }
  const text=[...panel.children].find(el=>title(el)==='Text'),typography=[...panel.children].find(el=>title(el)==='Typography');if(text&&typography){[...text.children].filter(el=>el.tagName!=='H3').reverse().forEach(el=>typography.insertBefore(el,typography.children[1]||null));text.remove();}
  if([...panel.children].some(el=>title(el)==='Vector position')){for(const flips of panel.querySelectorAll('.flip-controls:not(.svg-flip-controls)'))flips.remove();
   let cssPosition=[...panel.children].find(el=>title(el)==='Position');if(cssPosition)cssPosition.querySelector(':scope > h3').textContent='CSS position';
   for(const input of panel.querySelectorAll('[aria-label="Rotation (°)"]')){const row=input.closest('.property-row')||input.closest('.inspector-field');if(!row||cssPosition?.contains(row))continue;if(!cssPosition){cssPosition=document.createElement('section');cssPosition.className='sec';const h=document.createElement('h3');h.textContent='CSS position';cssPosition.append(h);panel.append(cssPosition);}const reset=row.nextElementSibling;cssPosition.append(row);if(reset?.classList.contains('control-button')&&/reset/i.test(reset.textContent))cssPosition.append(reset);}
  }
  const position=[...panel.children].find(el=>title(el)==='Position'),sharedRotation=panel.querySelector('[aria-label="Shared Rotation (°)"]')?.closest('.inspector-field');
  if(position&&sharedRotation){const label=sharedRotation.querySelector(':scope > span');if(label)label.textContent='Rotation (°)';const row=sharedRotation.closest('.property-row')||sharedRotation,reset=row.nextElementSibling;position.append(row);if(reset?.classList.contains('control-button')&&reset.textContent.toLowerCase().startsWith('reset shared rotation'))position.append(reset);}
  const selectionFlips=[...panel.children].find(el=>title(el)==='Flip selection');if(position&&selectionFlips){position.append(...[...selectionFlips.children].filter(el=>el.tagName!=='H3'));selectionFlips.remove();}
  const order=['Component','Shared component properties','Position','Selection transform','Combine shapes','Boolean group','Boolean operations','Mask','Vector position','Vector size','Geometry',...([...panel.children].some(el=>title(el)==='Vector size')?[]:['Layout']),'Appearance',...((head.dataset.textLayer==='true'||RetouchInspector.isTextLayer(head.dataset.layerTag||''))?['Typography']:[]),'Fill','Image fill','Fill gradient','Stroke','Stroke gradient','Original shapes','Effects','Image framing','Image','Export'];
  const advanced=disclosure('More properties','advanced');advanced.classList.add('inspector-more');
  const children=[...panel.children].filter(el=>el!==head);
  for(const name of order)for(const el of children.filter(el=>title(el)===name)){el.classList.add('inspector-section');panel.append(el);}
  for(const el of children.filter(el=>!order.includes(title(el))))advanced.append(el);
  if(advanced.children.length>1)panel.append(advanced);
  for(const section of panel.querySelectorAll('.inspector-section')){
   const name=title(section);section.dataset.section=name.toLowerCase().replace(/\s+/g,'-');
   if(name==='Stroke'){
    const rows=['top','right','bottom','left'].flatMap(side=>['width','style'].map(property=>section.querySelector('[aria-label="Border '+side+' '+property+' (CSS)"], [aria-label="Border '+side+' '+property+(property==='width'?' (px)':'')+'"]')?.closest('.inspector-field')));
    if(rows.every(Boolean)){const edges=disclosure('Individual edges','border-edges');edges.classList.add('border-edges');for(const row of rows){const reset=row.nextElementSibling;edges.append(row);if(reset?.classList.contains('control-button'))edges.append(reset);row.querySelector(':scope > span').textContent=fieldControl(row).getAttribute('aria-label').split(' ')[1].replace(/^./,c=>c.toUpperCase());}section.append(edges);}
   }
   if(name==='Fill gradient'||name==='Stroke gradient'){
    for(const names of [['x1','y1'],['x2','y2'],['cx','cy'],['fx','fy'],['r','fr']])pair(section,names.map(name=>'Gradient '+name));
    for(const row of section.querySelectorAll('.inspector-field')){const label=fieldControl(row)?.getAttribute('aria-label')||'';row.querySelector(':scope > span').textContent=label.replace(/^Gradient /,'').replace(/^Stop \d+ /,'').replace('gradientUnits','Units').replace('spreadMethod','Spread');}
   }
   if(name==='Fill'||name==='Effects'){
    const options=disclosure(name==='Fill'?'Fill options':'Effect options',name+'-options');
    const stackDetails=[...section.children].find(el=>el.tagName==='DETAILS'&&el.querySelector('summary')?.textContent===(name==='Fill'?'Gradient fills':'Shadow stack'));
    const buttons=[...section.querySelectorAll(':scope > .control-button'),...(stackDetails?[...stackDetails.querySelectorAll(':scope > .control-button')]:[])];
    for(const button of buttons){
     if(['Clear background images','Reset gradient fills','Clear layer filters','Clear background filters','Clear shadows','Reset shadows'].includes(button.textContent))options.append(button);
     else if((name==='Fill'?['Add gradient','Add gradient fill']:['Add shadow']).includes(button.textContent)){
      const label=button.textContent,add=button.onclick;button.setAttribute('aria-label',label);button.title=label;button.textContent='+';button.classList.add('section-add');
      button.onclick=event=>{if(stackDetails){if(stackDetails.retouchSetOpen)stackDetails.retouchSetOpen(true);else stackDetails.open=true;}if(name==='Effects')root.RetouchPanelFocus?.queueControl(button,'Shadow '+(section.querySelectorAll('.shadow-controls').length+1)+' type');return add?.call(button,event);};section.append(button);
     }
    }
    if(options.children.length>1)section.append(options);
   }
   if(name==='Effects')for(const group of section.querySelectorAll('.shadow-controls')){
    const prefix=group.querySelector(':scope > legend')?.textContent.trim();if(!prefix)continue;
    for(const row of group.querySelectorAll(':scope > .inspector-field')){const label=fieldControl(row)?.getAttribute('aria-label');if(!label?.startsWith(prefix+' '))continue;const text=row.querySelector(':scope > span');if(text){const short=label.slice(prefix.length+1).replace(' (px)','');text.textContent=short[0].toUpperCase()+short.slice(1);}}
    pair(group,[prefix+' X (px)',prefix+' Y (px)']);pair(group,[prefix+' Blur (px)',prefix+' Spread (px)']);
   }
   const paintInputs=['Fill','Image fill'].includes(name)?[...section.querySelectorAll('.gradient-stop-row input:not([type="number"])')]:name==='Effects'?[...section.querySelectorAll('.shadow-controls input')].filter(input=>/^Shadow \d+ color$/.test(input.getAttribute('aria-label')||'')):[];
   paintInputs.push(...section.querySelectorAll('input[data-paint-property]'));
   for(const input of paintInputs){
    if(input.parentElement.classList.contains('paint-field-control'))continue;
    if(name==='Effects'||input.dataset.paintProperty){const control=document.createElement('span');control.className='paint-field-control';input.replaceWith(control);control.append(input);}

    const swatch=document.createElement('button');swatch.type='button';swatch.className='gradient-stop-swatch';swatch.setAttribute('aria-label','Edit '+input.getAttribute('aria-label'));swatch.title='Edit color';swatch.disabled=input.disabled;swatch.onclick=()=>root.RetouchPaintPicker.open(input);input.parentElement.classList.add('gradient-stop-color');input.before(swatch);
    const paint=()=>{const color=input.retouchPaintValue?.()||input.value.trim();if(input.dataset.paintProperty==='border-color'){const parts=root.RetouchHTMLCSSValues.parseBorderColors(color);if(parts?.length>1&&parts.every(part=>CSS.supports('color',part))){const [a,b=a,c=a,d=b]=parts;swatch.style.backgroundImage='conic-gradient('+[a,b,c,d].map((part,i)=>part+' '+i*25+'% '+(i+1)*25+'%').join(',')+'),repeating-conic-gradient(#ddd 0% 25%,white 0% 50%)';return;}}if(CSS.supports('color',color))swatch.style.backgroundImage='linear-gradient('+color+','+color+'),repeating-conic-gradient(#ddd 0% 25%,white 0% 50%)';};
    input.addEventListener('input',paint);input.addEventListener('change',paint);input.addEventListener('keydown',event=>{if(event.key==='Escape')queueMicrotask(paint);});paint();if(name==='Fill'||name==='Stroke')compactPaint(section,input);
   }
   if(name==='Fill'||name==='Effects')for(const group of section.querySelectorAll(name==='Fill'?'.gradient-controls':'.shadow-controls')){
    const actions=document.createElement('span');actions.className='gradient-actions';
    const icons={up:'<path d="M5 12l5-5 5 5"/>',down:'<path d="M5 8l5 5 5-5"/>',duplicate:'<rect x="7" y="7" width="9" height="9" rx="1"/><path d="M12 5V4H4v8h1"/>',remove:'<path d="M5 10h10"/>'};
    const buttons=[...group.querySelectorAll(':scope > button')];
    for(const action of ['up','down','duplicate','remove']){
     const pattern=action==='up'||action==='down'?new RegExp('^Move (?:fill|gradient|shadow) \\d+ '+action+'$'):new RegExp('^'+(action==='duplicate'?'Duplicate':'Remove')+' (?:fill|gradient|shadow) \\d+$');
     const button=buttons.find(item=>pattern.test(item.textContent));if(!button)continue;
     const label=button.textContent;button.setAttribute('aria-label',label);button.title=label;button.classList.add('gradient-action');button.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true">'+icons[action]+'</svg>';
     const activate=button.onclick;button.onclick=event=>{
      const match=group.querySelector(':scope > legend').textContent.trim().match(/^(Gradient|Fill|Shadow) (\d+)$/),count=[...section.querySelectorAll(name==='Fill'?'.gradient-controls':'.shadow-controls')].filter(item=>!item.closest('.paint-stack-fields')).length;
      if(match){const index=Number(match[2]),next=action==='up'?index-1:action==='down'||action==='duplicate'?index+1:Math.min(index,count-1);if(next>0)root.RetouchPanelFocus?.queueControl(button,match[1]+' '+next+' type');else{const add=section.querySelector('.section-add');if(add)root.RetouchPanelFocus?.queue(add);}}
      return activate?.call(button,event);
     };actions.append(button);
    }
    if(actions.children.length){
     const legend=group.querySelector(':scope > legend');actions.setAttribute('role','toolbar');actions.setAttribute('aria-label',legend.textContent.trim()+' actions');
     const enabled=()=>[...actions.querySelectorAll('button:not(:disabled)')];
     for(const button of actions.children){button.tabIndex=-1;button.addEventListener('focus',()=>{for(const item of actions.children)item.tabIndex=item===button?0:-1;});}
     if(enabled()[0])enabled()[0].tabIndex=0;
     actions.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const items=enabled(),index=items.indexOf(document.activeElement);if(index<0)return;event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowRight'?1:-1)+items.length)%items.length;items[next].focus();});
     legend.append(actions);
    }
    if(name!=='Fill')continue;
    const rows=[...group.querySelectorAll(':scope > .inspector-field')].filter(row=>/^(?:Gradient|Fill) \d+ (?:Color blending|Hue direction|Repeat)$/.test(fieldControl(row)?.getAttribute('aria-label')||''));
    if(!rows.length)continue;
    const prefix=fieldControl(rows[0]).getAttribute('aria-label').replace(/ (?:Color blending|Hue direction|Repeat)$/,''),options=disclosure('Gradient options','gradient-options-'+prefix);
    options.querySelector('summary').setAttribute('aria-label',prefix+' options');
    for(const row of rows){const hint=row.nextElementSibling,label=fieldControl(row).getAttribute('aria-label');options.append(row);row.querySelector('span').textContent=label.slice(prefix.length+1);if(label.endsWith(' Repeat')&&hint?.classList.contains('hint'))options.append(hint);}
    const reverse=[...group.querySelectorAll(':scope > button')].find(button=>/^Reverse (?:fill|gradient) \d+ stops$/.test(button.textContent));
    if(reverse){const label=reverse.textContent;reverse.setAttribute('aria-label',label);reverse.title=label;reverse.textContent='Reverse stops';const activate=reverse.onclick;reverse.onclick=event=>{root.RetouchPanelFocus?.queue(reverse);return activate?.call(reverse,event);};options.append(reverse);}
    group.append(options);
   }
   if(name==='Typography'){
    const preview=section.querySelector(':scope > .type-preview');if(preview){const details=disclosure('Text preview','text-preview');details.append(preview);section.append(details);}
    const options=disclosure('Type settings','type-settings');
    const font=section.querySelector('[aria-label="Page font"]')?.closest('.inspector-field'),fontReset=[...section.children].find(el=>el.classList.contains('control-button')&&el.textContent==='Reset font family');
    if(font&&fontReset){font.after(fontReset);fontReset.dataset.primaryFontReset='true';}
    for(const row of [...section.querySelectorAll(':scope > .inspector-field')])if(['Paragraph indent (CSS)','Paragraph indent (px)','Font family (CSS)','Font style (CSS)','Text decoration (CSS)','Text case (CSS)','Font size','Font weight','Font slant','Text decoration','Text case','Optical sizing','HTML element'].includes(fieldControl(row)?.getAttribute('aria-label'))){const next=row.nextElementSibling;if(fieldControl(row)?.getAttribute('aria-label')?.startsWith('Paragraph indent')){row.dataset.typeCategory='Details';if(next?.classList.contains('control-button'))next.dataset.typeCategory='Details';}options.append(row);if(next?.classList.contains('control-button')&&/^Reset /.test(next.textContent))options.append(next);}
    for(const row of [...section.querySelectorAll(':scope > [data-type-trim], :scope > [data-type-truncation], :scope > [data-type-wrap], :scope > .relative-field')])options.append(row);
    for(const child of [...section.children])if((child.classList.contains('control-button')&&!child.dataset.primaryFontReset&&(/^(Reset |Automatic line height)/.test(child.textContent)))||(child.tagName==='DETAILS'&&['Underline details','Variable font axes','Number formatting','Ligatures','Capital forms','Number position'].includes(child.querySelector('summary')?.textContent)))options.append(child);
    const underline=options.querySelector('.underline-typography'),decoration=options.querySelector('[aria-label="Text decoration"], [aria-label="Text decoration (CSS)"]')?.closest('.inspector-field');if(underline&&decoration){const after=decoration.nextElementSibling?.classList.contains('control-button')?decoration.nextElementSibling:decoration;after.after(underline);}
    const content=section.querySelector(':scope > textarea');if(content){const details=disclosure('Text content','text-content'),action=section.querySelector('#textApply'),breakLine=content.nextElementSibling;details.append(content);if(breakLine?.tagName==='BR')breakLine.remove();if(action)details.append(action);section.insertBefore(details,section.children[1]);}
    if(options.children.length>1)section.append(options);
    const align=section.querySelector('[aria-label="Text alignment"], [aria-label="Text alignment (CSS)"]');
    if(align){const row=align.closest('.inspector-field');row.classList.add('text-align-modes');const group=document.createElement('div');group.className='layout-mode-segments';const logical={start:align.dataset.textDirection==='rtl'?'right':'left',end:align.dataset.textDirection==='rtl'?'left':'right'},active=logical[align.value]||align.value;
     for(const value of ['left','center','right','justify']){const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','Align text '+value);button.title='Align text '+value;button.setAttribute('aria-pressed',String(active===value));const short=value==='left'?'M3 7h9 M3 15h9':value==='right'?'M8 7h9 M8 15h9':value==='center'?'M6 7h8 M6 15h8':'M3 7h14 M3 15h14';button.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 3h14 M3 11h14 '+short+'"/></svg>';button.onclick=()=>{align.value=value;align.dispatchEvent(new Event('change',{bubbles:true}));};group.append(button);}row.insertBefore(group,align);
     keyboardToolbar(group,'Text alignment buttons');
    }
   }
   if(name==='Effects'&&!css){
    const shadow=disclosure('Add shadow','add-shadow');for(const child of [...section.children])if(child.tagName!=='DETAILS'&&(child.querySelector('[aria-label^="Shadow "]')||child.querySelector('[aria-label="Inner shadow"]')||child.textContent==='Apply custom shadow'))shadow.append(child);if(shadow.children.length>1)section.append(shadow);
   }
   for(const input of section.querySelectorAll('input[type="color"]')){
    const row=input.closest('.inspector-field');if(!row||input.parentElement!==row)continue;
    const control=document.createElement('span');control.className='color-control';const value=document.createElement('span');value.textContent=input.value.replace('#','').toUpperCase();input.after(control);control.append(input,value);input.addEventListener('input',()=>value.textContent=input.value.replace('#','').toUpperCase());
   }

   const help=disclosure('Details',name+'-help');for(const hint of [...section.children].filter(el=>(el.classList.contains('hint')||el.classList.contains('computed-value'))&&el.getAttribute('role')!=='alert'&&!el.classList.contains('gradient-scope')))help.append(hint);if(help.children.length>1)section.append(help);
   for(const button of [...section.querySelectorAll(':scope > .control-button, :scope > .radius-corners > .control-button, :scope > .border-edges > .control-button')])if(/^(Reset |Clear local (?:text|background|border) color$)/.test(button.textContent)){
    const label=button.textContent;button.setAttribute('aria-label',label);button.title=label;button.textContent='↺';button.classList.add('property-reset');const previous=button.previousElementSibling;
    if(previous?.classList.contains('inspector-field')){const row=document.createElement('div');row.className='property-row';previous.parentElement.insertBefore(row,previous);row.append(previous,button);}
   }
   if(name==='Stroke'){const edges=section.querySelector('.border-edges');if(edges)for(const side of ['top','right','bottom','left']){const width=edges.querySelector('[aria-label="Border '+side+' width (CSS)"], [aria-label="Border '+side+' width (px)"]'),style=edges.querySelector('[aria-label="Border '+side+' style (CSS)"], [aria-label="Border '+side+' style"]');if(width&&style){style.closest('.inspector-field').querySelector(':scope > span').textContent='';pair(edges,[width.getAttribute('aria-label'),style.getAttribute('aria-label')]);}}}
   if(name==='Stroke'&&!section.querySelector('[aria-label="SVG stroke width"]')){
    const weight=section.querySelector('[aria-label="Border width (CSS)"], [aria-label="Border width (px)"]')?.closest('.property-row'),style=section.querySelector('[aria-label="Border style (CSS)"], [aria-label="Border style"]')?.closest('.property-row'),edges=section.querySelector('.border-edges'),paint=section.querySelector('input[data-paint-property="border-color"]')?.closest('.property-row');
    if(paint)section.insertBefore(paint,section.children[1]||null);
    if(weight&&style){const settings=disclosure('Stroke settings','css-stroke-settings');settings.append(style);if(edges)settings.append(edges);strokePopover(settings,weight,'css-stroke-settings');}
   }
   if(name==='Stroke'&&section.querySelector('[aria-label="SVG stroke width"]')){
    const labels={'SVG stroke width':'Weight','SVG line ends':'Caps','SVG line joins':'Join','SVG dash pattern':'Dashes','SVG dash offset':'Offset','SVG miter limit':'Miter limit','SVG stroke scaling':'Mode'},settings=disclosure('Stroke settings','svg-stroke-settings');
    for(const [label,short]of Object.entries(labels)){const input=section.querySelector('[aria-label="'+label+'"]'),field=input?.closest('.inspector-field');if(!field)continue;field.querySelector(':scope > span').textContent=short;if(label!=='SVG stroke width')settings.append(field.closest('.property-row')||field);if(label==='SVG stroke scaling')for(const option of input.options)option.textContent=option.value==='none'?'Scale':option.value==='non-scaling-stroke'?'Fixed':option.value;}
    strokePatternControls(settings,head.dataset.strokeContext);strokeIconControls(settings);pair(settings,['SVG dash offset','SVG miter limit']);section.append(settings);const weight=section.querySelector('[aria-label="SVG stroke width"]')?.closest('.property-row');if(weight)strokePopover(settings,weight);
   }
   if(name==='Selection transform'){section.querySelector(':scope > h3').textContent='Position';pair(section,['Selection X','Selection Y']);pair(section,['Selection width','Selection height']);const group=section.querySelector('[aria-label="Selection width"]')?.closest('.property-pair'),lock=section.querySelector('[aria-label="Lock selection proportions"]');if(group&&lock){group.style.gridTemplateColumns='minmax(0,1fr) minmax(0,1fr) 28px';lock.style.padding='4px';group.append(lock);}for(const [label,short]of [['Selection X','X'],['Selection Y','Y'],['Selection width','W'],['Selection height','H'],['Rotate selection (°)','Rotate by']])section.querySelector('[aria-label="'+label+'"]')?.closest('.inspector-field').querySelector(':scope > span').replaceChildren(document.createTextNode(short));}
   if(name==='Vector position'){section.querySelector(':scope > h3').textContent='Position';pair(section,['Vector X','Vector Y']);for(const input of section.querySelectorAll('input'))input.closest('.inspector-field').querySelector(':scope > span').textContent=input.getAttribute('aria-label').replace('Vector ','').replace('rotation','Rotation');const input=section.querySelector('[aria-label="Vector rotation (°)"]'),row=input?.closest('.inspector-field'),action=section.querySelector('[data-canvas-tool="svg-rotate"]');if(row&&action){const group=document.createElement('div');group.className='property-pair rotation-controls';row.before(group);group.append(row);const actions=document.createElement('div');actions.className='rotation-actions';group.append(actions);const flips=section.querySelector('.svg-flip-controls');if(flips){actions.append(...flips.children);flips.remove();}actions.append(action);row.querySelector(':scope > span').innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3v13h13 M4 8a8 8 0 0 1 8 8"/></svg>';action.setAttribute('aria-label','Rotate vector on canvas');action.title='Rotate vector on canvas';action.classList.add('rotation-canvas-action');action.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 7l5 5-5 5-5-5Z M4 7a7 7 0 0 1 12-2 M16 2v4h-4"/></svg>';}}
   if(name==='Typography')for(const input of section.querySelectorAll('input')){
    const label=input.getAttribute('aria-label')||'';
    if(!/^(?:Font size|Line height|Letter spacing) \((?:px|CSS)\)$/.test(label))continue;
    const relative=section.querySelector('[aria-label="'+label.replace(/ \((?:px|CSS)\)$/,' (%)')+'"]');
    const percentDisplay=Number.isFinite(input.retouchSpacingPercent),numeric=input.type==='number',absoluteCommit=input.onchange,absoluteMin=Number(input.min),absoluteMax=Number(input.max);
    const draftInitial=percentDisplay?root.RetouchNumericExpression.decimal(input.retouchSpacingPercent)+'%':input.value;
    if(relative?.retouchCommitRelative)input.addEventListener('change',event=>{
     if(input.value===draftInitial)return;
     let quantity;
     try{quantity=root.RetouchNumericExpression.quantity(input.value,percentDisplay?'%':'');}
     catch(error){event.stopImmediatePropagation();input.setCustomValidity(error.message);input.reportValidity();return;}
     if(quantity?.unit!=='%'&&!(percentDisplay&&numeric&&quantity?.unit==='px'))return;
     event.stopImmediatePropagation();
     try{
      if(quantity.unit==='px'){
       if(quantity.value<absoluteMin||quantity.value>absoluteMax)throw Error('Enter pixels from '+absoluteMin+' to '+absoluteMax+'.');
       input.value=root.RetouchNumericExpression.decimal(quantity.value);input.setCustomValidity('');absoluteCommit?.call(input,event);return;
      }
      if(quantity.value<Number(relative.min)||quantity.value>Number(relative.max))throw Error('Enter a percentage from '+relative.min+' to '+relative.max+'.');
      if(relative.disabled)throw Error('Relative spacing is unavailable for this layer.');
      relative.value=root.RetouchNumericExpression.decimal(quantity.value);relative.setCustomValidity('');
      input.setCustomValidity('');relative.retouchCommitRelative();
     }catch(error){input.setCustomValidity(error.message);input.reportValidity();}
    },true);
    if(percentDisplay){
     input.retouchNumericRead=raw=>{try{const q=root.RetouchNumericExpression.quantity(raw,'%');return q?.unit==='%'?{value:q.value,min:Number(relative.min),max:Number(relative.max),format:value=>root.RetouchNumericExpression.decimal(value)+'%'}:null;}catch{return null;}};
     if(input.retouchPreviewTarget)root.RetouchInspector.numericPreview(input,input.retouchPreviewTarget,label.startsWith('Line')?'line-height':'letter-spacing',value=>root.RetouchNumericExpression.decimal(value/100)+(label.startsWith('Line')?'':'em'));
     if(numeric){input.min=relative.min;input.max=relative.max;}
    }
    root.RetouchNumericExpression.calculation(input,{unit:percentDisplay?'%':label==='Line height (CSS)'?'':'px',displayValue:draftInitial});
    root.RetouchInspector.fieldDraft(input);
    if(relative)input.title+=' Use % for spacing relative to font size, for example (100 + 50)%.';
   }
   if(name==='Stroke')for(const input of section.querySelectorAll('input'))if(/^(?:Border(?: (?:top|right|bottom|left))? width \(.*\)|SVG (?:stroke width|dash pattern|dash offset|miter limit)|Dash length|Dash gap)$/.test(input.getAttribute('aria-label')||'')){const label=input.getAttribute('aria-label');if(label!=='SVG dash pattern')root.RetouchNumericExpression.calculation(input,{unit:label.startsWith('Border')?'px':''});root.RetouchInspector.fieldDraft(input);}
   if(name==='Vector size'){pair(section,['Vector width','Vector height']);const group=section.querySelector('.property-pair'),lock=section.querySelector('[aria-label="Lock vector proportions"]');if(group&&lock){group.style.gridTemplateColumns='minmax(0,1fr) minmax(0,1fr) 28px';lock.style.padding='4px';group.append(lock);}for(const input of section.querySelectorAll('input'))input.closest('.inspector-field').querySelector(':scope > span').textContent=input.getAttribute('aria-label')==='Vector width'?'W':'H';}
   if(name==='Geometry'&&section.querySelector('[aria-label="Rectangle corner radius"]')){
    const radiusRow=section.querySelector('[aria-label="Rectangle corner radius"]').closest('.property-row'),canvasAction=section.querySelector('[data-canvas-tool="radius"]');if(radiusRow&&canvasAction)radiusRow.insertBefore(canvasAction,radiusRow.lastElementChild);
    const axes=disclosure('Elliptical corners','svg-radius-axes');
    for(const label of ['Shape Horizontal radius','Shape Vertical radius']){const field=section.querySelector('[aria-label="'+label+'"]')?.closest('.inspector-field');if(field)axes.append(field.closest('.property-row')||field);}
    pair(axes,['Shape Horizontal radius','Shape Vertical radius']);section.append(axes);
   }
   if(name==='Geometry'&&section.querySelector('[aria-label="Star points"],[aria-label="Polygon sides"]')){
    pair(section,['Star points','Star inner ratio (%)']);const field=section.querySelector('[aria-label="Shape Points"]')?.closest('.inspector-field');if(field){const reset=field.nextElementSibling,details=disclosure('Vector data','parametric-vector-data');details.append(field);if(reset?.classList.contains('control-button'))details.append(reset);section.append(details);}
   }
   if(name==='Geometry'){for(const labels of [['X','Y'],['Width','Height'],['Horizontal radius','Vertical radius'],['Center X','Center Y'],['Start X','Start Y'],['End X','End Y']])pair(section,labels.map(label=>'Shape '+label));for(const row of section.querySelectorAll('.inspector-field')){const input=row.querySelector('input'),label=input?.getAttribute('aria-label')?.replace(/^Shape /,'');if(label)row.querySelector(':scope > span').textContent=({'Star points':'Count','Polygon sides':'Sides','Star inner ratio (%)':'Ratio %',Width:'W',Height:'H','Horizontal radius':'RX','Vertical radius':'RY','Center X':'CX','Center Y':'CY','Start X':'X1','Start Y':'Y1','End X':'X2','End Y':'Y2'})[label]||label;}const scope=document.createElement('p');scope.className='hint geometry-scope';scope.textContent='SVG coordinates · Shared across screen sizes';if([...panel.children].some(el=>title(el)==='Vector size'))section.querySelector(':scope > h3').textContent='Source geometry';section.insertBefore(scope,section.children[1]||null);}
   for(const names of [['Padding top (CSS)','Padding bottom (CSS)'],['Padding left (CSS)','Padding right (CSS)'],['Font weight (CSS)','Font size (CSS)'],['Line height (CSS)','Letter spacing (CSS)'],['Font weight (1–1000)','Font size (px)'],['Line height (px)','Letter spacing (px)'],['Width (CSS)','Height (CSS)'],['Width (px)','Height (px)'],['Width behavior','Height behavior'],['Columns','Rows'],['Horizontal gap','Vertical gap'],['Padding top','Padding bottom'],['Padding left','Padding right'],['X','Y'],['Opacity (%)','Corner radius (px)'],['Opacity (%)','Corner radius (CSS)']])pair(section,names);
   if(name==='Position'){
    const input=section.querySelector('[aria-label="Rotation (°)"], [aria-label="Shared Rotation (°)"]'),field=input?.closest('.inspector-field'),row=field?.closest('.property-row')||field,action=section.querySelector(':scope > [data-canvas-tool="rotate"]');
    if(row?.parentElement===section&&(action||section.querySelector(':scope > .flip-controls'))){
     const group=document.createElement('div');group.className='property-pair rotation-controls';row.before(group);group.append(row);
     const coordinates=section.querySelector('[aria-label="X"], [aria-label="Shared X"]')?.closest('.property-pair');if(coordinates){let container=coordinates;while(container.parentElement&&container.parentElement!==section)container=container.parentElement;if(container.parentElement===section)container.after(group);}
     const actions=document.createElement('div');actions.className='rotation-actions';group.append(actions);const reset=section.querySelector(':scope > [aria-label="Reset rotate"], :scope > [aria-label="Reset rotation"], :scope > [aria-label="Reset shared rotation"]');const flips=section.querySelector(':scope > .flip-controls');if(flips){actions.append(...flips.children);flips.remove();}if(action)actions.append(action);if(reset)actions.append(reset);
     const label=field.querySelector(':scope > span');label.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3v13h13 M4 8a8 8 0 0 1 8 8"/></svg>';
     if(action){action.setAttribute('aria-label','Rotate on canvas');action.title=action.title||'Rotate on canvas';action.classList.add('rotation-canvas-action');action.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 7l5 5-5 5-5-5Z M4 7a7 7 0 0 1 12-2 M16 2v4h-4"/></svg>';}
    }
   }
   if(name==='Appearance'){
    for(const suffix of [' corner (CSS)',' radius (px)']){
     const labels=['Top left','Top right','Bottom left','Bottom right'].map(corner=>corner+suffix);
     const rows=labels.map(label=>section.querySelector('[aria-label="'+label+'"]')?.closest('.inspector-field')).map(row=>row?.closest('.property-row')||row);
     if(rows.some(row=>!row)||!rows.every(row=>row.parentElement===rows[0].parentElement))continue;
     const parent=rows[0].parentElement,group=document.createElement('div');group.className='property-pair corner-fields';
     if(parent===section){const details=disclosure('Individual corners','html-corners');section.insertBefore(details,rows[0]);details.append(group);}else parent.insertBefore(group,rows[0]);
     rows.forEach((row,index)=>{row.querySelector('.inspector-field > span, :scope > span').textContent=['⌜','⌝','⌞','⌟'][index];row.title=labels[index];group.append(row);});
    }
   }
   for(const checkbox of section.querySelectorAll('input[type="checkbox"]'))checkbox.closest('.inspector-field')?.classList.add('checkbox-field');
   if(name==='Layout'){
    const resize=section.querySelector(':scope > button[data-canvas-tool="resize"]');
    if(resize){const label=resize.textContent;resize.setAttribute('aria-label',label);resize.title=resize.title||label;resize.classList.add('section-add','canvas-resize-action');resize.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7V3h4 M13 3h4v4 M17 13v4h-4 M7 17H3v-4 M7 7l-4-4 M13 7l4-4 M13 13l4 4 M7 13l-4 4"/></svg>';}
    const alignment=section.querySelector('.layout-alignment');if(alignment)keyboardToolbar(alignment,'Align children',{columns:3,role:'group'});
    const stacks=section.querySelector(':scope > .stack-presets');if(stacks){stacks.classList.add('layout-mode-segments');for(const button of stacks.querySelectorAll(':scope > button')){const label=button.textContent,icon={'Normal flow':'flow','Vertical stack':'column','Horizontal stack':'row','Adaptive grid':'grid'}[label];if(!icon)continue;button.setAttribute('aria-label',label);button.title=label;button.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="'+layoutIcons[icon]+'"/></svg>';}keyboardToolbar(stacks,'Layout preset buttons');}
    {
     const paddingPairs=[...section.querySelectorAll(':scope > .property-pair')].filter(group=>group.querySelector('[aria-label="Padding top (CSS)"], [aria-label="Padding left (CSS)"], [aria-label="Padding top"], [aria-label="Padding left"]'));
     if(paddingPairs.length){const sides=disclosure('Individual padding',css?'html-padding':'react-padding');section.insertBefore(sides,paddingPairs[0]);paddingPairs.forEach(group=>sides.append(group));}
    }
    if(css){
     const dimensions=section.querySelector('[aria-label="Width (CSS)"]')?.closest('.property-pair'),clip=section.querySelector('[aria-label="Clip content"]')?.closest('.property-row');
     if(stacks&&dimensions){stacks.after(dimensions);if(clip)dimensions.after(clip);}
     const display=section.querySelector('[aria-label="Display (CSS)"]')?.value||'',flex=/^(inline-)?flex$/.test(display),grid=/^(inline-)?grid$/.test(display);
     const inactive=flex?[]:grid?['Direction','Wrap']:['Direction','Wrap','Align items','Align lines','Distribute items','Gap'];
     const options=disclosure('Layout options','html-layout-options');
     for(const label of inactive){const row=section.querySelector('[aria-label="'+label+' (CSS)"]')?.closest('.property-row');if(row?.parentElement===section)options.append(row);}
     if(options.children.length>1)section.append(options);
     for(const [heading,key,labels] of [['Size limits','html-size-limits',['Minimum width','Minimum height','Maximum width','Maximum height']],['Outer spacing','html-margin',['Margin','Margin top','Margin right','Margin bottom','Margin left']]]){
      const rows=labels.map(label=>section.querySelector('[aria-label="'+label+' (CSS)"]')?.closest('.property-row')).filter(row=>row?.parentElement===section);
      if(rows.length){const details=disclosure(heading,key);section.insertBefore(details,rows[0]);rows.forEach(row=>details.append(row));for(const names of [['Minimum width (CSS)','Minimum height (CSS)'],['Maximum width (CSS)','Maximum height (CSS)'],['Margin top (CSS)','Margin bottom (CSS)'],['Margin left (CSS)','Margin right (CSS)']])pair(details,names);}
     }
    }

    const picker=section.querySelector(':scope > .layout-alignment'),gaps=section.querySelector('[aria-label="Horizontal gap"]')?.closest('.property-pair');
    if(picker&&gaps&&gaps.parentElement===section){const group=document.createElement('div');group.className='layout-alignment-spacing';section.insertBefore(group,gaps);group.append(picker,gaps);}

    const select=section.querySelector('[aria-label="Arrange children"]');
    if(select){const row=select.closest('.inspector-field');row.classList.add('layout-modes');row.querySelector('span').textContent='';

     const group=document.createElement('div');group.className='layout-mode-segments';
     for(const [value,label,icon] of [['flow','Normal flow','flow'],[select.dataset.inlineAxis==='vertical'?'row':'column','Vertical layout','column'],[select.dataset.inlineAxis==='vertical'?'column':'row','Horizontal layout','row'],['grid','Grid layout','grid']]){const button=document.createElement('button');button.type='button';button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(select.value.replace('-reverse','')===value));button.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="'+layoutIcons[icon]+'"/></svg>';button.onclick=()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));};group.append(button);}row.insertBefore(group,select);keyboardToolbar(group,'Layout mode buttons');
     const dimension=section.querySelector('[aria-label="Width (px)"]')?.closest('.property-pair'),behavior=section.querySelector('[aria-label="Width behavior"]')?.closest('.property-pair');
     if(dimension)row.after(dimension);
     if(behavior&&dimension){
      for(const axis of ['Width','Height']){
       const size=dimension.querySelector('[aria-label="'+axis+' (px)"]')?.closest('.inspector-field'),mode=behavior.querySelector('[aria-label="'+axis+' behavior"]')?.closest('.inspector-field');
       if(!size||!mode)continue;
       const group=document.createElement('div');group.className='dimension-control';size.before(group);group.append(size,mode);mode.classList.add('dimension-mode');
      }
      if(!behavior.querySelector('input,select,button'))behavior.remove();else dimension.after(behavior);
     }
     const clip=section.querySelector('[aria-label="Clip content"]')?.closest('.property-row');if(clip)(behavior?.isConnected?behavior:dimension||row).after(clip);
    }
   }
   for(const row of section.querySelectorAll('.inspector-field')){const control=fieldControl(row),label=control?.getAttribute('aria-label');if(['Width behavior','Height behavior'].includes(label))for(const option of control.options)option.textContent=({'':'Auto',fixed:'Fixed',hug:'Hug',fill:'Fill'})[option.value]||option.textContent;const short={'Paragraph indent (px)':'Paragraph indent','Paragraph indent (CSS)':'Paragraph indent','Page font':'Font','Shared Page font':'Font','Display (CSS)':'Display','Direction (CSS)':'Direction','Wrap (CSS)':'Wrap','Align items (CSS)':'Alignment','Align lines (CSS)':'Lines','Distribute items (CSS)':'Distribution','Minimum width (CSS)':'Min W','Minimum height (CSS)':'Min H','Maximum width (CSS)':'Max W','Maximum height (CSS)':'Max H','Padding (CSS)':'Padding','Padding top (CSS)':'Top','Padding bottom (CSS)':'Bottom','Padding left (CSS)':'Left','Padding right (CSS)':'Right','Margin (CSS)':'Margin','Margin top (CSS)':'Top','Margin bottom (CSS)':'Bottom','Margin left (CSS)':'Left','Margin right (CSS)':'Right','Gap (CSS)':'Gap','Rectangle corner radius':'Radius','Shape Horizontal radius':'X radius','Shape Vertical radius':'Y radius','Corner radius (CSS)':'Radius','Border width (CSS)':'Weight','Border style (CSS)':'Style','Border color (CSS)':'Color','Background color (CSS)':'Color','Layer blur (px)':'Blur','Backdrop blur (px)':'Background','Background blur (px)':'Background','Font family (CSS)':'Font family','Font style (CSS)':'Style','Text decoration (CSS)':'Decoration','Text case (CSS)':'Case','Font weight (CSS)':'Weight','Font size (CSS)':'Size','Line height (CSS)':'↕','Letter spacing (CSS)':'↔','Text color (CSS)':'Color','Font weight (1–1000)':'Weight','Font size (px)':'Size','Line height (px)':'↕','Letter spacing (px)':'↔','Text alignment':'','Width (CSS)':'W','Height (CSS)':'H','Border width (px)':'Weight','Border style':'Style','Border color':'Color','Place grid items':'Flow','Align children':'Alignment','Distribute children':'Distribution','Width (px)':'W','Height (px)':'H','Opacity (%)':'Opacity','Corner radius (px)':'Radius','Padding top':'Top','Padding bottom':'Bottom','Padding left':'Left','Padding right':'Right','Horizontal gap':'↔','Vertical gap':'↕','Width behavior':'Width','Height behavior':'Height'}[label];if(short){row.querySelector('span').textContent=short;row.title=label;}}
   if(name==='Typography')typographyPrimary(section);
  }

  const arrowStroke=[...panel.children].find(el=>el.dataset.section==='stroke');
  if(arrowStroke){
   for(const [label,short]of [['Start point','Start point'],['Start arrowhead length','Start length'],['Start arrowhead width','Start width'],['End point','End point'],['Arrowhead length','End length'],['Arrowhead width','End width']]){
    const field=panel.querySelector('[aria-label="'+label+'"]')?.closest('.inspector-field');
    if(field){field.querySelector(':scope > span').textContent=short;field.title=label;arrowStroke.append(field);}
   }
   pair(arrowStroke,['Start point','End point']);const endpoints=arrowStroke.querySelector('[aria-label="Start point"]')?.closest('.property-pair');endpoints?.classList.add('arrow-endpoints');
   const sizes=disclosure('Arrowhead sizes','arrowhead-sizes');for(const label of ['Start arrowhead length','Start arrowhead width','Arrowhead length','Arrowhead width']){const field=arrowStroke.querySelector('[aria-label="'+label+'"]')?.closest('.inspector-field');if(field)sizes.append(field);}if(sizes.children.length>1){pair(sizes,['Start arrowhead length','Start arrowhead width']);pair(sizes,['Arrowhead length','Arrowhead width']);arrowStroke.append(sizes);}

   for(const action of panel.querySelectorAll('[data-arrow-action]'))arrowStroke.append(action);
  }
  // A gradient is the selected paint's editor, so keep it inside Fill or Stroke.
  // Preserve its wrapper: stop focus restoration and gesture handlers scope to it.
  for(const gradient of panel.querySelectorAll(':scope > [data-gradient-paint]')){
   const paint=gradient.dataset.gradientPaint,section=[...panel.children].find(el=>el.dataset.section===paint);
   if(!section)continue;
   if(!gradient.querySelector('.refused')){
    const field=section.querySelector('[aria-label="SVG '+paint+'"]')?.closest('.inspector-field');
    (field?.closest('.property-row')||field)?.remove();
   }
   gradient.querySelector(':scope > h3')?.remove();
   gradient.classList.remove('sec','inspector-section');gradient.classList.add('svg-gradient-editor');
   section.insertBefore(gradient,section.children[1]||null);
  }

  // Keep the shared disclosures themselves so their saved state and handlers survive.
  for(const shared of [...panel.children].filter(el=>el.querySelector(':scope > .shared-inspector-group'))){
   const groups=[...shared.querySelectorAll(':scope > .shared-inspector-group')],notes=disclosure('Shared editing details','shared-editing-details');
   for(const child of [...shared.children])if(child.tagName!=='H3'&&!groups.includes(child))notes.append(child);
   for(const group of groups){group.classList.add('sec');shared.before(group);}
   if(notes.children.length>1){notes.classList.add('shared-inspector-notes');shared.before(notes);}
   shared.remove();
  }
  if(!['svg','foreignobject'].includes((head.dataset.layerTag||'').toLowerCase()))for(const paint of ['fill','stroke']){
   const section=[...panel.children].find(el=>el.dataset.section===paint),input=section?.querySelector('[aria-label="SVG '+paint+'"]');
   if(!input||section.querySelector('[data-gradient-paint]')||section.querySelector(':scope > .section-add')||/^url\(/i.test(input.value.trim()))continue;
   const empty=input.value.trim()==='none',action=document.createElement('button');action.type='button';action.className='control-button section-add svg-paint-action';action.textContent=empty?'+':'−';
   action.setAttribute('aria-label',(empty?'Add ':'Remove ')+paint);action.title=input.disabled?input.title:(empty?'Add ':'Remove ')+paint;action.disabled=input.disabled;
   if(empty){action.setAttribute('aria-haspopup','menu');action.setAttribute('aria-expanded','false');}
   action.onclick=()=>{if(input.disabled||!input.isConnected)return;if(empty)return addSVGPaint(input,section.querySelector('[aria-label="'+(paint==='fill'?'Fill type':'Stroke type')+'"]'),action,paint);input.value='none';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
   section.classList.toggle('empty-svg-paint',empty);section.append(action);
  }
  const fillSection=panel.querySelector(':scope > [data-section="fill"]'),imageSection=panel.querySelector(':scope > [data-section="image-fill"]');
  if(fillSection&&imageSection&&!fillSection.querySelector('[aria-label="SVG fill"], [aria-label="Combined fill"]')){
   const advancedFills=disclosure('More fill controls','more-fill-controls'),background=fillSection.querySelector('input[data-paint-property="background-color"]');let backgroundRow=background;
   while(backgroundRow&&backgroundRow.parentElement!==fillSection)backgroundRow=backgroundRow.parentElement;
   for(const child of [...fillSection.children])if(child.tagName!=='H3'&&child!==backgroundRow)advancedFills.append(child);
   for(const child of [...imageSection.children])if(child.tagName==='DETAILS'&&child.querySelector('summary')?.textContent==='Details')advancedFills.append(child);
   imageSection.querySelector(':scope > h3')?.remove();imageSection.classList.remove('sec','inspector-section');imageSection.classList.add('paint-stack-fields');
   const addPaint=imageSection.querySelector(':scope > .section-add');if(addPaint)fillSection.append(addPaint);
   fillSection.insertBefore(imageSection,backgroundRow||fillSection.children[1]||null);
   if(backgroundRow){backgroundRow.classList.add('background-paint-row');backgroundRow.title='Background color · below all other fills';}
   if(advancedFills.children.length>1)fillSection.append(advancedFills);
  }
  for(const section of panel.querySelectorAll(':scope > .inspector-section'))collapsibleSection(section);
 }
 const dock=document.createElement('nav');dock.className='design-tool-dock';dock.setAttribute('aria-label','Canvas tools');
 for(const id of ['modeBtn','canvasHand','quickActions','undoBtn','redoBtn']){const button=document.getElementById(id);if(button){button.setAttribute('aria-label',button.textContent.trim());new MutationObserver(()=>button.setAttribute('aria-label',button.textContent.trim())).observe(button,{childList:true,characterData:true,subtree:true});dock.append(button);}}
 const creationTools=[];
 for(const [action,label,path]of [['insertFrame','Insert frame into selection','M5 2v20 M19 2v20 M2 5h20 M2 19h20'],['insertText','Insert text into selection','M4 5V3h16v2 M12 3v18 M8 21h8']]){
  const button=document.createElement('button');button.type='button';button.className='creation-tool';button.setAttribute('aria-label',label);button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';button.onclick=()=>{if(!button.disabled)root.RetouchActions?.run('layer-'+action);};dock.insertBefore(button,dock.querySelector('#quickActions'));creationTools.push({action,button,label});
 }
 const shapeIcons={rectangle:'M4 4h16v16H4z',circle:'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18',ellipse:'M3 12a9 6 0 1 0 18 0a9 6 0 1 0-18 0',line:'M4 20L20 4',arrow:'M4 20L20 4M8 4h12v12',triangle:'M12 3L22 21H2z',star:'M12 2l3 7h7l-5.5 5 2 8-6.5-4-6.5 4 2-8L2 9h7z',pen:'M5 19l2-10 6-6 8 8-6 6-10 2 M5 19l7-7 M10 10h4v4h-4z'};
 const toolButton=(label,icon)=>{const button=document.createElement('button');button.type='button';button.className='creation-tool';button.setAttribute('aria-label',label);button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+icon+'"/></svg>';dock.insertBefore(button,dock.querySelector('#quickActions'));return button;};
 const shapeTool=toolButton('Shape tools',shapeIcons.rectangle),penTool=toolButton('Pen tool',shapeIcons.pen);
 shapeTool.setAttribute('aria-keyshortcuts','R O L Shift+L');penTool.setAttribute('aria-keyshortcuts','P');shapeTool.setAttribute('aria-haspopup','menu');shapeTool.setAttribute('aria-expanded','false');
 let shapeMenu=null,shapeMenuSource=null;
 const shapeSource=action=>root.RetouchShapeTools?.get(action);
 const shapeEnabled=source=>!!source?.available();
 const preferredShape=preset=>shapeSource('draw-'+preset)||shapeSource('add-'+preset);
 const shapeIdentity=()=>{const source=preferredShape('rectangle');return source?source.owner+':'+source.action:null;};
 const closeShapes=(restore=false)=>{shapeMenu?.remove();shapeMenu=null;shapeMenuSource=null;shapeTool.setAttribute('aria-expanded','false');if(restore)shapeTool.focus({preventScroll:true});};
 const refreshShapes=()=>{const source=preferredShape('rectangle');shapeTool.disabled=!shapeEnabled(source);shapeTool.title=shapeTool.disabled?'Select an editable container, SVG canvas or group in Edit mode.':'Shape tools · R rectangle, O ellipse, L line · V returns to Move';const pen=shapeSource('pen');penTool.disabled=!shapeEnabled(pen);penTool.title=penTool.disabled?'Select an editable container, SVG canvas or group in Edit mode.':'Pen tool · P · V returns to Move';if(shapeMenu&&(shapeTool.disabled||shapeMenuSource!==shapeIdentity()))closeShapes();};
 shapeTool.onclick=()=>{
  if(shapeMenu){closeShapes(true);return;}refreshShapes();if(shapeTool.disabled)return;
  root.RetouchActions?.closeContext();const menu=document.createElement('div');shapeMenu=menu;shapeMenuSource=shapeIdentity();menu.className='rt-context-menu shape-tool-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Shape tools');
  for(const preset of ['rectangle','ellipse','circle','triangle','star','arrow','line']){const source=preferredShape(preset),button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.tabIndex=-1;button.disabled=!shapeEnabled(source);button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+shapeIcons[preset]+'"/></svg>';const label=document.createElement('span');label.textContent=source?.label||'Draw '+preset;button.append(label);const key={rectangle:'R',ellipse:'O',line:'L',arrow:'⇧L'}[preset];if(key){const hint=document.createElement('kbd');hint.textContent=key;hint.setAttribute('aria-hidden','true');button.append(hint);}button.onclick=()=>{const latest=preferredShape(preset);if(!shapeEnabled(latest))return;closeShapes();shapeTool.querySelector('path').setAttribute('d',shapeIcons[preset]);latest.run();};menu.append(button);}
  menu.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeShapes(true);return;}if(event.key==='Tab'){closeShapes(true);return;}if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...menu.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();};
  document.body.append(menu);shapeTool.setAttribute('aria-expanded','true');const box=shapeTool.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,box.left))+'px';menu.style.top=Math.max(8,box.top-menu.offsetHeight-8)+'px';menu.querySelector('button:not(:disabled)')?.focus();
 };
 shapeTool.onkeydown=event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(!shapeMenu)shapeTool.click();else shapeMenu.querySelector('button:not(:disabled)')?.focus();}};
 penTool.onclick=()=>{const source=shapeSource('pen');if(shapeEnabled(source)){closeShapes();source.run();}};
 document.addEventListener('pointerdown',event=>{if(shapeMenu&&!shapeMenu.contains(event.target)&&!shapeTool.contains(event.target))closeShapes();},true);
 window.addEventListener('resize',()=>closeShapes());
 const updateCreationTools=()=>{const editing=document.getElementById('modeBtn').classList.contains('mode-edit');for(const {action,button,label}of creationTools){const source=document.querySelector('#layersPanel button[data-design-action="'+action+'"]');button.disabled=!editing||!source||source.hidden||source.matches(':disabled')||!!source.closest('[inert]');button.title=!editing?'Switch to Edit mode to add a layer.':button.disabled?source?.title||'Select an editable container first.':label;}};
 const main=document.getElementById('main'),canvas=document.getElementById('frameWrap');main.append(dock);
 window.addEventListener('retouch:shape-tools',refreshShapes);window.addEventListener('retouch:selection',refreshShapes);new MutationObserver(refreshShapes).observe(document.getElementById('panelBody'),{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','hidden','inert']});new MutationObserver(refreshShapes).observe(document.getElementById('modeBtn'),{attributes:true,attributeFilter:['class']});refreshShapes();
 const updateDrawingTool=()=>{const surface=document.querySelector('.svg-draw-surface'),shape=!!surface,pen=!!document.querySelector('.svg-pen-surface');if(shapeIcons[surface?.dataset.shape])shapeTool.querySelector('path').setAttribute('d',shapeIcons[surface.dataset.shape]);shapeTool.setAttribute('aria-pressed',String(shape));penTool.setAttribute('aria-pressed',String(pen));dock.classList.toggle('drawing-active',shape||pen);};new MutationObserver(updateDrawingTool).observe(document.body,{childList:true});updateDrawingTool();
 new MutationObserver(updateCreationTools).observe(document.getElementById('layersPanel'),{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','hidden','inert','title']});new MutationObserver(updateCreationTools).observe(document.getElementById('modeBtn'),{attributes:true,attributeFilter:['class']});updateCreationTools();

 const place=()=>{
  const c=canvas.getBoundingClientRect(),m=main.getBoundingClientRect();let left=c.left,right=c.right;
  if(main.classList.contains('compact-workspace')){
   const layers=document.getElementById('layersPanel'),panel=document.getElementById('panel');
   if(!layers.hidden)left=Math.max(left,Math.min(right,layers.getBoundingClientRect().right));
   if(!panel.hidden)right=Math.min(right,Math.max(left,panel.getBoundingClientRect().left));
  }
  const half=Math.min(dock.offsetWidth/2+8,m.width/2);dock.style.left=Math.max(half,Math.min(m.width-half,left-m.left+(right-left)/2))+'px';
 };const dockResize=new ResizeObserver(place);dockResize.observe(canvas);dockResize.observe(dock);window.addEventListener('retouch:workspace-layout',place);place();
 function reveal(control){
  if(!control?.isConnected||control.matches(':disabled')||control.closest('[inert]'))return false;
  root.RetouchWorkspacePanels?.showInspector();
  for(let parent=control.parentElement;parent;parent=parent.parentElement){parent.retouchReveal?.();if(parent.retouchSetCollapsed)parent.retouchSetCollapsed(false,true);if(parent.tagName==='DETAILS'){if(parent.retouchSetOpen)parent.retouchSetOpen(true);else if(parent.retouchOpen)parent.retouchOpen();else parent.open=true;}}
  if(control.matches('select')){const field=control.closest('.vertical-text-modes, .text-align-modes');if(field)control=field.querySelector('.layout-mode-segments button[aria-pressed="true"]')||field.querySelector('.layout-mode-segments button')||control;}
  control.scrollIntoView({block:'nearest',inline:'nearest'});control.focus({preventScroll:true});if(typeof control.select==='function')try{control.select();}catch{}return true;
 }
 root.RetouchInspectorUI={organize,reveal};
})(window);
