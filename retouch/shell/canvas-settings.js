(function(root){
 'use strict';
 const host=document.getElementById('panelEmpty'),canvas=document.getElementById('frameWrap'),I=root.RetouchInspector;
 const project=root.__RT_RENDERING?.stateScope?.project,key='retouch.canvas.background.v1'+(typeof project==='string'&&/^[a-f0-9]{64}$/.test(project)?':'+project:''),fallback='#e5e5e5';
 const valid=value=>typeof value==='string'&&value.length<=256&&CSS.supports('background-color',value)&&!!root.RetouchPaintPicker.parsePaint(value);
 let current=fallback;try{const saved=localStorage.getItem(key);if(valid(saved))current=saved;}catch{}
 const undo=[],redo=[],section=I.section('Canvas'),input=document.createElement('input'),swatch=I.button('',()=>root.RetouchPaintPicker.open(input,{anchor:swatch,onClose:()=>swatch.focus()}));
 input.type='text';input.spellcheck=false;input.retouchPaintScopeLabel='Canvas background';swatch.className='canvas-background-swatch';swatch.setAttribute('aria-label','Choose canvas background');swatch.title='Choose canvas background';
 I.field(section,'Canvas background',input);input.closest('.inspector-field').querySelector('span').textContent='Background';const control=document.createElement('span');control.className='canvas-background-control';input.before(control);control.append(swatch,input);
 const reset=I.button('Reset',()=>write(fallback));reset.setAttribute('aria-label','Reset canvas background');reset.title='Restore the default canvas background';section.append(reset);
 const sync=()=>{canvas.style.backgroundColor=current;input.value=current;swatch.style.backgroundColor=current;reset.disabled=current===fallback;input.setCustomValidity('');};
 function write(value,record=true){if(!valid(value)){input.setCustomValidity('Enter a color such as E5E5E5 or rgb(229, 229, 229).');input.reportValidity();return false;}if(value!==current){if(record){undo.push(current);if(undo.length>50)undo.shift();redo.length=0;}current=value;try{localStorage.setItem(key,current);}catch{}}sync();return true;}
 input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{const value=input.value.trim();write(/^[a-f\d]{3,8}$/i.test(value)?'#'+value:value);};
 input.retouchPaintPreview=()=>{const initial=current;let active=true;return {update:value=>{if(active&&valid(value))canvas.style.backgroundColor=value;},restore:()=>{if(active){active=false;canvas.style.backgroundColor=initial;}}};};
 section.addEventListener('keydown',event=>{
  if(event.isComposing)return;
  if(event.key==='Escape'&&event.target===input){event.preventDefault();event.stopPropagation();sync();input.select();return;}
  if(event.key==='Enter'&&event.target===input&&!event.metaKey&&!event.ctrlKey&&!event.altKey){event.preventDefault();input.dispatchEvent(new Event('change',{bubbles:true}));return;}
  if(!event.altKey&&(event.metaKey||event.ctrlKey)&&['z','y'].includes(event.key.toLowerCase())){
   // Leave a text draft to the browser's native text undo.
   if(event.target===input&&input.value!==current)return;
   event.preventDefault();event.stopPropagation();const backwards=event.key.toLowerCase()==='z'&&!event.shiftKey,from=backwards?undo:redo,to=backwards?redo:undo;if(!from.length)return;to.push(current);write(from.pop(),false);
  }
 });
 host.replaceChildren(section);const guidance=document.createElement('div');guidance.className='canvas-selection-guidance';I.note(guidance,'Select a layer to edit its design.');I.note(guidance,'Drag on the canvas to select several layers. Shift-click adds to your selection.');host.append(guidance);sync();
})(window);
