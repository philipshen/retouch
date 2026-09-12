(function(){
 'use strict';
 const main=document.getElementById('main'),panels={layers:document.getElementById('layersPanel'),inspector:document.getElementById('panel')},buttons={layers:document.getElementById('toggleLayers'),inspector:document.getElementById('toggleInspector')};
 const project=window.__RT_RENDERING?.stateScope?.project,key='retouch.workspace-panels.v1'+(typeof project==='string'&&/^[a-f0-9]{64}$/.test(project)?':'+project:'');
 let hidden={layers:false,inspector:false},compact=null,opened=null,lastSelection=null;
 try{const value=JSON.parse(localStorage.getItem(key));if(value&&typeof value.layers==='boolean'&&typeof value.inspector==='boolean')hidden=value;}catch{}
 function layout(){
  const next=main.clientWidth<1100;
  if(next!==compact){
   // Keep an in-progress panel edit visible when sidebars become overlays.
   const active=document.querySelector('.paint-picker[open]')?.retouchSourceInput||document.activeElement;
   opened=next&&compact!==null?Object.keys(panels).find(name=>!panels[name].hidden&&panels[name].contains(active))||null:null;
   compact=next;
  }
  main.classList.toggle('compact-workspace',compact);
  for(const [name,panel]of Object.entries(panels)){const visible=compact?opened===name:!hidden[name];panel.hidden=!visible;buttons[name].setAttribute('aria-expanded',String(visible));}
  window.dispatchEvent(new Event('retouch:workspace-layout'));
 }
 function close(){const previous=opened;opened=null;layout();if(previous)buttons[previous].focus();}
 for(const [name,button]of Object.entries(buttons))button.onclick=()=>{if(compact)opened=opened===name?null:name;else{hidden[name]=!hidden[name];try{localStorage.setItem(key,JSON.stringify(hidden));}catch{}}layout();};
 window.addEventListener('retouch:selection',event=>{if(compact&&event.detail&&event.detail!==lastSelection){opened='inspector';layout();}lastSelection=event.detail;});
 window.RetouchWorkspacePanels={showInspector(){if(compact)opened='inspector';else{hidden.inspector=false;try{localStorage.setItem(key,JSON.stringify(hidden));}catch{}}layout();},closeIfOpen(){if(!compact||!opened)return false;close();return true;}};
 new ResizeObserver(layout).observe(main);layout();
})();
