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
 function sourceValue(info,scope,property){
  if(info.cssAuthoring){const width=scope?Number(/^min-\[(\d+)px\]:$/.exec(scope)?.[1]):0;return info.cssRules?.[width]?.[property]??null;}
  const tokens=root.RetouchResponsive.project(info.className||'',scope).split(/\s+/).map(token=>root.RetouchInspector.base(token)),prefix='['+property+':',matches=tokens.filter(token=>token?.startsWith(prefix)&&token.endsWith(']'));
  return matches.length===1?matches[0].slice(prefix.length,-1).replace(/_/g,' '):null;
 }
 function sourceState(info,scope){
  const literal=sourceValue(info,scope,'background-color'),parsed=literal===null?null:root.RetouchPaintPicker.parsePaint(literal);if(!parsed)return null;const current=parsed.value;
  const stored=sourceValue(info,scope,B.property),state=B.state(current,stored??'none');
  // A transparent declaration may still inherit hidden-fill metadata from a
  // lower scope. Keep the observed fallback unless ownership is explicit.
  if(stored===null&&root.RetouchPaletteValues.parse(state.color).alpha===0)return null;
  return {...state,current,stored:stored??'none'};
 }
 function sourceColor(info,scope,property){if(property==='background-color')return sourceState(info,scope)?.color??null;const value=sourceValue(info,scope,property);if(value===null)return null;const parts=property==='border-color'?root.RetouchHTMLCSSValues.parseBorderColors(value):[value];return parts?.length&&parts.every(part=>root.RetouchPaintPicker.parsePaint(part))?value:null;}
 function bindSource(input,info,scope,property,el){input.retouchPreviewDocument=el.ownerDocument;input.retouchHasScopedValues=()=>sourceColor(info,scope,property)!==null;}
 function rangeActive(input,el){
  const scope=input.ownerDocument.querySelector('[aria-label="Style screen scope"]')?.value||'';if(!scope)return true;
  const d=el.ownerDocument,w=d.defaultView,match=/^(min|max)-\[([\d.]+)(px|rem|em)\]:$/.exec(scope);
  return match?w.matchMedia('('+match[1]+'-width: '+match[2]+match[3]+')').matches:root.RetouchResponsive.matches(root.RetouchResponsive.discover(d).find(choice=>choice.prefix===scope),w)===true;
 }
 const visibilityIcon=(hidden,mixed=false)=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'+(hidden?'<path d="m3 3 18 18"/>':mixed?'<path d="M4 21h16"/>':'')+'</svg>';
 let resizeCleanup=()=>{};
 function watchVisibility(input,el,sync){
  resizeCleanup();const w=el.ownerDocument.defaultView;let frame;
  const cleanup=()=>{w.removeEventListener('resize',resize);if(frame!==undefined)w.cancelAnimationFrame(frame);};
  const resize=()=>{if(frame!==undefined)w.cancelAnimationFrame(frame);frame=w.requestAnimationFrame(()=>{frame=undefined;if(!input.isConnected){cleanup();return;}sync();});};
  w.addEventListener('resize',resize);resizeCleanup=cleanup;resize();
 }
 function bind(info,el,input,save,sourceState){
  const selectedState=()=>sourceState?.()??read(info,el);
  let value,error;try{value=selectedState();}catch(e){error=e.message;}
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
    const state=selectedState();
    if(!state.hidden&&originalChange){originalChange.call(input);return;}
    const parsed=root.RetouchPaintPicker.parsePaint(input.value.trim());if(!parsed){fail(Error('Enter a supported literal CSS color.'));return;}
    input.setCustomValidity('');const changes=B.edit(state.current,state.stored,parsed.value);if(!Object.hasOwn(changes,B.property))changes[B.property]='none';Promise.resolve(save(changes)).catch(fail);
   }catch(e){fail(e);}
  };
  input.retouchMountVisibility=field=>{
   const button=document.createElement('button');button.type='button';button.className='background-visibility';
   const active=()=>{try{return rangeActive(input,el)||sourceState?.()!=null;}catch{return false;}},sync=()=>{try{const state=selectedState();button.setAttribute('aria-label',(state.hidden?'Show':'Hide')+' background color');button.setAttribute('aria-pressed',String(!state.hidden));button.innerHTML=visibilityIcon(state.hidden);field.classList.toggle('background-color-hidden',state.hidden);button.disabled=input.disabled||!active();button.title=active()?button.getAttribute('aria-label'):'Preview this screen range to change fill visibility.';}catch(error){button.disabled=true;button.title=error.message;}};
   button.onclick=async()=>{if(!active()||input.disabled)return;button.disabled=true;try{const state=selectedState();root.RetouchPanelFocus?.queue(button,(state.hidden?'Hide':'Show')+' background color');await save(B.toggle(state.current,state.stored,!state.hidden));}catch(e){fail(e);}finally{if(button.isConnected)sync();}};
   field.append(button);sync();watchVisibility(input,el,sync);
  };
 }
 function mountSelection(input,elements,save,sourceState){
  const selectedStates=()=>elements.map((el,i)=>sourceState?.(i)??read({},el));
  let states;try{states=selectedStates();}catch(error){input.title=error.message;return;}
  const allHidden=states.every(state=>state.hidden),mixed=states.some(state=>state.hidden)!==allHidden,button=document.createElement('button');button.type='button';button.className='background-visibility';
  const label=hidden=>(hidden?'Show':'Hide')+' selected background colors';button.setAttribute('aria-label',label(allHidden));button.title=mixed?'Mixed visibility · hide all selected backgrounds':label(allHidden);button.setAttribute('aria-pressed',mixed?'mixed':String(!allHidden));button.disabled=input.disabled;
  button.innerHTML=visibilityIcon(allHidden,mixed);
  const active=()=>{try{return rangeActive(input,elements[0])||!!sourceState&&elements.every((_,i)=>sourceState(i)!=null);}catch{return false;}};button.disabled=input.disabled||!active();if(!active())button.title='Preview this screen range to change fill visibility.';
  button.onclick=async()=>{if(input.disabled||!active())return;button.disabled=true;try{const current=selectedStates(),hide=!current.every(state=>state.hidden),changes=current.map(state=>B.toggle(state.current,state.stored,hide));root.RetouchPanelFocus?.queue(button,label(hide));await save(changes);}catch(error){input.setCustomValidity(error.message);input.reportValidity();}finally{if(button.isConnected)button.disabled=input.disabled||!active();}};
  const field=input.closest('.inspector-field');field.querySelector(':scope > span').textContent='Fill';if(!input.value)input.placeholder='Mixed';field.append(button);
  const sync=()=>{
   try{const current=selectedStates(),hidden=current.every(state=>state.hidden),mixed=current.some(state=>state.hidden)!==hidden;button.setAttribute('aria-label',label(hidden));button.setAttribute('aria-pressed',mixed?'mixed':String(!hidden));button.disabled=input.disabled||!active();button.title=!active()?'Preview this screen range to change fill visibility.':mixed?'Mixed visibility · hide all selected backgrounds':label(hidden);button.innerHTML=visibilityIcon(hidden,mixed);}catch(error){button.disabled=true;button.title=error.message;}
  };watchVisibility(input,elements[0],sync);
 }
 root.RetouchBackgroundPaintUI={read,bind,mountSelection,rangeActive,sourceColor,sourceState,bindSource};
})(window);
