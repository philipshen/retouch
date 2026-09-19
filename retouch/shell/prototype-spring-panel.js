(function(root){
 'use strict';
 const S=root.RetouchPrototypeSpring,I=root.RetouchInspector,ns='http://www.w3.org/2000/svg';
 function mount(parent,{value,index,change}){
  let draft={...value},gesture=null,animation=null,curve=S.curve(draft);
  const box=document.createElement('div');box.className='prototype-curve prototype-spring';parent.append(box);
  const graph=document.createElementNS(ns,'svg');graph.setAttribute('viewBox','0 0 220 150');graph.setAttribute('tabindex','0');graph.setAttribute('role','button');graph.setAttribute('aria-label','Spring curve '+index);graph.setAttribute('aria-description','Drag right for greater stiffness, up for greater damping. Arrow keys adjust; Escape cancels.');box.append(graph);
  const line=document.createElementNS(ns,'path');line.setAttribute('class','curve-grid');graph.append(line);const path=document.createElementNS(ns,'path');path.setAttribute('class','curve-path');graph.append(path);
  const status=I.note(box,'');status.setAttribute('role','status');
  const inputs={};for(const key of ['stiffness','damping','mass']){const input=document.createElement('input');input.type='number';input.min=key==='stiffness'?'1':'.1';input.max=key==='stiffness'?'1000':key==='damping'?'100':'10';input.step=key==='stiffness'?'1':'.1';I.field(box,key[0].toUpperCase()+key.slice(1)+' '+index,input);inputs[key]=input;input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{const candidate={...draft,[key]:input.value===''?NaN:Number(input.value)};try{S.curve(candidate);input.setCustomValidity('');draft=candidate;draw();void commit(input.getAttribute('aria-label'));}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};}
  const preview=document.createElement('div');preview.className='curve-preview';const dot=document.createElement('span');preview.append(dot);box.append(preview);
  const play=I.button('Preview',()=>{animation?.cancel();if(root.matchMedia('(prefers-reduced-motion: reduce)').matches)return;animation=dot.animate([{transform:'translateX(0)'},{transform:'translateX('+((preview.clientWidth-12)/Math.max(1,...curve.samples))+'px)'}],{duration:curve.duration,easing:curve.css});});play.setAttribute('aria-label','Preview spring '+index);box.append(play);
  I.note(box,'Drag right for stiffness, up for damping. Arrow keys also adjust.').classList.add('curve-help');
  function draw(){curve=S.curve(draft);const low=Math.min(0,...curve.samples)-.1,high=Math.max(1,...curve.samples)+.1,y=n=>130-(n-low)/(high-low)*110;line.setAttribute('d','M20 '+y(1)+'H200');path.setAttribute('d',curve.samples.map((n,i)=>(i?'L':'M')+(20+180*i/(curve.samples.length-1))+' '+y(n)).join(' '));for(const [key,input]of Object.entries(inputs)){input.value=draft[key];input.setCustomValidity('');}status.textContent=curve.duration+' ms to settle';}
  async function commit(focus){if(['stiffness','damping','mass'].every(key=>draft[key]===value[key]))return;await change({...draft});if(focus)document.querySelector('#prototypePanel [aria-label="'+focus+'"]')?.focus({preventScroll:true});}
  function end(cancel=false){if(!gesture)return;const before=gesture;gesture=null;if(cancel)draft=before.value;draw();if(!cancel)void commit(before.label);}
  function update(candidate){try{S.curve(candidate);draft=candidate;draw();}catch(error){status.textContent=error.message;}}
  const clamp=(value,key)=>Math.round(Math.max(key==='stiffness'?1:.1,Math.min(key==='stiffness'?1000:100,value))*10)/10;
  graph.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();graph.focus({preventScroll:true});gesture={value:{...draft},x:event.clientX,y:event.clientY,pointer:event.pointerId,label:graph.getAttribute('aria-label')};graph.setPointerCapture(event.pointerId);});
  graph.addEventListener('pointermove',event=>{if(gesture?.pointer!==event.pointerId)return;update({...draft,stiffness:clamp(gesture.value.stiffness*2**((event.clientX-gesture.x)/80),'stiffness'),damping:clamp(gesture.value.damping*2**((gesture.y-event.clientY)/80),'damping')});});
  graph.addEventListener('pointerup',event=>{if(gesture?.pointer!==event.pointerId)return;end();if(graph.hasPointerCapture(event.pointerId))graph.releasePointerCapture(event.pointerId);});
  graph.addEventListener('pointercancel',()=>end(true));graph.addEventListener('lostpointercapture',()=>end(true));
  graph.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();end(true);return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();if(!gesture)gesture={value:{...draft},label:graph.getAttribute('aria-label')};const key=['ArrowLeft','ArrowRight'].includes(event.key)?'stiffness':'damping',scale=2**((event.shiftKey?.25:.05)*(['ArrowRight','ArrowUp'].includes(event.key)?1:-1));update({...draft,[key]:clamp(draft[key]*scale,key)});});
  graph.addEventListener('keyup',event=>{if(event.key.startsWith('Arrow')){event.preventDefault();event.stopPropagation();end();}});graph.addEventListener('blur',()=>{if(gesture?.pointer===undefined)end();});
  draw();
 }
 root.RetouchPrototypeSpringPanel={mount};
})(window);
