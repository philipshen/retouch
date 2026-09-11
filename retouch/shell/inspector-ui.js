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
  const scope=head.querySelector('.screen-scope');if(scope){const more=disclosure('Breakpoint options','breakpoint');[...scope.children].filter(el=>el.tagName!=='LABEL'&&!el.classList.contains('scope-status')&&el.id!=='previewBreakpoint').forEach(el=>more.append(el));if(more.children.length>1)scope.append(more);}
  // Put properties in the same reading order as the Design panel reference.
  for(const section of [...panel.children]){const aliases={'Shared styles':'Layout','Align selected layers':'Position'},name=aliases[title(section)];if(name)section.querySelector(':scope > h3').textContent=name;}

  for(const container of [...panel.children])if(container!==head&&[...container.children].some(el=>title(el)==='CSS properties')){[...container.children].forEach(el=>panel.insertBefore(el,container));container.remove();}
  const css=[...panel.children].find(el=>title(el)==='CSS properties');
  if(css){
   const getSection=name=>{let section=[...panel.children].find(el=>title(el)===name);if(!section){section=document.createElement('section');section.className='sec inspector-section';const h=document.createElement('h3');h.textContent=name;section.append(h);panel.append(section);}return section;};
   for(const row of [...css.querySelectorAll(':scope > .inspector-field')]){const label=row.querySelector('[aria-label]')?.getAttribute('aria-label')||'',target=getSection(label.startsWith('Border ')?'Stroke':label.startsWith('Background ')?'Fill':'Layout'),reset=row.nextElementSibling;target.append(row);if(reset?.classList.contains('control-button'))target.append(reset);}
   for(const [from,to] of [['Grid','Layout'],['Flex sizing','Layout'],['Blur','Effects'],['Shadows','Effects'],['Gradient fills','Fill']]){const source=[...panel.children].find(el=>title(el)===from);if(source){const target=getSection(to);[...source.children].filter(el=>el.tagName!=='H3').forEach(el=>target.append(el));source.remove();}}
   const corners=[...panel.children].find(el=>title(el)==='Corners');if(corners){const appearance=getSection('Appearance');[...corners.children].filter(el=>el.tagName!=='H3').forEach(el=>appearance.append(el));corners.remove();}
  }
  const layer=[...panel.children].find(el=>title(el)==='Layer'),nameField=layer?.querySelector('[aria-label="Layer name"]')?.closest('.inspector-field');if(nameField){nameField.classList.add('layer-title');const badge=head.querySelector('.kindbadge');nameField.querySelector('input').placeholder=badge?.textContent||'Layer';if(badge)badge.style.display='none';head.prepend(nameField);}
  const appearance=[...panel.children].find(el=>title(el)==='Appearance');
  if(appearance){
   const colors=disclosure('Color overrides','color-overrides');
   for(const row of [...appearance.querySelectorAll(':scope > .inspector-field')])if(/with alpha$/.test(row.querySelector('[aria-label]')?.getAttribute('aria-label')||'')){
    const value=row.nextElementSibling,clear=value?.nextElementSibling;colors.append(row);if(value?.classList.contains('computed-value'))colors.append(value);if(clear?.classList.contains('control-button'))colors.append(clear);
   }
   if(colors.children.length>1)appearance.append(colors);
   const options=disclosure('More appearance options','appearance-options');
   for(const row of [...appearance.querySelectorAll(':scope > .inspector-field')])if(['Visibility','Blend group'].includes(row.querySelector('[aria-label]')?.getAttribute('aria-label'))){const reset=row.nextElementSibling;options.append(row);if(reset?.classList.contains('control-button'))options.append(reset);}
   const slider=appearance.querySelector(':scope > .opacity-row');if(slider){const field=slider.querySelector('.inspector-field');if(field)appearance.insertBefore(field,slider);options.append(slider);}if(options.children.length>1)appearance.append(options);
  }

  if(appearance){const stroke=document.createElement('section');stroke.className='sec inspector-section';const h=document.createElement('h3');h.textContent='Stroke';stroke.append(h);for(const row of [...appearance.querySelectorAll(':scope > .inspector-field')]){if(/^Border /.test(row.querySelector('[aria-label]')?.getAttribute('aria-label')||'')){const next=row.nextElementSibling;stroke.append(row);if(next?.classList.contains('computed-value')||next?.classList.contains('control-button'))stroke.append(next);}}if(stroke.children.length>1)panel.append(stroke);}
  const fill=[...panel.children].find(el=>title(el)==='Fill');if(fill&&appearance){const gradients=[...appearance.children].find(el=>el.tagName==='DETAILS'&&el.querySelector('summary')?.textContent==='Gradient fills');if(gradients)fill.append(gradients);}
  const text=[...panel.children].find(el=>title(el)==='Text'),typography=[...panel.children].find(el=>title(el)==='Typography');if(text&&typography){[...text.children].filter(el=>el.tagName!=='H3').reverse().forEach(el=>typography.insertBefore(el,typography.children[1]||null));text.remove();}
  const order=['Component','Shared component properties','Position','Layout','Appearance',...(RetouchInspector.isTextLayer(head.querySelector('.kindbadge')?.textContent.toLowerCase()||'')?['Typography']:[]),'Fill','Stroke','Effects','Image framing','Image','Export'];
  const advanced=disclosure('More properties','advanced');advanced.classList.add('inspector-more');
  const children=[...panel.children].filter(el=>el!==head);
  for(const name of order)for(const el of children.filter(el=>title(el)===name)){el.classList.add('inspector-section');panel.append(el);}
  for(const el of children.filter(el=>!order.includes(title(el))))advanced.append(el);
  if(advanced.children.length>1)panel.append(advanced);
  for(const section of panel.querySelectorAll('.inspector-section')){
   const name=title(section);section.dataset.section=name.toLowerCase().replace(/\s+/g,'-');
   if(name==='Fill'||name==='Effects'){
    const options=disclosure(name==='Fill'?'Fill options':'Effect options',name+'-options');
    for(const button of [...section.querySelectorAll(':scope > .control-button')]){
     if(['Clear background images','Reset gradient fills','Clear layer filters','Clear background filters'].includes(button.textContent))options.append(button);
     else if(name==='Fill'&&button.textContent==='Add gradient'){button.setAttribute('aria-label','Add gradient');button.title='Add gradient';button.textContent='+';button.classList.add('section-add');}
    }
    if(options.children.length>1)section.append(options);
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
   for(const button of [...section.querySelectorAll(':scope > .control-button, :scope > .radius-corners > .control-button')])if(/^Reset /.test(button.textContent)){
    const label=button.textContent;button.setAttribute('aria-label',label);button.title=label;button.textContent='↺';button.classList.add('property-reset');const previous=button.previousElementSibling;
    if(previous?.classList.contains('inspector-field')){const row=document.createElement('div');row.className='property-row';previous.parentElement.insertBefore(row,previous);row.append(previous,button);}
   }
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
     if(dimension)row.after(dimension);if(behavior&&dimension)dimension.after(behavior);const clip=section.querySelector('[aria-label="Clip content"]')?.closest('.property-row');if(clip)(behavior||dimension||row).after(clip);
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
