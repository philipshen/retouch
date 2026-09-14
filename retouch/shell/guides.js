(function(root){
 'use strict';
 const canvas=document.getElementById('frameWrap'),frame=document.getElementById('app'),main=document.getElementById('main'),rulers=root.RetouchRulers,project=root.__RT_RENDERING?.stateScope?.project||'local',states=new Map(),nodes=new Map();
 const layer=document.createElement('div');layer.className='canvas-guides';layer.tabIndex=-1;layer.setAttribute('role','group');layer.setAttribute('aria-label','Canvas guides');main.append(layer);
 let state=null,gesture=null,editor=null;
 const copy=items=>items.map(item=>({...item})),valid=item=>item&&typeof item.id==='string'&&/^[a-f\d-]{1,64}$/i.test(item.id)&&['x','y'].includes(item.axis)&&Number.isFinite(item.value)&&Math.abs(item.value)<=1e7;
 function geometry(){const bounds=canvas.getBoundingClientRect(),preview=frame.getBoundingClientRect(),scale=preview.width/frame.clientWidth;let x=0,y=0;try{x=frame.contentWindow.scrollX;y=frame.contentWindow.scrollY;}catch{}return {bounds,preview,scale,x,y};}
 function scope(){try{const url=new URL(frame.contentDocument.URL);if(url.protocol==='about:')return null;return 'retouch.canvas.guides.v1:'+project+':'+url.pathname+url.search+':'+frame.clientWidth;}catch{return null;}}
 function save(){try{localStorage.setItem(state.key,JSON.stringify(state.items));}catch{}}
 function record(before){if(JSON.stringify(before)===JSON.stringify(state.items))return;state.undo.push(before);if(state.undo.length>50)state.undo.shift();state.redo.length=0;save();}
 function finish(cancelled=false,event=null){
  if(!gesture)return;const saved=gesture;gesture=null;
  const g=geometry(),point=event||saved.last,inside=point&&point.clientX>=g.bounds.left+20&&point.clientX<g.bounds.left+canvas.clientWidth&&point.clientY>=g.bounds.top+20&&point.clientY<g.bounds.top+canvas.clientHeight;
  if(cancelled||!saved.moved)state.items=saved.before;
  else{if(!inside)state.items=state.items.filter(item=>item.id!==saved.id);record(saved.before);}
  if(saved.target.hasPointerCapture(saved.pointerId))saved.target.releasePointerCapture(saved.pointerId);render();const node=nodes.get(saved.id);if(!cancelled&&node)node.focus({preventScroll:true});
 }
 function edit(id=null){
  if(editor||gesture)return;render();if(!state||!id&&state.items.length>=100)return;
  const owner=state,item=state.items.find(item=>item.id===id),opener=document.activeElement,I=root.RetouchInspector;
  const dialog=document.createElement('dialog');editor=dialog;dialog.className='quick-actions guide-editor';dialog.setAttribute('aria-label',item?'Edit guide':'Add guide');
  const form=document.createElement('form'),heading=document.createElement('h2'),section=document.createElement('div'),axis=document.createElement('select'),position=document.createElement('input');heading.textContent=item?'Edit guide':'Add guide';section.className='inspector-section';
  for(const [value,label]of [['x','Vertical'],['y','Horizontal']]){const option=document.createElement('option');option.value=value;option.textContent=label;axis.append(option);}axis.value=item?.axis||'x';
  position.type='number';position.min='-10000000';position.max='10000000';position.step='any';position.required=true;position.value=String(item?.value??Math.round(frame.clientWidth/2));
  I.field(section,'Orientation',axis);I.field(section,'Position (px)',position);
  const close=()=>{dialog.close();cleanup();};
  const footer=document.createElement('footer'),cancel=I.button('Cancel',close),apply=I.button(item?'Apply':'Add',()=>{});apply.type='submit';footer.append(cancel,apply);form.append(heading,section,footer);dialog.append(form);document.body.append(dialog);
  form.onsubmit=event=>{event.preventDefault();if(state!==owner||scope()!==owner.key){close();return;}const value=Number(position.value);if(!position.reportValidity()||!Number.isFinite(value))return;const before=copy(state.items);let target=state.items.find(guide=>guide.id===id);if(target){target.axis=axis.value;target.value=value;}else{if(state.items.length>=100)return;id=crypto.randomUUID();state.items.push({id,axis:axis.value,value});}record(before);if(!rulers.visible)document.getElementById('toggleRulers').click();render();close();};
  function cleanup(){if(!dialog.isConnected)return;dialog.remove();if(editor===dialog)editor=null;(nodes.get(id)||opener)?.focus({preventScroll:true});}
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',cleanup);dialog.showModal();position.focus();position.select();
 }
 const add=root.RetouchInspector.button('Add guide',()=>edit());add.id='addCanvasGuide';document.getElementById('panelEmpty').querySelector('.inspector-section').append(add);
 function render(){
  const key=scope();if(!key)return;if(state?.key!==key){editor?.close();finish(true);if(!states.has(key)){let items=[];try{const value=JSON.parse(localStorage.getItem(key));if(Array.isArray(value)&&value.length<=100&&value.every(valid)&&new Set(value.map(item=>item.id)).size===value.length)items=value;}catch{}states.set(key,{key,items,undo:[],redo:[]});if(states.size>20)states.delete(states.keys().next().value);}state=states.get(key);}
  const visible=rulers.visible;layer.hidden=!visible;if(!visible){finish(true);return;}const g=geometry(),parent=main.getBoundingClientRect();if(!Number.isFinite(g.scale)||g.scale<=0)return;
  Object.assign(layer.style,{left:g.bounds.left-parent.left+'px',top:g.bounds.top-parent.top+'px',width:canvas.clientWidth+'px',height:canvas.clientHeight+'px'});
  for(const [id,node]of nodes)if(!state.items.some(item=>item.id===id)){node.remove();nodes.delete(id);}
  for(const item of state.items){let node=nodes.get(item.id);if(!node){node=document.createElement('button');node.type='button';node.className='canvas-guide';node.dataset.guideId=item.id;node.onpointerdown=event=>start(event,state.items.find(guide=>guide.id===item.id)?.axis,item.id);node.ondblclick=()=>edit(item.id);node.onkeydown=event=>keyboard(event,item.id);layer.append(node);nodes.set(item.id,node);}
   const vertical=item.axis==='x',position=(vertical?g.preview.left-g.bounds.left:g.preview.top-g.bounds.top)+(item.value-(vertical?g.x:g.y))*g.scale;node.dataset.guideAxis=item.axis;node.dataset.guideValue=item.value;node.setAttribute('aria-label',(vertical?'Vertical':'Horizontal')+' guide '+item.value+' px');node.title='Double-click or Enter to edit position. Drag to move; arrows adjust by 1 px, Shift by 10 px. Delete removes; Command/Ctrl+Z undoes.';Object.assign(node.style,vertical?{left:(position-4)+'px',top:'20px',width:'9px',height:'calc(100% - 20px)'}:{left:'20px',top:(position-4)+'px',width:'calc(100% - 20px)',height:'9px'});
  }
 }
 function start(event,axis,id=null){
  if(event.button!==0||gesture||!rulers.visible)return;render();if(!state||!id&&state.items.length>=100)return;event.preventDefault();event.stopPropagation();const before=copy(state.items),target=event.currentTarget;
  if(!id){id=crypto.randomUUID();state.items.push({id,axis,value:0});}
  gesture={id,axis,before,target,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false,last:event};target.setPointerCapture(event.pointerId);move(event);
 }
 function move(event){if(!gesture||event.pointerId!==gesture.pointerId)return;const g=geometry();if(!Number.isFinite(g.scale)||g.scale<=0)return;event.preventDefault();event.stopPropagation();gesture.last=event;gesture.moved ||= Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)>3;const item=state.items.find(item=>item.id===gesture.id);if(!item)return;const vertical=item.axis==='x';item.value=Math.max(-1e7,Math.min(1e7,Math.round(((vertical?event.clientX-g.preview.left:event.clientY-g.preview.top)/g.scale)+(vertical?g.x:g.y))));render();}
 function historyKey(event,id=null){
  if(event.isComposing||event.altKey||!(event.metaKey||event.ctrlKey)||!['z','y'].includes(event.key.toLowerCase()))return false;event.preventDefault();event.stopPropagation();
  state.keyGesture=null;const back=event.key.toLowerCase()==='z'&&!event.shiftKey,from=back?state.undo:state.redo,to=back?state.redo:state.undo;if(from.length){to.push(copy(state.items));state.items=from.pop();save();render();(nodes.get(id)||nodes.values().next().value||layer).focus({preventScroll:true});}return true;
 }
 layer.addEventListener('keydown',event=>{if(event.target===layer&&state)historyKey(event);});
 function keyboard(event,id){
  if(event.isComposing||event.altKey)return;const item=state.items.find(item=>item.id===id);if(!item)return;
  if(historyKey(event,id))return;
  if(event.metaKey||event.ctrlKey)return;if(event.key==='Enter'){event.preventDefault();event.stopPropagation();edit(id);return;}const keys=item.axis==='x'?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'];if(!['Delete','Backspace',...keys].includes(event.key))return;event.preventDefault();event.stopPropagation();const before=copy(state.items);if(['Delete','Backspace'].includes(event.key))state.items=state.items.filter(guide=>guide!==item);else item.value=Math.max(-1e7,Math.min(1e7,item.value+(event.key===keys[0]?-1:1)*(event.shiftKey?10:1)));const repeated=event.repeat&&state.keyGesture?.id===id&&state.keyGesture.key===event.key&&state.undo.at(-1)===state.keyGesture.entry;if(repeated)save();else record(before);state.keyGesture=keys.includes(event.key)?{id,key:event.key,entry:state.undo.at(-1)}:null;render();if(!nodes.has(id))layer.focus({preventScroll:true});
 }
 for(const [ruler,axis]of [[rulers.horizontal,'y'],[rulers.vertical,'x']]){ruler.style.pointerEvents='auto';ruler.style.touchAction='none';ruler.style.cursor=axis==='x'?'col-resize':'row-resize';ruler.addEventListener('pointerdown',event=>start(event,axis));}
 document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',event=>{if(gesture&&event.pointerId===gesture.pointerId){event.preventDefault();event.stopPropagation();finish(false,event);}},true);document.addEventListener('pointercancel',()=>finish(true),true);
 document.addEventListener('keydown',event=>{if(gesture&&event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(true);}},true);
 for(const event of ['blur','retouch:before-zoom','retouch:screen'])root.addEventListener(event,()=>finish(true));root.addEventListener('retouch:rulers',render);frame.addEventListener('load',render);render();
 root.RetouchGuides={values:()=>copy(state?.items||[]),targets(document){
  if(!rulers.visible||gesture||document!==frame.contentDocument)return [];render();const w=document.defaultView;
  return state.items.map(item=>item.axis==='x'?{guideAxis:'x',container:true,left:item.value-w.scrollX,top:0,width:0,height:w.innerHeight}:{guideAxis:'y',container:true,left:0,top:item.value-w.scrollY,width:w.innerWidth,height:0});
 }};
})(window);
