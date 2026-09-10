(function () {
  'use strict';
  const preset = document.getElementById('screenPreset');
  const width = document.getElementById('screenWidth');
  const height = document.getElementById('screenHeight');
  const aspect=document.getElementById('screenAspect');
  const project=window.__RT_RENDERING?.stateScope?.project;
  const key = 'retouch.screen.v1'+(typeof project==='string'&&/^[a-f0-9]{64}$/.test(project)?':'+project:'');
  const savedGroup=document.createElement('optgroup');savedGroup.label='Project screens';preset.append(savedGroup);
  let screen = null, viewport = null, committed = null;
  const undoStack=[],redoStack=[],undoButton=document.getElementById('screenUndo'),redoButton=document.getElementById('screenRedo');
  const copy=value=>value?{...value}:null;
  const same=(a,b)=>a?.width===b?.width&&a?.height===b?.height;
  const updateHistory=()=>{undoButton.disabled=!undoStack.length;redoButton.disabled=!redoStack.length;};
  let linked=false;try{linked=localStorage.getItem(key+'.aspect')==='true';}catch{}
  const updateAspect=()=>{aspect.setAttribute('aria-pressed',String(linked));aspect.textContent=linked?'Ratio locked':'Lock ratio';};updateAspect();
  aspect.onclick=()=>{linked=!linked;updateAspect();try{localStorage.setItem(key+'.aspect',String(linked));}catch{}};
  function constrain(next,axis,base=screen||viewport,enabled=linked){
    if(!enabled||!axis||!base||!base.width||!base.height)return next;
    const x=next.width/base.width,y=next.height/base.height,requested=axis==='width'?x:axis==='height'?y:Math.abs(x-1)>Math.abs(y-1)?x:y;
    const scale=Math.max(240/base.width,240/base.height,Math.min(7680/base.width,7680/base.height,requested));
    return {width:Math.round(base.width*scale),height:Math.round(base.height*scale)};
  }
  function valid(value) { return Number.isInteger(value) && value >= 240 && value <= 7680; }
  function apply(next, options = {}) {
    if(options.persist!==false){
      if(options.history!==false&&!same(committed,next)){undoStack.push({before:copy(committed),after:copy(next)});if(undoStack.length>50)undoStack.shift();redoStack.length=0;}
      committed=copy(next);updateHistory();
    }
    screen = copy(next);
    const name = next ? `${next.width}x${next.height}` : 'fluid';
    preset.value = [...preset.options].some(o => o.value === name) ? name : [...savedGroup.children].some(o=>o.value==='saved:'+name)?'saved:'+name:'custom';
    if (next) { width.value = next.width; height.value = next.height; }
    if(options.persist!==false)try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
    window.dispatchEvent(Object.assign(new CustomEvent('retouch:screen', { detail: next }), {preservePan:!!options.preservePan}));
  }
  function replay(redo,moveFocus=false){
    const from=redo?redoStack:undoStack,to=redo?undoStack:redoStack,entry=from.pop();if(!entry)return;
    to.push(entry);width.setCustomValidity('');height.setCustomValidity('');apply(copy(redo?entry.after:entry.before),{history:false,preservePan:true});
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
  function custom(axis) {
    const w = Number(width.value), h = Number(height.value);
    if (!valid(w) || !valid(h)) {
      const input = !valid(w) ? width : height;
      input.setCustomValidity('Choose a whole number from 240 to 7680.');
      input.reportValidity();
      return;
    }
    apply(constrain({ width: w, height: h },axis));
  }
  for (const input of [width, height]) {
    input.addEventListener('input', () => input.setCustomValidity(''));
    input.addEventListener('change',()=>custom(input===width?'width':'height'));
    input.addEventListener('keydown', e => {
      if(e.key==='Escape'){
        e.preventDefault();e.stopPropagation();
        const committed=screen||viewport;
        if(committed)input.value=input===width?committed.width:committed.height;
        input.setCustomValidity('');input.select();
      }else if(e.shiftKey&&['ArrowUp','ArrowDown'].includes(e.key)){
        e.preventDefault();
        const current=Number(input.value);
        if(Number.isFinite(current)&&input.value!==''){
          input.value=Math.max(240,Math.min(7680,Math.round(current)+(e.key==='ArrowUp'?10:-10)));
          input.setCustomValidity('');custom(input===width?'width':'height');
        }
      }else if(e.key==='Enter')input.blur();
    });
  }
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
  window.RetouchScreens = { constrain, setSaved(sizes) {
    savedGroup.replaceChildren();
    for(const [label,w,h] of sizes){if(typeof label!=='string'||!valid(w)||!valid(h))continue;const option=document.createElement('option');option.value='saved:'+w+'x'+h;option.textContent=label+' · '+w+' × '+h;savedGroup.append(option);}
    const name=screen?screen.width+'x'+screen.height:'fluid';preset.value=[...preset.options].some(option=>option.value===name)?name:[...savedGroup.children].some(option=>option.value==='saved:'+name)?'saved:'+name:'custom';
  }, get() { return screen ? {...screen} : null; }, set(next, options) { if(next===null || next && valid(next.width) && valid(next.height))apply(next, options); }, restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && valid(saved.width) && valid(saved.height)) apply(saved,{history:false});
    } catch {}
  } };
})();
