(function () {
  'use strict';
  const preset = document.getElementById('screenPreset');
  const width = document.getElementById('screenWidth');
  const height = document.getElementById('screenHeight');
  const aspect=document.getElementById('screenAspect');
  const project=window.__RT_RENDERING?.stateScope?.project;
  const key = 'retouch.screen.v1'+(typeof project==='string'&&/^[a-f0-9]{64}$/.test(project)?':'+project:'');
  const savedGroup=document.createElement('optgroup');savedGroup.label='Project screens';preset.append(savedGroup);
  let screen = null, viewport = null, committed = null, fieldScrub = null;
  const undoStack=[],redoStack=[],undoButton=document.getElementById('screenUndo'),redoButton=document.getElementById('screenRedo');
  const copy=value=>value?{...value}:null;
  const same=(a,b)=>a?.width===b?.width&&a?.height===b?.height;
  const updateHistory=()=>{undoButton.disabled=!undoStack.length;redoButton.disabled=!redoStack.length;};
  let ratioBase=null,linked=false;try{linked=localStorage.getItem(key+'.aspect')==='true';}catch{}
  const updateAspect=()=>{aspect.setAttribute('aria-pressed',String(linked));aspect.textContent=linked?'Ratio locked':'Lock ratio';};updateAspect();
  aspect.onclick=()=>{linked=!linked;ratioBase=copy(screen||viewport);updateAspect();try{localStorage.setItem(key+'.aspect',String(linked));localStorage.setItem(key+'.aspectBase',JSON.stringify(ratioBase));}catch{}};
  function constrain(next,axis,base=screen||viewport,enabled=linked){
    if(!enabled||!axis||!base||!base.width||!base.height)return next;
    const x=next.width/base.width,y=next.height/base.height,requested=axis==='width'?x:axis==='height'?y:Math.abs(x-1)>Math.abs(y-1)?x:y;
    const scale=Math.max(240/base.width,240/base.height,Math.min(7680/base.width,7680/base.height,requested));
    return {width:Math.round(base.width*scale),height:Math.round(base.height*scale)};
  }
  function constrainMain(next,axis,base=screen||viewport){
    if(!linked||!axis||!base)return next;
    if(!ratioBase)ratioBase=copy(base);
    if(axis==='both'){const x=next.width/base.width,y=next.height/base.height;axis=Math.abs(x-1)>Math.abs(y-1)?'width':'height';}
    return constrain(next,axis,ratioBase||base,true);
  }
  function valid(value) { return Number.isInteger(value) && value >= 240 && value <= 7680; }
  function apply(next, options = {}) {
    if(fieldScrub&&options.persist!==false)finishScrub(true);
    if(options.persist!==false){
      const nextRatio=Object.hasOwn(options,'ratio')?options.ratio:options.preserveRatio?ratioBase:next;
      if(options.history!==false&&!same(committed,next)){undoStack.push({before:copy(committed),after:copy(next),ratioBefore:copy(ratioBase),ratioAfter:copy(nextRatio)});if(undoStack.length>50)undoStack.shift();redoStack.length=0;}
      ratioBase=copy(nextRatio);committed=copy(next);updateHistory();
    }
    screen = copy(next);
    const name = next ? `${next.width}x${next.height}` : 'fluid';
    preset.value = [...preset.options].some(o => o.value === name) ? name : [...savedGroup.children].some(o=>o.value==='saved:'+name)?'saved:'+name:'custom';
    if (next) { width.value = next.width; height.value = next.height; }
    if(options.persist!==false)try { localStorage.setItem(key, JSON.stringify(next));localStorage.setItem(key+'.aspectBase',JSON.stringify(ratioBase)); } catch {}
    window.dispatchEvent(Object.assign(new CustomEvent('retouch:screen', { detail: next }), {preservePan:!!options.preservePan}));
  }
  function replay(redo,moveFocus=false){
    const from=redo?redoStack:undoStack,to=redo?undoStack:redoStack,entry=from.pop();if(!entry)return;
    to.push(entry);width.setCustomValidity('');height.setCustomValidity('');apply(copy(redo?entry.after:entry.before),{history:false,preservePan:true,ratio:copy(redo?entry.ratioAfter:entry.ratioBefore)});
    if(moveFocus){const button=redo?redoButton:undoButton;(button.disabled?(redo?undoButton:redoButton):button).focus();}
  }
  undoButton.onclick=()=>replay(false,true);redoButton.onclick=()=>replay(true,true);
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.isComposing||event.altKey||!(event.metaKey||event.ctrlKey))return;
    const target=event.target;if(![preset,width,height,aspect,undoButton,redoButton,document.getElementById('screenRotate')].includes(target)&&!target.matches?.('.screen-resize-handle'))return;
    const key=event.key.toLowerCase();if(key!=='z'&&key!=='y')return;
    if((target===width||target===height)&&target.value!==String((screen||viewport)?.[target===width?'width':'height']))return;
    event.preventDefault();event.stopPropagation();replay(key==='y'||event.shiftKey,target===undoButton||target===redoButton);
  });
  let keyResize=null;
  function custom(axis,repeat=false) {
    const w = Number(width.value), h = Number(height.value);
    if (!valid(w) || !valid(h)) {
      const input = !valid(w) ? width : height;
      input.setCustomValidity('Choose a whole number from 240 to 7680.');
      input.reportValidity();
      return;
    }
    apply(constrainMain({ width: w, height: h },axis),{preserveRatio:!!axis,history:!repeat});
    if(repeat&&keyResize?.entry===undoStack.at(-1)){keyResize.entry.after=copy(committed);keyResize.entry.ratioAfter=copy(ratioBase);}
  }
  for (const input of [width, height]) {
    input.addEventListener('input', () => input.setCustomValidity(''));
    input.addEventListener('change',()=>custom(input===width?'width':'height'));
    input.addEventListener('keyup',e=>{if(['ArrowUp','ArrowDown'].includes(e.key))keyResize=null;});
    input.addEventListener('blur',()=>{keyResize=null;});
    input.addEventListener('keydown', e => {
      if(e.isComposing)return;
      if(e.key==='Escape'){
        e.preventDefault();e.stopPropagation();
        const committed=screen||viewport;
        if(committed)input.value=input===width?committed.width:committed.height;
        input.setCustomValidity('');input.select();
      }else if(!e.altKey&&!e.metaKey&&!e.ctrlKey&&['ArrowUp','ArrowDown'].includes(e.key)){
        e.preventDefault();
        const current=Number(input.value);
        if(Number.isFinite(current)&&input.value!==''){
          const repeat=e.repeat&&keyResize?.input===input&&keyResize.key===e.key&&keyResize.entry===undoStack.at(-1);
          const previous=undoStack.at(-1);
          input.value=Math.max(240,Math.min(7680,Math.round(current)+(e.key==='ArrowUp'?1:-1)*(e.shiftKey?10:1)));
          input.setCustomValidity('');custom(input===width?'width':'height',repeat);
          if(!repeat)keyResize=undoStack.at(-1)!==previous?{input,key:e.key,entry:undoStack.at(-1)}:null;
        }
      }else if(e.key==='Enter')input.blur();
    });
  }
  // Scrubbing previews continuously, but persists one history entry on release.
  for(const [input,axis] of [[width,'width'],[height,'height']]){
    const label=input.parentElement;label.dataset.screenScrub=axis;label.style.cursor='ew-resize';label.style.touchAction='none';label.style.userSelect='none';label.title='Drag to resize. Shift: 10 pixels; Option/Alt: 0.1 pixels. Escape cancels.';
    label.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target===input||fieldScrub)return;
      event.preventDefault();input.focus({preventScroll:true});const base=copy(screen||viewport);if(!base||!valid(base.width)||!valid(base.height))return;
      fieldScrub={id:event.pointerId,label,input,axis,lastX:event.clientX,value:base[axis],before:copy(screen),base,ratio:copy(ratioBase),linked};keyResize=null;input.value=String(base[axis]);input.setCustomValidity('');label.setPointerCapture(event.pointerId);
    });
    label.addEventListener('pointermove',event=>{
      if(!fieldScrub||fieldScrub.id!==event.pointerId)return;event.preventDefault();const saved=fieldScrub,delta=event.clientX-saved.lastX;saved.lastX=event.clientX;if(!delta)return;
      saved.value=Math.max(240,Math.min(7680,saved.value+delta*(event.altKey?0.1:event.shiftKey?10:1)));
      const next=constrain({...saved.base,[axis]:Math.round(saved.value)},axis,saved.ratio||saved.base,saved.linked);apply(next,{persist:false,preservePan:true});
    });
    label.addEventListener('pointerup',event=>{if(fieldScrub?.id===event.pointerId){event.preventDefault();finishScrub(false);}});
    for(const type of ['pointercancel','lostpointercapture'])label.addEventListener(type,event=>{if(fieldScrub?.id===event.pointerId)finishScrub(true);});
  }
  function finishScrub(cancelled){
    if(!fieldScrub)return;const saved=fieldScrub,next=copy(screen);fieldScrub=null;
    if(cancelled){apply(saved.before,{persist:false,preservePan:true});const restored=saved.before||viewport||saved.base;width.value=restored.width;height.value=restored.height;}
    else if(!same(saved.before,next))apply(next,{preservePan:true,ratio:saved.ratio||saved.base});
    if(saved.label.hasPointerCapture(saved.id))saved.label.releasePointerCapture(saved.id);
  }
  document.addEventListener('keydown',event=>{if(fieldScrub&&event.key==='Escape'&&!event.isComposing){event.preventDefault();event.stopImmediatePropagation();finishScrub(true);}},true);
  for(const type of ['blur','pagehide'])window.addEventListener(type,()=>finishScrub(true));
  preset.addEventListener('change', () => {
    width.setCustomValidity(''); height.setCustomValidity('');
    if (preset.value === 'fluid') apply(null);
    else if (preset.value === 'custom') { custom(); width.focus(); width.select(); }
    else { const [w, h] = preset.value.replace(/^saved:/,'').split('x').map(Number); apply({ width: w, height: h }); }
  });
  document.getElementById('screenRotate').addEventListener('click', () => {
    const w = Number(width.value), h = Number(height.value);
    if (valid(w) && valid(h)) apply({ width: h, height: w });
  });
  window.addEventListener('retouch:viewport', e => {
    viewport={width:e.detail.width,height:e.detail.height};
    if (!screen) { width.value = e.detail.width; height.value = e.detail.height; }
  });
  const toolbar=document.getElementById('screenToolbar'),options=document.createElement('details'),summary=document.createElement('summary'),optionsBody=document.createElement('div'),dimensions=document.createElement('div');
  options.id='screenOptions';options.className='screen-options';summary.textContent='Preview options';optionsBody.className='screen-options-body';options.append(summary,optionsBody);
  dimensions.className='screen-dimensions';const widthLabel=width.parentElement,heightLabel=height.parentElement,separator=widthLabel.nextElementSibling;toolbar.insertBefore(dimensions,widthLabel);dimensions.append(widthLabel,separator,heightLabel);
  for(const id of ['screenAspect','screenRotate','screenUndo','screenRedo','canvasZoom','fitScreen','zoomSelection','compareScreens']){const control=document.getElementById(id);optionsBody.append(id==='canvasZoom'?control.parentElement:control);}toolbar.append(options);
  const compactToolbar=matchMedia('(max-width:600px)'),layoutOptions=()=>{options.open=!compactToolbar.matches||optionsBody.contains(document.activeElement);};compactToolbar.addEventListener('change',layoutOptions);layoutOptions();
  options.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.isComposing&&compactToolbar.matches&&options.open){event.preventDefault();event.stopPropagation();options.open=false;summary.focus();}});
  document.addEventListener('pointerdown',event=>{if(compactToolbar.matches&&options.open&&!options.contains(event.target))options.open=false;},true);
  window.RetouchScreens = { constrain, constrainMain, isRatioLocked:()=>linked, setSaved(sizes) {
    savedGroup.replaceChildren();
    for(const [label,w,h] of sizes){if(typeof label!=='string'||!valid(w)||!valid(h))continue;const option=document.createElement('option');option.value='saved:'+w+'x'+h;option.textContent=label===`Custom ${w} × ${h}`?label:label+' · '+w+' × '+h;savedGroup.append(option);}
    const name=screen?screen.width+'x'+screen.height:'fluid';preset.value=[...preset.options].some(option=>option.value===name)?name:[...savedGroup.children].some(option=>option.value==='saved:'+name)?'saved:'+name:'custom';
  }, get() { return screen ? {...screen} : null; }, set(next, options) { if(next===null || next && valid(next.width) && valid(next.height))apply(next, options); }, restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      let anchor;try{anchor=JSON.parse(localStorage.getItem(key+'.aspectBase'));}catch{}
      if (saved && valid(saved.width) && valid(saved.height)) apply(saved,{history:false,ratio:anchor&&valid(anchor.width)&&valid(anchor.height)?anchor:saved});
      else if(saved===null&&anchor&&valid(anchor.width)&&valid(anchor.height))ratioBase=copy(anchor);
    } catch {}
  } };
})();
