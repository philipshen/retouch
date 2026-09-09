(function(root){
 'use strict';
 function arrange(rects,mode){
  if(rects.length<2||rects.length>100||rects.some(r=>!['left','top','width','height'].every(p=>Number.isFinite(r[p]))||r.width<=0||r.height<=0))throw Error('Choose between 2 and 100 visible layers.');
  const modes={left:['x',0],center:['x',.5],right:['x',1],top:['y',0],middle:['y',.5],bottom:['y',1],'gap-x':['x','gap'],'gap-y':['y','gap']};
  if(!modes[mode])throw Error('Choose an alignment.');
  const [axis,fraction]=modes[mode],position=axis==='x'?'left':'top',size=axis==='x'?'width':'height',result=rects.map(()=>({x:0,y:0}));
  if(fraction==='gap'){
   if(rects.length<3)throw Error('Select at least three layers to distribute spacing.');
   const sorted=rects.map((r,i)=>({[position]:r[position],[size]:r[size],i})).sort((a,b)=>a[position]-b[position]),first=sorted[0],last=sorted.at(-1),gap=(last[position]+last[size]-first[position]-sorted.reduce((n,r)=>n+r[size],0))/(sorted.length-1);let start=first[position];
   for(const r of sorted){result[r.i][axis]=start-r[position];start+=r[size]+gap;}
  }else{
   const start=Math.min(...rects.map(r=>r[position])),end=Math.max(...rects.map(r=>r[position]+r[size])),line=start+(end-start)*fraction;
   for(let i=0;i<rects.length;i++)result[i][axis]=line-rects[i][size]*fraction-rects[i][position];
  }
  return result;
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
 function mount(infos,elements,width,save){
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
  I.note(sec,'Align within the selection bounds. Distribution keeps the first and last layers in place. Changes follow this screen scope and undo together.');
  const controls=root.document.createElement('div');controls.className='stack-presets';
  for(const [mode,label]of [['left','Align left'],['center','Align horizontal centers'],['right','Align right'],['top','Align top'],['middle','Align vertical centers'],['bottom','Align bottom'],['gap-x','Distribute horizontal spacing'],['gap-y','Distribute vertical spacing']]){
   const button=I.button(label,()=>{try{
    const measured=measure(),deltas=arrange(measured.map(item=>item.rect),mode);if(deltas.every(d=>Math.abs(d.x)+Math.abs(d.y)<1/32))return;
    const changes=Object.fromEntries(infos.map((info,i)=>{const el=elements[i],effective=Object.entries(info.cssRules||{}).filter(([w])=>Number(w)<=el.ownerDocument.defaultView.innerWidth).sort(([a],[b])=>Number(a)-Number(b)).reduce((all,[,values])=>Object.assign(all,values),{}),g=measured[i].geometry;return [info.id,preserveBox(P.placement({...g,x:g.x+deltas[i].x,y:g.y+deltas[i].y},effective),g,el.ownerDocument.defaultView.getComputedStyle(el))];}));save(changes,width);
   }catch(error){I.note(sec,error.message,'refused');}});if(mode.startsWith('gap-')&&infos.length<3)button.disabled=true;controls.append(button);
  }
  sec.append(controls);return sec;
 }
 const api={arrange,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSelectionLayout=api;
})(typeof window==='object'?window:globalThis);
