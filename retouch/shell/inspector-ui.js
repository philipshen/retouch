(function(root){
 'use strict';
const layoutIcons={flow:'M3 3h5v5H3z M12 3h5v5h-5z M3 12h5v5H3z M12 12h5v5h-5z',row:'M3 5v10 M8 5v10 M13 5v10 M16 10h4 M18 8l2 2-2 2',column:'M5 3h10 M5 8h10 M5 13h10 M10 16v4 M8 18l2 2 2-2',grid:'M3 3h14v14H3z M10 3v14 M3 10h14'};
 const openGroups=new Set(),collapsedSections=new Set();
 const sectionPreferenceKey='retouch.inspector.sections.v1';
 try{const saved=JSON.parse(root.localStorage.getItem(sectionPreferenceKey));if(Array.isArray(saved))for(const name of saved.slice(0,64))if(typeof name==='string'&&name.length<=64)collapsedSections.add(name);}catch{}
 function saveSectionPreferences(){try{root.localStorage.setItem(sectionPreferenceKey,JSON.stringify([...collapsedSections].slice(0,64)));}catch{}}

 function disclosure(title,key){const d=document.createElement('details'),s=document.createElement('summary');d.className='inspector-disclosure';s.textContent=title;d.append(s);d.open=openGroups.has(key);d.ontoggle=()=>d.open?openGroups.add(key):openGroups.delete(key);return d;}
 function title(section){return section.querySelector(':scope > h3')?.textContent||'';}
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
 function typographyPrimary(section){
  const find=labels=>labels.map(label=>section.querySelector('[aria-label="'+label+'"]')).find(Boolean),row=control=>control?.closest('.property-row')||control?.closest('.inspector-field');
  const font=row(find(['Page font'])),weight=find(['Font weight (1–1000)','Font weight (CSS)']),spacing=find(['Line height (px)','Line height (CSS)']),align=row(find(['Text alignment','Text alignment (CSS)']));
  const sizePair=weight?.closest('.property-pair'),spacingPair=spacing?.closest('.property-pair'),parts=[font,sizePair,spacingPair,align].filter(part=>part?.parentElement===section);
  if(!parts.length)return;
  const primary=document.createElement('div');primary.className='typography-primary';section.querySelector(':scope > h3').after(primary);parts.forEach(part=>primary.append(part));
  font?.classList.add('typography-family');sizePair?.classList.add('typography-size');spacingPair?.classList.add('typography-spacing');
  for(const [labels,title,path] of [[['Line height (px)','Line height (CSS)'],'Line height','M4 3h12 M4 17h12 M6 14l4-8 4 8 M8 11h4'],[['Letter spacing (px)','Letter spacing (CSS)'],'Letter spacing','M3 4v12 M17 4v12 M6 14l4-8 4 8 M8 11h4']]){
   const input=find(labels),field=input?.closest('.inspector-field');if(!field)continue;
   const icon=field.querySelector(':scope > span');icon.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="'+path+'"/></svg>';
   const cell=field.closest('.property-row')||field;cell.classList.add('typography-spacing-cell');cell.dataset.caption=title;
  }
  if(align){align.classList.add('typography-alignment');const label=align.querySelector('.inspector-field > span, :scope > span');if(label)label.textContent='Alignment';}
 }
 function collapsibleSection(section){
  const heading=section.querySelector(':scope > h3');if(!heading)return;
  const name=heading.textContent,key=section.dataset.section||name,button=document.createElement('button');button.type='button';button.className='section-toggle';button.textContent=name;
  const set=(collapsed,persist=false)=>{section.dataset.collapsed=String(collapsed);button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',(collapsed?'Expand ':'Collapse ')+name+' section');if(collapsed)collapsedSections.add(key);else collapsedSections.delete(key);if(persist)saveSectionPreferences();};
  section.retouchSetCollapsed=set;button.onclick=()=>set(section.dataset.collapsed!=='true',true);heading.setAttribute('aria-label',name);heading.replaceChildren(button);set(collapsedSections.has(key));
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
   for(const [from,to] of [['Grid','Layout'],['Flex sizing','Layout'],['Blur','Effects'],['Shadows','Effects'],['Gradient fills','Fill']]){const source=[...panel.children].find(el=>title(el)===from);if(source){const target=getSection(to);[...source.children].filter(el=>el.tagName!=='H3').forEach(el=>target.append(el));source.remove();}}
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
  const text=[...panel.children].find(el=>title(el)==='Text'),typography=[...panel.children].find(el=>title(el)==='Typography');if(text&&typography){[...text.children].filter(el=>el.tagName!=='H3').reverse().forEach(el=>typography.insertBefore(el,typography.children[1]||null));text.remove();}
  const position=[...panel.children].find(el=>title(el)==='Position'),sharedRotation=panel.querySelector('[aria-label="Shared Rotation (°)"]')?.closest('.inspector-field');
  if(position&&sharedRotation){const label=sharedRotation.querySelector(':scope > span');if(label)label.textContent='Rotation (°)';const row=sharedRotation.closest('.property-row')||sharedRotation,reset=row.nextElementSibling;position.append(row);if(reset?.classList.contains('control-button')&&reset.textContent.toLowerCase().startsWith('reset shared rotation'))position.append(reset);}
  const selectionFlips=[...panel.children].find(el=>title(el)==='Flip selection');if(position&&selectionFlips){position.append(...[...selectionFlips.children].filter(el=>el.tagName!=='H3'));selectionFlips.remove();}
  const order=['Component','Shared component properties','Position','Geometry','Add shape','Layout','Appearance',...(RetouchInspector.isTextLayer(head.dataset.layerTag||'')?['Typography']:[]),'Fill','Stroke','Effects','Image framing','Image','Export'];
  const advanced=disclosure('More properties','advanced');advanced.classList.add('inspector-more');
  const children=[...panel.children].filter(el=>el!==head);
  for(const name of order)for(const el of children.filter(el=>title(el)===name)){el.classList.add('inspector-section');panel.append(el);}
  for(const el of children.filter(el=>!order.includes(title(el))))advanced.append(el);
  if(advanced.children.length>1)panel.append(advanced);
  for(const section of panel.querySelectorAll('.inspector-section')){
   const name=title(section);section.dataset.section=name.toLowerCase().replace(/\s+/g,'-');
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
   const paintInputs=name==='Fill'?[...section.querySelectorAll('.gradient-stop-row input:not([type="number"])')]:name==='Effects'?[...section.querySelectorAll('.shadow-controls input')].filter(input=>/^Shadow \d+ color$/.test(input.getAttribute('aria-label')||'')):[];
   paintInputs.push(...section.querySelectorAll('input[data-paint-property]'));
   for(const input of paintInputs){
    if(input.parentElement.classList.contains('paint-field-control'))continue;
    if(name==='Effects'||input.dataset.paintProperty){const control=document.createElement('span');control.className='paint-field-control';input.replaceWith(control);control.append(input);}

    const swatch=document.createElement('button');swatch.type='button';swatch.className='gradient-stop-swatch';swatch.setAttribute('aria-label','Edit '+input.getAttribute('aria-label'));swatch.title='Edit color';swatch.disabled=input.disabled;swatch.onclick=()=>root.RetouchPaintPicker.open(input);input.parentElement.classList.add('gradient-stop-color');input.before(swatch);
    const paint=()=>{const color=input.value.trim();if(CSS.supports('color',color))swatch.style.backgroundImage='linear-gradient('+color+','+color+'),repeating-conic-gradient(#ddd 0% 25%,white 0% 50%)';};
    input.addEventListener('input',paint);input.addEventListener('change',paint);input.addEventListener('keydown',event=>{if(event.key==='Escape')queueMicrotask(paint);});paint();
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
      const match=group.querySelector(':scope > legend').textContent.trim().match(/^(Gradient|Fill|Shadow) (\d+)$/),count=section.querySelectorAll(name==='Fill'?'.gradient-controls':'.shadow-controls').length;
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
    for(const row of [...section.querySelectorAll(':scope > .inspector-field')])if(['Font family (CSS)','Font style (CSS)','Text decoration (CSS)','Text case (CSS)','Font size','Font weight','Font slant','Text decoration','Text case','Optical sizing','HTML element'].includes(fieldControl(row)?.getAttribute('aria-label'))){const next=row.nextElementSibling;options.append(row);if(next?.classList.contains('control-button')&&/^Reset /.test(next.textContent))options.append(next);}
    for(const row of [...section.querySelectorAll(':scope > .relative-field')])options.append(row);
    for(const child of [...section.children])if((child.classList.contains('control-button')&&!child.dataset.primaryFontReset&&(/^(Reset |Automatic line height)/.test(child.textContent)))||(child.tagName==='DETAILS'&&['Variable font axes','Number formatting'].includes(child.querySelector('summary')?.textContent)))options.append(child);
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

   const help=disclosure('Details',name+'-help');for(const hint of [...section.children].filter(el=>el.classList.contains('hint')||el.classList.contains('computed-value')))help.append(hint);if(help.children.length>1)section.append(help);
   for(const button of [...section.querySelectorAll(':scope > .control-button, :scope > .radius-corners > .control-button')])if(/^(Reset |Clear local (?:text|background|border) color$)/.test(button.textContent)){
    const label=button.textContent;button.setAttribute('aria-label',label);button.title=label;button.textContent='↺';button.classList.add('property-reset');const previous=button.previousElementSibling;
    if(previous?.classList.contains('inspector-field')){const row=document.createElement('div');row.className='property-row';previous.parentElement.insertBefore(row,previous);row.append(previous,button);}
   }
   if(name==='Geometry'&&section.querySelector('[aria-label="Star points"],[aria-label="Polygon sides"]')){
    pair(section,['Star points','Star inner ratio (%)']);const field=section.querySelector('[aria-label="Shape Points"]')?.closest('.inspector-field');if(field){const reset=field.nextElementSibling,details=disclosure('Vector data','parametric-vector-data');details.append(field);if(reset?.classList.contains('control-button'))details.append(reset);section.append(details);}
   }
   if(name==='Geometry'){for(const labels of [['X','Y'],['Width','Height'],['Horizontal radius','Vertical radius'],['Center X','Center Y'],['Start X','Start Y'],['End X','End Y']])pair(section,labels.map(label=>'Shape '+label));for(const row of section.querySelectorAll('.inspector-field')){const input=row.querySelector('input'),label=input?.getAttribute('aria-label')?.replace(/^Shape /,'');if(label)row.querySelector(':scope > span').textContent=({'Star points':'Count','Polygon sides':'Sides','Star inner ratio (%)':'Ratio %',Width:'W',Height:'H','Horizontal radius':'RX','Vertical radius':'RY','Center X':'CX','Center Y':'CY','Start X':'X1','Start Y':'Y1','End X':'X2','End Y':'Y2'})[label]||label;}const scope=document.createElement('p');scope.className='hint geometry-scope';scope.textContent='SVG coordinates · Shared across screen sizes';section.insertBefore(scope,section.children[1]||null);}
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
   for(const row of section.querySelectorAll('.inspector-field')){const control=fieldControl(row),label=control?.getAttribute('aria-label');if(['Width behavior','Height behavior'].includes(label))for(const option of control.options)option.textContent=({'':'Auto',fixed:'Fixed',hug:'Hug',fill:'Fill'})[option.value]||option.textContent;const short={'Page font':'Font','Shared Page font':'Font','Display (CSS)':'Display','Direction (CSS)':'Direction','Wrap (CSS)':'Wrap','Align items (CSS)':'Alignment','Align lines (CSS)':'Lines','Distribute items (CSS)':'Distribution','Minimum width (CSS)':'Min W','Minimum height (CSS)':'Min H','Maximum width (CSS)':'Max W','Maximum height (CSS)':'Max H','Padding (CSS)':'Padding','Padding top (CSS)':'Top','Padding bottom (CSS)':'Bottom','Padding left (CSS)':'Left','Padding right (CSS)':'Right','Margin (CSS)':'Margin','Margin top (CSS)':'Top','Margin bottom (CSS)':'Bottom','Margin left (CSS)':'Left','Margin right (CSS)':'Right','Gap (CSS)':'Gap','Corner radius (CSS)':'Radius','Border width (CSS)':'Weight','Border style (CSS)':'Style','Border color (CSS)':'Color','Background color (CSS)':'Color','Layer blur (px)':'Blur','Backdrop blur (px)':'Background','Background blur (px)':'Background','Font family (CSS)':'Font family','Font weight (CSS)':'Weight','Font size (CSS)':'Size','Line height (CSS)':'↕','Letter spacing (CSS)':'↔','Text color (CSS)':'Color','Font weight (1–1000)':'Weight','Font size (px)':'Size','Line height (px)':'↕','Letter spacing (px)':'↔','Text alignment':'','Width (CSS)':'W','Height (CSS)':'H','Border width (px)':'Weight','Border style':'Style','Border color':'Color','Place grid items':'Flow','Align children':'Alignment','Distribute children':'Distribution','Width (px)':'W','Height (px)':'H','Opacity (%)':'Opacity','Corner radius (px)':'Radius','Padding top':'Top','Padding bottom':'Bottom','Padding left':'Left','Padding right':'Right','Horizontal gap':'↔','Vertical gap':'↕','Width behavior':'Width','Height behavior':'Height'}[label];if(short){row.querySelector('span').textContent=short;row.title=label;}}
   if(name==='Typography')typographyPrimary(section);
  }

  // Keep the shared disclosures themselves so their saved state and handlers survive.
  for(const shared of [...panel.children].filter(el=>el.querySelector(':scope > .shared-inspector-group'))){
   const groups=[...shared.querySelectorAll(':scope > .shared-inspector-group')],notes=disclosure('Shared editing details','shared-editing-details');
   for(const child of [...shared.children])if(child.tagName!=='H3'&&!groups.includes(child))notes.append(child);
   for(const group of groups){group.classList.add('sec');shared.before(group);}
   if(notes.children.length>1){notes.classList.add('shared-inspector-notes');shared.before(notes);}
   shared.remove();
  }
  for(const section of panel.querySelectorAll(':scope > .inspector-section'))collapsibleSection(section);
 }
 const dock=document.createElement('nav');dock.className='design-tool-dock';dock.setAttribute('aria-label','Canvas tools');
 for(const id of ['modeBtn','canvasHand','quickActions','undoBtn','redoBtn']){const button=document.getElementById(id);if(button){button.setAttribute('aria-label',button.textContent.trim());new MutationObserver(()=>button.setAttribute('aria-label',button.textContent.trim())).observe(button,{childList:true,characterData:true,subtree:true});dock.append(button);}}
 const creationTools=[];
 for(const [action,label,path]of [['insertFrame','Insert frame into selection','M5 2v20 M19 2v20 M2 5h20 M2 19h20'],['insertText','Insert text into selection','M4 5V3h16v2 M12 3v18 M8 21h8']]){
  const button=document.createElement('button');button.type='button';button.className='creation-tool';button.setAttribute('aria-label',label);button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';button.onclick=()=>{if(!button.disabled)root.RetouchActions?.run('layer-'+action);};dock.insertBefore(button,dock.querySelector('#quickActions'));creationTools.push({action,button,label});
 }
 const shapeIcons={rectangle:'M4 4h16v16H4z',circle:'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18',ellipse:'M3 12a9 6 0 1 0 18 0a9 6 0 1 0-18 0',line:'M4 20L20 4',triangle:'M12 3L22 21H2z',star:'M12 2l3 7h7l-5.5 5 2 8-6.5-4-6.5 4 2-8L2 9h7z',pen:'M5 19l2-10 6-6 8 8-6 6-10 2 M5 19l7-7 M10 10h4v4h-4z'};
 const toolButton=(label,icon)=>{const button=document.createElement('button');button.type='button';button.className='creation-tool';button.setAttribute('aria-label',label);button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+icon+'"/></svg>';dock.insertBefore(button,dock.querySelector('#quickActions'));return button;};
 const shapeTool=toolButton('Shape tools',shapeIcons.rectangle),penTool=toolButton('Pen tool',shapeIcons.pen);
 shapeTool.setAttribute('aria-haspopup','menu');shapeTool.setAttribute('aria-expanded','false');
 let shapeMenu=null,shapeMenuSource=null;
 const shapeSource=action=>document.querySelector('#panelBody [data-shape-action="'+action+'"]');
 const shapeEnabled=source=>document.getElementById('modeBtn').classList.contains('mode-edit')&&source&&!source.disabled&&!source.closest('[inert]');
 const preferredShape=preset=>shapeSource('draw-'+preset)||shapeSource('add-'+preset);
 const shapeIdentity=()=>{const source=preferredShape('rectangle');return source?source.closest('[data-shape-owner]')?.dataset.shapeOwner+':'+source.dataset.shapeAction:null;};
 const closeShapes=(restore=false)=>{shapeMenu?.remove();shapeMenu=null;shapeMenuSource=null;shapeTool.setAttribute('aria-expanded','false');if(restore)shapeTool.focus({preventScroll:true});};
 const refreshShapes=()=>{const source=preferredShape('rectangle');shapeTool.disabled=!shapeEnabled(source);shapeTool.title=shapeTool.disabled?'Select an editable container, SVG canvas or group in Edit mode.':'Shape tools';const pen=shapeSource('pen');penTool.disabled=!shapeEnabled(pen);penTool.title=penTool.disabled?'Select an SVG canvas or group in Edit mode.':'Draw with the Pen tool';if(shapeMenu&&(shapeTool.disabled||shapeMenuSource!==shapeIdentity()))closeShapes();};
 shapeTool.onclick=()=>{
  if(shapeMenu){closeShapes(true);return;}refreshShapes();if(shapeTool.disabled)return;
  root.RetouchActions?.closeContext();const menu=document.createElement('div');shapeMenu=menu;shapeMenuSource=shapeIdentity();menu.className='rt-context-menu shape-tool-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Shape tools');
  for(const preset of ['rectangle','ellipse','circle','triangle','star','line']){const source=preferredShape(preset),button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.tabIndex=-1;button.disabled=!shapeEnabled(source);button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+shapeIcons[preset]+'"/></svg>';const label=document.createElement('span');label.textContent=source?.textContent||'Add '+preset;button.append(label);button.onclick=()=>{const latest=preferredShape(preset);if(!shapeEnabled(latest))return;closeShapes();shapeTool.querySelector('path').setAttribute('d',shapeIcons[preset]);latest.click();};menu.append(button);}
  menu.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeShapes(true);return;}if(event.key==='Tab'){closeShapes(true);return;}if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...menu.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();};
  document.body.append(menu);shapeTool.setAttribute('aria-expanded','true');const box=shapeTool.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,box.left))+'px';menu.style.top=Math.max(8,box.top-menu.offsetHeight-8)+'px';menu.querySelector('button:not(:disabled)')?.focus();
 };
 shapeTool.onkeydown=event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(!shapeMenu)shapeTool.click();else shapeMenu.querySelector('button:not(:disabled)')?.focus();}};
 penTool.onclick=()=>{const source=shapeSource('pen');if(shapeEnabled(source)){closeShapes();source.click();}};
 document.addEventListener('pointerdown',event=>{if(shapeMenu&&!shapeMenu.contains(event.target)&&!shapeTool.contains(event.target))closeShapes();},true);
 window.addEventListener('resize',()=>closeShapes());
 const updateCreationTools=()=>{const editing=document.getElementById('modeBtn').classList.contains('mode-edit');for(const {action,button,label}of creationTools){const source=document.querySelector('#layersPanel button[data-design-action="'+action+'"]');button.disabled=!editing||!source||source.hidden||source.matches(':disabled')||!!source.closest('[inert]');button.title=!editing?'Switch to Edit mode to add a layer.':button.disabled?source?.title||'Select an editable container first.':label;}};
 const main=document.getElementById('main'),canvas=document.getElementById('frameWrap');main.append(dock);
 new MutationObserver(refreshShapes).observe(document.getElementById('panelBody'),{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','inert']});new MutationObserver(refreshShapes).observe(document.getElementById('modeBtn'),{attributes:true,attributeFilter:['class']});refreshShapes();
 const updateDrawingTool=()=>{const shape=!!document.querySelector('.svg-draw-surface'),pen=!!document.querySelector('.svg-pen-surface');shapeTool.setAttribute('aria-pressed',String(shape));penTool.setAttribute('aria-pressed',String(pen));dock.classList.toggle('drawing-active',shape||pen);};new MutationObserver(updateDrawingTool).observe(document.body,{childList:true});updateDrawingTool();
 new MutationObserver(updateCreationTools).observe(document.getElementById('layersPanel'),{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','hidden','inert','title']});new MutationObserver(updateCreationTools).observe(document.getElementById('modeBtn'),{attributes:true,attributeFilter:['class']});updateCreationTools();

 const place=()=>{
  const c=canvas.getBoundingClientRect(),m=main.getBoundingClientRect();let left=c.left,right=c.right;
  if(main.classList.contains('compact-workspace')){
   const layers=document.getElementById('layersPanel'),panel=document.getElementById('panel');
   if(!layers.hidden)left=Math.max(left,Math.min(right,layers.getBoundingClientRect().right));
   if(!panel.hidden)right=Math.min(right,Math.max(left,panel.getBoundingClientRect().left));
  }
  const half=Math.min(dock.offsetWidth/2+8,m.width/2);dock.style.left=Math.max(half,Math.min(m.width-half,left-m.left+(right-left)/2))+'px';
 };new ResizeObserver(place).observe(canvas);window.addEventListener('retouch:workspace-layout',place);place();
 function reveal(control){
  if(!control?.isConnected||control.matches(':disabled')||control.closest('[inert]'))return false;
  root.RetouchWorkspacePanels?.showInspector();
  for(let parent=control.parentElement;parent;parent=parent.parentElement){if(parent.retouchSetCollapsed)parent.retouchSetCollapsed(false,true);if(parent.tagName==='DETAILS'){if(parent.retouchSetOpen)parent.retouchSetOpen(true);else parent.open=true;}}
  control.scrollIntoView({block:'nearest',inline:'nearest'});control.focus({preventScroll:true});if(typeof control.select==='function')try{control.select();}catch{}return true;
 }
 root.RetouchInspectorUI={organize,reveal};
})(window);
