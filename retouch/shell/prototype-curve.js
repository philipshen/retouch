(function(root){
 'use strict';
 const V=root.RetouchPrototypeValues,I=root.RetouchInspector,ns='http://www.w3.org/2000/svg';
 function mount(parent,{value,index,duration,change}){
  let points=[...value.values],gesture=null,animation=null,domain;
  const box=document.createElement('div');box.className='prototype-curve';parent.append(box);
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 220 180');svg.setAttribute('aria-label','Easing curve '+index);box.append(svg);
  const shape=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);svg.append(el);return el;};
  const grid=shape('path',{class:'curve-grid'}),line=shape('path',{class:'curve-tangent'}),path=shape('path',{class:'curve-path'});
  const handles=[0,1].map(i=>shape('circle',{r:7,tabindex:0,role:'button','aria-label':'Bézier handle '+(i+1)+' '+index,class:'curve-handle','aria-description':'Arrow keys adjust X and Y. Shift adjusts by 0.1. Escape cancels.'}));
  const fields=document.createElement('div');fields.className='curve-coordinates';box.append(fields);
  const inputs=['X1','Y1','X2','Y2'].map((label,i)=>{const input=document.createElement('input');input.type='number';input.step='.01';input.min=i%2?'-10000':'0';input.max=i%2?'10000':'1';I.field(fields,label+' '+index,input);input.onchange=()=>{const next=[...points];next[i]=input.value===''?NaN:Number(input.value);try{V.easing({type:'cubic-bezier',values:next});input.setCustomValidity('');points=next;draw();void commit(input.getAttribute('aria-label'));}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};input.oninput=()=>input.setCustomValidity('');return input;});
  const preview=document.createElement('div');preview.className='curve-preview';const dot=document.createElement('span');preview.append(dot);box.append(preview);
  const play=I.button('Preview',()=>{animation?.cancel();if(root.matchMedia('(prefers-reduced-motion: reduce)').matches)return;animation=dot.animate([{transform:'translateX(0)'},{transform:'translateX('+(preview.clientWidth-12)+'px)'}],{duration,easing:V.easingCss({type:'cubic-bezier',values:points})});});play.setAttribute('aria-label','Preview easing '+index);box.append(play);
  const reset=I.button('Reset',()=>{points=[0,0,1,1];draw();void commit();});reset.setAttribute('aria-label','Reset easing '+index);box.append(reset);
  const note=I.note(box,'Drag handles or use arrow keys. Shift makes larger steps.');note.classList.add('curve-help');
  function draw(){
   if(!gesture)domain=[Math.min(-.25,points[1]-.15,points[3]-.15),Math.max(1.25,points[1]+.15,points[3]+.15)];
   const xy=(x,y)=>[20+180*x,160-140*(y-domain[0])/(domain[1]-domain[0])],start=xy(0,0),end=xy(1,1),a=xy(points[0],points[1]),b=xy(points[2],points[3]);
   grid.setAttribute('d','M'+start+'H'+end[0]+'V'+end[1]+'H'+start[0]+'Z');line.setAttribute('d','M'+start+'L'+a+'M'+end+'L'+b);path.setAttribute('d','M'+start+'C'+a+' '+b+' '+end);
   for(let i=0;i<2;i++){const p=i?b:a;handles[i].setAttribute('cx',p[0]);handles[i].setAttribute('cy',p[1]);handles[i].setAttribute('aria-description','X '+points[i*2]+', Y '+points[i*2+1]+'. Arrow keys adjust; Shift makes larger steps; Escape cancels.');}
   inputs.forEach((input,i)=>{input.value=points[i];input.setCustomValidity('');});
  }
  async function commit(focus){if(points.every((p,i)=>p===value.values[i]))return;await change({type:'cubic-bezier',values:[...points]});if(focus&&parent.isConnected)parent.querySelector('[aria-label="'+focus+'"]')?.focus({preventScroll:true});else if(focus)document.querySelector('#prototypePanel [aria-label="'+focus+'"]')?.focus({preventScroll:true});}
  function end(cancel=false){if(!gesture)return;const prior=gesture;gesture=null;if(cancel)points=prior.points;draw();if(!cancel)void commit(prior.label);}
  for(const [i,handle]of handles.entries()){
   handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();handle.focus({preventScroll:true});gesture={points:[...points],pointer:event.pointerId,label:handle.getAttribute('aria-label')};handle.setPointerCapture(event.pointerId);});
   handle.addEventListener('pointermove',event=>{if(gesture?.pointer!==event.pointerId)return;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(svg.getScreenCTM().inverse());points[i*2]=Math.round(Math.max(0,Math.min(1,(local.x-20)/180))*1000)/1000;points[i*2+1]=Math.round(Math.max(-10000,Math.min(10000,domain[0]+(160-local.y)/140*(domain[1]-domain[0])))*1000)/1000;draw();});
   handle.addEventListener('pointerup',event=>{if(gesture?.pointer!==event.pointerId)return;end();if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);});
   handle.addEventListener('pointercancel',()=>end(true));handle.addEventListener('lostpointercapture',()=>end(true));
   handle.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();end(true);return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();if(!gesture)gesture={points:[...points],label:handle.getAttribute('aria-label')};const horizontal=['ArrowLeft','ArrowRight'].includes(event.key),j=i*2+(horizontal?0:1),delta=(event.shiftKey?.1:.01)*(['ArrowRight','ArrowUp'].includes(event.key)?1:-1);points[j]=Math.round(Math.max(horizontal?0:-10000,Math.min(horizontal?1:10000,points[j]+delta))*1000)/1000;draw();});
   handle.addEventListener('keyup',event=>{if(event.key.startsWith('Arrow')){event.preventDefault();event.stopPropagation();end();}});
   handle.addEventListener('blur',()=>{if(gesture?.pointer===undefined)end();});
  }
  draw();
 }
 root.RetouchPrototypeCurve={mount};
})(window);
