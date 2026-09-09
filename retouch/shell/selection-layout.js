(function(root){
 'use strict';
 let targetChoice='selection',selectionKey='',gapMode='equal';
 function arrange(rects,mode,target=null){
  if(rects.length<2||rects.length>100||rects.some(r=>!['left','top','width','height'].every(p=>Number.isFinite(r[p]))||r.width<=0||r.height<=0))throw Error('Choose between 2 and 100 visible layers.');
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
 function mount(infos,elements,width,save,onTransform){
  const I=root.RetouchInspector,P=root.RetouchHTMLPosition,sec=I.section('Align selected layers');
  function measure(){
   if(!Number.isInteger(width)||elements.some(el=>!el?.isConnected)||infos.some(info=>info.cssReason))throw Error('Re-select the layers and choose a pixel screen scope.');
   if(width>elements[0].ownerDocument.defaultView.innerWidth)throw Error('Choose a screen at least '+width+' pixels wide for this scope.');
   for(const el of elements){
    if(el.namespaceURI!=='http://www.w3.org/1999/xhtml'||elements.some(other=>other!==el&&el.contains(other)))throw Error('Choose separate HTML layers without selecting their ancestors.');
    for(let ancestor=el.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor.namespaceURI==='http://www.w3.org/2000/svg')throw Error('Alignment inside an SVG viewport is not available yet.');
    const css=el.ownerDocument.defaultView.getComputedStyle(el);if(css.visibility!=='visible'||!el.getClientRects().length)throw Error('Choose visible layers to align their canvas bounds.');
    if(css.position!=='absolute')throw Error('Choose Absolute positioning for each layer to align its canvas bounds.');
   }
   return elements.map(el=>({geometry:I.geometry(el),rect:el.getBoundingClientRect()}));
  }
  try{measure();}catch(error){I.note(sec,error.message,'refused');return sec;}
  const key=infos.map(info=>info.id).sort().join(',');if(key!==selectionKey){selectionKey=key;targetChoice='selection';}
  const commonParent=()=>elements.every(el=>el.offsetParent===elements[0].offsetParent);
  if(targetChoice==='parent'&&!commonParent())targetChoice='selection';
  const choices=[['selection','Selection bounds'],['parent','Containing frame'],...infos.map((info,i)=>['layer:'+info.id,'Layer: '+(i+1)+'. '+(info.layerName||elements[i].getAttribute('aria-label')||elements[i].id||info.text?.trim().slice(0,32)||info.tag)])];
  const controls=root.document.createElement('div');controls.className='stack-presets';const description=root.document.createElement('p');description.className='hint';
  const update=()=>{description.textContent=(targetChoice==='selection'?'Align within the selection bounds. Distribution keeps the outer layers in place.':targetChoice==='parent'?'Align to the containing frame. Distribution spreads layers across its bounds.':'The chosen layer stays unchanged. Alignment moves the other selected layers.')+' Changes follow this screen scope and undo together.';for(const button of controls.querySelectorAll('[data-distribution]'))button.disabled=infos.length<3||targetChoice.startsWith('layer:');};
  const choice=I.select(sec,'Align to',choices,targetChoice,value=>{targetChoice=value;root.dispatchEvent(new root.Event('retouch:selection-layout'));update();});if(!commonParent()){const option=choice.querySelector('[value=parent]');option.disabled=true;option.textContent='Containing frame (different containers)';}sec.append(description);
  function targetBounds(measured){
   if(targetChoice==='selection')return null;
   if(targetChoice.startsWith('layer:')){const index=infos.findIndex(info=>'layer:'+info.id===targetChoice);if(index<0)throw Error('Choose a selected layer as the alignment target.');return measured[index].rect;}
   if(!commonParent())throw Error('Choose layers with the same containing frame.');
   const parent=elements[0].offsetParent,d=elements[0].ownerDocument,w=d.defaultView;
   if(!parent||parent===d.body&&w.getComputedStyle(parent).position==='static')return {left:0,top:0,width:d.documentElement.clientWidth,height:w.innerHeight};
   const rect=parent.getBoundingClientRect();return {left:rect.left+parent.clientLeft,top:rect.top+parent.clientTop,width:parent.clientWidth,height:parent.clientHeight};
  }
  function write(measured,deltas){
   const changed=(g,d)=>Math.abs(d.x)+Math.abs(d.y)+Math.abs((d.width??g.width)-g.width)+Math.abs((d.height??g.height)-g.height)>=1/32;
   if(!deltas.some((d,i)=>changed(measured[i].geometry,d)))return;
   const changes=Object.fromEntries(infos.map((info,i)=>{const g=measured[i].geometry,d=deltas[i];if(!changed(g,d))return [info.id,{}];const el=elements[i],effective=Object.entries(info.cssRules||{}).filter(([w])=>Number(w)<=el.ownerDocument.defaultView.innerWidth).sort(([a],[b])=>Number(a)-Number(b)).reduce((all,[,values])=>Object.assign(all,values),{}),next={...g,x:g.x+d.x,y:g.y+d.y,width:d.width??g.width,height:d.height??g.height};if(!['x','y','width','height'].every(p=>Number.isFinite(next[p])&&Math.abs(next[p])<=100000))throw Error('Keep layer bounds within 100,000 pixels.');return [info.id,preserveBox(P.placement(next,effective),next,el.ownerDocument.defaultView.getComputedStyle(el))];}));return save(changes,width);
  }
  for(const [mode,label]of [['left','Align left'],['center','Align horizontal centers'],['right','Align right'],['top','Align top'],['middle','Align vertical centers'],['bottom','Align bottom'],['gap-x','Distribute horizontal spacing'],['gap-y','Distribute vertical spacing']]){
   const button=I.button(label,()=>{try{
    const measured=measure(),deltas=arrange(measured.map(item=>item.rect),mode,targetBounds(measured));if(deltas.every(d=>Math.abs(d.x)+Math.abs(d.y)<1/32))return;
    write(measured,deltas);
   }catch(error){I.note(sec,error.message,'refused');}});if(mode.startsWith('gap-'))button.dataset.distribution=mode;controls.append(button);
  }
  if(onTransform)for(const action of ['move','resize']){const control=I.button((action==='move'?'Move':'Resize')+' selection on canvas',event=>{try{const measured=measure();onTransform(elements,delta=>write(measured,action==='resize'?root.RetouchCanvasMove.memberBounds(measured.map(item=>item.rect),delta):measured.map(()=>delta)),event.currentTarget,action);}catch(error){I.note(sec,error.message,'refused');}});control.dataset.canvasTool=action;controls.append(control);}
  sec.append(controls);
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
 const api={arrange,gaps,setGaps,setSpacing,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSelectionLayout=api;
})(typeof window==='object'?window:globalThis);
