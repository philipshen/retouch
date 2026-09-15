(function(root){
 'use strict';
 const B=root.RetouchBackgroundPaint;
 function read(info,el){
  const css=el.ownerDocument.defaultView.getComputedStyle(el),stored=css.getPropertyValue(B.property).trim()||'none';
  const owned=(el.getAttribute('class')||'').includes('['+B.property+':'+stored+']')||Object.values(info.cssRules||{}).some(values=>values[B.property]===stored)||[...el.ownerDocument.querySelectorAll('style[data-rt-css]')].some(style=>style.dataset.rtCss===el.getAttribute('data-rt-style')&&style.textContent.includes(B.property+':'+stored+' '));
  const metadata=owned?stored:'none',current=css.backgroundColor;
  return {...B.state(current,metadata),current,stored:metadata};
 }
 function bind(info,el,input,save){
  let value,error;try{value=read(info,el);}catch(e){error=e.message;}
  if(error){input.disabled=true;input.title=error;return;}
  if(value.hidden)input.value=value.color;
  const fail=e=>{input.setCustomValidity(e.message);input.reportValidity();};
  input.retouchPaintPreview=()=>{
   const state=read(info,el),preview=root.RetouchPaintPicker.propertyPreview({el,input,property:'background-color'});
   return {update:color=>preview.update(state.hidden?B.transparent(color):color),restore:()=>preview.restore()};
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
 root.RetouchBackgroundPaintUI={read,bind};
})(window);
