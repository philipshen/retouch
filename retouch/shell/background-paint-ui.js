(function(root){
 'use strict';
 const B=root.RetouchBackgroundPaint;
 // Recover a literal source value only when its browser rendering agrees with
 // the current paint. Ambiguous declarations retain the computed fallback.
 function preciseColor(info,el,current){
  const d=el.ownerDocument,w=d.defaultView,candidates=[],rules=[];
  const inline=el.style.getPropertyValue('background-color');if(inline)candidates.push(inline);
  for(const style of d.querySelectorAll('style[data-rt-css]'))if(style.dataset.rtCss===el.getAttribute('data-rt-style')){
   try{const width=Number(style.dataset.rtWidth),values=JSON.parse(style.dataset.rtValues);if(Number.isFinite(width)&&width<=w.innerWidth)rules.push({width,values});}catch{}
  }
  const effective=Object.assign({},...rules.sort((a,b)=>a.width-b.width).map(rule=>rule.values));
  if(effective['background-color'])candidates.push(effective['background-color']);
  const R=root.RetouchResponsive;let choices;
  for(const token of (el.getAttribute('class')||'').split(/\s+/).filter(Boolean)){
   const part=R.split(token),plain=root.RetouchInspector.base(part.value),match=/^\[background-color:(.+)\]$/.exec(plain);if(!match)continue;
   if(part.prefix){const arbitrary=/^(min|max)-\[([\d.]+)(px|rem|em)\]:$/.exec(part.prefix),active=arbitrary?w.matchMedia('('+arbitrary[1]+'-width: '+arbitrary[2]+arbitrary[3]+')').matches:R.matches((choices??=R.discover(d)).find(choice=>choice.prefix===part.prefix),w);if(active!==true)continue;}
   candidates.push(match[1].replace(/_/g,' '));
  }
  if(!candidates.length)return current;
  const probe=d.createElement('span'),matches=new Set();probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none';d.documentElement.append(probe);
  try{for(const value of candidates){try{const literal=B.state(value).color;probe.style.setProperty('background-color',value,'important');if(w.getComputedStyle(probe).backgroundColor===current)matches.add(literal);}catch{}}}finally{probe.remove();}
  return matches.size===1?[...matches][0]:current;
 }
 function read(info,el){
  const css=el.ownerDocument.defaultView.getComputedStyle(el),stored=css.getPropertyValue(B.property).trim()||'none';
  const owned=(el.getAttribute('class')||'').includes('['+B.property+':'+stored+']')||Object.values(info.cssRules||{}).some(values=>values[B.property]===stored)||[...el.ownerDocument.querySelectorAll('style[data-rt-css]')].some(style=>style.dataset.rtCss===el.getAttribute('data-rt-style')&&style.textContent.includes(B.property+':'+stored+' '));
  const metadata=owned?stored:'none',current=metadata==='none'?preciseColor(info,el,css.backgroundColor):css.backgroundColor;
  return {...B.state(current,metadata),current,stored:metadata};
 }
 function bind(info,el,input,save){
  let value,error;try{value=read(info,el);}catch(e){error=e.message;}
  if(error){input.disabled=true;input.title=error;return;}
  if(value.hidden||root.RetouchPaintPicker.parsePaint(input.value.trim()))input.value=value.color;
  const fail=e=>{input.setCustomValidity(e.message);input.reportValidity();};
  input.retouchPaintPreview=()=>{
   const state=read(info,el),preview=root.RetouchPaintPicker.propertyPreview({el,input,property:'background-color'});
   return {update:color=>{const parsed=state.hidden?root.RetouchPaintPicker.parsePaint(color):null;if(state.hidden&&!parsed)return;preview.update(state.hidden?B.transparent(parsed.value):color);},restore:()=>preview.restore()};
  };
  const originalChange=input.onchange;
  input.onchange=()=>{
   try{
    const state=read(info,el);
    if(!state.hidden&&originalChange){originalChange.call(input);return;}
    const parsed=root.RetouchPaintPicker.parsePaint(input.value.trim());if(!parsed){fail(Error('Enter a supported literal CSS color.'));return;}
    input.setCustomValidity('');const changes=B.edit(state.current,state.stored,parsed.value);if(!Object.hasOwn(changes,B.property))changes[B.property]='none';Promise.resolve(save(changes)).catch(fail);
   }catch(e){fail(e);}
  };
  input.retouchMountVisibility=field=>{
   const button=document.createElement('button');button.type='button';button.className='background-visibility';button.setAttribute('aria-label',(value.hidden?'Show':'Hide')+' background color');button.title=button.getAttribute('aria-label');button.setAttribute('aria-pressed',String(!value.hidden));
   button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'+(value.hidden?'<path d="m3 3 18 18"/>':'')+'</svg>';
   field.classList.toggle('background-color-hidden',value.hidden);button.onclick=async()=>{button.disabled=true;try{const state=read(info,el);root.RetouchPanelFocus?.queue(button,(state.hidden?'Hide':'Show')+' background color');await save(B.toggle(state.current,state.stored,!state.hidden));}catch(e){fail(e);}finally{if(button.isConnected)button.disabled=false;}};field.append(button);
  };
 }
 let selectionResizeCleanup=()=>{};
 function mountSelection(input,elements,save){
  selectionResizeCleanup();
  let states;try{states=elements.map(el=>read({},el));}catch(error){input.title=error.message;return;}
  const allHidden=states.every(state=>state.hidden),mixed=states.some(state=>state.hidden)!==allHidden,button=document.createElement('button');button.type='button';button.className='background-visibility';
  const label=hidden=>(hidden?'Show':'Hide')+' selected background colors';button.setAttribute('aria-label',label(allHidden));button.title=mixed?'Mixed visibility · hide all selected backgrounds':label(allHidden);button.setAttribute('aria-pressed',mixed?'mixed':String(!allHidden));button.disabled=input.disabled;
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'+(allHidden?'<path d="m3 3 18 18"/>':mixed?'<path d="M4 21h16"/>':'')+'</svg>';
  const active=()=>{const scope=input.ownerDocument.querySelector('[aria-label="Style screen scope"]')?.value||'';if(!scope)return true;const d=elements[0].ownerDocument,w=d.defaultView,match=/^(min|max)-\[([\d.]+)(px|rem|em)\]:$/.exec(scope);return match?w.matchMedia('('+match[1]+'-width: '+match[2]+match[3]+')').matches:root.RetouchResponsive.matches(root.RetouchResponsive.discover(d).find(choice=>choice.prefix===scope),w)===true;};button.disabled=input.disabled||!active();if(!active())button.title='Preview this screen range to change fill visibility.';
  button.onclick=async()=>{if(!active())return;button.disabled=true;try{const current=elements.map(el=>read({},el)),hide=!current.every(state=>state.hidden),changes=current.map(state=>B.toggle(state.current,state.stored,hide));root.RetouchPanelFocus?.queue(button,label(hide));await save(changes);}catch(error){input.setCustomValidity(error.message);input.reportValidity();}finally{if(button.isConnected)button.disabled=input.disabled||!active();}};
  const field=input.closest('.inspector-field');field.querySelector(':scope > span').textContent='Fill';if(!input.value)input.placeholder='Mixed';field.append(button);
  const w=elements[0].ownerDocument.defaultView,sync=()=>{
   if(!input.isConnected){w.removeEventListener('resize',resize);return;}
   try{const current=elements.map(el=>read({},el)),hidden=current.every(state=>state.hidden),mixed=current.some(state=>state.hidden)!==hidden;button.setAttribute('aria-label',label(hidden));button.setAttribute('aria-pressed',mixed?'mixed':String(!hidden));button.disabled=input.disabled||!active();button.title=!active()?'Preview this screen range to change fill visibility.':mixed?'Mixed visibility · hide all selected backgrounds':label(hidden);button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'+(hidden?'<path d="m3 3 18 18"/>':mixed?'<path d="M4 21h16"/>':'')+'</svg>';}catch(error){button.disabled=true;button.title=error.message;}
  },resize=()=>w.requestAnimationFrame(sync);w.addEventListener('resize',resize);selectionResizeCleanup=()=>w.removeEventListener('resize',resize);resize();
 }
 root.RetouchBackgroundPaintUI={read,bind,mountSelection};
})(window);
