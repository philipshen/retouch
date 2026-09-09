(function(root){
 'use strict';
 const round=n=>Math.round(n*10000)/10000,px=n=>round(n)+'px';
 const properties=['position','left','right','top','bottom','width','height','margin','box-sizing'];
 function axis(g,dimension,mode){
  const horizontal=dimension==='x',start=horizontal?g.x:g.y,size=horizontal?g.width:g.height,parent=horizontal?g.parentWidth:g.parentHeight;
  if(![start,size,parent].every(Number.isFinite)||parent<=0||size<0)throw Error('The container needs a measurable size.');
  const a=horizontal?'left':'top',b=horizontal?'right':'bottom',d=horizontal?'width':'height',values={[a]:px(start),[b]:'auto',[d]:px(size)};
  if(mode==='end'){values[a]='auto';values[b]=px(parent-start-size);}
  else if(mode==='center'){const offset=start-parent/2;values[a]=`calc(50% ${offset<0?'-':'+'} ${px(Math.abs(offset))})`;}
  else if(mode==='stretch'){values[b]=px(parent-start-size);values[d]='auto';}
  else if(mode==='scale'){values[a]=round(start/parent*100)+'%';values[d]=round(size/parent*100)+'%';}
  else if(mode!=='start')throw Error('Choose an anchor.');
  return values;
 }
 function infer(values,dimension){
  const [a,b,d]=dimension==='x'?['left','right','width']:['top','bottom','height'];
  if(values[a]?.startsWith('calc(50% '))return 'center';
  if(values[a]?.endsWith('%')&&values[d]?.endsWith('%'))return 'scale';
  if(values[a]==='auto'&&values[b]&&values[b]!=='auto')return 'end';
  if(values[a]&&values[a]!=='auto'&&values[b]&&values[b]!=='auto'&&values[d]==='auto')return 'stretch';
  if(values[a]&&values[a]!=='auto'&&values[b]==='auto')return 'start';
  return '';
 }
 function placement(g,values){const I=root.RetouchInspector;return {margin:'0','box-sizing':'border-box',...axis(g,'x',infer(values,'x')||I.nearestAnchor(g.x,g.width,g.parentWidth)),...axis(g,'y',infer(values,'y')||I.nearestAnchor(g.y,g.height,g.parentHeight))};}
 function mount(info,el,width,save,onMove){
  const I=root.RetouchInspector,sec=I.section('Position');
  if(info.cssReason||!el||!Number.isInteger(width)){I.note(sec,info.cssReason||'Choose a pixel screen scope.','refused');return sec;}
  const css=el.ownerDocument.defaultView.getComputedStyle(el),own=info.cssRules?.[width]||{};
  const measure=()=>{for(let parent=el.parentElement;parent;parent=parent.parentElement)if(parent.namespaceURI==='http://www.w3.org/2000/svg')throw Error('HTML anchors inside an SVG viewport are not available yet.');return I.geometry(el);};
  const mode=css.position,write=changes=>save(changes,null,width);
  let g,reason;if(mode==='absolute')try{g=measure();}catch(error){reason=error.message;}
  const report=error=>{I.note(sec,error.message,'refused');};
  const positioning=I.select(sec,'Positioning',[['static','Auto / flow'],['relative','Relative'],['absolute','Absolute'],['fixed','Fixed'],['sticky','Sticky']],mode,value=>{
   try{if(value==='absolute'&&mode!=='absolute'){g=measure();write({position:'absolute',margin:'0','box-sizing':'border-box',...axis(g,'x',I.nearestAnchor(g.x,g.width,g.parentWidth)),...axis(g,'y',I.nearestAnchor(g.y,g.height,g.parentHeight))});}
   else write({position:value,...(value==='static'?{left:'auto',right:'auto',top:'auto',bottom:'auto'}:{})});}catch(error){positioning.value=mode;report(error);}
  });
  if(mode==='absolute'){
   if(!g){I.note(sec,reason,'refused');return sec;}
   I.note(sec,'Anchored to '+g.parentLabel);
   if(onMove)sec.append(I.button('Move on canvas',()=>onMove(g)));
   const effective=()=>Object.entries(info.cssRules||{}).filter(([w])=>Number(w)<=el.ownerDocument.defaultView.innerWidth).sort(([a],[b])=>Number(a)-Number(b)).reduce((all,[,values])=>Object.assign(all,values),{});let inherited=effective();
   for(const [dimension,label,choices]of [['x','Horizontal anchor',[['start','Left'],['center','Center'],['end','Right'],['stretch','Left + right'],['scale','Scale']]],['y','Vertical anchor',[['start','Top'],['center','Center'],['end','Bottom'],['stretch','Top + bottom'],['scale','Scale']]]]){
    I.select(sec,label,[['','Custom / inherited'],...choices],infer(inherited,dimension),value=>{if(value)try{g=measure();inherited=effective();write({margin:'0','box-sizing':'border-box',...axis(g,'x',dimension==='x'?value:infer(inherited,'x')||I.nearestAnchor(g.x,g.width,g.parentWidth)),...axis(g,'y',dimension==='y'?value:infer(inherited,'y')||I.nearestAnchor(g.y,g.height,g.parentHeight))});}catch(error){report(error);}});
   }
   I.note(sec,'A custom position is captured at its current size when you choose an anchor.');
   I.note(sec,'Edges keep their distance. Center keeps its offset from the center. Both edges stretch; Scale changes position and size proportionally.');
  }else if(mode==='fixed'||mode==='sticky'){
   for(const [property,label]of [['left','Left inset'],['right','Right inset'],['top','Top inset'],['bottom','Bottom inset']]){
    const input=document.createElement('input');input.value=own[property]??css.getPropertyValue(property);input.onchange=()=>{const value=input.value.trim();if(root.RetouchHTMLCSSValues.valid(property,value)&&CSS.supports(property,value))save(property,value,width);else report(Error('Use a length, percentage or auto.'));};I.field(sec,label,input);
   }
  }
  const reset=I.button('Reset positioning and size',()=>write(Object.fromEntries(properties.map(p=>[p,null]))));reset.disabled=!properties.some(p=>Object.hasOwn(own,p));sec.append(reset);
  I.note(sec,'Changes follow the selected screen scope. Reset restores the page’s positioning and size in this scope.');return sec;
 }
 const api={axis,infer,placement,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchHTMLPosition=api;
})(typeof window==='object'?window:globalThis);
