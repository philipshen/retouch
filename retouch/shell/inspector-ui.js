(function(root){
 'use strict';
 const openGroups=new Set();
 function disclosure(title,key){const d=document.createElement('details'),s=document.createElement('summary');d.className='inspector-disclosure';s.textContent=title;d.append(s);d.open=openGroups.has(key);d.ontoggle=()=>d.open?openGroups.add(key):openGroups.delete(key);return d;}
 function title(section){return section.querySelector(':scope > h3')?.textContent||'';}
 function pair(section,names){
  const rows=names.map(name=>[...section.querySelectorAll('.inspector-field')].find(row=>row.querySelector('[aria-label]')?.getAttribute('aria-label')===name)).map(row=>row?.closest('.property-row')||row);
  if(rows.some(row=>!row)||rows[0].parentElement!==section||rows[1].parentElement!==section)return;
  const group=document.createElement('div');group.className='property-pair';section.insertBefore(group,rows[0]);rows.forEach(row=>group.append(row));
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
   for(const row of [...css.querySelectorAll(':scope > .inspector-field')]){const label=row.querySelector('[aria-label]')?.getAttribute('aria-label')||'',target=getSection(label.startsWith('Border ')?'Stroke':label.startsWith('Background ')?'Fill':'Layout'),reset=row.nextElementSibling;target.append(row);if(reset?.classList.contains('control-button'))target.append(reset);}
   for(const [from,to] of [['Grid','Layout'],['Flex sizing','Layout'],['Blur','Effects'],['Shadows','Effects'],['Gradient fills','Fill']]){const source=[...panel.children].find(el=>title(el)===from);if(source){const target=getSection(to);[...source.children].filter(el=>el.tagName!=='H3').forEach(el=>target.append(el));source.remove();}}
   const corners=[...panel.children].find(el=>title(el)==='Corners');if(corners){const appearance=getSection('Appearance');[...corners.children].filter(el=>el.tagName!=='H3').forEach(el=>appearance.append(el));corners.remove();}
  }
  const layer=[...panel.children].find(el=>title(el)==='Layer'),nameField=layer?.querySelector('[aria-label="Layer name"]')?.closest('.inspector-field');if(nameField){nameField.classList.add('layer-title');const badge=head.querySelector('.kindbadge');nameField.querySelector('input').placeholder=badge?.textContent||'Layer';if(badge)badge.style.display='none';head.prepend(nameField);}
  const paints=[],appearance=[...panel.children].find(el=>title(el)==='Appearance');
  if(appearance){
   const colors=disclosure('Color overrides','color-overrides');
   for(const row of [...appearance.querySelectorAll(':scope > .inspector-field')])if(/with alpha$/.test(row.querySelector('[aria-label]')?.getAttribute('aria-label')||'')){
    const value=row.nextElementSibling,clear=value?.nextElementSibling,property=row.querySelector('input')?.dataset.paintProperty;if(['color','background-color','border-color'].includes(property)){paints.push({property,row,clear});row.remove();value?.remove();if(clear?.classList.contains('control-button'))clear.remove();continue;}colors.append(row);if(value?.classList.contains('computed-value'))colors.append(value);if(clear?.classList.contains('control-button'))colors.append(clear);
   }
   if(colors.children.length>1)appearance.append(colors);
   const options=disclosure('More appearance options','appearance-options');
   for(const row of [...appearance.querySelectorAll(':scope > .inspector-field')])if(['Visibility','Blend group'].includes(row.querySelector('[aria-label]')?.getAttribute('aria-label'))){const reset=row.nextElementSibling;options.append(row);if(reset?.classList.contains('control-button'))options.append(reset);}
   const slider=appearance.querySelector(':scope > .opacity-row');if(slider){const field=slider.querySelector('.inspector-field');if(field)appearance.insertBefore(field,slider);options.append(slider);}if(options.children.length>1)appearance.append(options);
  }

  if(appearance){const stroke=document.createElement('section');stroke.className='sec inspector-section';const h=document.createElement('h3');h.textContent='Stroke';stroke.append(h);for(const row of [...appearance.querySelectorAll(':scope > .inspector-field')]){if(/^Border /.test(row.querySelector('[aria-label]')?.getAttribute('aria-label')||'')){const next=row.nextElementSibling;stroke.append(row);if(next?.classList.contains('computed-value')||next?.classList.contains('control-button'))stroke.append(next);}}if(stroke.children.length>1)panel.append(stroke);}
  for(const {property,row,clear}of paints){
   const name=property==='background-color'?'Fill':property==='border-color'?'Stroke':'Typography';let target=[...panel.children].find(el=>title(el)===name);if(!target){target=document.createElement('section');target.className='sec inspector-section';const heading=document.createElement('h3');heading.textContent=name;target.append(heading);panel.append(target);}
   if(property==='border-color'){const old=target.querySelector('[aria-label="Border color"]')?.closest('.inspector-field'),note=old?.nextElementSibling;old?.remove();if(note?.classList.contains('computed-value'))note.remove();}
   else{const old=property==='background-color'?target:[...panel.children].find(el=>title(el)==='Text color'),palette=old?.querySelector('.palette');if(palette){const input=row.querySelector('input'),apply=value=>{root.RetouchPanelFocus?.queue(input);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};for(const button of palette.querySelectorAll('.palbtn')){button.setAttribute('aria-label',button.title);button.onclick=()=>apply(button.style.backgroundColor);}const hex=palette.querySelector('.hexinput');if(hex)hex.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();const value='#'+hex.value.trim().replace(/^#/,'');if(/^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value))apply(value);}};const presets=disclosure('Color presets','paint-presets-'+property);palette.hidden=false;presets.append(palette);if(old===target)[...old.children].filter(el=>el.tagName!=='H3').forEach(el=>el.remove());else old.remove();target.append(presets);}}
   row.querySelector(':scope > span').textContent='Color';target.insertBefore(row,target.children[1]||null);if(clear?.classList.contains('control-button'))row.after(clear);
  }
  const svgPaint=[...panel.children].find(el=>title(el)==='SVG paint');if(svgPaint){for(const row of [...svgPaint.querySelectorAll(':scope > .inspector-field')]){const name=row.querySelector('[aria-label]')?.getAttribute('aria-label')==='SVG fill'?'Fill':'Stroke';let target=[...panel.children].find(el=>title(el)===name);if(!target){target=document.createElement('section');target.className='sec inspector-section';const h=document.createElement('h3');h.textContent=name;target.append(h);panel.append(target);}const reset=row.nextElementSibling;target.append(row);if(reset?.classList.contains('control-button'))target.append(reset);}if(!svgPaint.querySelector('.refused'))svgPaint.remove();}
  const fill=[...panel.children].find(el=>title(el)==='Fill');if(fill&&appearance){const gradients=[...appearance.children].find(el=>el.tagName==='DETAILS'&&el.querySelector('summary')?.textContent==='Gradient fills');if(gradients)fill.append(gradients);}
  const text=[...panel.children].find(el=>title(el)==='Text'),typography=[...panel.children].find(el=>title(el)==='Typography');if(text&&typography){[...text.children].filter(el=>el.tagName!=='H3').reverse().forEach(el=>typography.insertBefore(el,typography.children[1]||null));text.remove();}
  const order=['Component','Shared component properties','Position','Geometry','Layout','Appearance',...(RetouchInspector.isTextLayer(head.dataset.layerTag||'')?['Typography']:[]),'Fill','Stroke','Effects','Image framing','Image','Export'];
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
    for(const row of group.querySelectorAll(':scope > .inspector-field')){const label=row.querySelector('[aria-label]')?.getAttribute('aria-label');if(!label?.startsWith(prefix+' '))continue;const text=row.querySelector(':scope > span');if(text){const short=label.slice(prefix.length+1).replace(' (px)','');text.textContent=short[0].toUpperCase()+short.slice(1);}}
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
    const rows=[...group.querySelectorAll(':scope > .inspector-field')].filter(row=>/^(?:Gradient|Fill) \d+ (?:Color blending|Hue direction|Repeat)$/.test(row.querySelector('[aria-label]')?.getAttribute('aria-label')||''));
    if(!rows.length)continue;
    const prefix=rows[0].querySelector('[aria-label]').getAttribute('aria-label').replace(/ (?:Color blending|Hue direction|Repeat)$/,''),options=disclosure('Gradient options','gradient-options-'+prefix);
    options.querySelector('summary').setAttribute('aria-label',prefix+' options');
    for(const row of rows){const hint=row.nextElementSibling,label=row.querySelector('[aria-label]').getAttribute('aria-label');options.append(row);row.querySelector('span').textContent=label.slice(prefix.length+1);if(label.endsWith(' Repeat')&&hint?.classList.contains('hint'))options.append(hint);}
    const reverse=[...group.querySelectorAll(':scope > button')].find(button=>/^Reverse (?:fill|gradient) \d+ stops$/.test(button.textContent));
    if(reverse){const label=reverse.textContent;reverse.setAttribute('aria-label',label);reverse.title=label;reverse.textContent='Reverse stops';const activate=reverse.onclick;reverse.onclick=event=>{root.RetouchPanelFocus?.queue(reverse);return activate?.call(reverse,event);};options.append(reverse);}
    group.append(options);
   }
   if(name==='Typography'){
    const preview=section.querySelector(':scope > .type-preview');if(preview){const details=disclosure('Text preview','text-preview');details.append(preview);section.append(details);}
    const options=disclosure('Type settings','type-settings');
    for(const row of [...section.querySelectorAll(':scope > .inspector-field')])if(['Font style (CSS)','Text decoration (CSS)','Text case (CSS)','Font size','Font weight','Font slant','Text decoration','Text case','Optical sizing','HTML element'].includes(row.querySelector('[aria-label]')?.getAttribute('aria-label'))){const next=row.nextElementSibling;options.append(row);if(next?.classList.contains('control-button')&&/^Reset /.test(next.textContent))options.append(next);}
    for(const row of [...section.querySelectorAll(':scope > .relative-field')])options.append(row);
    for(const child of [...section.children])if((child.classList.contains('control-button')&&(/^(Reset |Automatic line height)/.test(child.textContent)))||(child.tagName==='DETAILS'&&['Variable font axes','Number formatting'].includes(child.querySelector('summary')?.textContent)))options.append(child);
    const content=section.querySelector(':scope > textarea');if(content){const details=disclosure('Text content','text-content'),action=section.querySelector('#textApply'),breakLine=content.nextElementSibling;details.append(content);if(breakLine?.tagName==='BR')breakLine.remove();if(action)details.append(action);section.insertBefore(details,section.children[1]);}
    if(options.children.length>1)section.append(options);
    const align=section.querySelector('[aria-label="Text alignment"], [aria-label="Text alignment (CSS)"]');
    if(align){const row=align.closest('.inspector-field');row.classList.add('text-align-modes');const group=document.createElement('div');group.className='layout-mode-segments';
     for(const value of ['left','center','right','justify']){const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','Align text '+value);button.title='Align text '+value;button.setAttribute('aria-pressed',String(align.value===value));const short=value==='left'?'M3 7h9 M3 15h9':value==='right'?'M8 7h9 M8 15h9':value==='center'?'M6 7h8 M6 15h8':'M3 7h14 M3 15h14';button.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 3h14 M3 11h14 '+short+'"/></svg>';button.onclick=()=>{align.value=value;align.dispatchEvent(new Event('change',{bubbles:true}));};group.append(button);}row.insertBefore(group,align);
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
   if(name==='Geometry'){for(const labels of [['X','Y'],['Width','Height'],['Horizontal radius','Vertical radius'],['Center X','Center Y'],['Start X','Start Y'],['End X','End Y']])pair(section,labels.map(label=>'Shape '+label));for(const row of section.querySelectorAll('.inspector-field')){const input=row.querySelector('input'),label=input?.getAttribute('aria-label')?.replace(/^Shape /,'');if(label)row.querySelector(':scope > span').textContent=({Width:'W',Height:'H','Horizontal radius':'RX','Vertical radius':'RY','Center X':'CX','Center Y':'CY','Start X':'X1','Start Y':'Y1','End X':'X2','End Y':'Y2'})[label]||label;}const scope=document.createElement('p');scope.className='hint geometry-scope';scope.textContent='SVG coordinates · Shared across screen sizes';section.insertBefore(scope,section.children[1]||null);}
   for(const names of [['Padding top (CSS)','Padding bottom (CSS)'],['Padding left (CSS)','Padding right (CSS)'],['Font weight (CSS)','Font size (CSS)'],['Line height (CSS)','Letter spacing (CSS)'],['Font weight (1–1000)','Font size (px)'],['Line height (px)','Letter spacing (px)'],['Width (CSS)','Height (CSS)'],['Width (px)','Height (px)'],['Width behavior','Height behavior'],['Columns','Rows'],['Horizontal gap','Vertical gap'],['Padding top','Padding bottom'],['Padding left','Padding right'],['X','Y'],['Opacity (%)','Corner radius (px)'],['Opacity (%)','Corner radius (CSS)']])pair(section,names);
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
    {
     const paddingPairs=[...section.querySelectorAll(':scope > .property-pair')].filter(group=>group.querySelector('[aria-label="Padding top (CSS)"], [aria-label="Padding left (CSS)"], [aria-label="Padding top"], [aria-label="Padding left"]'));
     if(paddingPairs.length){const sides=disclosure('Individual padding',css?'html-padding':'react-padding');section.insertBefore(sides,paddingPairs[0]);paddingPairs.forEach(group=>sides.append(group));}
    }
    if(css){
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
     const icons={flow:'M3 3h5v5H3z M12 3h5v5h-5z M3 12h5v5H3z M12 12h5v5h-5z',row:'M3 5v10 M8 5v10 M13 5v10 M16 10h4 M18 8l2 2-2 2',column:'M5 3h10 M5 8h10 M5 13h10 M10 16v4 M8 18l2 2 2-2',grid:'M3 3h14v14H3z M10 3v14 M3 10h14'};
     const group=document.createElement('div');group.className='layout-mode-segments';
     for(const [value,label,icon] of [['flow','Normal flow','flow'],[select.dataset.inlineAxis==='vertical'?'row':'column','Vertical layout','column'],[select.dataset.inlineAxis==='vertical'?'column':'row','Horizontal layout','row'],['grid','Grid layout','grid']]){const button=document.createElement('button');button.type='button';button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(select.value.replace('-reverse','')===value));button.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="'+icons[icon]+'"/></svg>';button.onclick=()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));};group.append(button);}row.insertBefore(group,select);
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
   for(const row of section.querySelectorAll('.inspector-field')){const control=row.querySelector('[aria-label]'),label=control?.getAttribute('aria-label');if(['Width behavior','Height behavior'].includes(label))for(const option of control.options)option.textContent=({'':'Auto',fixed:'Fixed',hug:'Hug',fill:'Fill'})[option.value]||option.textContent;const short={'Display (CSS)':'Display','Direction (CSS)':'Direction','Wrap (CSS)':'Wrap','Align items (CSS)':'Alignment','Align lines (CSS)':'Lines','Distribute items (CSS)':'Distribution','Minimum width (CSS)':'Min W','Minimum height (CSS)':'Min H','Maximum width (CSS)':'Max W','Maximum height (CSS)':'Max H','Padding (CSS)':'Padding','Padding top (CSS)':'Top','Padding bottom (CSS)':'Bottom','Padding left (CSS)':'Left','Padding right (CSS)':'Right','Margin (CSS)':'Margin','Margin top (CSS)':'Top','Margin bottom (CSS)':'Bottom','Margin left (CSS)':'Left','Margin right (CSS)':'Right','Gap (CSS)':'Gap','Corner radius (CSS)':'Radius','Border width (CSS)':'Weight','Border style (CSS)':'Style','Border color (CSS)':'Color','Background color (CSS)':'Color','Layer blur (px)':'Blur','Backdrop blur (px)':'Background','Background blur (px)':'Background','Font family (CSS)':'Font family','Font weight (CSS)':'Weight','Font size (CSS)':'Size','Line height (CSS)':'↕','Letter spacing (CSS)':'↔','Text color (CSS)':'Color','Font weight (1–1000)':'Weight','Font size (px)':'Size','Line height (px)':'↕','Letter spacing (px)':'↔','Text alignment':'','Width (CSS)':'W','Height (CSS)':'H','Border width (px)':'Weight','Border style':'Style','Border color':'Color','Place grid items':'Flow','Align children':'Alignment','Distribute children':'Distribution','Width (px)':'W','Height (px)':'H','Opacity (%)':'Opacity','Corner radius (px)':'Radius','Padding top':'Top','Padding bottom':'Bottom','Padding left':'Left','Padding right':'Right','Horizontal gap':'↔','Vertical gap':'↕','Width behavior':'Width','Height behavior':'Height'}[label];if(short){row.querySelector('span').textContent=short;row.title=label;}}
  }
 }
 const dock=document.createElement('nav');dock.className='design-tool-dock';dock.setAttribute('aria-label','Canvas tools');
 for(const id of ['modeBtn','canvasHand','quickActions','undoBtn','redoBtn']){const button=document.getElementById(id);if(button){button.setAttribute('aria-label',button.textContent.trim());new MutationObserver(()=>button.setAttribute('aria-label',button.textContent.trim())).observe(button,{childList:true,characterData:true,subtree:true});dock.append(button);}}
 const main=document.getElementById('main'),canvas=document.getElementById('frameWrap');main.append(dock);
 const place=()=>{
  const c=canvas.getBoundingClientRect(),m=main.getBoundingClientRect();let left=c.left,right=c.right;
  if(main.classList.contains('compact-workspace')){
   const layers=document.getElementById('layersPanel'),panel=document.getElementById('panel');
   if(!layers.hidden)left=Math.max(left,Math.min(right,layers.getBoundingClientRect().right));
   if(!panel.hidden)right=Math.min(right,Math.max(left,panel.getBoundingClientRect().left));
  }
  dock.style.left=(left-m.left+(right-left)/2)+'px';
 };new ResizeObserver(place).observe(canvas);window.addEventListener('retouch:workspace-layout',place);place();
 root.RetouchInspectorUI={organize};
})(window);
