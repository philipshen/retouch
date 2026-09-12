(function(root){
 'use strict';
 let targetChoice='selection',selectionKey='',gapMode='equal';
 function arrange(rects,mode,target=null){
  if(rects.length<(target?1:2)||rects.length>100||rects.some(r=>!['left','top','width','height'].every(p=>Number.isFinite(r[p]))||r.width<=0||r.height<=0))throw Error('Choose between 2 and 100 visible layers.');
  if(target&&(!['left','top','width','height'].every(p=>Number.isFinite(target[p]))||target.width<0||target.height<0))throw Error('The alignment target needs measurable bounds.');
  const modes={left:['x',0],center:['x',.5],right:['x',1],top:['y',0],middle:['y',.5],bottom:['y',1],'gap-x':['x','gap'],'gap-y':['y','gap']};
  if(!modes[mode])throw Error('Choose an alignment.');
  const [axis,fraction]=modes[mode],position=axis==='x'?'left':'top',size=axis==='x'?'width':'height',result=rects.map(()=>({x:0,y:0}));
  if(fraction==='gap'){
   if(rects.length<3)throw Error('Select at least three layers to distribute spacing.');
   const sorted=rects.map((r,i)=>({[position]:r[position],[size]:r[size],i})).sort((a,b)=>a[position]-b[position]),first=sorted[0],last=sorted.at(-1),gap=((target?target[size]:last[position]+last[size]-first[position])-sorted.reduce((n,r)=>n+r[size],0))/(sorted.length-1);let start=target?target[position]:first[position];
   for(const r of sorted){result[r.i][axis]=start-r[position];start+=r[size]+gap;}
  }else{
   const start=target?target[position]:Math.min(...rects.map(r=>r[position])),end=target?target[position]+target[size]:Math.max(...rects.map(r=>r[position]+r[size])),line=start+(end-start)*fraction;
   for(let i=0;i<rects.length;i++)result[i][axis]=line-rects[i][size]*fraction-rects[i][position];
  }
  return result;
 }
 function alignmentKey(event){
  if(event.defaultPrevented||event.isComposing||!event.altKey||event.metaKey||event.ctrlKey||event.getModifierState?.('AltGraph'))return null;
  const code=event.code||'Key'+String(event.key).toUpperCase();
  return {KeyA:'left',KeyH:'center',KeyD:'right',KeyW:'top',KeyV:'middle',KeyS:'bottom'}[code]||null;
 }
 function alignGroups(rects,mode,frames){
  if(!['left','center','right','top','middle','bottom'].includes(mode))throw Error('Choose an alignment for the containing frames.');
  arrange(rects,mode);if(!Array.isArray(frames)||frames.length!==rects.length)throw Error('Resolve a containing frame for every layer.');
  const groups=new Map(),result=rects.map(()=>({x:0,y:0}));
  for(let i=0;i<rects.length;i++){
   const frame=frames[i];if(!frame||!['left','top','width','height'].every(key=>Number.isFinite(frame[key]))||frame.width<0||frame.height<0)throw Error('Choose measurable containing frames.');
   if(!groups.has(frame))groups.set(frame,[]);groups.get(frame).push(i);
  }
  const [axis,position,size,fraction]={left:['x','left','width',0],center:['x','left','width',.5],right:['x','left','width',1],top:['y','top','height',0],middle:['y','top','height',.5],bottom:['y','top','height',1]}[mode];
  for(const [frame,indices]of groups){
   const start=Math.min(...indices.map(i=>rects[i][position])),end=Math.max(...indices.map(i=>rects[i][position]+rects[i][size])),delta=frame[position]+frame[size]*fraction-start-(end-start)*fraction;
   for(const i of indices)result[i][axis]=delta;
  }
  return result;
 }
 function gaps(rects,axis){
  if(!['x','y'].includes(axis))throw Error('Choose horizontal or vertical spacing.');
  const position=axis==='x'?'left':'top',size=axis==='x'?'width':'height',sorted=rects.map((r,i)=>({position:r[position],size:r[size],i})).sort((a,b)=>a.position-b.position);
  return {sorted,values:sorted.slice(1).map((r,i)=>r.position-sorted[i].position-sorted[i].size)};
 }
 function setGaps(rects,axis,values,{anchor=null,start=null}={}){
  arrange(rects,axis==='x'?'left':'top');const {sorted,values:original}=gaps(rects,axis);
  if(!Array.isArray(values)||values.length!==rects.length-1||Array.from(values).some(gap=>!Number.isFinite(gap)||Math.abs(gap)>100000))throw Error('Use a spacing value between -100,000 and 100,000 pixels for each gap.');
  if(values.some((gap,i)=>gap!==original[i]&&gap<1/32-sorted[i].size))throw Error('Keep some forward distance between layers so their order stays intact.');
  if(anchor!==null&&(!Number.isInteger(anchor)||anchor<0||anchor>=rects.length)||start!==null&&!Number.isFinite(start))throw Error('Choose a measurable spacing reference.');
  let cursor=0;const packed=sorted.map((r,i)=>{const item={...r,next:cursor};cursor+=r.size+(values[i]??0);return item;}),reference=packed.find(r=>r.i===(anchor??sorted[0].i)),offset=start??reference.position-reference.next,result=rects.map(()=>({x:0,y:0}));
  for(const r of packed)result[r.i][axis]=r.next+offset-r.position;return result;
 }
 function setSpacing(rects,axis,gap,options={}){
  if(!Number.isFinite(gap)||Math.abs(gap)>100000)throw Error('Use a spacing value between -100,000 and 100,000 pixels.');
  return setGaps(rects,axis,Array(Math.max(0,rects.length-1)).fill(gap),options);
 }
 function preserveBox(changes,g,css){
  // Alignment keeps the authored box model, so content-box maximum sizes do
  // not suddenly constrain a border-box width after moving a padded layer.
  delete changes['box-sizing'];
  if(css.boxSizing==='content-box')for(const [size,parent,edges]of [['width','parentWidth',['left','right']],['height','parentHeight',['top','bottom']]]){
   if(changes[size]==='auto')continue;
   const decoration=edges.reduce((n,edge)=>n+(parseFloat(css.getPropertyValue('padding-'+edge))||0)+(parseFloat(css.getPropertyValue('border-'+edge+'-width'))||0),0),value=Math.max(0,g[size]-decoration);
   changes[size]=changes[size].endsWith('%')?(Math.round(value/g[parent]*1000000)/10000)+'%':(Math.round(value*1000000)/1000000)+'px';
  }
  return changes;
 }
 function alignmentToolbar(onAlign,distribution=false){
  const I=root.RetouchInspector,controls=root.document.createElement('div');controls.className='selection-alignment';controls.setAttribute('role','toolbar');controls.setAttribute('aria-label',distribution?'Align selected layers':'Align layer to frame');controls.style.gridTemplateColumns='repeat('+(distribution?8:6)+',minmax(0,1fr))';
  const icons={left:'M3 3v14 M6 5h10v3H6z M6 12h6v3H6z',center:'M10 2v16 M3 5h14v3H3z M6 12h8v3H6z',right:'M17 3v14 M4 5h10v3H4z M8 12h6v3H8z',top:'M3 3h14 M5 6h3v10H5z M12 6h3v6h-3z',middle:'M2 10h16 M5 3h3v14H5z M12 6h3v8h-3z',bottom:'M3 17h14 M5 4h3v10H5z M12 8h3v6h-3z','gap-x':'M2 3v14 M18 3v14 M6 5h3v10H6z M12 5h3v10h-3z','gap-y':'M3 2h14 M3 18h14 M5 6h10v3H5z M5 12h10v3H5z'};
  for(const [mode,label]of [['left','Align left'],['center','Align horizontal centers'],['right','Align right'],['top','Align top'],['middle','Align vertical centers'],['bottom','Align bottom'],['gap-x','Distribute horizontal spacing'],['gap-y','Distribute vertical spacing']].filter(([mode])=>distribution||!mode.startsWith('gap-'))){
   const button=I.button(label,event=>onAlign(mode,event,button));button.dataset.align=mode;button.setAttribute('aria-label',label);const key={left:'A',center:'H',right:'D',top:'W',middle:'V',bottom:'S'}[mode];if(key)button.setAttribute('aria-keyshortcuts','Alt+'+key);button.title=label+(key?' · Alt+'+key:'')+(distribution&&!mode.startsWith('gap-')?' · Shift: align group to containing frame':'');button.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="'+icons[mode]+'"/></svg>';button.tabIndex=mode==='left'?0:-1;button.addEventListener('focus',()=>{for(const item of controls.children)item.tabIndex=item===button?0:-1;});if(mode.startsWith('gap-'))button.dataset.distribution=mode;controls.append(button);
  }
  controls.addEventListener('keydown',event=>{
   if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   const items=[...controls.querySelectorAll('button:not(:disabled)')],index=items.indexOf(root.document.activeElement);if(index<0)return;
   event.preventDefault();event.stopPropagation();items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowRight'?1:-1)+items.length)%items.length].focus();
  });
  return controls;
 }
  function frameBounds(el){
   const parent=el.offsetParent,d=el.ownerDocument,w=d.defaultView;
   if(!parent||parent===d.body&&w.getComputedStyle(parent).position==='static'&&['none',''].includes(w.getComputedStyle(parent).rotate||''))return {left:0,top:0,width:d.documentElement.clientWidth,height:w.innerHeight};
   const rect=parent.getBoundingClientRect();return {left:rect.left+parent.clientLeft,top:rect.top+parent.clientTop,width:parent.clientWidth,height:parent.clientHeight};
  }
 function singlePosition(el,save,report){
  const I=root.RetouchInspector,group=root.document.createElement('div'),fields=root.document.createElement('div');fields.className='property-pair';
  function measure(){if(!el?.isConnected||el.ownerDocument.defaultView.getComputedStyle(el).position!=='absolute')throw Error('Choose an absolute layer in the current screen.');return I.geometry(el,{allowRotation:true});}
  function write(next,before,control){
   if(!['x','y','width','height'].every(key=>Number.isFinite(next[key])&&Math.abs(next[key])<=100000))throw Error('Keep layer bounds within 100,000 pixels.');
   if(['x','y'].every(key=>Math.abs(next[key]-before[key])<1/32))return;
   if(root.document.activeElement===control)root.RetouchPanelFocus?.queue(control);return save(next,before);
  }
  group.append(alignmentToolbar((mode,event,button)=>{try{
   const before=measure(),delta=arrange([el.getBoundingClientRect()],mode,frameBounds(el))[0];write({...before,x:before.x+delta.x,y:before.y+delta.y},before,button);
  }catch(error){report(error.message);}}),fields);
  const initial=measure();
  for(const [axis,label]of [['x','X'],['y','Y']]){
   const input=I.number(fields,label,initial[axis],-100000,100000,value=>{try{const before=measure();write({...before,[axis]:value},before,input);}catch(error){report(error.message);}});I.fieldDraft(input);input.title='Position from the containing frame in pixels. '+input.title;
   input.retouchNumericPreview=()=>{
    let before;try{before=measure();}catch(error){report(error.message);return {current:()=>false,update(){},restore(){}};}
    const preview=root.RetouchPaintPicker.propertyPreview({el,input,property:'translate'});
    return {current:()=>el.isConnected,update:value=>preview.update(axis==='x'?(value-before.x)+'px 0':'0 '+(value-before.y)+'px'),restore:()=>preview.restore()};
   };
  }
  return group;
 }
 function mount(infos,elements,width,save,onTransform,strategy=null){
  const I=root.RetouchInspector,P=root.RetouchHTMLPosition,sec=I.section('Align selected layers');
  function measure(allowFlow=false){
   strategy?.validate();
   if(!Number.isInteger(width)||elements.some(el=>!el?.isConnected)||infos.some(info=>info.cssReason))throw Error('Re-select the layers and choose a pixel screen scope.');
   if(width>elements[0].ownerDocument.defaultView.innerWidth)throw Error('Choose a screen at least '+width+' pixels wide for this scope.');
   for(const el of elements){
    if(el.namespaceURI!=='http://www.w3.org/1999/xhtml'||elements.some(other=>other!==el&&el.contains(other)))throw Error('Choose separate page layers without selecting their ancestors.');
    for(let ancestor=el.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor.namespaceURI==='http://www.w3.org/2000/svg')throw Error('Alignment inside an SVG viewport is not available yet.');
    const css=el.ownerDocument.defaultView.getComputedStyle(el);if(css.visibility!=='visible'||!el.getClientRects().length)throw Error('Choose visible layers to align their canvas bounds.');
    if(!allowFlow&&css.position!=='absolute')throw Error('Choose Absolute positioning for each layer to align its canvas bounds.');
   }
   return elements.map(el=>({geometry:I.geometry(el,{allowRotation:true,allowScale:true}),rect:el.getBoundingClientRect()}));
  }
  try{measure();}catch(error){
   try{measure(true);}catch(reason){I.note(sec,reason.message,'refused');return sec;}
   I.note(sec,'These layers follow page layout. Use absolute positioning to move and align them freely. Other page content may reflow.');
   sec.append(I.button('Use absolute positioning',()=>{try{
    const before=measure(true),styles=elements.map(el=>el.getAttribute('style'));let measured;
    try{
     // Remove all selected layers from flow together before resolving their
     // containing blocks, which may move when earlier content disappears.
     elements.forEach(el=>el.style.setProperty('position','absolute','important'));
     measured=elements.map((el,i)=>{const g=I.geometry(el,{allowRotation:true,allowScale:true}),original=before[i].rect;return {rect:original,geometry:{...g,x:g.x+before[i].geometry.layoutLeft-g.layoutLeft,y:g.y+before[i].geometry.layoutTop-g.layoutTop,width:before[i].geometry.width,height:before[i].geometry.height}};});
    }finally{elements.forEach((el,i)=>styles[i]===null?el.removeAttribute('style'):el.setAttribute('style',styles[i]));}
    if(measured.some(({geometry:g})=>!['x','y','width','height'].every(key=>Number.isFinite(g[key])&&Math.abs(g[key])<=100000)))throw Error('Keep layer bounds within 100,000 pixels.');
    if(strategy)return strategy.makeAbsolute(measured);
    return save(Object.fromEntries(infos.map((info,i)=>{const g=measured[i].geometry,css=elements[i].ownerDocument.defaultView.getComputedStyle(elements[i]);return [info.id,{position:'absolute',...preserveBox({margin:'0',...P.axis(g,'x','start'),...P.axis(g,'y','start')},g,css)}];})),width);
   }catch(reason){I.note(sec,reason.message,'refused');}}));return sec;
  }
  const key=infos.map(info=>info.id).sort().join(',');if(key!==selectionKey){selectionKey=key;targetChoice='selection';}
  const commonParent=()=>elements.every(el=>el.offsetParent===elements[0].offsetParent);
  if(targetChoice==='parent'&&!commonParent())targetChoice='selection';
  const choices=[['selection','Selection bounds'],['parent','Containing frame'],...infos.map((info,i)=>['layer:'+info.id,'Layer: '+(i+1)+'. '+(info.layerName||elements[i].getAttribute('aria-label')||elements[i].id||info.text?.trim().slice(0,32)||info.tag)])];
  const controls=alignmentToolbar((mode,event,button)=>{try{
   const measured=measure(),rects=measured.map(item=>item.rect),frames=new Map();
   const deltas=event.shiftKey&&!mode.startsWith('gap-')?alignGroups(rects,mode,elements.map(el=>{const key=el.offsetParent;if(!frames.has(key))frames.set(key,frameBounds(el));return frames.get(key);})):arrange(rects,mode,targetBounds(measured));if(deltas.every(d=>Math.abs(d.x)+Math.abs(d.y)<1/32))return;
   if(root.document.activeElement===button)root.RetouchPanelFocus?.queue(button);write(measured,deltas);
  }catch(error){I.note(sec,error.message,'refused');}},true);const description=root.document.createElement('p');description.className='hint';
  const update=()=>{description.textContent=(targetChoice==='selection'?'Align within the selection bounds. Distribution keeps the outer layers in place.':targetChoice==='parent'?'Align to the containing frame. Distribution spreads layers across its bounds.':'The chosen layer stays unchanged. Alignment moves the other selected layers.')+' Shift-align moves sibling layers together within each containing frame. Changes follow this screen scope and undo together.';for(const button of controls.querySelectorAll('[data-distribution]'))button.disabled=infos.length<3||targetChoice.startsWith('layer:');};
  const choice=I.select(sec,'Align to',choices,targetChoice,value=>{targetChoice=value;root.dispatchEvent(new root.Event('retouch:selection-layout'));update();});if(!commonParent()){const option=choice.querySelector('[value=parent]');option.disabled=true;option.textContent='Containing frame (different containers)';}sec.append(description);
  function targetBounds(measured){
   if(targetChoice==='selection')return null;
   if(targetChoice.startsWith('layer:')){const index=infos.findIndex(info=>'layer:'+info.id===targetChoice);if(index<0)throw Error('Choose a selected layer as the alignment target.');return measured[index].rect;}
   if(!commonParent())throw Error('Choose layers with the same containing frame.');
   return frameBounds(elements[0]);
  }
  function write(measured,deltas){
   const current=measure();if(current.some((item,i)=>['x','y','width','height','parentWidth','parentHeight','rotation','scaleX','scaleY'].some(key=>Math.abs((item.geometry[key]??0)-(measured[i].geometry[key]??0))>(key.startsWith('scale')?1e-9:.5))))throw Error('The selection changed during the gesture. Re-select it and try again.');
   const changed=(g,d)=>Math.abs(d.x)+Math.abs(d.y)+Math.abs((d.width??g.width)-g.width)+Math.abs((d.height??g.height)-g.height)>=1/32;
   if(!deltas.some((d,i)=>changed(measured[i].geometry,d)))return;
   if(strategy)return strategy.write(measured,deltas);
   const changes=Object.fromEntries(infos.map((info,i)=>{const g=measured[i].geometry,d=deltas[i];if(!changed(g,d))return [info.id,{}];const el=elements[i],effective=Object.entries(info.cssRules||{}).filter(([w])=>Number(w)<=el.ownerDocument.defaultView.innerWidth).sort(([a],[b])=>Number(a)-Number(b)).reduce((all,[,values])=>Object.assign(all,values),{}),next={...g,x:g.x+d.x,y:g.y+d.y,width:d.width??g.width,height:d.height??g.height};if(!['x','y','width','height'].every(p=>Number.isFinite(next[p])&&Math.abs(next[p])<=100000))throw Error('Keep layer bounds within 100,000 pixels.');return [info.id,preserveBox(P.placement(next,effective),next,el.ownerDocument.defaultView.getComputedStyle(el))];}));return save(changes,width);
  }
  sec.insertBefore(controls,choice.closest('.inspector-field'));
  const coordinates=root.document.createElement('div');coordinates.className='property-pair';controls.after(coordinates);
  const coordinate=(measured,axis)=>commonParent()?Math.min(...measured.map(item=>item.geometry[axis])):Math.min(...measured.map(item=>item.rect[axis==='x'?'left':'top']))+elements[0].ownerDocument.defaultView[axis==='x'?'scrollX':'scrollY'];
  for(const [axis,label]of [['x','Shared X'],['y','Shared Y']]){
   const input=I.number(coordinates,label,coordinate(measure(),axis),-100000,100000,value=>{try{const measured=measure(),delta=value-coordinate(measured,axis);if(root.document.activeElement===input)root.RetouchPanelFocus?.queue(input);write(measured,measured.map(()=>({x:axis==='x'?delta:0,y:axis==='y'?delta:0})));}catch(error){I.note(sec,error.message,'refused');}});I.fieldDraft(input);input.parentElement.querySelector('span').textContent=axis.toUpperCase();
   input.title=(commonParent()?'Selection position in the containing frame.':'Selection position on the page; layers have different containing frames.')+' '+input.title;
   input.retouchNumericPreview=()=>{
    let start;try{start=coordinate(measure(),axis);}catch(error){I.note(sec,error.message,'refused');return {current:()=>false,update(){},restore(){}};}
    const previews=elements.map(el=>root.RetouchPaintPicker.propertyPreview({el,input,property:'translate'}));
    return {current:()=>elements.every(el=>el.isConnected),update:value=>previews.forEach(preview=>preview.update(axis==='x'?(value-start)+'px 0':'0 '+(value-start)+'px')),restore:()=>previews.forEach(preview=>preview.restore())};
   };
  }

  const transforms=root.document.createElement('div');transforms.className='stack-presets';
  if(onTransform)for(const action of ['move','resize']){const control=I.button((action==='move'?'Move':'Resize')+' selection on canvas',event=>{try{const measured=measure();if(action==='resize')elements.forEach(el=>I.geometry(el,{allowScale:true}));onTransform(elements,delta=>write(measured,action==='resize'?root.RetouchCanvasMove.memberBounds(measured.map(item=>item.rect),delta):measured.map(()=>delta)),event.currentTarget,action);}catch(error){I.note(sec,error.message,'refused');}});control.dataset.canvasTool=action;if(action==='resize'&&measure().some(item=>item.geometry.rotation||item.geometry.scaleX!==1||item.geometry.scaleY!==1)){control.disabled=true;control.title='Resizing selections with rotated or scaled layers is not available yet.';}transforms.append(control);}
  if(transforms.children.length)sec.append(transforms);
  if(onTransform)I.select(sec,'Canvas gap adjustment',[['equal','All gaps equally'],['individual','Only the dragged gap']],gapMode,value=>{gapMode=value;root.dispatchEvent(new root.Event('retouch:selection-layout'));});
  for(const [axis,label]of [['x','Horizontal gap (px)'],['y','Vertical gap (px)']]){
   const values=gaps(measure().map(item=>item.rect),axis).values,mixed=values.some(value=>Math.abs(value-values[0])>=1/32),initial=mixed?'':String(Math.round(values.reduce((n,value)=>n+value,0)/values.length*100)/100),input=root.document.createElement('input');
   if(onTransform){const control=I.button('Adjust '+(axis==='x'?'horizontal':'vertical')+' gaps on canvas',event=>{try{const measured=measure(),target=targetBounds(measured),options={axis,independent:gapMode==='individual',anchor:targetChoice.startsWith('layer:')?infos.findIndex(info=>'layer:'+info.id===targetChoice):null,start:targetChoice==='parent'?target[axis==='x'?'left':'top']:null};onTransform(elements,delta=>write(measured,options.independent?setGaps(measured.map(item=>item.rect),axis,delta.values,options):setSpacing(measured.map(item=>item.rect),axis,delta.gap,options)),event.currentTarget,'spacing-'+axis,options);}catch(error){I.note(sec,error.message,'refused');}});control.dataset.canvasTool='spacing-'+axis;sec.append(control);}
   input.type='number';input.step='any';input.min='-100000';input.max='100000';input.value=initial;input.placeholder=mixed?'Mixed':'';input.oninput=()=>input.setCustomValidity('');
   input.onchange=()=>{if(!input.value.trim()){input.value=initial;return;}if(!input.checkValidity())return;try{const measured=measure(),target=targetBounds(measured),anchor=targetChoice.startsWith('layer:')?infos.findIndex(info=>'layer:'+info.id===targetChoice):null,start=targetChoice==='parent'?target[axis==='x'?'left':'top']:null;write(measured,setSpacing(measured.map(item=>item.rect),axis,Number(input.value),{anchor,start}));}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};
   input.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();input.value=initial;input.setCustomValidity('');input.blur();}else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();input.blur();}};I.field(sec,label,input);
  }
  I.note(sec,'Exact gaps keep the first layer fixed, or the chosen reference layer. With a frame target, spacing starts at its left or top edge. Negative gaps overlap layers without reversing their order.');
  update();return sec;
 }
 const api={arrange,alignGroups,alignmentKey,alignmentToolbar,singlePosition,preserveBox,gaps,setGaps,setSpacing,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSelectionLayout=api;
})(typeof window==='object'?window:globalThis);
