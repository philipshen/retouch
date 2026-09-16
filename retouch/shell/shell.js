'use strict';
/* Retouch shell: selection, co-highlight, class/text/spacing edits, undo.
   Same-origin iframe; direct DOM access per RFC-0001 rev 6 (OQ-B4). */

const TOKEN = window.__RT_TOKEN;
const iframe = document.getElementById('app');
const overlayLayer = document.getElementById('overlayLayer');
const modeBtn = document.getElementById('modeBtn');
const routeInput = document.getElementById('routeInput');
const pagePicker = document.getElementById('pagePicker');
const pagePickerLabel = document.getElementById('pagePickerLabel');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const statusEl = document.getElementById('status');
const panelEmpty = document.getElementById('panelEmpty');
const panelBody = document.getElementById('panelBody');
if(window.__RT_RENDERING?.selectionStyling){const hint=document.createElement('p');hint.className='hint';hint.textContent='Drag empty canvas or page background to surround layers. Shift adds to the selection; Escape cancels.';panelEmpty.append(hint);}

const SPACING_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32];

let historyRecoveryRequired=!!window.__RT_RENDERING?.historyRecoveryRequired;
let armedCanvasTool=null;
let stopShapeDrag=null,preparingShapeDrag=false,creationEntrySerial=0;
let mode = historyRecoveryRequired?'interact':'edit'; // 'edit' | 'interact'
let renderedSelection=null; // Live DOM anchor for the explicitly chosen occurrence.
let sel = null; // { hostId, instanceId, scope: 'host'|'instance', info }
let inlineFormatCleanup=()=>{};
let editing = null; // { el, id, info, original, originalHTML, snapshot, originalTree } during inline text editing
let inspectorTextCommit=null,inlineTextCommit=null,inspectorSelectionSerial=0;
let hoverEl = null;
let measuring = false;
let selectionMarquee=null,stopMarquee=null,stopDrawing=null,stopSVGDrag=null,stopGroupDrag=null,frameRefreshDrawing=null;
const marqueeSurface=document.createElement('div');marqueeSurface.className='selection-marquee-surface';document.body.append(marqueeSurface);
const canvasSurface=document.getElementById('frameWrap');
let sourceRequests = 0;
let undoBusy = false;
let classificationSerial = 0;
let panelTasks = 0;
let pendingVectorEntry=null,vectorEntrySerial=0;
let pendingPanelFocus=null;
const panelSelectionKey=()=>sel?JSON.stringify([sel.info.file,sel.scope,sel.instanceId,(sel.multiple||[sel.info]).map(info=>info.id).sort()]):null;
const controlIdentity=el=>JSON.stringify([el.tagName,el.getAttribute('aria-label'),el.getAttribute('name'),el.dataset.canvasTool,el.matches('button,summary')?el.textContent:null]);
// Source refresh can rebuild a slider again after the save releases the panel.
// Retain its destination briefly; deliberate input still cancels the request below.
window.RetouchPanelFocus={refreshSavedControl(target){
  const active=document.activeElement;
  if(panelBody.contains(active)&&active!==target&&active.matches('input,textarea,select'))return;
  window.RetouchPanelFocus.queue(target);if(active===target)active.blur();renderPanel();restorePanelFocus();
},queue(target,label){
  if(!panelBody.contains(target))return;
  const identityTarget=target.cloneNode(true);if(label)identityTarget.setAttribute('aria-label',label);
  pendingPanelFocus={selection:panelSelectionKey(),identity:controlIdentity(identityTarget),index:0,expires:0,retain:true};
},queueControl(target,label){
  if(!panelBody.contains(target)||typeof label!=='string')return;
  pendingPanelFocus={selection:panelSelectionKey(),controlLabel:label,index:0,expires:0,retain:true};
}};
function restorePanelFocus(){
  const pending=pendingPanelFocus;if(!pending||panelBody.disabled)return;
  if(!pending.expires)pending.expires=Date.now()+3000;
  if(pending.selection!==panelSelectionKey()||Date.now()>pending.expires){pendingPanelFocus=null;return;}
  const candidates=[...panelBody.querySelectorAll('input,select,textarea,button,summary,[tabindex]')].filter(el=>pending.controlLabel?el.matches('input,select,textarea')&&el.getAttribute('aria-label')===pending.controlLabel:controlIdentity(el)===pending.identity);
  const target=(pending.gradientPaint?candidates.filter(el=>el.closest('[data-gradient-paint]')?.dataset.gradientPaint===pending.gradientPaint):candidates)[pending.index];
  if(target&&!target.matches(':disabled')&&target.getClientRects().length){if(!pending.retain)pendingPanelFocus=null;if(document.activeElement!==target)target.focus();}
}
panelBody.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.key!=='Tab'||event.altKey||event.ctrlKey||event.metaKey||!event.target.matches('input:not([type=checkbox]):not([type=radio]),textarea'))return;
  const controls=[...panelBody.querySelectorAll('input,select,textarea,button,summary,[tabindex]')].filter(el=>el.tabIndex>=0&&!el.matches(':disabled')&&el.getClientRects().length);
  const target=controls[controls.indexOf(event.target)+(event.shiftKey?-1:1)];if(!target)return;
  const identity=controlIdentity(target),matches=[...panelBody.querySelectorAll('input,select,textarea,button,summary,[tabindex]')].filter(el=>controlIdentity(el)===identity);
  pendingPanelFocus={selection:panelSelectionKey(),identity,index:matches.indexOf(target),expires:0,retain:true};
  event.preventDefault();event.target.blur();restorePanelFocus();
});
// A deliberate click or keyboard action during a save supersedes queued focus.
window.addEventListener('pointerdown',()=>{pendingPanelFocus=null;},true);
window.addEventListener('keydown',()=>{pendingPanelFocus=null;},true);
// Paste, autofill and accessibility edits may arrive without a key or pointer event.
window.addEventListener('input',event=>{if(event.isTrusted)pendingPanelFocus=null;},true);
window.addEventListener('blur',()=>{pendingPanelFocus=null;});
// Accessibility activation may change screen controls without a pointer/key event.
window.addEventListener('change',event=>{if(!panelBody.contains(event.target)||event.target.getAttribute('aria-label')==='Style screen scope')pendingPanelFocus=null;},true);
// Metadata can rebuild an input after the source save has completed.
new MutationObserver(restorePanelFocus).observe(panelBody,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled']});

const canvasPan=RetouchCanvasPan.mount({enabled:()=>mode==='edit'&&!editing&&!panelTasks&&!sourceRequests&&!undoBusy,onActivate:()=>{setArmedCanvasTool(null);window.dispatchEvent(new Event('retouch:before-zoom'));stopDrawing?.();hoverEl=null;}});
function busyPanel(start) {
  if(start&&!panelTasks&&!pendingPanelFocus){
    const target=document.activeElement;
    if(panelBody.contains(target)&&target.matches('input,select,textarea')){
      const identity=controlIdentity(target),matches=[...panelBody.querySelectorAll('input,select,textarea,button,summary,[tabindex]')].filter(el=>controlIdentity(el)===identity);
      pendingPanelFocus={selection:panelSelectionKey(),identity,index:matches.indexOf(target),expires:0};
    }
  }
  if(start)stopDrawing?.();
  panelTasks += start ? 1 : -1;
  syncHistoryControls();
  if(!panelTasks&&panelRenderDeferred)queueViewportPanelRefresh();
  if(!panelTasks&&pendingVectorEntry)queueMicrotask(openPendingVectorEntry);
}
let lastAppPath = null;
let styleScope = '';
let groupAlignmentKey='',groupAlignmentTarget='selection',groupGapMode='equal';
const svgExportNames=new WeakMap();
let svgExportScale=1,svgEmbedImages=true,svgExportFormat='svg',jpegQuality=92,jpegBackground='#ffffff';
function scopedInfo(info) { return {...info,sourceClassName:info.className,styleScope,anchorInheritedClasses:RetouchResponsive.inherited(info.className,styleScope,doc()),className:RetouchResponsive.project(info.className,styleScope)}; }

let lockStorage;try{lockStorage=sessionStorage;}catch{}
const layerLocks=RetouchLayerLocks.create({route:()=>currentPageRoute()||'',storage:lockStorage,scope:window.__RT_RENDERING?.stateScope});
function pickLayer(node,x,y,{enter=false}={}){
 const picked=layerLocks.pick(node,x,y);if(!picked)return null;
 const target=picked.closest('[data-rt-boolean-result]')?.closest('[data-rt-boolean]')||layers.textOwner(picked);if(!target)return target;return groupSelectionTarget(target,{enter});
}
function groupSelectionTarget(target,{enter=false}={}){
 const selected=sel?matchingInDocument(target.ownerDocument,activeId(),sel.info).find(el=>inTextScope(el,sel.info)):null;
 const closed=[];for(let group=target.closest('[data-rt-group][data-rt]');group;group=group.parentElement?.closest('[data-rt-group][data-rt]')){if(selected&&selected!==group&&group.contains(selected))continue;if(!layerLocks.locked(group))closed.push(group);}
 if(enter)closed.pop();return closed.at(-1)||target;
}
window.RetouchCanvasSelection={marqueeTargets:resolveMarqueeTargets,pick:(node,x,y,options)=>pickLayer(node,x,y,options),selectable:node=>!layerLocks.locked(node),canMarquee:()=>window.__RT_RENDERING?.selectionStyling===true&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests};
const historyRoutes = new Map();
function currentPageRoute(){try{const loc=iframe.contentWindow.location;return loc.origin===location.origin?loc.pathname+loc.search+loc.hash:null;}catch{return null;}}
const editorHistory = RetouchHistory.createHistory({apply:restoreHistory,onChange:syncHistoryControls,storage:lockStorage,scope:window.__RT_RENDERING?.stateScope,initialState:window.__RT_RENDERING?.history,capture:entry=>({route:historyRoutes.get(entry.undoId)||currentPageRoute()})});
function syncHistoryControls() {
  undoBusy = editorHistory.busy;
  const busy = undoBusy || panelTasks > 0 || sourceRequests > 0;
  if(busy)canvasPan.cancel();
  const textChanged=!!editing&&editing.el.innerHTML!==editing.historyBaselineHTML;
  undoBtn.disabled = busy || historyRecoveryRequired || !(canStepInlineHistory(false)||(!textChanged||!ownsNativeTextHistory())&&(textChanged||editorHistory.canUndo));
  redoBtn.disabled = busy || historyRecoveryRequired || !(canStepInlineHistory(true)||!textChanged&&editorHistory.canRedo);
  const toolHistory=document.querySelector('.svg-pen-surface')?.retouchHistory;
  if(toolHistory){undoBtn.disabled=busy||!toolHistory.canUndo;redoBtn.disabled=busy||!toolHistory.canRedo;}
  undoBtn.setAttribute('aria-busy',String(busy));
  redoBtn.setAttribute('aria-busy',String(busy));
  pagePicker.disabled = busy;routeInput.disabled = busy;
  panelBody.disabled = busy||historyRecoveryRequired;panelBody.inert = busy||historyRecoveryRequired;
  panelBody.setAttribute('aria-busy',String(busy));
  if(!busy)queueMicrotask(restorePanelFocus);
}
syncHistoryControls();

const historyWarning=document.createElement('span');historyWarning.setAttribute('role','status');historyWarning.className='hint';document.getElementById('toolbar').append(historyWarning);
const recoveryDetails=document.createElement('details');recoveryDetails.hidden=true;recoveryDetails.className='recovery-details';
const recoverySummary=document.createElement('summary');recoverySummary.textContent='Review recovery';
const recoveryReason=document.createElement('p'),recoveryHelp=document.createElement('p'),recoveryRetry=document.createElement('button');
recoveryHelp.textContent='Restore the files listed below to their state before the interrupted edit, or resolve them in your code editor and recheck. External changes require manual resolution. Rechecking does not change source files.';
recoveryRetry.textContent='Recheck recovery';recoveryRetry.type='button';
const recoveryPanel=document.createElement('div');recoveryPanel.className='recovery-panel';recoveryPanel.append(recoveryReason,recoveryHelp,recoveryRetry);recoveryReason.setAttribute('role','status');recoveryDetails.append(recoverySummary,recoveryPanel);document.getElementById('toolbar').append(recoveryDetails);
const recoveryFiles=document.createElement('ul'),recoveryRestore=document.createElement('button');let recoveryToken=null;
recoveryRestore.type='button';recoveryRestore.textContent='Restore before interrupted edit';recoveryRestore.hidden=true;
recoveryPanel.append(recoveryFiles,recoveryRestore);
async function reviewRecovery(){
 recoveryToken=null;recoveryRestore.hidden=true;recoveryFiles.replaceChildren();
 try{const result=await api('GET','/rt/__api/history-recovery-review');if(!result.ok)return;
  for(const file of result.files){const row=document.createElement('li');row.textContent=file.file+' — '+(file.state==='before'?'already restored':file.state==='external'?'external changes; resolve manually':file.action==='remove'?'will be removed':file.action==='create'?'will be recreated':'will be restored');recoveryFiles.append(row);}
  recoveryToken=result.token;recoveryRestore.hidden=!result.canRestore;
 }catch(error){recoveryReason.textContent='Could not review recovery: '+error.message;}
}
recoveryDetails.addEventListener('toggle',()=>{if(recoveryDetails.open)reviewRecovery();});
recoveryRestore.addEventListener('click',async()=>{if(!recoveryToken)return;recoveryRestore.disabled=true;try{const result=await api('POST','/rt/__api/history-recovery-restore',{token:recoveryToken});if(result.ok)location.reload();else{recoveryReason.textContent=result.reason||'Recovery could not complete.';await reviewRecovery();}}catch(error){recoveryReason.textContent=error.message;}finally{recoveryRestore.disabled=false;}});
recoveryRetry.addEventListener('click',async()=>{recoveryRetry.disabled=true;try{const result=await api('POST','/rt/__api/history-recovery',{});if(result.ok)location.reload();else recoveryReason.textContent=result.reason||result.error||'Recovery is still required.';}catch(error){recoveryReason.textContent='Could not recheck recovery: '+error.message;}finally{recoveryRetry.disabled=false;}});
function showHistoryPersistence(error,recoveryRequired=false){historyRecoveryRequired=recoveryRequired;recoveryDetails.hidden=!recoveryRequired;recoveryReason.textContent=error||'';historyWarning.hidden=!error&&!recoveryRequired;historyWarning.textContent=recoveryRequired?'Source recovery required. Editing is paused.':error?'History is available for this session only.':'';historyWarning.title=error||'';if(recoveryRequired){mode='interact';modeBtn.disabled=true;modeBtn.textContent='Interact mode';modeBtn.classList.remove('mode-edit');stopDrawing?.();hoverEl=null;}syncHistoryControls();}
showHistoryPersistence(window.__RT_RENDERING?.historyPersistenceError,historyRecoveryRequired);

/* ---------- boot ---------- */
const appPath = (location.pathname.replace(/^\/rt\/?/, '/') || '/') + location.search + location.hash;
iframe.src = appPath;
routeInput.value = appPath;

iframe.addEventListener('load', () => {
  try {
    if (!iframe.contentDocument || iframe.contentWindow.location.origin !== location.origin) return;
    classificationSerial++;
    if (editing?.el.ownerDocument !== iframe.contentDocument) {inlineFormatCleanup();editing = null;}
    hoverEl = null;
    hookFrame(iframe.contentDocument, iframe.contentWindow);
    layers.attach(iframe.contentDocument);
    onNavigated();
    refreshPages();
    if (sel) renderPanel();
  } catch (err) {
    toast('Could not attach to the app frame: ' + err.message, 'err');
  }
});

window.addEventListener('pagehide', () => {});
requestAnimationFrame(paintLoop);
setInterval(pollNavigation, 300);

/* ---------- frame hooks ---------- */
function doc() { return iframe.contentDocument; }

let canvasContextSerial=0;
document.addEventListener('pointerdown',()=>canvasContextSerial++,true);
async function canvasContextMenu(event,keyboard=false){
 if(event.defaultPrevented||event.isComposing||mode!=='edit'||editing||panelTasks||undoBusy||sourceRequests||document.querySelector('dialog[open]')||event.target.isContentEditable||event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return;
 if(keyboard&&!sel)return;
 event.preventDefault();event.stopPropagation();const serial=++canvasContextSerial;
 const candidates=keyboard?[]:layers.atPoint(doc(),event.clientX,event.clientY);
 const target=keyboard?matchingEls(activeId())[0]:pickLayer(event.target,event.clientX,event.clientY)||candidates[0]?.el;
 if(!target)return;
 const selectedTargets=!sel?[]:sel.multiple?sel.multiple.flatMap(info=>matchingEls(info.id)):sel.info.kind==='instance'?selectedComponentGroups(doc(),activeId(),sel.info)[0]?.elements||[]:matchingEls(activeId()).filter(el=>inTextScope(el,sel.info)).slice(0,1);
 if(!keyboard&&!selectedTargets.includes(target))await select(target);
 if(keyboard)await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 if(serial!==canvasContextSerial||mode!=='edit'||!sel)return;
 const frame=iframe.getBoundingClientRect(),box=target.getBoundingClientRect(),x=keyboard?box.left:event.clientX,y=keyboard?box.bottom:event.clientY;
 const body=doc().body;body.tabIndex=-1;
 window.RetouchActions?.contextMenu({x:frame.left+x*frame.width/iframe.offsetWidth,y:frame.top+y*frame.height/iframe.offsetHeight,opener:body,layerChoices:candidates,onLayerError:error=>toast(error.message,'err'),onLayerPreview:el=>{hoverEl=el;},canSelectLayer:()=>doc()===body.ownerDocument&&mode==='edit'&&!editing&&!panelTasks&&!sourceRequests&&!undoBusy});
}
function hookFrame(d, w) {
  d.addEventListener('contextmenu',event=>void canvasContextMenu(event).catch(error=>toast(error.message,'err')),true);
  d.addEventListener('keydown',event=>{if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey)void canvasContextMenu(event,true).catch(error=>toast(error.message,'err'));},true);
  d.addEventListener('pointerdown',()=>{canvasContextSerial++;window.RetouchActions?.closeContext();},true);
  d.addEventListener('scroll',()=>window.RetouchActions?.closeContext(),true);
  w.addEventListener('pointerup',releasePanelPointer,true);
  w.addEventListener('pointercancel',releasePanelPointer,true);
  if(!frameRefreshDrawing||stopDrawing!==frameRefreshDrawing.cancel||iframe.contentWindow?.location.href!==frameRefreshDrawing.route)stopDrawing?.();
  stopShapeDrag?.();stopShapeDrag=RetouchSVGDrag.mount({document:d,frame:iframe,allowAlt:true,preventSelection:true,
   candidate:node=>{
    if(!(armedCanvasTool==='text'||armedCanvasTool==='pen'||armedCanvasTool?.startsWith('draw-'))||mode!=='edit'||editing||stopDrawing||panelTasks||undoBusy||sourceRequests||canvasPan.active||layerLocks.locked(node))return null;
    for(let target=node?.closest?.('[data-rt]');target;target=target.parentElement?.closest('[data-rt]'))if(/^(body|div|main|section|article|aside|header|footer|nav|form|fieldset|dialog|figure|details|blockquote|li|td|th|svg|g)$/.test(target.localName)&&!layerLocks.locked(target))return {target,action:armedCanvasTool};
    return null;
   },
   prepare:async({target,action},current)=>{
    preparingShapeDrag=true;
    try{
     const valid=()=>current()&&doc()===d&&armedCanvasTool===action&&mode==='edit'&&!canvasPan.active;
     for(let candidate=target;candidate&&valid();candidate=candidate.parentElement?.closest('[data-rt]')){
      if(layerLocks.locked(candidate))return null;
      await select(candidate,{current:valid});if(!valid())return null;
      const destination=renderedSelection?.element;
      if((action==='text'?sel?.info.structure?.canInsert&&matchingEls(sel.info.id).length===1:action==='pen'?sel?.info.svgInsertion?.pen:sel?.info.svgInsertion?.presets.includes(action.slice(5)))&&destination?.isConnected&&destination.contains(target)&&!layerLocks.locked(destination))return {target:destination,pointerTarget:target,action,info:sel.info};
     }
     if(valid())toast('Choose an editable container to create a layer in.','err');
     return null;
    }
    finally{preparingShapeDrag=false;}
   },
   onStart:({target,pointerTarget,action,info},event,move,released)=>{if(armedCanvasTool!==action)return;setArmedCanvasTool(null);if(action==='text'){
    const commit=position=>{if(sel?.info===info)insertLayer('text',info,'insertElement',{position});};
    stopDrawing=RetouchSVGDraw.mount({target,frame:iframe,canvas:canvasSurface,preset:'rectangle',tool:'text',native:true,initialPointer:event,initialMove:move,initialReleased:released,pointerTarget,onClick:commit,onCommit:([x1,y1,x2,y2])=>commit({x:Math.min(x1,x2),y:Math.min(y1,y2),width:Math.max(1,Math.abs(x2-x1)),height:Math.max(1,Math.abs(y2-y1))}),onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});return;
   }if(action==='pen'){stopDrawing=RetouchSVGPen.mount({target,frame:iframe,canvas:canvasSurface,native:info.svgInsertion.createsViewport,initialPointer:event,initialMove:move,initialReleased:released,pointerTarget,isCurrent:()=>sel?.info===info,onCommit:(points,closed,nodes)=>{if(sel?.info===info)insertLayer(nodes?'path':closed?'polygon':'polyline',info,'insertSVG',{...(nodes?{nodes,closed}:{points}),...(info.svgInsertion.createsViewport?{nativeCanvas:true}:{})});},onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});return;}stopDrawing=RetouchSVGDraw.mount({target,frame:iframe,canvas:canvasSurface,preset:action.slice(5),native:info.svgInsertion.createsViewport,initialPointer:event,initialMove:move,initialReleased:released,pointerTarget,onCommit:points=>{if(sel?.info===info)insertLayer(action.slice(5),info,'insertSVG',{points,...(info.svgInsertion.createsViewport?{nativeCanvas:true}:{})});},onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});},
   onError:error=>toast(error.message,'err')});
  const vectorDragCandidate=node=>{
    if(armedCanvasTool||mode!=='edit'||editing||stopDrawing||panelTasks||undoBusy||sourceRequests||canvasPan.active)return null;
    if(sel?.multiple?.length>1){const infos=sel.multiple;if(infos.some(info=>!info.svgTransform?.editable))return null;const elements=infos.map(info=>{const found=matchingEls(info.id);return found.length===1?found[0]:null;});if(elements.some(el=>!el||layerLocks.locked(el)))return null;const target=elements.find(el=>el.contains(node));return target?{info:sel.info,target,infos}:null;}
    const targets=sel?.info.svgTransform?.editable?matchingEls(sel.info.id):[],selected=targets.length===1?targets[0]:null;
    if(selected?.contains(node)&&!layerLocks.locked(selected))return {info:sel.info,target:selected};
    const target=pickLayer(node);return target?.namespaceURI==='http://www.w3.org/2000/svg'&&/^(g|rect|circle|ellipse|line|path|polygon|polyline|text|image|use)$/.test(target.localName)&&!layerLocks.locked(target)?{target}:null;
  };
  stopSVGDrag?.();stopSVGDrag=RetouchSVGDrag.mount({document:d,frame:iframe,candidate:vectorDragCandidate,
    prepare:async({target},current)=>{const selection=sel,valid=()=>current()&&sel===selection&&doc()===d&&!!vectorDragCandidate(target);await select(target,{current:valid});const result=current()&&vectorDragCandidate(target);return result?.info?result:null;},
    onStart:({info,target,infos},event,move,released)=>infos?moveSVGSelection({initialPointer:event,initialMove:move,pointerTarget:target}):resizeSVGOnCanvas(info,target,event,'se','move',{framePointer:true,initialMove:move,initialReleased:released}),onError:error=>toast(error.message,'err')});
  const groupDragCandidate=node=>{
   if(armedCanvasTool||mode!=='edit'||editing||stopDrawing||panelTasks||undoBusy||sourceRequests||canvasPan.active)return null;
   const roots=groupMovementRoots(),selected=roots?.find(el=>el.contains(node));
   if(selected&&roots.every(el=>!layerLocks.locked(el)))return {target:selected,selectionInfo:sel.info,selection:sel,scope:styleScope};
   if(sel?.multiple?.length)return null;
   const target=pickLayer(node);
   return target?.hasAttribute('data-rt-group')&&!layerLocks.locked(target)?{target,selection:sel,scope:styleScope}:null;
  };
  stopGroupDrag?.();stopGroupDrag=RetouchSVGDrag.mount({document:d,frame:iframe,candidate:groupDragCandidate,
   prepare:async({target,selectionInfo,selection,scope},current)=>{
    if(!selectionInfo){
     const valid=()=>current()&&doc()===d&&sel===selection&&styleScope===scope&&groupDragCandidate(target)?.target===target;
     let selectedHere=false;await select(target,{current:()=>{selectedHere=valid();return selectedHere;}});
     if(!selectedHere||!current()||doc()!==d||styleScope!==scope)return null;
     selectionInfo=groupDragCandidate(target)?.selectionInfo;if(!selectionInfo)return null;
    }
    const valid=()=>current()&&doc()===d&&styleScope===scope&&groupDragCandidate(target)?.selectionInfo===selectionInfo;
    const prepared=await moveGroupOnCanvas(selectionInfo,null,{prepareOnly:true,valid});return prepared&&valid()?{target,selectionInfo,prepared}:null;
   },
   onStart:({target,selectionInfo,prepared},event,move,released)=>void moveGroupOnCanvas(selectionInfo,null,{prepared,event,move,released,framePointer:true,target}),onError:error=>toast(error.message,'err')});
  stopMarquee?.();
  stopMarquee=RetouchMarquee.mount({document:d,frame:iframe,surface:canvasSurface,enabled:()=>!armedCanvasTool&&window.__RT_RENDERING?.selectionStyling===true&&mode==='edit'&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests,
    onChange:rect=>{selectionMarquee=rect?{document:d,rect}:null;},
    selectable:node=>!layerLocks.locked(node),
    onSelect:(nodes,options)=>selectMarquee(d,nodes,options),
    onClick:(node,options)=>{if(panelTasks||undoBusy||sourceRequests)return;const target=pickLayer(node,options.point?.x,options.point?.y);if(target)select(target,options);else if(!options.toggle)clearSelection();},
  });
  // The compiler may deliver CSS after the source-write response. Refresh
  // computed inspector values when that CSS lands, without interrupting input.
  let styleRefresh, viewportStyleRefresh=false;
  const refreshStyles = event => {
    viewportStyleRefresh ||= event?.type==='resize';
    clearTimeout(styleRefresh);
    styleRefresh = setTimeout(() => {
      const viewport=viewportStyleRefresh;viewportStyleRefresh=false;
      if(doc()===d&&sel){if(viewport)queueViewportPanelRefresh();else if(!panelTasks&&!panelBody.contains(document.activeElement))renderPanel();}
    }, 100);
  };
  // WebKit can settle the child viewport after the parent's animation frame.
  // Refresh on the embedded window's own resize, once its media queries apply.
  w.addEventListener('resize',refreshStyles);
  if (d.head) new MutationObserver(refreshStyles).observe(d.head,{childList:true,subtree:true,characterData:true});
  d.addEventListener('load',e=>{if(e.target.tagName==='LINK')refreshStyles();},true);
  const suppress = (e) => {
    if (mode !== 'edit') return;
    if (editing && editing.el.contains(e.target)) return; // let the text being edited behave
    e.stopPropagation();
  };
  // Selection: capture-phase click; prevent the app from reacting (OQ-E4).
  d.addEventListener('click', async (e) => {
    if (mode !== 'edit') return;
    if(inspectorTextCommit){
      e.preventDefault();e.stopPropagation();const serial=++inspectorSelectionSerial,target=captureInspectorSelectionTarget(pickLayer(e.target,e.clientX,e.clientY));
      await inspectorTextCommit;if(serial!==inspectorSelectionSerial||mode!=='edit'||panelTasks||undoBusy||sourceRequests)return;
      const next=target();if(next&&!layerLocks.locked(next)){if((e.shiftKey||e.metaKey||e.ctrlKey)&&(sel?.info.cssAuthoring||sel?.info.classSelection||sel?.info.contextSelection||sel?.info.kind==='instance'))await select(next,{toggle:true});else await startInlineEdit(next,e,true);}else if(!next)clearSelection();return;
    }
    if (panelTasks > 0 || undoBusy || sourceRequests) { e.preventDefault(); e.stopPropagation(); return; }
    const creationToolArmed=armedCanvasTool==='text'||armedCanvasTool==='pen'||armedCanvasTool?.startsWith('draw-');
    if ((e.shiftKey&&!creationToolArmed||e.metaKey||e.ctrlKey)&&(sel?.info.cssAuthoring||sel?.info.classSelection||sel?.info.contextSelection||sel?.info.kind==='instance')){e.preventDefault();e.stopPropagation();await commitInlineEdit();const target=pickLayer(e.target,e.clientX,e.clientY);if(target)await select(target,{toggle:true});return;}
    if (editing) {
      if (editing.el.contains(e.target)) return;
      commitInlineEdit(); // clicking away commits (R-5)
    }
    e.preventDefault();
    e.stopPropagation();
    const t = pickLayer(e.target,e.clientX,e.clientY);
    if(armedCanvasTool){if(t&&!layerLocks.locked(t)){if(creationToolArmed)await startCreationAt(t,{x:e.clientX,y:e.clientY,altKey:e.altKey},armedCanvasTool);else await select(t);}else clearSelection();return;}
    // Single click selects AND, when the element has editable literal text,
    // enters in-place editing directly (user decision, 2026-09-02).
    if (t&&!layerLocks.locked(t)) startInlineEdit(t, e, true);
    else clearSelection();
  }, true);
  // Double-click opens vector points, boolean originals, or inline text.
  d.addEventListener('dblclick', (e) => {
    if (mode !== 'edit') return;
    if(undoBusy||sourceRequests){e.preventDefault();e.stopPropagation();return;}
    if (editing) {
      if (editing.el.contains(e.target)) return;
      commitInlineEdit(); // moving to another element commits the current one
    }
    e.preventDefault();
    e.stopPropagation();
    const t = pickLayer(e.target,e.clientX,e.clientY,{enter:true});
    if (t&&!layerLocks.locked(t)) startInlineEdit(t, e, false, true);
  }, true);
  d.addEventListener('mousemove', (e) => {
    if (mode !== 'edit') { hoverEl = null; return; }
    measuring = e.altKey;
    hoverEl = pickLayer(e.target,e.clientX,e.clientY);
  }, true);
  d.addEventListener('mouseleave', () => { hoverEl = null; }, true);
  d.addEventListener('keydown', (e) => { if (e.key === 'Alt') measuring = true; }, true);
  d.addEventListener('keyup', (e) => { if (!e.altKey) measuring = false; }, true);
  w.addEventListener('blur', () => { measuring = false; });
  // Block app interaction + transient-state dismissal in edit mode (E4 rule 1).
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup',
    'pointerleave', 'pointerout', 'mouseleave', 'mouseout', 'submit']) {
    d.addEventListener(type, suppress, true);
  }
  d.addEventListener('focusout', (e) => {
    if (editing && e.target === editing.el) {
      const current=editing;
      requestAnimationFrame(()=>{if(editing===current&&!inlineTextUIFocused()&&!(document.activeElement===iframe&&current.el.contains(d.activeElement)))commitInlineEdit();});return;
    }
    suppress(e);
  }, true);
  d.addEventListener('blur', suppress, true);
  d.addEventListener('paste', (e) => {
    if (!editing || !editing.el.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    pasteInlineText(e.clipboardData?.getData('text/plain') || '');
  }, true);
  d.addEventListener('drop', (e) => {
    if (!editing || !editing.el.contains(e.target)) return;
    // Do not let native rich HTML drops bypass the plain-text paste path.
    e.preventDefault();
    e.stopPropagation();
  }, true);
  d.addEventListener('input',event=>{finishNativeTextEdit(event);if(editing)for(const node of caretPlaceholders(editing))if(hasInlineContentAfter(node,editing.el))delete node.__rtCaretPlaceholder;if(editing?.caretHistory&&editing.el.contains(event.target)&&!['historyUndo','historyRedo'].includes(event.inputType))editing.caretHistory.redo=[];syncHistoryControls();},true);
  d.addEventListener('compositionstart',()=>beginCaretComposition(),true);
  d.addEventListener('compositionend',()=>finishCaretComposition(),true);
  d.addEventListener('beforeinput', (e) => {
    if(editing&&editing.el.contains(e.target)&&!e.isComposing&&e.inputType==='deleteContentBackward'&&removeListMarker()){e.preventDefault();e.stopPropagation();return;}
    if(editing&&editing.el.contains(e.target)&&!e.isComposing&&['deleteContentBackward','deleteContentForward'].includes(e.inputType)&&joinTextParagraph(e.inputType==='deleteContentBackward')){e.preventDefault();e.stopPropagation();return;}
    if(editing&&editing.el.contains(e.target)&&!e.isComposing&&e.inputType==='insertParagraph'){e.preventDefault();e.stopPropagation();if(!insertTextParagraph())toast('This text structure cannot create a paragraph yet.','err');return;}
    if(editing&&editing.el.contains(e.target)&&!e.isComposing&&e.inputType==='insertLineBreak'){e.preventDefault();e.stopPropagation();insertInlineBreak();return;}
    if(editing&&editing.el.contains(e.target)&&['historyUndo','historyRedo'].includes(e.inputType)&&inlineHistoryCommand(e.inputType==='historyRedo')){e.preventDefault();e.stopPropagation();return;}
    if(editing&&editing.el.contains(e.target)&&!e.isComposing&&e.inputType==='insertText'&&typeof e.data==='string'&&(autoListPrefix(e.data)||insertCaretText(e.data)||insertListCaretText(e.data))){e.preventDefault();e.stopPropagation();return;}
    beginNativeTextEdit(e);
    if (editing && editing.el.contains(e.target) && e.inputType.startsWith('format')) {
      e.preventDefault();
    }
  }, true);
  d.addEventListener('keyup',e=>{if(editing&&e.key==='Backspace')editing.listMarkerBackspace=false;},true);
  d.addEventListener('pointerdown',breakTextHistoryGroup,true);
  d.addEventListener('pointerdown',cancelOpacityEntry,true);
  d.addEventListener('keydown', (e) => {
    if(armedCanvasTool&&e.key==='Escape'&&!e.isComposing){setArmedCanvasTool(null);e.preventDefault();e.stopPropagation();return;}
    if(e.key==='Escape'){vectorEntrySerial++;if(pendingVectorEntry){pendingVectorEntry=null;e.preventDefault();e.stopPropagation();return;}}
    if(mode==='edit'&&!editing&&window.RetouchActions?.shortcut(e)){cancelOpacityEntry();return;}
    if(groupNudgeShortcut(e)||vectorNudgeShortcut(e)||flipShortcut(e)||alignmentShortcut(e)||opacityShortcut(e)||visibilityShortcut(e)||canvasZoomShortcut(e)||lockShortcut(e)||layerNavigationShortcut(e)||canvasLayerShortcut(e))return;
    if (editing) {
      e.stopPropagation(); // typing stays native; app shortcuts stay out
      if(e.isComposing)return;
      if(e.key==='Backspace'&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!e.shiftKey&&(e.repeat&&editing.listMarkerBackspace||removeListMarker())){editing.listMarkerBackspace=true;e.preventDefault();return;}
      if(['Backspace','Delete'].includes(e.key)&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!e.shiftKey&&joinTextParagraph(e.key==='Backspace')){e.preventDefault();return;}
      if(e.key==='Enter'&&!e.shiftKey&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();if(!insertTextParagraph())toast('This text structure cannot create a paragraph yet.','err');return;}
      if(listIndentShortcut(e)||inlineListShortcut(e))return;
      if((e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='k'){e.preventDefault();editing.focusLink?.();return;}
      if(/^(Arrow|Home$|End$|PageUp$|PageDown$)/.test(e.key))breakTextHistoryGroup();
      if(e.key==='Enter'&&e.shiftKey){e.preventDefault();insertInlineBreak();return;}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&inlineHistoryCommand(e.shiftKey)){e.preventDefault();return;}
      if ((e.metaKey || e.ctrlKey) && ['b','i','u'].includes(e.key.toLowerCase())) {
        e.preventDefault(); // never let the browser's own rich-edit commands run (R-5)
        toggleWrap(e.key.toLowerCase()==='b'?'strong':e.key.toLowerCase()==='i'?'em':'u');
        return;
      }
      if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        commitInlineEdit();
      }
      return;
    }
    sourceHistoryShortcut(e,true);
  }, true);

  // Follow SPA navigations (OQ-B6 rule 2).
  try {
    const h = w.history;
    for (const m of ['pushState', 'replaceState']) {
      const orig = h[m].bind(h);
      h[m] = (...args) => { const r = orig(...args); setTimeout(onNavigated, 0); return r; };
    }
  } catch {}
}

function pollNavigation() {
  try {
    const loc = iframe.contentWindow.location;
    if (loc.origin !== location.origin) return;
    const p = loc.pathname + loc.search + loc.hash;
    if (p !== lastAppPath) onNavigated();
  } catch {}
}

function onNavigated() {
  try {
    const loc = iframe.contentWindow.location;
    if (loc.origin !== location.origin) return;
    const p = loc.pathname + loc.search + loc.hash;
    if(lastAppPath && lastAppPath!==p)clearSelection();
    lastAppPath = p;
    layers.refresh();
    pagePicker.value=loc.pathname;
    window.dispatchEvent(new CustomEvent('retouch:route'));
    routeInput.value = p;
    history.replaceState(null, '', '/rt' + (p === '/' ? '' : p));
  } catch {}
}

let pageListRequest=0;
async function refreshPages(){
  const request=++pageListRequest,result=await api('GET','/rt/__api/pages');
  if(request!==pageListRequest||!result?.ok)return;
  pagePickerLabel.hidden=!result.available;if(!result.available)return;
  const current=iframe.contentWindow.location.pathname;pagePicker.replaceChildren();
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose a page';pagePicker.append(placeholder);
  for(const page of result.pages){const option=document.createElement('option');option.value=page.url;option.textContent=page.path;pagePicker.append(option);}
  pagePicker.value=current;pagePicker.title=result.truncated?'Showing the first 1000 pages. Use Page URL for other pages.':'Choose a project page';
}
async function navigatePage(url){
  stopDrawing?.();
  if(panelTasks||undoBusy||sourceRequests)return;
  await commitInlineEdit();clearSelection();iframe.src=url||'/';
}
pagePicker.onchange=()=>{if(pagePicker.value)navigatePage(pagePicker.value);};
document.getElementById('refreshPages').onclick=refreshPages;

/* ---------- selection ---------- */
function idsOf(el) {
  return { hostId: el.getAttribute('data-rt'), instanceId: el.getAttribute('data-rt-i') };
}

function renderContext(el) {
  const attributes = node => Object.fromEntries([...node.attributes].filter(a=>a.name.startsWith('data-rt-')).map(a=>[a.name,a.value]));
  const ancestors = [];
  for (let node=el.parentElement;node&&ancestors.length<30;node=node.parentElement) ancestors.push(attributes(node));
  return {attributes:attributes(el),ancestors,tag:el.tagName.toLowerCase(),className:el.getAttribute('class')||'',src:el.getAttribute('src')};
}
function resolveUrl(id, context) {
  return '/rt/__api/resolve?id=' + id + (context ? '&context=' + encodeURIComponent(JSON.stringify(context)) : '');
}
function componentUrl(id,context) {return resolveUrl(id,context).replace('/resolve?','/component?');}
function sourcePayload(info, source=info.textSource) {
  return { context: info.context, sourceId: source?.id, sourceHash: source?.hash };
}
function updateSource(info, result) {
  info.hash = result.hash;
  if (info.textSource && result.sourceHash) info.textSource.hash = result.sourceHash;
}

// Classification pass: resolve a clicked DOM node to the nearest ancestor
// (itself first) that maps to source right now. A stamped id can fail to
// resolve — its file changed and its structural id shifted, or the DOM is a
// frame that has not reloaded yet — so we climb rather than error. Returns
// { el, info } or null. This is the single gate for what is selectable.
async function classify(node,sourceId) {
  const serial = ++classificationSerial,documentBefore=node?.ownerDocument;
  busyPanel(true);
  try {
    let result;
    if(sourceId&&[node?.getAttribute?.('data-rt'),node?.getAttribute?.('data-rt-i')].includes(sourceId)){
      const resolved=await api('GET',resolveUrl(sourceId,renderContext(node)));result=resolved?.ok?{el:node,info:resolved.element,...idsOf(node)}:null;
    }else result = await classifyNode(node,()=>serial===classificationSerial);
    return serial === classificationSerial && documentBefore===doc() && node?.isConnected ? result : { superseded: true };
  } finally {
    busyPanel(false);
  }
}
async function repositionImage(target,save,onPreview){
 stopDrawing?.();let cancelled=false;const info=sel?.info,scopeBefore=styleScope,canvas=document.getElementById('frameWrap'),current=()=>!cancelled&&styleScope===scopeBefore&&sel?.info===info&&mode==='edit'&&!editing&&!panelTasks&&!sourceRequests&&!undoBusy&&target.ownerDocument===doc()&&!document.querySelector('dialog[open]');if(!current())return;
 stopDrawing=()=>{cancelled=true;stopDrawing=null;};target.scrollIntoView({block:'center',inline:'center',behavior:'instant'});
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(!current())return;
 const f=iframe.getBoundingClientRect(),r=target.getBoundingClientRect(),c=canvas.getBoundingClientRect(),scale=f.width/iframe.clientWidth;canvas.scrollLeft+=f.left+(r.left+r.width/2)*scale-(c.left+canvas.clientWidth/2);canvas.scrollTop+=f.top+(r.top+r.height/2)*scale-(c.top+canvas.clientHeight/2);
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(!current())return;
 stopDrawing=RetouchImagePosition.mount({target,frame:iframe,canvas,current,onCommit:save,onPreview,onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});
}
function isStandaloneText(el, info) {
  if(!info || (info.text==null && !info.mixedText))return false;
  if(!/^(H[1-6]|P|SPAN|LABEL|BLOCKQUOTE|DIV)$/.test(el.tagName))return false;
  return !!el.textContent.trim() && [...el.querySelectorAll('*')].every(child=>
    /^(SPAN|STRONG|EM|B|I|U|S|DEL|BR|A|CODE|SMALL|SUB|SUP)$/.test(child.tagName));
}
async function classifyNode(node,current=()=>true) {
  const documentBefore=node?.ownerDocument,active=()=>current()&&documentBefore===doc()&&node?.isConnected;
  let el = node && node.closest ? node.closest('[data-rt], [data-rt-i]') : null;
  while (el) {
    if(!active())return null;
    const { hostId, instanceId } = idsOf(el);
    let inlineComponent=false;
    if(hostId && instanceId) {
      const host=await api('GET',resolveUrl(hostId,renderContext(el)));if(!active())return null;
      if(host?.ok && isStandaloneText(el,host.element)) {
        const usage=await api('GET',resolveUrl(instanceId,renderContext(el)));if(!active())return null;
        return {el,info:{...host.element,textLeaf:true},hostId,instanceId:usage?.element?.inlineComponent?null:instanceId};
      }
    }
    for (const id of [instanceId, hostId]) {
      if (!id || !/^[0-9a-f]{10}$/.test(id)) continue;
      if(!active())return null;
      const res = await api('GET', resolveUrl(id, renderContext(el)));if(!active())return null;
      if(res?.ok && res.element.inlineComponent&&!componentLibrarySelections.has(id)){inlineComponent=true;continue;}
      if (res && res.ok) return { el, info: res.element, hostId, instanceId:inlineComponent?null:instanceId };
    }
    el = el.parentElement ? el.parentElement.closest('[data-rt], [data-rt-i]') : null;
  }
  return null;
}

function captureInspectorSelectionTarget(el,sourceId){
  if(!el)return ()=>null;
  const id=sourceId||el.getAttribute('data-rt-i')||el.getAttribute('data-rt'),context=renderContext(el),occurrence=matchingInDocument(el.ownerDocument,id,{context}).indexOf(el);
  return ()=>el.isConnected&&el.ownerDocument===doc()?el:occurrence>=0?matchingInDocument(doc(),id,{context})[occurrence]:null;
}
async function select(node,{toggle=false,sourceId,current=()=>true}={}) {
  stopDrawing?.();
  if(!sourceId&&node?.closest?.('[data-rt-boolean-result]'))node=node.closest('[data-rt-boolean]');
  const componentToggle=toggle&&sel?.info.kind==='instance';
  if(componentToggle&&!sourceId){
    const root=node?.closest?.('[data-rt-i]');
    if(!root||layerLocks.locked(root))return toast('Choose an unlocked component to add to this selection.','err');
    node=root;sourceId=root.getAttribute('data-rt-i');
  }
  const c = await classify(node,sourceId);
  if (!current()||c?.superseded) return;
  if (!c) return componentToggle?toast('This component is no longer available. Select it again.','err'):clearSelection();
  if(componentToggle&&(c.info.kind!=='instance'||c.info.file!==sel?.info.file||c.info.hash!==sel?.info.hash))return toast('Select components from one unchanged source file.','err');
  if(toggle&&(c.info.cssAuthoring&&sel?.info.cssAuthoring||c.info.classSelection&&sel?.info.classSelection||c.info.contextSelection&&sel?.info.contextSelection||c.info.kind==='instance'&&sel?.info.kind==='instance')&&c.info.file===sel.info.file&&c.info.hash===sel.info.hash){
    let multiple=sel.multiple||[sel.info];multiple=multiple.some(info=>info.id===c.info.id)?multiple.filter(info=>info.id!==c.info.id):[...multiple,c.info];
    if(!multiple.length)return clearSelection();if(multiple.length>100)return toast('Select up to 100 layers.','err');
    const primary=multiple.find(info=>info.id===c.info.id)||multiple[0];sel={hostId:primary.id,instanceId:primary.kind==='instance'?primary.id:null,scope:primary.kind==='instance'?'instance':'host',info:primary,multiple:multiple.length>1?multiple:undefined};renderPanel();return;
  }
  renderedSelection={id:c.info.id,element:c.el};
  sel = {
    hostId: c.hostId,
    instanceId: c.instanceId,
    scope: c.instanceId && c.info.id === c.instanceId ? 'instance' : 'host',
    info: c.info,
  };
  renderPanel();
}

let comparisonSelectionSerial=0;
window.addEventListener('retouch:comparison-edit',async event=>{
  const detail=event.detail||{},serial=++comparisonSelectionSerial,selectionSerial=++inspectorSelectionSerial;
  const contextOpener=document.activeElement;
  if(detail.contextMenu&&(!Number.isFinite(detail.contextMenu.x)||!Number.isFinite(detail.contextMenu.y)))return;
  if(inspectorTextCommit)await inspectorTextCommit;
  if(inlineTextCommit)await inlineTextCommit;
  if(serial!==comparisonSelectionSerial||selectionSerial!==inspectorSelectionSerial)return;
  if(panelTasks||undoBusy||sourceRequests||!['width','height'].every(key=>Number.isInteger(detail[key])&&detail[key]>=240&&detail[key]<=7680))return;
  const validId=id=>id===null||id===undefined||/^[a-f0-9]{10}$/.test(id);
  if(!validId(detail.hostId)||!validId(detail.instanceId)||!Number.isInteger(detail.occurrence)||detail.occurrence<0||detail.occurrence>10000)return;
  if(detail.textEdit!==undefined&&typeof detail.textEdit!=='boolean'||detail.textPoint&&(!detail.textEdit||!['x','y'].every(key=>Number.isFinite(detail.textPoint[key])&&detail.textPoint[key]>=0&&detail.textPoint[key]<=1)))return;
  const group=detail.selection;if(detail.component!==undefined&&typeof detail.component!=='boolean')return;
  if(group!==undefined&&(!Array.isArray(group)||group.length>100||group.some(item=>!item||!item.hostId||!validId(item.hostId)||!validId(item.instanceId)||!Number.isInteger(item.occurrence)||item.occurrence<0||item.occurrence>10000)))return;
  await commitInlineEdit();if(serial!==comparisonSelectionSerial)return;
  const sameRoute=()=>{try{const loc=iframe.contentWindow.location;return loc.pathname+loc.search+loc.hash===detail.route;}catch{return false;}};
  if(!sameRoute())return toast('The page changed. Select the layer in the refreshed comparison.','err');
  if(mode!=='edit')modeBtn.click();
  window.RetouchScreens.set({width:detail.width,height:detail.height});
  const applyScope=()=>{
    if(!detail.scopeAtWidth)return;
    if(!sel)return toast('Select a layer before choosing its style scope.','err');
    styleScope=(sel.info.cssAuthoring||sel.info.groupScale||sel.info.scaleMember)?`min-[${detail.width}px]:`:RetouchResponsive.atWidth(doc(),detail.width).prefix;renderPanel();
  };
  const openContext=()=>{if(detail.contextMenu&&serial===comparisonSelectionSerial&&sameRoute()&&contextOpener?.isConnected&&sel)window.RetouchActions?.contextMenu({...detail.contextMenu,opener:contextOpener});};
  if(group?.length===0){if(!detail.append)clearSelection();return;}
  if(!group&&!detail.hostId&&!detail.instanceId&&!detail.scopeAtWidth)return;
  const classification=classificationSerial;let viewportReady=false;
  for(let attempt=0;attempt<60;attempt++){
    await new Promise(resolve=>setTimeout(resolve,50));
    if(serial!==comparisonSelectionSerial||classification!==classificationSerial||!sameRoute())return;
    if(iframe.contentWindow.innerWidth!==detail.width||iframe.contentWindow.innerHeight!==detail.height)continue;
    viewportReady=true;
    if(!group&&!detail.hostId&&!detail.instanceId){applyScope();return;}
    if(group){
      const nodes=[...doc().querySelectorAll('[data-rt],[data-rt-i]')],targets=group.map(item=>nodes.filter(el=>el.getAttribute('data-rt')===item.hostId&&el.getAttribute('data-rt-i')===item.instanceId)[item.occurrence]);
      if(targets.some(target=>!target))continue;
      if(targets.some(target=>layerLocks.locked(target)))return toast('A selected layer is now locked. Select the group again.','err');
      await selectMany(targets,{append:detail.append===true,component:detail.component===true});if(serial===comparisonSelectionSerial&&sameRoute())applyScope();return;
    }
    const matches=[...doc().querySelectorAll('[data-rt],[data-rt-i]')].filter(el=>el.getAttribute('data-rt')===detail.hostId&&el.getAttribute('data-rt-i')===detail.instanceId),target=matches[detail.occurrence];
    if(!target)continue;
    if(layerLocks.locked(target))return toast('This layer is locked. Select it in Layers to edit.','err');
    if(detail.textEdit){
      target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});const box=target.getBoundingClientRect(),point=detail.textPoint?{clientX:box.left+detail.textPoint.x*box.width,clientY:box.top+detail.textPoint.y*box.height}:null;
      await startInlineEdit(target,point,false);
      if(serial===comparisonSelectionSerial&&sameRoute()&&editing?.el?.contains(target)&&!point){const range=doc().createRange();range.selectNodeContents(editing.el);doc().getSelection().removeAllRanges();doc().getSelection().addRange(range);}
      return;
    }
    if(detail.contextMenu&&sel?.multiple?.some(info=>matchingInDocument(doc(),info.id,info).includes(target))){renderPanel();openContext();return;}
    await select(target,{toggle:detail.toggle===true});if(serial!==comparisonSelectionSerial||classificationSerial!==classification+1)return;applyScope();target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});openContext();return;
  }
  toast(viewportReady?'This layer is not present on the main canvas at this size.':'This comparison size did not become ready. Try selecting it again.','err');
});

function componentMarqueeTargets(d,rect,library){
  const candidates=[],byUsage=new Map();
  for(const el of d.querySelectorAll('[data-rt-i]')){const id=el.getAttribute('data-rt-i');if(!byUsage.has(id))byUsage.set(id,[]);byUsage.get(id).push(el);}
  for(const component of library.components||[])for(const usage of component.usages||[]){
   const roots=byUsage.get(usage.id)||[];
   for(const group of RetouchComponentInstances.group(roots,component.rootGroups)){
    if(!group.complete||!group.elements.every(el=>!layerLocks.locked(el)&&!['hidden','collapse'].includes(d.defaultView.getComputedStyle(el).visibility)&&RetouchMarquee.enclosed(rect,el.getBoundingClientRect())))continue;
    candidates.push(group);
   }
  }
  return candidates.filter(group=>!candidates.some(parent=>parent!==group&&parent.elements.some(root=>root!==group.element&&root.contains(group.element)))).map(group=>group.element);
}
function textMarqueeTargets(nodes,rect){
 return [...new Set(nodes.map(node=>groupSelectionTarget(layers.textOwner(node))).filter(Boolean))].filter(node=>{if(layerLocks.locked(node))return false;const b=node.hasAttribute('data-rt-group')?RetouchComponentInstances.bounds([node]):node.getBoundingClientRect();return b&&RetouchMarquee.enclosed(rect,{...b,left:b.left,top:b.top,width:b.width,height:b.height,right:b.left+b.width,bottom:b.top+b.height});});
}
async function resolveMarqueeTargets(d,nodes,rect){
 if(sel?.info.kind!=='instance')return {nodes:textMarqueeTargets(nodes,rect),component:false};
 const selection=sel,serial=classificationSerial;
 const library=await api('GET','/rt/__api/components');
 if(sel!==selection||serial!==classificationSerial||d.defaultView?.document!==d)return null;
 if(!library?.ok)throw Error('Could not resolve components for this selection.');
 return {nodes:componentMarqueeTargets(d,rect,library),component:true};
}

async function selectMarquee(d,nodes,options){
 if(sel?.info.kind!=='instance')return selectMany(textMarqueeTargets(nodes,options.rect),options);
 const serial=++classificationSerial,selection=sel;busyPanel(true);
 try{
  const library=await api('GET','/rt/__api/components');
  if(serial!==classificationSerial||sel!==selection||doc()!==d)return;
  if(!library?.ok)return toast('Could not resolve components for this selection.','err');
  const targets=componentMarqueeTargets(d,options.rect,library);
  await selectMany(targets,{append:options.append,component:true});
 }catch(error){toast(error.message||'Could not select these components.','err');}finally{busyPanel(false);}
}

async function selectMany(nodes,{active=nodes[0],append=false,component=false}={}){
  stopDrawing?.();
  const serial=++classificationSerial;
  const attribute=component?'data-rt-i':'data-rt';
  const ids=[...new Set([...(append?(sel?.multiple||[sel?.info]).filter(Boolean).map(info=>info.id):[]),...nodes.map(node=>node.getAttribute(attribute))])];
  if(!ids.length)return clearSelection();if(ids.length>100)return toast('Select up to 100 layers. Narrow the layer search first.','err');
  busyPanel(true);
  try{
    const results=await Promise.all(ids.map(id=>{const element=matchingEls(id)[0];return api('GET',resolveUrl(id,element?renderContext(element):undefined));}));if(serial!==classificationSerial)return;
    if(nodes.some(node=>!node.isConnected)||results.some(result=>!result?.ok||!(component?result.element.kind==='instance':result.element.cssAuthoring||result.element.classSelection||result.element.collectionSelection)))return toast('These layers cannot be selected together.','err');
    const infos=results.map(result=>result.element),first=infos[0];
    if(infos.some(info=>info.file!==first.file||info.hash!==first.hash))return toast('Select layers from one unchanged source file.','err');
    const primary=infos.find(info=>info.id===active?.getAttribute(attribute))||first;
    if(component)for(const info of infos)componentLibrarySelections.add(info.id);
    sel={hostId:primary.id,instanceId:component?primary.id:null,scope:component?'instance':'host',info:primary,multiple:infos.length>1?infos:undefined};renderPanel();
  }finally{busyPanel(false);}
}

function activeId() {
  if (!sel) return null;
  return sel.scope === 'instance' ? (sel.instanceId || sel.hostId) : (sel.hostId || sel.instanceId);
}

async function loadScope() {
  const id = activeId();
  if (!id) return clearSelection();
  const res = await api('GET', resolveUrl(id, sel?.info?.context));
  if (!res || !res.ok) return clearSelection();
  sel.info = res.element;
  renderPanel();
}

function clearSelection() {
  vectorEntrySerial++;pendingVectorEntry=null;
  stopDrawing?.();
  classificationSerial++;sel = null;renderedSelection=null;renderedPanelSelection=null;
  window.dispatchEvent(new CustomEvent('retouch:selection',{detail:null}));
  panelBody.hidden = true;
  panelEmpty.hidden = false;
}

/* ---------- inline text editing ---------- */
async function startInlineEdit(node, evt, quiet, openVector=false) {
  const vectorRequest=openVector?++vectorEntrySerial:null;
  const c = await classify(node);
  if(openVector&&vectorRequest!==vectorEntrySerial)return;
  if (c?.superseded) return;
  if (!c) return clearSelection(); // nothing editable here — no error
  const { el, info } = c;
  // Plain range wrappers are text runs inside their parent text layer.
  const textParent=info.textRangeStyle&&!c.instanceId&&el.parentElement?.closest('[data-rt]');
  if(textParent&&/^(H[1-6]|P|SPAN|DIV|LABEL|BLOCKQUOTE|A|BUTTON)$/.test(textParent.tagName)){
    const serial=classificationSerial,parent=await api('GET',resolveUrl(textParent.getAttribute('data-rt'),renderContext(textParent)));
    if(serial!==classificationSerial)return;
    if(parent?.ok&&parent.element.file===info.file&&parent.element.hash===info.hash)return startInlineEdit(textParent,evt,quiet,openVector);
  }
  renderedSelection={id:c.info.id,element:c.el};
  sel = {
    hostId: c.hostId,
    instanceId: c.instanceId,
    scope: c.instanceId && info.id === c.instanceId ? 'instance' : 'host',
    info,
  };
  if(el.hasAttribute('data-rt-group')){renderPanel();return;}
  if(info.svgBooleanOwner){
    if(openVector&&info.svgBooleanGroup){
      RetouchSVGBooleanGroup.revealOriginals(info);renderPanel();
      const operandId=RetouchSVGBooleanGroup.operandAtPoint(el,evt?.clientX,evt?.clientY,target=>!layerLocks.locked(target));
      if(operandId){const serial=classificationSerial,meta=info.svgBooleanGroup,ids=[meta.baseId,...meta.operandIds.filter(id=>id!==meta.baseId)],responses=await Promise.all(ids.map(id=>api('GET',resolveUrl(id))));
        if(serial!==classificationSerial||vectorRequest!==vectorEntrySerial||mode!=='edit'||sel?.info.id!==info.id||sel.info.hash!==info.hash)return;
        if(responses.some(r=>!r?.ok||r.element.hash!==info.hash))return toast('The original shapes changed. Re-select the group.','err');
        const infos=responses.map(r=>r.element),operand=infos.find(item=>item.id===operandId);if(operand)editBooleanOperandOnCanvas(info,operand,infos,'move');
      }
    }else renderPanel();return;
  }
  if(openVector&&editableVectorField(info)){renderPanel();pendingVectorEntry={info,serial:classificationSerial};openPendingVectorEntry();return;}
  // Only literal or rich text can be edited in place; otherwise just select.
  if (info.text === null && !info.mixedText) {
    renderPanel();
    if (!quiet && info.textDynamic) {
      toast('The text of this element is dynamic; it cannot be edited in place (R-6).', 'err');
    }
    return;
  }
  if (info.textSource && info.textSource.format !== 'text' && !info.richText) { renderPanel(); return; }
  if(info.text===''&&!['h1','h2','h3','h4','h5','h6','p','span','blockquote','label','a','button'].includes(el.tagName.toLowerCase())){renderPanel();return;}
  const editId = info.id;
  renderPanel(true);
  const originalHTML=el.innerHTML;
  if (info.richText) {
    try { RetouchRichTextSource.prepare(el,info.richText); }
    catch(err) { toast(err.message,'err');return; }
  }
  editing = {
    el,
    id: editId,
    info,
    original: el.textContent,
    originalHTML,
    snapshot: new Map(),
    originalTree: null,
  };
  for (const c of el.querySelectorAll('[data-rt], [data-rt-i], [data-rt-keep]')) {
    const rangeStyle=info.rangeStyleIds?.[c.getAttribute('data-rt')];
    if(rangeStyle){c.__rtRangeStyleValues={};for(const [property,value]of Object.entries(rangeStyle.properties||{[rangeStyle.property]:rangeStyle.value})){const probe=el.ownerDocument.createElement('span');probe.style.setProperty(property,value);const css=probe.style.getPropertyValue(property);if(c.style.getPropertyValue(property)===css){c.__rtRangeStyleValues[property]={value,css};if(property==='color'){c.__rtRangeStyleValue=value;c.__rtRangeStyleCSS=css;}}}}

    const cid = c.getAttribute('data-rt-keep') || c.getAttribute('data-rt') || c.getAttribute('data-rt-i');
    if (cid) editing.snapshot.set(cid, {html:c.innerHTML,listInset:c.style.paddingInlineStart,marker:c.style.listStyleType,start:c.getAttribute('start'),listSpacing:c.getAttribute('data-retouch-list-spacing'),tag:c.tagName.toLowerCase(),href:c.tagName==='A'?c.getAttribute('href'):undefined});
  }
  editing.originalTree = serializeChildren(el, editing.snapshot);
  // plaintext-only forces pre-wrap in Chromium even over author !important
  // styles, exposing template indentation. Keep native layout; paste is plain
  // text through the frame hook below.
  editing.historyBaselineHTML=el.innerHTML;
  el.setAttribute('contenteditable', 'true');
  syncHistoryControls();
  el.focus();
  showInlineFormatToolbar();
  try {
    const d = doc();
    const range = evt && d.caretRangeFromPoint(evt.clientX, evt.clientY);
    if (range) {
      const s = d.getSelection();
      s.removeAllRanges();
      s.addRange(range);
    }
  } catch {}
}

function commitInlineEdit() {
  // Focusout and comparison click/double-click can all request the same save.
  // Retain its promise after editing is cleared so later intents wait for it.
  if(inlineTextCommit)return inlineTextCommit;
  if(!editing)return Promise.resolve();
  const task=Promise.resolve().then(persistInlineEdit).finally(()=>{if(inlineTextCommit===task)inlineTextCommit=null;});
  inlineTextCommit=task;return task;
}

async function persistInlineEdit() {
  if (!editing) return;
  const ed = editing;
  normalizeCaretPlaceholders(ed);
  inlineFormatCleanup();editing = null;syncHistoryControls();
  ed.el.removeAttribute('contenteditable');
  const children = serializeChildren(ed.el, ed.snapshot);
  if (JSON.stringify(children) === JSON.stringify(ed.originalTree)) { if(ed.info.richText)ed.el.innerHTML=ed.originalHTML;return; }

  // A pure-text element with a pure-text result uses setText (smaller diff).
  // An element whose SOURCE has mixed children must use setChildren even when
  // the edited result is now all text (e.g. the user deleted a styled span),
  // because setText only rewrites a literal-text-only children range.
  let op;
  if (!ed.info.mixedText && children.every((c) => c.t === 'text')) {
    op = { type: 'setText', id: ed.id, text: children.map((c) => c.value).join(''), fileHash: ed.info.hash };
    if(ed.info.textSource?.format==='text')op.text=RetouchRichTextSource.storedText(op.text,ed.original,ed.info.text);
  } else {
    op = { type: 'setChildren', id: ed.id, children, fileHash: ed.info.hash };
  }
  // Structural edits change child node identities that the app framework
  // tracks by reference. Letting React (dev Fast Refresh) reconcile against
  // our hand-mutated DOM crashes its committer (removeChild NotFoundError),
  // so a structural commit reloads the frame after the write: React remounts
  // clean from the new source. Text-only commits keep the smooth HMR path.
  const structural = op.type === 'setChildren',expectedFormatting=structural?JSON.stringify(serializeChildren(ed.el)):null;
  Object.assign(op, sourcePayload(ed.info));
  // Keep editing disabled until the structural write has mounted its new DOM.
  if(structural)busyPanel(true);
  try {
    const res = await api('POST', '/rt/__api/op', op);
    if (res && res.ok) {
      editorHistory.record(op.type === 'setText'
        ? { type: 'setText', id: ed.id, text: ed.info.textSource ? ed.info.text : ed.original, undoId: res.undoId, context: ed.info.context, sourceId: ed.info.textSource?.id }
        : { type: 'setChildren', id: ed.id, children: ed.originalTree, undoId: res.undoId, context: ed.info.context });
      updateSource(ed.info, res);
      if (op.type === 'setText') {
        ed.info.text = op.text;
        for (const m of (ed.info.textSource ? [] : matchingEls(ed.id))) if (m !== ed.el) m.textContent = op.text;
      }
      if (structural) {
        await reloadFrame();
        await refreshWrittenElement(ed.info,el=>JSON.stringify(serializeChildren(el))===expectedFormatting);
      } else if (window.__RT_RENDERING?.reloadAfterWrite) await reloadFrame();
      else if (sel && sel.info && sel.info.id === ed.id) {
        sel.info.hash = res.hash;
        renderPanel();
      }
      if(op.type==='setText')await window.RetouchComparisons?.syncText(ed.info);
      toast('Saved', 'ok');
    } else {
      ed.el.innerHTML = ed.originalHTML;
      toast((res && res.reason) || (res && res.error) || 'Write failed', 'err');
    }
  } finally { if(structural)busyPanel(false); }
}

// Reload the iframe to its current path, preserving scroll where possible.
function clientMountReady(d){return !!d?.body&&[...d.querySelectorAll('[data-rt-client-revision]')].every(el=>el.getAttribute('data-rt-client-mounted')===el.getAttribute('data-rt-client-revision'));}
async function waitForClientMount(d){for(let attempt=0;attempt<80;attempt++){if(d!==doc())return false;if(clientMountReady(d))return true;await new Promise(resolve=>setTimeout(resolve,50));}return false;}
window.RetouchClientMount={ready:clientMountReady};
// A committed gradient gesture can retain its re-entry token through its own
// refresh. Live preview tools and unrelated navigations still cancel normally.
function reloadFrame({keepDrawing=null,expectedTag=null}={}) {
  if(stopDrawing!==keepDrawing)stopDrawing?.();
  const preserved=keepDrawing?{cancel:keepDrawing,route:iframe.contentWindow?.location.href}:null;frameRefreshDrawing=preserved;
  const selectionBefore=sel,anchorBefore=renderedSelection,routeBefore=iframe.contentWindow?.location.href;
  const bookmark=sel&&!sel.multiple&&renderedSelection?.id===activeId()?RetouchComponentInstances.captureOccurrence(matchingInDocument(doc(),activeId(),sel.info),renderedSelection.element,expectedTag):null;
  return new Promise(resolve => {
    classificationSerial++;
    inlineFormatCleanup();editing = null;
    hoverEl = null;
    const y = iframe.contentWindow?.scrollY || 0;
    let timeout, finished = false;
    const done = async () => {
      if (finished) return;
      finished = true;
      if(frameRefreshDrawing===preserved)frameRefreshDrawing=null;
      clearTimeout(timeout); iframe.removeEventListener('load', done);
      // Development renderers can retain a stylesheet URL after recompiling
      // its contents. Revalidate local CSS after a source write, even if the
      // host application's asset cache treats that URL as immutable.
      const revision = Date.now().toString(36);
      try {
        await Promise.all([...(window.__RT_RENDERING?.revalidateStyles ? iframe.contentDocument.querySelectorAll('link[rel="stylesheet"]') : [])].map(link => {
          const url = new URL(link.href);
          if (url.origin !== location.origin) return;
          return new Promise(ready => {
            let timer;
            const complete = () => { clearTimeout(timer); link.removeEventListener('load',complete); link.removeEventListener('error',complete); ready(); };
            link.addEventListener('load',complete); link.addEventListener('error',complete);
            timer = setTimeout(complete,4000);
            url.searchParams.set('__rt_revision',revision); link.href = url.href;
          });
        }));
      } catch {}
      await waitForClientMount(doc());
      try {
        if(bookmark)await layers.refresh();
        if(bookmark&&sel===selectionBefore&&renderedSelection===anchorBefore&&iframe.contentWindow.location.href===routeBefore){
          const target=RetouchComponentInstances.restoreOccurrence(matchingInDocument(doc(),activeId(),sel.info),bookmark);
          if(target){renderedSelection={id:activeId(),element:target};renderPanel();}
          else {clearSelection();toast('The page structure changed. Select the layer again.');}
        }
        iframe.contentWindow.scrollTo({left:0,top:y,behavior:'instant'});
      } catch {}
      resolve();
    };
    iframe.addEventListener('load', done);
    timeout = setTimeout(done, 8000);
    try { iframe.contentWindow.location.reload(); } catch { iframe.src = iframe.src; }
  });
}

// A source write can finish before the framework invalidates its rendered
// module. Wait for that revision, retaining the live session when HMR applies it.
// Reload only when the renderer cannot confirm a matching live update.
async function refreshWrittenElement(info, matches, {verifyText=false,keepDrawing=null,expectedTag=null,svgGeometry=false,imageSource=false,classSource=false}={}) {
  if(classSource&&info.renderRevisionAttribute){await refreshWrittenElement(info,matches,{keepDrawing,expectedTag});const result=await window.RetouchComparisons?.syncSource({select:d=>matchingInDocument(d,info.id,info),matches,revisionAttribute:info.renderRevisionAttribute,hash:info.hash});if(result?.failures.length)throw Error('Retry the failed comparison previews.');return;}

  if(imageSource&&/\.(?:html?|liquid)$/i.test(info.file)&&matchingEls(info.id).length&&matchingEls(info.id).every(el=>el.tagName==='IMG')){const select=d=>matchingInDocument(d,info.id,info);await RetouchRenderSync.sync({frame:iframe,serverRendered:true,select,matches});const comparisons=await window.RetouchComparisons?.syncImage({select,matches});if(comparisons?.failures.length)toast('Image saved. Retry the failed comparison previews.','err');return;}
  if(imageSource){await refreshWrittenElement(info,matches);const comparisons=await window.RetouchComparisons?.syncImage({select:d=>matchingInDocument(d,info.id,info),matches,serverRendered:false,revisionAttribute:info.renderRevisionAttribute,hash:info.hash});if(comparisons?.failures.length)toast('Image saved. Retry the failed comparison previews.','err');return;}
  const geometrySelection=[...new Map([info,...(sel?.multiple||[])].map(item=>[item.id,item])).values()];
  if(svgGeometry&&/\.(?:html?|liquid)$/i.test(info.file)&&geometrySelection.every(item=>{const elements=matchingEls(item.id);return elements.length>0&&elements.every(el=>el.namespaceURI==='http://www.w3.org/2000/svg');})){
    await RetouchRenderSync.sync({frame:iframe,serverRendered:true,select:d=>{
      const selected=geometrySelection.flatMap(item=>matchingInDocument(d,item.id,item));
      // Reconcile all edited roots once; descendants follow their selected parent.
      return selected.filter(el=>!selected.some(parent=>parent!==el&&parent.contains(el)));
    },matches});return;
  }
  const location = iframe.contentWindow.location.href,initialDocument=iframe.contentDocument;
  const current=()=>iframe.contentDocument===initialDocument&&iframe.contentWindow.location.href===location;
  async function liveUpdateReady(expectedText=null){
    // Only compiler-stamped revisions can prove the live page reflects this write.
    if(!info.renderRevisionAttribute)return false;
    // A fresh server response can precede delivery of the browser hot update.
    // Use the same bounded window as RetouchRenderSync before falling back.
    let stable=0;const deadline=performance.now()+8000;
    while(performance.now()<deadline){
      if(!current())return false;
      try{
        const d=doc(),el=matchingInDocument(d,info.id,info)[0];
        const stylesReady=[...d.querySelectorAll('link[rel="stylesheet"]')].every(link=>link.disabled||!!link.sheet);
        const ready=el&&el.getAttribute(info.renderRevisionAttribute)===info.hash&&matches(el)&&(expectedText===null||el.textContent===expectedText)&&stylesReady&&clientMountReady(d);
        stable=ready?stable+1:0;
        if(stable>=3)return true;
      }catch{stable=0;}
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    return false;
  }
  // The running framework can confirm an edit without a concurrent server render.
  // Avoid forcing render requests while its development compiler is rebuilding.
  if(!verifyText&&await liveUpdateReady())return;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!current()) return;
    try {
      const response = await fetch(location, { cache: 'no-store' });
      if (response.ok) {
        const html = new DOMParser().parseFromString(await response.text(), 'text/html');
        const el = matchingInDocument(html,info.id,info)[0];
        if (el && (!info.renderRevisionAttribute||el.getAttribute(info.renderRevisionAttribute)===info.hash) && matches(el)) {
          // Use rendered text so JSX whitespace and HTML entities match the browser.
          if(await liveUpdateReady(verifyText?el.textContent:null))return;
          if(current())await reloadFrame({keepDrawing,expectedTag});
          return;
        }
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  // A stale server render must not discard a live compiler-confirmed update.
  // Text edits still require the server-rendered whitespace/entity comparison.
  if(!verifyText&&await liveUpdateReady())return;
  if(current())await reloadFrame({keepDrawing,expectedTag});
}

// DOM -> op children tree. Implemented in serialize.js (loaded first) so it
// can be unit-tested in Node against a fake DOM.
const serializeChildren = window.RetouchSerialize.serializeChildren;

async function applyChildren(id, children) {
  const r = await api('GET', '/rt/__api/resolve?id=' + id);
  if (!r || !r.ok) return toast('Cannot resolve the element for undo', 'err');
  const res = await api('POST', '/rt/__api/op', { type: 'setChildren', id, children, fileHash: r.element.hash });
  if (res && res.ok) toast('Saved', 'ok');
  else toast((res && res.reason) || (res && res.error) || 'Undo failed', 'err');
}

function inlineTextUIFocused(){
  const active=document.activeElement;
  return !!(['toggleInspector','toggleLayers','undoBtn','redoBtn'].includes(active?.id)||active?.closest('.inline-format-toolbar')||[...document.querySelectorAll('dialog.paint-picker')].some(dialog=>dialog.retouchSourceInput?.closest('.inline-format-toolbar')));
}

// Preserve original nodes and source metadata while previewing selected text.
function previewInlineStyle(current,range,property){
  if(range.collapsed)return {get valid(){return editing===current&&current.el.isConnected;},update(){},restore(){}};
  const root=current.el,d=root.ownerDocument,runs=[],parents=new Map(),walker=d.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode;if(!range.intersectsNode(node))continue;
    const from=node===range.startContainer?range.startOffset:0,to=node===range.endContainer?range.endOffset:node.length;
    if(from<to)runs.push({node,from,to});
  }
  if(!runs.length||runs.some(({node})=>node.parentElement.closest('[contenteditable="false"]')))return null;
  for(const {node}of runs){const parent=node.parentNode;if(!parents.has(parent))parents.set(parent,[...parent.childNodes].map(child=>({child,text:child.nodeType===3?child.data:null})));}
  const wrappers=[];
  for(const {node,from,to}of runs){const part=d.createRange(),span=d.createElement('span');part.setStart(node,from);part.setEnd(node,to);part.surroundContents(span);wrappers.push(span);}
  let expected=root.innerHTML,restored=false,valid=true;
  const currentRoot=()=>editing===current&&doc()===d&&root.isConnected;
  return {
    get valid(){return valid&&currentRoot();},
    update(value){if(restored)return;if(!currentRoot()||root.innerHTML!==expected){valid=false;return;}for(const span of wrappers)span.style.setProperty(property,value);expected=root.innerHTML;},
    restore(){
      if(restored)return;restored=true;
      if(!currentRoot()){valid=false;return;}
      if(root.innerHTML!==expected){valid=false;for(const span of wrappers)if(root.contains(span))span.replaceWith(...span.childNodes);return;}
      for(const [parent,children]of parents){for(const {child,text}of children)if(text!==null)child.data=text;parent.replaceChildren(...children.map(({child})=>child));}
    }
  };
}

function inlineRangeAt(root,start,end){
  const d=root.ownerDocument,walker=d.createTreeWalker(root,NodeFilter.SHOW_TEXT),range=d.createRange();let offset=0,started=false;
  while(walker.nextNode()){const node=walker.currentNode,next=offset+node.length;if(!started&&start<next){range.setStart(node,start-offset);started=true;}if(started&&end<=next){range.setEnd(node,end-offset);return range;}offset=next;}
  if(start===end&&start===offset){range.selectNodeContents(root);range.collapse(false);return range;}
  return null;
}

// Cursor styles are editor state until text is inserted. No placeholder text or
// empty source wrapper is needed, and moving the cursor drops the draft.
function sameCaret(a,b){return !!(a?.collapsed&&b?.collapsed&&a.startContainer===b.startContainer&&a.startOffset===b.startOffset);}
function caretDraft(){
  const d=doc(),selection=d?.getSelection(),range=selection?.rangeCount?selection.getRangeAt(0):null;
  if(!editing||!range||!sameCaret(range,editing.caretStyle?.range)||!editing.el.contains(range.startContainer))return null;
  const parent=range.startContainer.nodeType===3?range.startContainer.parentElement:range.startContainer;
  if(parent.closest('[contenteditable="false"]'))return null;
  return {current:editing,selection,range,properties:{...editing.caretStyle.properties},script:editing.caretStyle.script,decorations:{...editing.caretStyle.decorations}};
}
function styleInsertedText(current,start,end,properties,script,decorations={}){
  // Typing, composition, and paste own their history transaction. Their style
  // normalization must not create additional formatting-only undo steps.
  const batch=current.caretHistoryBatch;current.caretHistoryBatch=true;
  try{return styleInsertedTextContent(current,start,end,properties,script,decorations);}
  finally{current.caretHistoryBatch=batch;}
}
function styleInsertedTextContent(current,start,end,properties,script,decorations={}){
  if(editing!==current||!current.el.isConnected)return;
  const d=current.el.ownerDocument,range=inlineRangeAt(current.el,start,end),selection=d.getSelection();if(!range)return;
  selection.removeAllRanges();selection.addRange(range);
  if(start!==end){
    const parent=range.startContainer.nodeType===3?range.startContainer.parentElement:range.startContainer,previous=parent.closest('sup,sub'),inherited=previous&&previous!==current.el&&current.el.contains(previous)?previous.tagName.toLowerCase():null,desired=script===undefined?inherited:script;
    const sameProperties=element=>!!element&&Object.entries(properties).every(([name,value])=>{const probe=d.createElement('span');probe.style.setProperty(name,value);return element.style.getPropertyValue(name)===probe.style.getPropertyValue(name);});
    if(inherited&&script===undefined&&!plainInlineFormatting(previous)){
      // Typography-only edits can retain an authored script wrapper intact.
      // Reconstructing it would unnecessarily discard attributes or identity.
      for(const [property,value]of Object.entries(properties))applyTextRangeStyle(property,value);
    }else if(!(inherited===desired&&inherited&&sameProperties(previous.parentElement))){
      if(inherited&&!toggleWrap(inherited)){current.caretStyle=null;return;}
      for(const [property,value]of Object.entries(properties))applyTextRangeStyle(property,value);
      if(desired&&desired!=='normal')toggleWrap(desired);
    }
  }
  if(start!==end)for(const [tag,enabled]of Object.entries(decorations)){const active=inlineRangeAt(current.el,start,end);if(!active){current.caretStyle=null;return;}selection.removeAllRanges();selection.addRange(active);const parent=active.startContainer.nodeType===3?active.startContainer.parentElement:active.startContainer,ancestor=parent.closest(tag);if((enabled&&!ancestor||!enabled&&ancestor)&&!toggleWrap(tag)){current.caretStyle=null;return;}}
  const caret=selection.getRangeAt(0).cloneRange();caret.collapse(false);selection.removeAllRanges();selection.addRange(caret);
  current.caretStyle={properties,script,decorations,range:caret.cloneRange()};
  d.dispatchEvent(new Event('selectionchange'));
}
// Keep the actual nodes (and their source evidence) so restoring a local
// insertion does not invalidate preceding native text undo transactions.
const caretMetadataNames=['__rtListInset','__rtParagraphSpacing','__rtListStart','__rtParagraphInline','__rtSourceCopy','__rtListMarker','__rtListTemplate','__rtBlockTag','__rtLinkHref','__rtCaretPlaceholder','__rtKeep','__rtRangeStyle','__rtRangeStyleCSS','__rtRangeStyleValue','__rtRangeStyleValues','__rtReplaceRangeStyle'];
function captureCaretEdit(current){
  const d=current.el.ownerDocument,selection=d.getSelection(),range=selection?.rangeCount?selection.getRangeAt(0):null;
  const capture=node=>({node,text:typeof node.data==='string'?node.data:null,attributes:node.nodeType===1?[...node.attributes].map(a=>[a.name,a.value]):null,metadata:Object.fromEntries(caretMetadataNames.filter(key=>Object.hasOwn(node,key)).map(key=>[key,structuredClone(node[key])])),children:[...node.childNodes].map(capture)});
  return {html:current.el.innerHTML,nodes:[...current.el.childNodes].map(capture),range:range?{start:range.startContainer,from:range.startOffset,end:range.endContainer,to:range.endOffset}:null,properties:current.caretStyle?{...current.caretStyle.properties}:null,script:current.caretStyle?.script,decorations:{...current.caretStyle?.decorations}};
}
function breakTextHistoryGroup(){if(editing)editing.textHistoryGroupSerial=(editing.textHistoryGroupSerial||0)+1;}
function textHistoryGroup(current,type,text){
  if(type==='insertText'&&(!text||/\s/.test(text)))return null;
  if(type!=='insertText'&&!/^delete(?:Content|Word|SoftLine|HardLine)(?:Backward|Forward)$/.test(type))return null;
  return {type,serial:current.textHistoryGroupSerial||0,time:performance.now()};
}
function recordCaretEdit(current,before,group=null){
  if(current.caretHistoryBatch)return;
  const history=current.caretHistory||={undo:[],redo:[]},after=captureCaretEdit(current),previous=history.undo.at(-1);
  const collapsed=range=>!!range&&range.start===range.end&&range.from===range.to;
  if(!collapsed(before.range)||!collapsed(after.range))group=null;
  const contiguous=previous&&collapsed(previous.after.range)&&collapsed(before.range)&&previous.after.range.start===before.range.start&&previous.after.range.from===before.range.from;
  if(group&&previous?.group&&history.redo.length===0&&previous.group.type===group.type&&previous.group.serial===group.serial&&group.time-previous.group.time<=1000&&previous.after.html===before.html&&contiguous){previous.after=after;previous.group=group;}
  else history.undo.push({before,after,group});
  if(history.undo.length>100)history.undo.shift();history.redo=[];syncHistoryControls();
}
function inlineFormattingTransaction(action){
  const current=editing;if(!current||current.caretHistoryBatch)return action();
  breakTextHistoryGroup();
  const before=captureCaretEdit(current),batch=current.caretHistoryBatch;let completed=false;
  current.caretHistoryBatch=true;
  try{const result=action();if(result===false&&editing===current)restoreCaretEdit(current,before);completed=true;return result;}
  catch(error){if(editing===current)restoreCaretEdit(current,before);throw error;}
  finally{
    current.caretHistoryBatch=batch;
    if(completed&&editing===current&&current.el.innerHTML!==before.html)recordCaretEdit(current,before);
  }
}
// Let the browser perform ordinary insertion/deletion, but retain its exact
// before/after nodes in the same history as formatting and styled insertion.
function beginNativeTextEdit(event){
  const current=editing;
  if(!current||!current.el.contains(event.target)||event.defaultPrevented||event.isComposing||current.caretComposition)return;
  current.nativeTextEdit=null;
  if(!/^(insertText|insertReplacementText|deleteContentBackward|deleteContentForward|deleteWordBackward|deleteWordForward|deleteSoftLineBackward|deleteSoftLineForward|deleteHardLineBackward|deleteHardLineForward|deleteByCut)$/.test(event.inputType))return;
  current.nativeTextEdit={type:event.inputType,group:textHistoryGroup(current,event.inputType,event.data),before:captureCaretEdit(current)};
}
function finishNativeTextEdit(event){
  const current=editing;if(!current||!current.el.contains(event.target)||current.caretComposition)return;
  const pending=current.nativeTextEdit;current.nativeTextEdit=null;
  if(pending&&pending.type===event.inputType){
    current.nativeHistoryCaptured=true;
    if(current.el.innerHTML!==pending.before.html)recordCaretEdit(current,pending.before,pending.group);
  }else if(!['historyUndo','historyRedo'].includes(event.inputType))current.nativeHistoryUntracked=true;
}
function ownsNativeTextHistory(){return !!editing?.nativeHistoryCaptured&&!editing.nativeHistoryUntracked;}
function inlineHistoryCommand(redo=false){
  if(caretHistoryStep(redo))return true;
  // Native browser history still contains operations restored by snapshots.
  // Do not replay those a second time when the tracked local stack is empty.
  return ownsNativeTextHistory();
}
function canStepInlineHistory(redo=false){
  const current=editing;if(!current?.caretHistory||current.caretComposition)return false;
  const entry=(redo?current.caretHistory.redo:current.caretHistory.undo).at(-1);
  return !!entry&&current.el.innerHTML===(redo?entry.before:entry.after).html;
}
function caretHistoryStep(redo=false){
  const current=editing,history=current?.caretHistory;if(!history||current.caretComposition)return false;
  const source=redo?history.redo:history.undo,destination=redo?history.undo:history.redo,entry=source.at(-1);if(!entry)return false;
  const expected=redo?entry.before:entry.after,target=redo?entry.after:entry.before;
  // A later native edit must undo through the browser first. Never restore a
  // stale custom snapshot over unrelated page or typing changes.
  if(current.el.innerHTML!==expected.html)return false;
  breakTextHistoryGroup();restoreCaretEdit(current,target);source.pop();destination.push(entry);syncHistoryControls();return true;
}
function restoreCaretEdit(current,target){
  const restore=state=>{const node=state.node;if(state.text!==null)node.data=state.text;else{if(state.attributes){for(const a of [...node.attributes])node.removeAttribute(a.name);for(const [name,value]of state.attributes)node.setAttribute(name,value);}node.replaceChildren(...state.children.map(restore));}for(const key of caretMetadataNames)delete node[key];Object.assign(node,structuredClone(state.metadata));return node;};
  current.el.replaceChildren(...target.nodes.map(restore));
  const d=current.el.ownerDocument,selection=d.getSelection(),range=d.createRange();if(target.range){range.setStart(target.range.start,target.range.from);range.setEnd(target.range.end,target.range.to);}else{range.selectNodeContents(current.el);range.collapse(false);}
  selection.removeAllRanges();selection.addRange(range);current.caretStyle=target.properties?{properties:{...target.properties},script:target.script,decorations:{...target.decorations},range:range.cloneRange()}:null;
  d.dispatchEvent(new Event('selectionchange'));
}
function caretPlaceholders(current){return [...current.el.querySelectorAll('br')].filter(node=>node.__rtCaretPlaceholder);}
function normalizeCaretPlaceholders(current){for(const node of caretPlaceholders(current))if(hasInlineContentAfter(node,current.el))delete node.__rtCaretPlaceholder;}
function removeCaretPlaceholders(current){normalizeCaretPlaceholders(current);for(const node of caretPlaceholders(current))node.remove();}
function hasInlineContentAfter(node,root){
  const paragraph=node.parentElement?.closest('[data-retouch-paragraph]');if(paragraph&&root.contains(paragraph))root=paragraph;
  for(let current=node;current&&current!==root;current=current.parentNode)for(let next=current.nextSibling;next;next=next.nextSibling)if(next.textContent||next.nodeType===1&&!next.__rtCaretPlaceholder)return true;
  return false;
}
function insertInlineBreak(){
  const current=editing,d=doc(),selection=d?.getSelection(),range=selection?.rangeCount?selection.getRangeAt(0):null;
  if(current?.info.canSetChildren===false){toast('This text source cannot preserve line breaks.','err');return;}
  if(!current||!range||!current.el.contains(range.startContainer)||!current.el.contains(range.endContainer))return;
  if([...current.el.querySelectorAll('[contenteditable="false"]')].some(node=>range.intersectsNode(node))){toast('This selection includes source-owned text.','err');return;}
  const before=current.caretHistoryBatch?null:captureCaretEdit(current),draft=caretDraft(),properties=draft?.properties||{},script=draft?.script,decorations=draft?.decorations||{};
  removeCaretPlaceholders(current);range.deleteContents();
  const br=d.createElement('br'),text=d.createTextNode(''),fragment=d.createDocumentFragment();fragment.append(br,text);range.insertNode(fragment);
  // A trailing BR gives the empty line a box. Explicit paragraph spans keep
  // it in source so a trailing soft line survives saving. Legacy flat text
  // keeps the existing editor-only placeholder behavior.
  if(!hasInlineContentAfter(text,current.el)){const placeholder=d.createElement('br');if(!text.parentElement?.closest('[data-retouch-paragraph]'))placeholder.__rtCaretPlaceholder=true;text.after(placeholder);}
  const caret=d.createRange();caret.setStart(text,0);caret.collapse(true);selection.removeAllRanges();selection.addRange(caret);
  current.caretStyle={properties,script,decorations,range:caret.cloneRange()};recordCaretEdit(current,before);d.dispatchEvent(new Event('selectionchange'));
}

function pasteInlineText(value){
  const current=editing,d=doc(),selection=d?.getSelection(),range=selection?.rangeCount?selection.getRangeAt(0):null;
  const text=String(value).replace(/\r\n?/g,'\n');
  if(!current||!text||!range||!current.el.contains(range.startContainer)||!current.el.contains(range.endContainer))return;
  if(current.caretComposition)return;
  if(text.includes('\n')&&current.info.canSetChildren===false){toast('This text source cannot preserve line breaks.','err');return;}
  if([...current.el.querySelectorAll('[contenteditable="false"]')].some(node=>range.intersectsNode(node))){toast('This selection includes source-owned text.','err');return;}
  const before=captureCaretEdit(current),draft=caretDraft(),properties=draft?.properties||{},script=draft?.script,decorations=draft?.decorations||{};
  current.caretHistoryBatch=true;
  try{
    removeCaretPlaceholders(current);range.deleteContents();range.collapse(true);selection.removeAllRanges();selection.addRange(range);
    current.caretStyle={properties,script,decorations,range:range.cloneRange()};
    const lines=text.split('\n');
    for(let index=0;index<lines.length;index++){
      if(index)insertInlineBreak();
      if(lines[index]&&(!insertCaretText(lines[index])||!current.caretStyle))throw new Error('This source structure cannot preserve the pasted formatting.');
    }
  }catch(error){restoreCaretEdit(current,before);toast(error.message,'err');return;}
  finally{current.caretHistoryBatch=false;}
  recordCaretEdit(current,before);
}

function insertCaretText(text){
  const draft=caretDraft();if(!draft||editing.caretComposition)return false;
  if(!text)return true;
  const {current,selection,range,properties,script,decorations}=draft,before=current.caretHistoryBatch?null:captureCaretEdit(current),d=current.el.ownerDocument,prefix=d.createRange();prefix.selectNodeContents(current.el);prefix.setEnd(range.startContainer,range.startOffset);const start=prefix.toString().length;
  removeCaretPlaceholders(current);
  // Retain a plain source run's node identity so its existing styles can split
  // around the inserted text through the same proven range-editing path.
  if(range.startContainer.nodeType===3)range.startContainer.insertData(range.startOffset,text);
  else {const node=d.createTextNode(text);range.insertNode(node);}
  styleInsertedText(current,start,start+text.length,properties,script,decorations);recordCaretEdit(current,before,textHistoryGroup(current,'insertText',text));return true;
}
function beginCaretComposition(){
  const draft=caretDraft();if(!draft)return;
  const {current,range,properties,script,decorations}=draft,prefix=current.el.ownerDocument.createRange();prefix.selectNodeContents(current.el);prefix.setEnd(range.startContainer,range.startOffset);
  const start=prefix.toString().length,text=current.el.textContent;
  current.caretComposition={start,before:text.slice(0,start),after:text.slice(start),properties,script,decorations,snapshot:captureCaretEdit(current)};
}
function finishCaretComposition(){
  const current=editing,composition=current?.caretComposition;if(!composition)return;
  requestAnimationFrame(()=>{
    if(editing!==current||current.caretComposition!==composition)return;
    current.caretComposition=null;
    const text=current.el.textContent,{start,before,after,properties,script,decorations}=composition;
    if(!text.startsWith(before)||!text.endsWith(after)||text.length<before.length+after.length){current.caretStyle=null;return;}
    styleInsertedText(current,start,text.length-after.length,properties,script,decorations);if(text.length>before.length+after.length)recordCaretEdit(current,composition.snapshot);
  });
}

// Range.intersectsNode includes text touching a selection boundary. Only
// characters actually selected should contribute to mixed formatting values.
function selectedInlineTextNodes(root,range){
  if(!range||range.collapsed)return [];
  const nodes=[],walker=root.ownerDocument.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode;if(!node.length||!range.intersectsNode(node))continue;
    const overlap=range.cloneRange();
    if(range.comparePoint(node,0)>=0)overlap.setStart(node,0);
    if(range.comparePoint(node,node.length)<=0)overlap.setEnd(node,node.length);
    if(overlap.toString().length)nodes.push(node);
  }
  return nodes;
}

function joinTextParagraph(backward=true){
  const current=editing;if(!current||current.caretHistoryBatch||!RetouchListEditing.joinContext(current.el,backward))return false;
  const before=captureCaretEdit(current);
  try{if(!RetouchListEditing.join(current.el,backward))return false;}catch(error){restoreCaretEdit(current,before);throw error;}
  recordCaretEdit(current,before,textHistoryGroup(current,backward?'deleteContentBackward':'deleteContentForward'));current.el.ownerDocument.dispatchEvent(new Event('selectionchange'));return true;
}
function removeListMarker(){
  const current=editing;if(!current||!RetouchListEditing.canRemoveMarker(current.el))return false;
  const result=inlineFormattingTransaction(()=>RetouchListEditing.removeMarker(current.el));
  if(result)current.el.ownerDocument.dispatchEvent(new Event('selectionchange'));return result;
}
function insertListCaretText(text){
  const current=editing;if(!current||!text)return false;
  const d=current.el.ownerDocument,selection=d.getSelection();if(!selection.rangeCount)return false;
  const range=selection.getRangeAt(0),node=range.startContainer;
  if(!range.collapsed||node.nodeType!==3||node.length||!current.el.contains(node)||!node.parentElement.closest('li,[data-retouch-paragraph]'))return false;
  const before=captureCaretEdit(current);node.insertData(0,text);range.setStart(node,text.length);range.collapse(true);selection.removeAllRanges();selection.addRange(range);
  recordCaretEdit(current,before,textHistoryGroup(current,'insertText',text));return true;
}
function autoListPrefix(text){
  const current=editing;if(text!==' '||!current||current.info.canSetChildren===false||current.caretComposition||!RetouchListEditing.prefixContext(current.el))return false;
  // The typed space belongs to ordinary typing history. Undoing the separate
  // formatting transaction restores the literal prefix, including that space.
  if(!insertCaretText(text)&&!insertListCaretText(text)){
    const before=captureCaretEdit(current),d=current.el.ownerDocument,selection=d.getSelection(),range=selection.getRangeAt(0);
    if(range.startContainer.nodeType===3){const node=range.startContainer,offset=range.startOffset;node.insertData(offset,text);range.setStart(node,offset+1);}
    else {const node=d.createTextNode(text);range.insertNode(node);range.setStartAfter(node);}
    range.collapse(true);selection.removeAllRanges();selection.addRange(range);recordCaretEdit(current,before,textHistoryGroup(current,'insertText',text));
  }
  inlineFormattingTransaction(()=>RetouchListEditing.prefix(current.el));current.el.ownerDocument.dispatchEvent(new Event('selectionchange'));return true;
}
function insertTextParagraph(){
  const current=editing;if(!current)return false;
  const result=inlineFormattingTransaction(()=>RetouchListEditing.listContext(current.el)?RetouchListEditing.enter(current.el):RetouchListEditing.paragraph(current.el));
  current.el.ownerDocument.dispatchEvent(new Event('selectionchange'));return result;
}
function indentTextList(outdent=false){
  const current=editing;if(!current)return false;
  const result=inlineFormattingTransaction(()=>RetouchListEditing.indent(current.el,outdent));
  current.el.ownerDocument.dispatchEvent(new Event('selectionchange'));return result;
}
function listIndentShortcut(event,allowTab=true){
  if(!editing||event.isComposing||event.altKey||!RetouchListEditing.listContext(editing.el))return false;
  const tab=allowTab&&event.key==='Tab'&&!event.metaKey&&!event.ctrlKey,bracket=(event.metaKey||event.ctrlKey)&&!event.shiftKey&&['[',']'].includes(event.key);
  if(!tab&&!bracket)return false;
  event.preventDefault();event.stopPropagation();indentTextList(tab?event.shiftKey:event.key==='[');return true;
}
function inlineListShortcut(event){
  if(event.isComposing||!(event.metaKey||event.ctrlKey)||!event.shiftKey||event.altKey||!editing||!RetouchListEditing.supported(editing.el))return false;
  const kind=event.code==='Digit7'||event.key==='7'?'ol':event.code==='Digit8'||event.key==='8'?'ul':null;if(!kind)return false;
  event.preventDefault();event.stopPropagation();applyTextList(kind);return true;
}
function applyTextList(kind){
  const current=editing;if(!current||!RetouchListEditing.supported(current.el))return false;
  if(!RetouchListEditing.canApply(current.el)){toast('Select paragraphs, items in one list, or all text to change list style.','err');return false;}
  const result=inlineFormattingTransaction(()=>RetouchListEditing.apply(current.el,kind));
  current.el.ownerDocument.dispatchEvent(new Event('selectionchange'));return result;
}

function showInlineFormatToolbar(){
  inlineFormatCleanup();if(!editing||editing.info.canSetChildren===false)return;
  const d=doc(),bar=document.createElement('div');bar.className='inline-format-toolbar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Selected text formatting');
  for(const [tag,label,text]of [['strong','Bold selected text','B'],['em','Italic selected text','I'],['u','Underline selected text','U'],['s','Strikethrough selected text','S'],['sup','Superscript selected text','x²'],['sub','Subscript selected text','x₂']]){const button=document.createElement('button');button.type='button';button.textContent=text;button.dataset.formatTag=tag;if(tag==='u'||tag==='s')button.style.textDecoration=tag==='u'?'underline':'line-through';button.setAttribute('aria-label',label);button.title=label;button.onpointerdown=event=>event.preventDefault();button.onclick=()=>{toggleWrap(tag);update();};bar.append(button);}
  const listStyle=document.createElement('select');listStyle.setAttribute('aria-label','Text layer list style');listStyle.title='Applies to selected paragraphs or list items. Select all text to change the whole text layer.';
  for(const [value,label]of [['none','No list'],['ul','Bulleted list'],['ol','Numbered list'],['mixed','Mixed']]){const option=document.createElement('option');option.value=value;option.textContent=label;option.disabled=value==='mixed';listStyle.append(option);}
  listStyle.onchange=()=>{if(savedRange&&editing){const selection=d.getSelection();selection.removeAllRanges();selection.addRange(savedRange.cloneRange());applyTextList(listStyle.value);update();}};
  const paragraphSpacing=document.createElement('input');paragraphSpacing.type='number';paragraphSpacing.min='0';paragraphSpacing.max='10000';paragraphSpacing.step='any';paragraphSpacing.setAttribute('aria-label','Paragraph spacing (px)');paragraphSpacing.title='Space between paragraphs in this text layer. Soft line breaks use line height.';
  const changeParagraphSpacing=()=>{if(!savedRange||!editing||paragraphSpacing.value===''||!paragraphSpacing.checkValidity())return;const selection=d.getSelection();selection.removeAllRanges();selection.addRange(savedRange.cloneRange());inlineFormattingTransaction(()=>RetouchListEditing.setParagraphSpacing(editing.el,Number(paragraphSpacing.value)));update();};
  paragraphSpacing.onchange=changeParagraphSpacing;paragraphSpacing.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();changeParagraphSpacing();editing?.el.focus();}};
  const listSpacing=document.createElement('input');listSpacing.type='number';listSpacing.min='0';listSpacing.max='10000';listSpacing.step='any';listSpacing.setAttribute('aria-label','List spacing (px)');listSpacing.title='Space between items in the list containing the text cursor. Nested lists keep their own spacing.';
  const changeListSpacing=()=>{if(!savedRange||!editing||listSpacing.value===''||!listSpacing.checkValidity())return;const selection=d.getSelection();selection.removeAllRanges();selection.addRange(savedRange.cloneRange());inlineFormattingTransaction(()=>RetouchListEditing.setListSpacing(editing.el,Number(listSpacing.value)));update();};
  listSpacing.onchange=changeListSpacing;listSpacing.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();changeListSpacing();editing?.el.focus();}};
  const listInset=document.createElement('input');listInset.type='number';listInset.min='0';listInset.max='10000';listInset.step='any';listInset.setAttribute('aria-label','List inset (px)');listInset.title='Inset of list text from its container. Increase to make room for wide markers; use 0 for hanging markers. Nested lists keep their own inset.';
  const changeListInset=()=>{if(!savedRange||!editing||listInset.value===''||!listInset.checkValidity())return;const selection=d.getSelection();selection.removeAllRanges();selection.addRange(savedRange.cloneRange());inlineFormattingTransaction(()=>RetouchListEditing.setListInset(editing.el,Number(listInset.value)));update();};
  listInset.onchange=changeListInset;listInset.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();changeListInset();editing?.el.focus();}};
  const listStart=document.createElement('input');listStart.type='number';listStart.min='1';listStart.max='1000000';listStart.step='1';listStart.setAttribute('aria-label','List start number');listStart.title='Starting number for the ordered list containing the text cursor.';
  const changeListStart=()=>{if(!savedRange||!editing||listStart.value===''||!listStart.checkValidity())return;const selection=d.getSelection();selection.removeAllRanges();selection.addRange(savedRange.cloneRange());inlineFormattingTransaction(()=>RetouchListEditing.setStart(editing.el,Number(listStart.value)));update();};
  listStart.onchange=changeListStart;listStart.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();changeListStart();editing?.el.focus();}};
  const indentButtons=[['Decrease list indentation',true,'←'],['Increase list indentation',false,'→']].map(([label,outdent,text])=>{const button=document.createElement('button');button.type='button';button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18M12 10h9M12 14h9M3 19h18 '+(outdent?'M8 12H2m3-3-3 3 3 3':'M2 12h6M5 9l3 3-3 3')+'"/></svg>';button.title=label+(outdent?' (Shift+Tab)':' (Tab)');button.setAttribute('aria-label',label);button.onpointerdown=event=>event.preventDefault();button.onclick=()=>{if(savedRange&&editing){const selection=d.getSelection();selection.removeAllRanges();selection.addRange(savedRange.cloneRange());indentTextList(outdent);update();}};button.retouchOutdent=outdent;return button;});
  const indentControls=document.createElement('div');indentControls.className='range-indent-controls';indentControls.setAttribute('role','group');indentControls.setAttribute('aria-label','List indentation');indentControls.append(...indentButtons);
  let savedRange=null;const fields=[];
  for(const [property,label,options] of [['font-weight','Selected text weight',[['100','Thin'],['200','Extra light'],['300','Light'],['400','Regular'],['500','Medium'],['600','Semibold'],['700','Bold'],['800','Extra bold'],['900','Black'],['custom','Custom…']]],['font-style','Selected text style',[['normal','Upright'],['italic','Italic']]],['text-transform','Selected text case',[['none','As typed'],['uppercase','Uppercase'],['lowercase','Lowercase'],['capitalize','Capitalize']]],['font-variant-caps','Selected text caps',[['normal','Normal'],['small-caps','Small caps'],['all-small-caps','All small caps']]]]){
    const field=document.createElement('select');field.setAttribute('aria-label',label);field.title=label;
    field.append(new Option(property==='font-weight'?'Weight':'Mixed',''));field.options[0].disabled=true;
    for(const [value,label]of options)field.append(new Option(label,value));
    field.onchange=()=>{if(property==='font-weight'&&field.value==='custom'){const custom=bar.querySelector('[aria-label="Selected text custom weight"]');custom.hidden=false;custom.focus();custom.select();return;}if(savedRange&&editing){const selection=d.getSelection();selection.removeAllRanges();selection.addRange(savedRange.cloneRange());applyTextRangeStyle(property,field.value);update();}};
    fields.push({field,property});bar.append(field);
  }
  const rangeInput=(property,label,configure,normalize,display)=>{
    const field=document.createElement('input');field.setAttribute('aria-label',label);field.title=label;configure(field);
    const apply=()=>{
      let value;try{value=normalize(field.value);}catch{field.setAttribute('aria-invalid','true');return false;}
      if(!RetouchRangeStyles.valid(property,value)){field.setAttribute('aria-invalid','true');return false;}
      if(!savedRange||!editing)return false;
      field.removeAttribute('aria-invalid');const selection=d.getSelection();selection.removeAllRanges();selection.addRange(savedRange.cloneRange());applyTextRangeStyle(property,value);update();return true;
    };
    let beforeFocus='',cancel=false;field.onfocus=()=>{beforeFocus=field.value;};field.onchange=()=>{if(!cancel)apply();};
    field.onkeydown=event=>{
      if(event.key==='Enter'){event.preventDefault();event.stopPropagation();if(apply()){if(savedRange?.collapsed)editing?.el.focus();else void commitInlineEdit();}}
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel=true;field.value=beforeFocus;field.blur();cancel=false;field.removeAttribute('aria-invalid');editing?.el.focus();update();}
    };
    fields.push({field,property,display});bar.append(field);return field;
  };
  const customWeight=rangeInput('font-weight','Selected text custom weight',field=>{field.type='number';field.min='1';field.max='1000';field.step='any';field.placeholder='Weight';field.hidden=true;field.title='Custom font weight (1–1000). The available font determines the rendered result.';},value=>value.trim(),value=>value);
  bar.insertBefore(customWeight,bar.querySelector('select').nextSibling);
  rangeInput('font-size','Selected text size (px)',field=>{field.type='number';field.min='0.1';field.max='1000';field.step='0.1';field.placeholder='Size';},value=>value+'px',value=>String(Math.round(parseFloat(value)*1000)/1000));
  const spacingFields={};
  for(const [property,label]of [['line-height','Selected text line height'],['letter-spacing','Selected text letter spacing']])spacingFields[property]=rangeInput(property,label,field=>{field.type='text';field.spellcheck=false;field.placeholder='Auto';field.title=property==='line-height'?'Auto, pixels, percent, or a multiplier such as 1.2x.':'Auto, pixels, or percent of the font size.';},value=>RetouchRangeStyles.spacingValue(property,value),value=>RetouchRangeStyles.spacingDisplay(property,value));
  const colorField=rangeInput('color','Selected text color',field=>{field.type='text';field.spellcheck=false;field.placeholder='Color';field.className='range-color';field.title='Selected text color: hex, RGB, sRGB or Display P3';},value=>RetouchPaletteValues.fromComputed(/^(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value.trim())?'#'+value.trim():value.trim()),value=>RetouchPaletteValues.fromComputed(value));
  const swatch=document.createElement('button');swatch.type='button';swatch.className='range-color-swatch';swatch.setAttribute('aria-label','Choose selected text color');swatch.title='Choose selected text color';bar.insertBefore(swatch,colorField);
  colorField.retouchPaintScopeLabel='Selected text · Applies across all screen sizes.';
  let picker=null,fontDialog=null;
  swatch.onpointerdown=event=>event.preventDefault();
  swatch.onclick=()=>{
    if(!editing||!savedRange||picker)return;
    colorField.value=swatch.dataset.color||'';colorField.removeAttribute('aria-invalid');
    const current=editing,prefix=d.createRange();prefix.selectNodeContents(current.el);prefix.setEnd(savedRange.startContainer,savedRange.startOffset);
    const start=prefix.toString().length,end=start+savedRange.toString().length;
    const preview=previewInlineStyle(current,savedRange,'color');
    if(!preview){toast('This selection includes source-owned text.','err');return;}
    const restoreSelection=()=>{if(editing!==current||doc()!==d||!current.el.isConnected)return false;const range=start===end?savedRange.cloneRange():inlineRangeAt(current.el,start,end);if(!range)return false;const selection=d.getSelection();selection.removeAllRanges();selection.addRange(range);savedRange=range.cloneRange();return true;};
    colorField.retouchPaintPreview=()=>preview;
    picker=RetouchPaintPicker.open(colorField,{anchor:swatch,
      onApply:async value=>{
        if(!preview.valid||!restoreSelection()){toast('Text changed while choosing a color. Select it again.','err');return;}
        const parsed=RetouchPaintPicker.parsePaint(value);if(!parsed)return;
        const normalized=parsed.space==='srgb'?RetouchPaletteValues.srgb(parsed.channels,parsed.alpha):RetouchPaletteValues.p3(parsed.channels,parsed.alpha);
        applyTextRangeStyle('color',normalized);if(start!==end)await commitInlineEdit();
      },
      onClose:()=>{picker=null;delete colorField.retouchPaintPreview;if(restoreSelection()){current.el.focus();update();}}
    });
  };
  const familyButton=document.createElement('button');familyButton.type='button';familyButton.className='range-font-family';familyButton.setAttribute('aria-label','Choose selected text font');bar.prepend(familyButton);
  fields.push({field:familyButton,property:'font-family',display:value=>value});
  familyButton.onpointerdown=event=>event.preventDefault();
  familyButton.onclick=()=>{
    if(!editing||!savedRange||fontDialog)return;
    const current=editing,prefix=d.createRange();prefix.selectNodeContents(current.el);prefix.setEnd(savedRange.startContainer,savedRange.startOffset);
    const start=prefix.toString().length,end=start+savedRange.toString().length;
    const preview=previewInlineStyle(current,savedRange,'font-family');if(!preview){toast('This selection includes source-owned text.','err');return;}
    const restoreSelection=()=>{if(editing!==current||doc()!==d||!current.el.isConnected)return false;const range=start===end?savedRange.cloneRange():inlineRangeAt(current.el,start,end);if(!range)return false;const selection=d.getSelection();selection.removeAllRanges();selection.addRange(range);savedRange=range.cloneRange();return true;};
    const dialog=document.createElement('dialog');fontDialog=dialog;dialog.className='paint-picker range-font-picker';dialog.retouchSourceInput=familyButton;dialog.setAttribute('aria-label','Selected text font');
    const heading=document.createElement('h3');heading.textContent='Font';dialog.append(heading);
    RetouchInspector.note(dialog,(savedRange.collapsed?'Text you type next':'Selected text')+' · Applies across all screen sizes.');
    let chosen=familyButton.value;
    const apply=RetouchInspector.button('Apply font',async()=>{
      if(!dialog.open||!RetouchRangeStyles.valid('font-family',chosen))return;preview.restore();
      if(!preview.valid||!restoreSelection()){dialog.close();toast('Text changed while choosing a font. Select it again.','err');return;}
      dialog.close();if(chosen!==familyButton.value){applyTextRangeStyle('font-family',chosen);if(start!==end)await commitInlineEdit();}
    });apply.disabled=true;
    document.body.append(dialog);
    RetouchInspector.fontPicker(dialog,d,chosen,value=>{if(!RetouchRangeStyles.valid('font-family',value))return;chosen=value;preview.update(value);apply.disabled=false;},{label:'Selected text font family',mixed:!chosen,preview:true});
    const actions=document.createElement('div');actions.className='paint-picker-actions';actions.append(RetouchInspector.button('Cancel',()=>{preview.restore();dialog.close();}),apply);dialog.append(actions);
    const observer=new MutationObserver(()=>{if(!familyButton.isConnected){preview.restore();dialog.close();}});observer.observe(document.body,{childList:true,subtree:true});
    dialog.addEventListener('cancel',()=>preview.restore());
    dialog.addEventListener('close',()=>{observer.disconnect();preview.restore();dialog.remove();fontDialog=null;if(restoreSelection()){current.el.focus();update();}},{once:true});
    dialog.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Enter'&&event.target.matches('input[type=search]')){event.preventDefault();const first=dialog.querySelector('.font-results button');if(first){first.click();if(!apply.disabled)apply.click();}}});
    dialog.querySelector('details').open=true;dialog.showModal();const box=familyButton.getBoundingClientRect();dialog.style.left=Math.max(8,Math.min(innerWidth-dialog.offsetWidth-8,box.left))+'px';dialog.style.top=Math.max(8,Math.min(innerHeight-dialog.offsetHeight-8,box.top-dialog.offsetHeight-8))+'px';
  };
  const linkField=document.createElement('input');linkField.type='text';linkField.inputMode='url';linkField.placeholder='Paste a URL';linkField.setAttribute('aria-label','Selected text link');
  const changeLink=href=>{
    if(!savedRange||!editing)return false;
    if(href!==null&&!RetouchLinkValues.valid(href)){linkField.setAttribute('aria-invalid','true');return false;}
    linkField.removeAttribute('aria-invalid');const selection=d.getSelection();selection.removeAllRanges();selection.addRange(savedRange.cloneRange());
    const result=applyInlineLink(href);if(result&&href===null)linkField.value='';update();return result;
  };
  let cancelLinkChange=false;
  linkField.onchange=()=>{if(!cancelLinkChange)changeLink(linkField.value.trim());};
  linkField.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();if(changeLink(linkField.value.trim()))editing?.el.focus();}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelLinkChange=true;editing?.el.focus();update();linkField.removeAttribute('aria-invalid');cancelLinkChange=false;}};
  const removeLink=document.createElement('button');removeLink.type='button';removeLink.textContent='Remove';removeLink.setAttribute('aria-label','Remove selected text link');removeLink.onpointerdown=event=>event.preventDefault();removeLink.onclick=()=>changeLink(null);
  const update=()=>{
    if(picker||fontDialog)return;
    const selection=d.getSelection(),range=selection?.rangeCount?selection.getRangeAt(0):null,valid=editing&&range&&editing.el.contains(range.startContainer)&&editing.el.contains(range.endContainer)&&!(range.collapsed&&(range.startContainer.nodeType===3?range.startContainer.parentElement:range.startContainer).closest('[contenteditable="false"]'));
    for(const control of bar.querySelectorAll('button,input,select'))if(!control.dataset.rangeAlwaysEnabled)control.disabled=!valid;
    for(const button of indentButtons)button.disabled=!valid||!RetouchListEditing.canIndent(editing?.el,button.retouchOutdent);
    listStyle.disabled=!valid||!RetouchListEditing.canApply(editing?.el);listStyle.value=editing?RetouchListEditing.state(editing.el):'none';
    const paragraphs=valid?RetouchListEditing.spacingParagraphs(editing.el):[];paragraphSpacing.disabled=!paragraphs.length;
    if(document.activeElement!==paragraphSpacing){const values=paragraphs.slice(0,-1).map(node=>d.defaultView.getComputedStyle(node).marginBlockEnd),same=values.length&&values.every(value=>value===values[0]);paragraphSpacing.value=same?parseFloat(values[0]):'';paragraphSpacing.placeholder=values.length?'Mixed':'—';paragraphSpacing.title=paragraphs.length?'Space between paragraphs in this text layer. Soft line breaks use line height.':'Select a simple text flow with at least two paragraphs. Enter creates a paragraph.';}
    const insetTarget=valid?RetouchListEditing.insetList(editing.el):null;listInset.disabled=!insetTarget;if(document.activeElement!==listInset){listInset.value=insetTarget?parseFloat(d.defaultView.getComputedStyle(insetTarget).paddingInlineStart):'';listInset.placeholder=insetTarget?'':'Select a list';}
    const spacedItems=valid?RetouchListEditing.spacingListItems(editing.el):[];listSpacing.disabled=!spacedItems.length;
    if(document.activeElement!==listSpacing){const values=spacedItems.slice(0,-1).map(node=>d.defaultView.getComputedStyle(node).marginBlockEnd),same=values.length&&values.every(value=>value===values[0]);const stored=valid?RetouchListEditing.authoredListSpacing(RetouchListEditing.listContext(editing.el)?.list):null;listSpacing.value=stored!==null?stored:same?parseFloat(values[0]):spacedItems.length===1?0:'';listSpacing.placeholder=spacedItems.length?'Mixed':'Select a list';}
    const listContext=valid?RetouchListEditing.listContext(editing.el):null;listStart.disabled=!listContext||listContext.list.tagName!=='OL';if(d.activeElement!==listStart&&document.activeElement!==listStart)listStart.value=listStart.disabled?'':RetouchListEditing.startNumber(listContext.list);
    selectionNote.textContent=valid?(range.collapsed?'Text you type next':'Selected text'):'Select text to format';
    if(valid&&!editing.caretComposition&&editing.caretStyle&&!sameCaret(range,editing.caretStyle.range))editing.caretStyle=null;
    const selectedText=valid?selectedInlineTextNodes(editing.el,range):[];
    for(const button of commands.querySelectorAll('button')){
      button.disabled=!valid;
      const tag=button.dataset.formatTag;if(!['sup','sub','u','s'].includes(tag))continue;
      const decoration=tag==='u'||tag==='s';
      const inherited=parent=>decoration?!!parent.closest(tag):parent.closest('sup,sub')?.tagName.toLowerCase()===tag;
      let state='false';
      if(valid&&range.collapsed){
        const parent=range.startContainer.nodeType===3?range.startContainer.parentElement:range.startContainer;
        state=String(decoration?(editing.caretStyle?.decorations?.[tag]??inherited(parent)):(editing.caretStyle?.script!==undefined?editing.caretStyle.script===tag:inherited(parent)));
      }else if(valid&&selectedText.length){
        const values=new Set(selectedText.map(node=>inherited(node.parentElement)));
        state=values.size>1?'mixed':String([...values][0]);
      }
      button.setAttribute('aria-pressed',state);
      button.title=button.getAttribute('aria-label')+(state==='mixed'?' · Mixed':'');
    }
    const linkParent=valid?(range.startContainer.nodeType===3?range.startContainer.parentElement:range.startContainer):null;
    const selectedLink=linkParent?.closest('a'),withinLink=selectedLink&&selectedLink!==editing?.el&&selectedLink.contains(range?.endContainer);
    const ownedLink=withinLink&&!plainInlineFormatting(selectedLink),editableOwned=ownedLink&&editableLinkURL(selectedLink);
    linkField.disabled=!valid||range.collapsed&&!withinLink;linkField.readOnly=!!ownedLink&&!editableOwned;removeLink.disabled=!valid||!withinLink||!selectedLink.hasAttribute('href')||ownedLink&&!editableOwned;
    linkField.title=ownedLink?(editableOwned?'Updates this whole link and preserves its attributes.':'This link is controlled by the site. You can copy its URL.'):'Edit link (⌘K / Ctrl+K)';
    if(document.activeElement!==linkField)linkField.value=withinLink?selectedLink.getAttribute('href')||'':'';
    if(!valid)return;savedRange=range.cloneRange();
    colorField.retouchPaintScopeLabel=(range.collapsed?'Text you type next':'Selected text')+' · Applies across all screen sizes.';
    const values=new Map(fields.map(({property})=>[property,new Set()]));
    if(range.collapsed){const parent=range.startContainer.nodeType===3?range.startContainer.parentElement:range.startContainer,style=d.defaultView.getComputedStyle(parent);for(const [property,set]of values){const authored=parent.__rtRangeStyleValues?.[property];set.add(editing.caretStyle?.properties[property]??(authored?.css===parent.style.getPropertyValue(property)?authored.value:style.getPropertyValue(property)));}}
    for(const node of selectedText){const style=d.defaultView.getComputedStyle(node.parentElement);for(const [property,set]of values){const css=style.getPropertyValue(property),parent=node.parentElement,authored=parent.__rtRangeStyleValues?.[property];set.add(authored?.css===parent.style.getPropertyValue(property)?authored.value:property==='color'&&parent.__rtRangeStyleCSS===css&&parent.__rtRangeStyleValue?parent.__rtRangeStyleValue:css);}}
    for(const {field,property,display}of fields){
      const set=values.get(property),value=set.size===1?[...set][0]:'';
      if(display){if(document.activeElement!==field){try{field.value=value?display(value):'';}catch{field.value='';}}if(property==='color'){swatch.dataset.color=value;swatch.style.backgroundImage=value?'linear-gradient('+value+','+value+'),repeating-conic-gradient(#ddd 0% 25%,white 0% 50%)':'';}}
      else {field.value=[...field.options].some(option=>option.value===value)?value:property==='font-weight'&&value?'custom':'';if(property==='font-weight'&&document.activeElement!==customWeight)customWeight.hidden=field.value!=='custom';}
      if(field===familyButton){field.textContent=value?value.split(',')[0].replace(/["']/g,''):'Mixed fonts';field.title=value||'Mixed font families';}
    }
  };
  bar.addEventListener('focusin',breakTextHistoryGroup);
  bar.addEventListener('pointerdown',breakTextHistoryGroup);
  bar.addEventListener('keydown',event=>{
    if(listIndentShortcut(event,false)||inlineListShortcut(event)){update();return;}
    if(event.isComposing||!(event.metaKey||event.ctrlKey)||event.key.toLowerCase()!=='z'||event.target.closest('input,textarea,[contenteditable="true"]'))return;
    if(inlineHistoryCommand(event.shiftKey)){event.preventDefault();event.stopPropagation();update();}
  });
  bar.addEventListener('focusout',()=>{const current=editing;requestAnimationFrame(()=>{if(editing===current&&current&&document.activeElement!==iframe&&!inlineTextUIFocused())commitInlineEdit();});});
  const section=panelBody.querySelector('[data-section="typography"]'),panel=document.getElementById('panel');
  const originals=section?[...section.children].filter(node=>node.tagName!=='H3').map(node=>({node,hidden:node.hidden})):[];
  const collapsed=section?.dataset.collapsed==='true';let collapseChanged=false;
  const trackCollapse=event=>{if(event.target.closest('.section-toggle'))collapseChanged=true;};section?.querySelector(':scope > h3')?.addEventListener('click',trackCollapse);
  const selectionNote=document.createElement('span'),header=document.createElement('div');header.className='range-edit-heading';selectionNote.setAttribute('role','status');selectionNote.setAttribute('aria-label','Text formatting selection');
  const done=document.createElement('button');done.type='button';done.textContent='Done';done.setAttribute('aria-label','Finish text editing');done.title='Finish editing (Command/Ctrl+Enter). Enter adds a paragraph; Shift+Enter adds a line break.';done.dataset.rangeAlwaysEnabled='true';done.onclick=()=>void commitInlineEdit();header.append(selectionNote,done);
  const commands=document.createElement('div');commands.className='range-format-commands';commands.setAttribute('role','group');commands.setAttribute('aria-label','Text formatting');
  for(const button of [...bar.children].filter(node=>node.tagName==='BUTTON'&&node!==familyButton&&node!==swatch))commands.append(button);
  const row=(title,controls,className='')=>{const group=document.createElement('div');group.className='range-format-field '+className;const label=document.createElement('span');label.className='range-field-label';label.textContent=title;group.append(label,...controls);return group;};
  const weight=fields.find(item=>item.property==='font-weight'&&item.field.tagName==='SELECT').field,style=fields.find(item=>item.property==='font-style').field,size=fields.find(item=>item.property==='font-size').field;
  const colorControls=document.createElement('div');colorControls.className='range-color-controls';colorControls.append(swatch,colorField);
  const scopeNote=document.createElement('small');scopeNote.className='range-scope-note';scopeNote.textContent='Applies across all screen sizes.';
  bar.replaceChildren(header,row('Font',[familyButton],'range-family-field'),row('Weight',[weight,customWeight]),row('Size',[size]),row('Line height',[spacingFields['line-height']]),row('Letter spacing',[spacingFields['letter-spacing']]),row('Paragraph spacing',[paragraphSpacing]),row('Style',[style]),row('Color',[colorControls]),row('Case',[fields.find(item=>item.property==='text-transform').field]),row('Caps',[fields.find(item=>item.property==='font-variant-caps').field]),row('Link',[linkField,removeLink],'range-link-field'),...(RetouchListEditing.supported(editing.el)?[row('List',[listStyle],'range-list-field'),row('Start at',[listStart],'range-list-start-field'),row('List spacing',[listSpacing]),row('List inset',[listInset]),row('Indentation',[indentControls],'range-list-indent-field')]:[]),commands,scopeNote);
  const mount=()=>{
    const docked=!!section?.isConnected&&!panel.hidden,focused=bar.contains(document.activeElement)?document.activeElement:null;
    bar.classList.toggle('range-inspector',docked);if(section)section.toggleAttribute('data-range-editing',docked);
    for(const {node,hidden}of originals)node.hidden=docked||hidden;
    if(docked){if(bar.parentNode!==section){section.retouchSetCollapsed?.(false);section.append(bar);section.scrollIntoView({block:'start'});}for(let parent=section.parentElement;parent&&parent!==panel;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;}
    else if(bar.parentNode!==document.body)document.body.append(bar);
    if(focused&&document.activeElement!==focused)focused.focus({preventScroll:true});
  };
  const preservePanelFocus=event=>{if(event.target.closest?.('#toggleInspector,#toggleLayers'))event.preventDefault();};
  editing.focusLink=()=>{update();if(linkField.disabled)return;linkField.focus();linkField.select();};
  window.addEventListener('pointerdown',preservePanelFocus,true);
  window.addEventListener('retouch:workspace-layout',mount);window.addEventListener('retouch:viewport',update);d.addEventListener('selectionchange',update);mount();update();
  inlineFormatCleanup=()=>{window.removeEventListener('pointerdown',preservePanelFocus,true);window.removeEventListener('retouch:workspace-layout',mount);window.removeEventListener('retouch:viewport',update);d.removeEventListener('selectionchange',update);bar.remove();section?.removeAttribute('data-range-editing');for(const {node,hidden}of originals)node.hidden=hidden;section?.querySelector(':scope > h3')?.removeEventListener('click',trackCollapse);if(!collapseChanged)section?.retouchSetCollapsed?.(collapsed);inlineFormatCleanup=()=>{};if(panelRenderDeferred)queueViewportPanelRefresh();};
}

function editableLinkURL(node){
  const id=node.getAttribute('data-rt'),keepId=node.getAttribute('data-rt-keep');
  const proven=nodes=>(nodes||[]).some(item=>item.id===keepId&&item.editableLink||proven(item.children));
  return editing?.info.editableLinkIds?.includes(id)||!!keepId&&proven(editing?.info.richText?.children);
}

function applyInlineLink(href){return inlineFormattingTransaction(()=>{
  if(!editing||href!==null&&!RetouchLinkValues.valid(href))return false;
  const current=editing,d=doc(),selection=d.getSelection();if(!selection?.rangeCount)return false;
  let range=selection.getRangeAt(0).cloneRange();if(!current.el.contains(range.startContainer)||!current.el.contains(range.endContainer))return false;
  const parent=range.startContainer.nodeType===3?range.startContainer.parentElement:range.startContainer,anchor=parent.closest('a');
  if(anchor===current.el){toast('Select the parent text layer to edit this link.','err');return false;}
  if(anchor&&current.el.contains(anchor)&&anchor.contains(range.endContainer)){
    if(href===anchor.getAttribute('href'))return true;
    if(!plainInlineFormatting(anchor)){
      if(editableLinkURL(anchor)){if(href===null)anchor.removeAttribute('href');else anchor.setAttribute('href',href);anchor.__rtLinkHref=href;range.selectNodeContents(anchor);selection.removeAllRanges();selection.addRange(range);return true;}
      toast('Edit this source-owned link in its source.','err');return false;
    }
    if(range.collapsed)range.selectNodeContents(anchor);
    range=splitInlineFormatting(anchor,range,'a','a');if(!range)return false;
    selection.removeAllRanges();selection.addRange(range);
    if(href===null)return true;
  }else{
    if(href===null||range.collapsed){toast('Select text to add a link.','err');return false;}
    if(parent.closest('a')||[...current.el.querySelectorAll('a,[contenteditable="false"]')].some(node=>range.intersectsNode(node))){toast('Select one link or unlinked text.','err');return false;}
  }
  const fragment=range.cloneContents();
  const safe=node=>node.nodeType===3||node.nodeType===1&&node.tagName!=='A'&&(plainInlineFormatting(node)||node.tagName==='SPAN'&&!node.getAttribute('data-rt')&&[...node.attributes].every(a=>a.name==='style')&&RetouchRangeStyles.validProperties(Object.fromEntries([...node.style].map(name=>[name,node.style.getPropertyValue(name)])))&&[...node.childNodes].every(safe));
  if(![...fragment.childNodes].every(safe)){toast('This selection contains source-owned formatting.','err');return false;}
  const copy=node=>{if(node.nodeType===3)return d.createTextNode(node.data);const result=cloneInlineFormatting(node);for(const child of node.childNodes)result.append(copy(child));return result;};
  const link=d.createElement('a');link.setAttribute('href',href);for(const child of fragment.childNodes)link.append(copy(child));
  range.deleteContents();range.insertNode(link);range.selectNodeContents(link);selection.removeAllRanges();selection.addRange(range);return true;
});}

function applyTextRangeStyle(property,value){return inlineFormattingTransaction(()=>applyTextRangeStyleContent(property,value));}
function applyTextRangeStyleContent(property,value){
  if(!editing||!RetouchRangeStyles.valid(property,value))return;
  const d=doc(),selection=d.getSelection(),range=selection?.rangeCount?selection.getRangeAt(0):null;
  if(!range||!editing.el.contains(range.startContainer)||!editing.el.contains(range.endContainer))return;
  if(range.collapsed){if(!sameCaret(range,editing.caretStyle?.range))editing.caretStyle={properties:{},range:range.cloneRange()};editing.caretStyle.properties[property]=value;return;}
  const runs=[],walker=d.createTreeWalker(editing.el,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode;if(!range.intersectsNode(node))continue;
    const from=range.startContainer===node?range.startOffset:0,to=range.endContainer===node?range.endOffset:node.textContent.length;
    if(from<to)runs.push({node,from,to});
  }
  if(!runs.length)return;
  if(runs.some(({node})=>node.parentElement.closest('[contenteditable="false"]'))){toast('This selection includes source-owned text.','err');return;}
  const prefix=d.createRange();prefix.selectNodeContents(editing.el);prefix.setEnd(range.startContainer,range.startOffset);
  const selectionStart=prefix.toString().length,selectionEnd=selectionStart+range.toString().length;
  const authored=wrapper=>Object.fromEntries([...wrapper.style].map(name=>{const css=wrapper.style.getPropertyValue(name),stored=wrapper.__rtRangeStyleValues?.[name];return [name,stored?.css===css?stored.value:name===wrapper.__rtRangeStyle&&wrapper.__rtRangeStyleCSS===css&&wrapper.__rtRangeStyleValue?wrapper.__rtRangeStyleValue:css];}));
  const reusable=element=>{
    if(!element||element===editing.el||element.tagName!=='SPAN'||element.childNodes.length!==1||element.firstChild.nodeType!==3)return false;
    const evidence=editing.info.rangeStyleIds?.[element.getAttribute('data-rt')];
    return (element.__rtRangeStyle||evidence)&&RetouchRangeStyles.validProperties(authored(element))&&
      !element.getAttribute('data-rt-i')&&[...element.attributes].every(attr=>['style','data-rt','data-rt-keep','data-rt-revision','data-rt-client-revision','data-rt-client-mounted','data-rt-section','data-rt-block','data-rt-block-type','data-rt-template','data-rt-locale'].includes(attr.name));
  };
  const assign=(wrapper,name,value)=>{wrapper.__rtRangeStyle=name;wrapper.style.setProperty(name,value);(wrapper.__rtRangeStyleValues||={})[name]={value,css:wrapper.style.getPropertyValue(name)};if(name==='color'){wrapper.__rtRangeStyleValue=value;wrapper.__rtRangeStyleCSS=wrapper.style.getPropertyValue(name);}};
  const styled=(text,properties)=>{const wrapper=d.createElement('span');for(const [name,value]of Object.entries(properties))assign(wrapper,name,value);wrapper.textContent=text;return wrapper;};
  // Apply at text leaves, so existing child styles cannot override the choice.
  const wrappers=[];
  for(const {node,from,to}of runs){
    const parent=node.parentElement;
    if(reusable(parent)){
      if(from===0&&to===node.textContent.length){parent.__rtReplaceRangeStyle=true;assign(parent,property,value);wrappers.push(parent);}
      else{
        const oldValue=authored(parent),fragment=d.createDocumentFragment(),text=node.textContent;
        if(from)fragment.append(styled(text.slice(0,from),oldValue));
        const middle=styled(text.slice(from,to),{...oldValue,[property]:value});fragment.append(middle);wrappers.push(middle);
        if(to<text.length)fragment.append(styled(text.slice(to),oldValue));parent.replaceWith(fragment);
      }
      continue;
    }
    const part=d.createRange();part.setStart(node,from);part.setEnd(node,to);
    const wrapper=styled('',{[property]:value});part.surroundContents(wrapper);wrappers.push(wrapper);
  }
  // Coalesce only equivalent plain neighbors touching a changed run.
  for(let wrapper of wrappers){
    if(!editing.el.contains(wrapper))continue;
    const equivalent=other=>{if(!reusable(other))return false;const a=authored(wrapper),b=authored(other);return RetouchRangeStyles.names.every(name=>a[name]===b[name]);};
    if(equivalent(wrapper.previousSibling)){const previous=wrapper.previousSibling;previous.textContent+=wrapper.textContent;wrapper.remove();wrapper=previous;}
    while(equivalent(wrapper.nextSibling)){const next=wrapper.nextSibling;wrapper.textContent+=next.textContent;next.remove();}
    wrapper.__rtRangeStyle=property;wrapper.__rtReplaceRangeStyle=true;
  }
  // Node identities can change during splitting/merging; restore by text offsets.
  const next=d.createRange(),texts=d.createTreeWalker(editing.el,NodeFilter.SHOW_TEXT);let offset=0,started=false;
  while(texts.nextNode()){
    const node=texts.currentNode,end=offset+node.textContent.length;
    if(!started&&selectionStart<end){next.setStart(node,selectionStart-offset);started=true;}
    if(started&&selectionEnd<=end){next.setEnd(node,selectionEnd-offset);break;}offset=end;
  }
  selection.removeAllRanges();selection.addRange(next);
}

function plainInlineFormatting(node){
  if(node.nodeType===3)return true;if(node.nodeType!==1||node.getAttribute('data-rt-i'))return false;
  const stamps=['data-rt','data-rt-keep','data-rt-revision','data-rt-client-revision','data-rt-client-mounted','data-rt-section','data-rt-block','data-rt-block-type','data-rt-template','data-rt-locale'];
  const id=node.getAttribute('data-rt'),span=node.tagName==='SPAN';
  if(node.tagName==='A'){
    const keepId=node.getAttribute('data-rt-keep'),sourceLink=nodes=>(nodes||[]).some(item=>item.id===keepId&&item.plainLink||sourceLink(item.children));
    const proven=!id&&!keepId||editing.info.plainLinkIds?.includes(id)||keepId&&sourceLink(editing.info.richText?.children);
    return proven&&RetouchLinkValues.valid(node.getAttribute('href'))&&[...node.attributes].every(attribute=>attribute.name==='href'||stamps.includes(attribute.name))&&[...node.childNodes].every(plainInlineFormatting);
  }
  if(node.tagName==='BR')return !node.childNodes.length&&[...node.attributes].every(attribute=>stamps.includes(attribute.name))&&(!id||!editing.info.plainFormattingIds||editing.info.plainFormattingIds.includes(id));
  if(span){if(!node.__rtRangeStyle&&!editing.info.rangeStyleIds?.[id])return false;if(!RetouchRangeStyles.validProperties(Object.fromEntries([...node.style].map(name=>[name,node.style.getPropertyValue(name)]))))return false;}
  else if(!/^(STRONG|B|EM|I|U|S|SUP|SUB)$/.test(node.tagName)||id&&editing.info.plainFormattingIds&&!editing.info.plainFormattingIds.includes(id))return false;
  return [...node.attributes].every(attribute=>stamps.includes(attribute.name)||span&&attribute.name==='style')&&[...node.childNodes].every(plainInlineFormatting);
}
function cloneInlineFormatting(node){
  const result=node.ownerDocument.createElement(node.tagName.toLowerCase());
  if(node.tagName==='A')result.setAttribute('href',node.getAttribute('href'));
  if(node.tagName==='SPAN'){result.style.cssText=node.style.cssText;for(const name of caretMetadataNames.filter(name=>name!=='__rtKeep'))if(Object.hasOwn(node,name))result[name]=structuredClone(node[name]);result.__rtRangeStyle||=node.style[0];}
  return result;
}

function splitInlineFormatting(previous,r,tag,selector){
  const d=previous.ownerDocument;
  const prefix=d.createRange();prefix.selectNodeContents(previous);prefix.setEnd(r.startContainer,r.startOffset);
  const from=prefix.toString().length,to=from+r.toString().length,total=previous.textContent.length;
  if(from===to)return;
  // Slice each text interval through the same tree, retaining other inline styles.
  const slice=(from,to,remove)=>{
    let offset=0;
    const visit=node=>{
      if(node.tagName==='BR')return offset>=from&&(offset<to||offset===total&&to===total)?d.createElement('br'):d.createDocumentFragment();
      if(node.nodeType===3){const start=offset;offset+=node.textContent.length;return d.createTextNode(node.textContent.slice(Math.max(0,from-start),Math.max(0,Math.min(to,offset)-start)));}
      const result=remove&&node.matches(selector)?d.createDocumentFragment():cloneInlineFormatting(node);
      for(const child of node.childNodes){const next=visit(child);if(next.textContent||next.tagName==='BR'||next.querySelector?.('br'))result.append(next);}
      return result;
    };
    return visit(previous);
  };
  const parts=d.createDocumentFragment();if(from)parts.append(slice(0,from,false));
  let middle=slice(from,to,true);
  if(!previous.matches(selector)){
    // Superscript and subscript are mutually exclusive; retain nested emphasis.
    const content=d.createDocumentFragment();while(middle.firstChild)content.append(middle.firstChild);
    middle=d.createElement(tag);middle.append(content);
  }
  const selectedNodes=middle.nodeType===11?[...middle.childNodes]:[middle];
  parts.append(middle);if(to<total)parts.append(slice(to,total,false));previous.replaceWith(parts);
  const selected=d.createRange();if(selectedNodes.length===1)selected.selectNodeContents(selectedNodes[0]);else {selected.setStartBefore(selectedNodes[0]);selected.setEndAfter(selectedNodes.at(-1));}return selected;
}

/* ---------- bold / italic on selection (Cmd+B / Cmd+I) ---------- */
function toggleWrap(tag){return inlineFormattingTransaction(()=>toggleWrapContent(tag));}
function toggleWrapContent(tag) {
  const d = doc();
  if (!d || !editing) return;
  if (editing.info.canSetChildren === false) return toast('This source cannot preserve rich text formatting.', 'err');
  const s = d.getSelection();
  if (!s || !s.rangeCount) return;
  let r = s.getRangeAt(0);
  if (!editing.el.contains(r.startContainer)||!editing.el.contains(r.endContainer)) return;
  if(r.collapsed){if(tag==='u'||tag==='s'){const parent=r.startContainer.nodeType===3?r.startContainer.parentElement:r.startContainer,ancestor=parent.closest(tag);if(ancestor===editing.el||ancestor&&!plainInlineFormatting(ancestor)){toast('Select the parent text layer or edit this source-owned formatting in source.','err');return;}if(!sameCaret(r,editing.caretStyle?.range))editing.caretStyle={properties:{},range:r.cloneRange()};const decorations=editing.caretStyle.decorations||={};decorations[tag]=!(decorations[tag]??!!ancestor);d.dispatchEvent(new Event('selectionchange'));return;}if(tag==='sup'||tag==='sub'){const parent=r.startContainer.nodeType===3?r.startContainer.parentElement:r.startContainer,ancestor=parent.closest('sup,sub');if(ancestor===editing.el){toast('Select the parent text layer to change this script position.','err');return;}if(ancestor&&!plainInlineFormatting(ancestor)){toast('Edit this source-owned formatting in its source.','err');return;}if(!sameCaret(r,editing.caretStyle?.range))editing.caretStyle={properties:{},range:r.cloneRange()};const current=editing.caretStyle.script??(ancestor&&ancestor!==editing.el?ancestor.tagName.toLowerCase():'normal');editing.caretStyle.script=current===tag?'normal':tag;d.dispatchEvent(new Event('selectionchange'));return;}const property=tag==='strong'?'font-weight':tag==='em'?'font-style':null;if(!property)return;const parent=r.startContainer.nodeType===3?r.startContainer.parentElement:r.startContainer,value=editing.caretStyle?.properties[property]||d.defaultView.getComputedStyle(parent).getPropertyValue(property);applyTextRangeStyle(property,tag==='strong'?(parseFloat(value)>=600?'400':'700'):(value==='italic'?'normal':'italic'));d.dispatchEvent(new Event('selectionchange'));return;}
  // Element-offset selections can enclose a formatted run without either
  // endpoint being inside it. Normalize those boundaries before toggling off.
  const selector = tag === 'strong' ? 'strong,b' : tag === 'em' ? 'em,i' : tag;
  const textNodes=selectedInlineTextNodes(editing.el,r),first=textNodes[0],last=textNodes.at(-1);
  // A uniform selection may span several independently authored runs. Plan
  // every slice before mutating any wrapper so one owned run cannot leave a
  // partially applied command behind.
  const groups=new Map();let uniform=!!textNodes.length;
  for(const node of textNodes){
    let wrapper=node.parentElement.closest(selector);
    if(!wrapper||wrapper===editing.el||!editing.el.contains(wrapper)){uniform=false;break;}
    for(let parent=wrapper.parentElement;parent&&parent!==editing.el;parent=parent.parentElement)if(parent.matches(selector))wrapper=parent;
    if(!groups.has(wrapper))groups.set(wrapper,[]);groups.get(wrapper).push(node);
  }
  if(uniform&&groups.size>1){
    if([...groups.keys()].some(wrapper=>!plainInlineFormatting(wrapper))){toast('Edit this source-owned formatting in its source.','err');return false;}
    const plans=[...groups].map(([wrapper,nodes])=>{
      const range=d.createRange(),first=nodes[0],last=nodes.at(-1);
      range.setStart(first,r.startContainer===first?r.startOffset:0);range.setEnd(last,r.endContainer===last?r.endOffset:last.length);
      return {wrapper,range};
    });
    const prefix=d.createRange();prefix.selectNodeContents(editing.el);prefix.setEnd(r.startContainer,r.startOffset);
    const from=prefix.toString().length,to=from+r.toString().length,snapshot=captureCaretEdit(editing);
    try{
      for(const {wrapper,range}of plans)if(!splitInlineFormatting(wrapper,range,tag,selector))throw Error('The selected formatting changed.');
      const selected=inlineRangeAt(editing.el,from,to);if(!selected)throw Error('The selected text changed.');
      s.removeAllRanges();s.addRange(selected);return true;
    }catch{restoreCaretEdit(editing,snapshot);toast('The selected formatting could not be changed.','err');return false;}
  }
  const enclosing=first?.parentElement.closest(tag==='sup'||tag==='sub'?'sup,sub':selector);
  if(enclosing&&enclosing!==editing.el&&textNodes.every(node=>enclosing.contains(node))&&(!enclosing.contains(r.startContainer)||!enclosing.contains(r.endContainer))){
    const normalized=d.createRange();normalized.setStart(first,r.startContainer===first?r.startOffset:0);normalized.setEnd(last,r.endContainer===last?r.endOffset:last.length);r=normalized;
  }
  // Split only the selected portion when toggling existing formatting.
  const cac = r.commonAncestorContainer;
  const start = cac.nodeType === 1 ? cac : cac.parentElement;
  {
    const previous=start?.closest(tag==='sup'||tag==='sub'?'sup,sub':selector);
    if(previous&&previous!==editing.el&&editing.el.contains(previous)&&previous.contains(r.startContainer)&&previous.contains(r.endContainer)){
      // Reconstruct only plain formatting whose source ownership is known.
      if(!plainInlineFormatting(previous)){toast('Edit this source-owned formatting in its source.','err');return false;}
      const selected=splitInlineFormatting(previous,r,tag,selector);if(!selected)return false;
      s.removeAllRanges();s.addRange(selected);return true;
    }
  }
  const w = d.createElement(tag);
  try {
    r.surroundContents(w);
  } catch {
    const frag = r.extractContents();
    w.appendChild(frag);
    r.insertNode(w);
  }
  s.removeAllRanges();
  const nr = d.createRange();
  nr.selectNodeContents(w);
  s.addRange(nr);return true;
}

/* ---------- overlays ---------- */
const hoverDescriptions = new WeakMap();
function hoverDescription(el) {
  let entry=hoverDescriptions.get(el);
  if(!entry || (!entry.pending && Date.now()-entry.updated>2000)) {
    entry={info:entry?.info || null,element:entry?.element||el,pending:true,updated:Date.now()};
    hoverDescriptions.set(el,entry);
    classifyNode(el).then(result=>{
      entry.info=result?.info || {unresolved:true};entry.element=result?.el||el;entry.pending=false;entry.updated=Date.now();
    });
  }
  return {info:entry.info,element:entry.element||el};
}
function outlineKind(el, info) {
  if(info?.kind==='instance' && (!info.inlineComponent||componentLibrarySelections.has(info.id)))return 'instance';
  if(!info)return null;
  return !info.unresolved && (info.classNameDynamic===false || info.text!=null || info.canSetChildren || info.canSetSrc || info.canSetTag) ? 'editable' : 'readonly';
}
const componentBadge=document.createElement('div');
componentBadge.className='component-badge';componentBadge.hidden=true;
componentBadge.innerHTML='<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0 11.5 3.5 8 7 4.5 3.5ZM3.5 4.5 7 8 3.5 11.5 0 8ZM12.5 4.5 16 8 12.5 11.5 9 8ZM8 9 11.5 12.5 8 16 4.5 12.5Z"/></svg><span>component</span><button type="button" title="detach" aria-label="detach"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 2-4 6 6 6m4-12 4 6-4 6M9 1 7 15" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></button>';
overlayLayer.parentElement.appendChild(componentBadge);
let badgeTarget=null;
componentBadge.querySelector('button').onclick=async()=>{
  const target=badgeTarget;if(!target)return;
  const button=componentBadge.querySelector('button');button.disabled=true;
  try {
    await commitInlineEdit();
    const context=renderContext(target.el);
    const component=await api('GET',componentUrl(target.id,context));
    if(!component?.ok || !component.canDetach)return toast(component?.reason || 'This component cannot be detached.','err');
    await detachInstance(target.id,component,button,context);
  } finally {button.disabled=false;}
};
const svgSelectionGaps=RetouchSVGSelection.gapControls({frame:iframe,canvas:canvasSurface});
const svgSelectionCorners=RetouchSVGSelection.controls({frame:iframe,canvas:canvasSurface,onStart:(event,handle)=>moveSVGSelection({initialPointer:event,handle}),onRotate:(event,handle)=>moveSVGSelection({initialPointer:event,handle,rotating:true})});
const svgResizeCorners=RetouchSVGResize.controls({frame:iframe,canvas:canvasSurface,onStart:resizeSVGOnCanvas,onRotate:(info,target,event,handle)=>resizeSVGOnCanvas(info,target,event,handle,'rotate')});
const radiusCorners=RetouchSVGRadiusCanvas.controls({frame:iframe,canvas:canvasSurface,onStart:roundRectangleOnCanvas});
const rotationCorners=RetouchCanvasRotate.cornerControls({frame:iframe,canvas:canvasSurface,onStart:rotateLayerOnCanvas});
function paintLoop() {
  advanceArmedCanvasTool();
  overlayLayer.textContent = '';
  const d = doc();
  let badge=null;
  if (d && sel && mode==='edit'&&!RetouchSVGSelection.isRotating()) {
    const id=activeId();
    let first=true;
    const targets=matchingInDocument(d,id,sel.info).filter(el=>inTextScope(el,sel.info));
    const groups=RetouchComponentInstances.prioritize(sel.info.kind==='instance'?RetouchComponentInstances.group(targets,sel.info.rootGroups):targets.map(el=>({element:el,elements:[el]})),renderedSelection?.id===id?renderedSelection.element:null);
    for(const group of groups) {
      const el=group.element,kind=outlineKind(el,sel.info);
      const bounds=RetouchComponentInstances.bounds(group.elements);if(bounds){if(group.elements.length===1)drawBox(el,first?'sel':'co',kind);else drawBounds(bounds,first?'sel':'co',kind);}
      if(first && kind==='instance')badge={el,elements:group.elements,id:el.getAttribute('data-rt-i') || id,name:sel.info.tag};
      first=false;
    }
  }
  if(d&&sel?.multiple&&mode==='edit'&&!RetouchSVGSelection.isRotating())for(const info of sel.multiple)if(info.id!==activeId()){
    const targets=matchingEls(info.id).filter(el=>inTextScope(el,info));
    const groups=info.kind==='instance'?RetouchComponentInstances.group(targets,info.rootGroups):targets.map(el=>({element:el,elements:[el]}));
    for(const group of groups){const bounds=RetouchComponentInstances.bounds(group.elements);if(bounds){if(group.elements.length===1)drawBox(group.element,'co',outlineKind(group.element,info));else drawBounds(bounds,'co',outlineKind(group.element,info));}}
  }
  if(d&&mode==='edit'&&sel?.multiple?.length>1&&sel.multiple.every(info=>info.svgTransform)){const groups=sel.multiple.map(info=>matchingEls(info.id));if(groups.every(group=>group.length===1)){const bounds=RetouchComponentInstances.bounds(groups.flat());if(bounds&&!RetouchSVGSelection.isRotating())drawBounds(bounds,'sel svg-selection-bounds','editable');}}
  if(d && editing?.el.isConnected)drawBox(editing.el,'editing',outlineKind(editing.el,editing.info));
  if(d && hoverEl?.isConnected && mode==='edit' && !editing && !stopDrawing) {
    const hovered=hoverDescription(hoverEl),target=hovered.element,info=hovered.info,kind=outlineKind(target,info);
    const group=kind==='instance'?RetouchComponentInstances.group(matchingInDocument(d,info.id,info),info.rootGroups).find(group=>group.elements.includes(target)):null;
    const elements=group?.elements||[target],bounds=RetouchComponentInstances.bounds(elements);
    if(kind&&bounds){if(elements.length===1)drawBox(target,'hover',kind);else drawBounds(bounds,'hover',kind);}
    if(kind==='instance')badge={el:target,elements,id:info.id,name:info.tag};
  }
  // Keep the badge mounted so pointer/focus events survive animation frames.
  if(componentBadge.matches(':hover') || componentBadge.contains(document.activeElement))badge=badgeTarget;
  if(mode!=='edit' || sel?.multiple?.length>1 || !badge?.el.isConnected)badge=null;
  badgeTarget=badge;componentBadge.hidden=!badge;
  if(badge){
    const label=componentBadge.querySelector('span'),name=badge.name||'Component';if(label.textContent!==name)label.textContent=name;label.title=name;
    const r=RetouchComponentInstances.bounds((badge.elements||[badge.el]).filter(el=>el.isConnected))||badge.el.getBoundingClientRect();
    const zoom=parseFloat(getComputedStyle(componentBadge).getPropertyValue('--canvas-zoom'))||1,pageWidth=d.defaultView.innerWidth;
    componentBadge.style.maxWidth=Math.max(60,Math.min(240,pageWidth*zoom))+'px';
    componentBadge.style.left=Math.max(0,Math.min(r.left,pageWidth-componentBadge.offsetWidth/zoom))+'px';
    componentBadge.style.top=Math.max(0,r.top-22)+'px';
  }
  const rotationInput=!sel?.info.svgTransform&&mode==='edit'&&!editing&&!stopDrawing&&!canvasPan.active&&!panelTasks&&!undoBusy&&!sourceRequests&&!sel?.multiple?.length&&!document.querySelector('dialog[open]')&&document.querySelector('[aria-label="Edit range status"]')?.dataset.match!=='false'?panelBody.querySelector('input[aria-label="Rotation (°)"]'):null;
  const radiusInput=mode==='edit'&&!editing&&!stopDrawing&&!canvasPan.active&&!panelTasks&&!undoBusy&&!sourceRequests&&!sel?.multiple?.length&&!document.querySelector('dialog[open]')?panelBody.querySelector('[aria-label="Rectangle corner radius"]'):null;
  radiusCorners.update(radiusInput?.retouchRadiusTarget,radiusInput);
  const svgResizeInfo=mode==='edit'&&!editing&&!stopDrawing&&!canvasPan.active&&!panelTasks&&!undoBusy&&!sourceRequests&&!(sel?.multiple?.length>1)&&!document.querySelector('dialog[open]')?sel?.info:null;
  const svgResizeTargets=svgResizeInfo?.svgTransform?.editable?matchingEls(svgResizeInfo.id):[];svgResizeCorners.update(svgResizeTargets.length===1?svgResizeTargets[0]:null,svgResizeInfo);
  const selectionResizeInfos=mode==='edit'&&!editing&&!stopDrawing&&!canvasPan.active&&!panelTasks&&!undoBusy&&!sourceRequests&&sel?.multiple?.length>1&&!document.querySelector('dialog[open]')?sel.multiple:null;
  const selectionResizeElements=selectionResizeInfos?.map(info=>{const found=matchingEls(info.id);return found.length===1&&!layerLocks.locked(found[0])?found[0]:null;});
  svgSelectionCorners.update(selectionResizeElements?.every(Boolean)?selectionResizeInfos:null,selectionResizeElements);
  RetouchSVGMask.paintOutlines({frame:iframe,canvas:canvasSurface,active:mode==='edit',comparisons:window.RetouchComparisons?.outlineViews()||[]});
  svgSelectionGaps.update(selectionResizeElements?.every(Boolean)?selectionResizeInfos:null,selectionResizeElements);
  rotationCorners.update(rotationInput?.retouchPreviewTarget,rotationInput,rotationInput&&!sel?.info.svgTransform?panelBody.querySelector('[data-canvas-tool=resize]'):null);
  if(d&&sel&&mode==='edit'&&!editing&&window.RetouchGridGuidesEnabled)RetouchInspector.drawGridGuides(overlayLayer,renderedSelection?.element||matchingEls(activeId())[0]);
  if (d && measuring && hoverEl?.isConnected && mode === 'edit') RetouchInspector.measurements(overlayLayer, hoverEl, sel ? matchingEls(activeId())[0] : null);
  marqueeSurface.textContent='';
  if(selectionMarquee?.document===d){
    const rect=selectionMarquee.rect,area=canvasSurface.getBoundingClientRect(),frame=iframe.getBoundingClientRect(),scale=frame.width/d.defaultView.innerWidth,box=document.createElement('div');
    Object.assign(marqueeSurface.style,{left:area.left+canvasSurface.clientLeft+'px',top:area.top+canvasSurface.clientTop+'px',width:canvasSurface.clientWidth+'px',height:canvasSurface.clientHeight+'px'});
    box.className='selection-marquee';Object.assign(box.style,{left:frame.left-area.left-canvasSurface.clientLeft+rect.left*scale+'px',top:frame.top-area.top-canvasSurface.clientTop+rect.top*scale+'px',width:rect.width*scale+'px',height:rect.height*scale+'px'});marqueeSurface.append(box);
  }
  document.getElementById('canvasHand').disabled=mode!=='edit'||!!editing||!!panelTasks||undoBusy||!!sourceRequests;
  document.getElementById('zoomSelection').disabled=!sel||!!panelTasks||undoBusy||!!sourceRequests;
  syncLayerSelection();
  requestAnimationFrame(paintLoop);
}

function syncLayerSelection() {
  layers.selection(sel ? matchingEls(activeId()).find(el=>inTextScope(el,sel.info)) : null, sel?.multiple?.length>1&&sel.info.kind==='instance'?{...sel.info,selectionIds:sel.multiple.map(info=>info.id),selectionCanDuplicate:sel.multiple.every(info=>info.canDuplicateComponent),selectionCanDelete:sel.multiple.every(info=>info.canDeleteComponent),selectionCanReparent:sharedComponentContainers(sel.multiple).length>0,selectionContainers:sharedComponentContainers(sel.multiple),selectionTargets:sharedComponentTargets(sel.multiple),selectionOrdering:sharedComponentOrdering(sel.multiple)}:sel?.multiple?.length>1&&sel.multiple.some(info=>info.svgBooleanOwner)&&sel.multiple.every(info=>info.svgBooleanOwner||info.svgTransform||info.svgGeometry)&&new Set(sel.multiple.map(info=>info.file+'#'+info.hash)).size===1?{...sel.info,selectionBooleanDelete:true}:sel?.multiple?.length>1?{...sel.info,selectionOrdering:sharedNativeOrdering(sel.multiple),selectionCanFrame:sharedNativeFraming(sel.multiple),selectionCanReparent:new Set(sel.multiple.map(info=>info.file+'#'+info.hash)).size===1&&sel.multiple.every(info=>info.kind==='host'&&info.structure?.canReparent),selectionCanDuplicate:new Set(sel.multiple.map(info=>info.file+'#'+info.hash)).size===1&&sel.multiple.every(info=>info.kind==='host'&&info.structure?.canDuplicate),selectionCanDelete:new Set(sel.multiple.map(info=>info.file+'#'+info.hash)).size===1&&sel.multiple.every(info=>info.kind==='host'&&info.structure?.canDelete)}:sel?.info, !!panelTasks || undoBusy || !!sourceRequests,sel?.multiple?.flatMap(info=>matchingEls(info.id))||[],historyRecoveryRequired);
}

function inTextScope(el, info) {
  return Object.entries(info.renderScope || {}).every(([name,value])=>el.getAttribute(name)===value);
}
function drawBox(el, cls, kind) {
  if(cls==='sel'&&document.querySelector('.canvas-move-surface[data-local-move], .canvas-local-rotate-surface[data-local-move]')?.dataset.localMove===el.getAttribute('data-rt'))return;
  const css=el.ownerDocument.defaultView.getComputedStyle(el);
  if(css.display==='contents'){const bounds=RetouchComponentInstances.bounds([el]);if(bounds)drawBounds(bounds,cls,kind);return;}
  if(css.rotate&&css.rotate!=='none'&&css.rotate!=='0deg'||css.scale&&css.scale!=='none')try{const g=RetouchInspector.outlineGeometry(el);if(g.rotation||g.scaleX!==1||g.scaleY!==1){drawBounds({left:g.layoutLeft,top:g.layoutTop,width:g.width,height:g.height},cls,kind,{rotation:g.rotation,origin:g.transformOrigin});return;}}catch{}
  try{let g;try{g=RetouchInspector.positionGeometry(el);}catch{g=RetouchInspector.localPositionGeometry(el,{allowFlow:true});}if(g.localCoordinates){const points=RetouchCanvasRotate.localControls(el,1,g).outline,svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),polygon=document.createElementNS(svg.namespaceURI,'polygon');svg.classList.add('affine-selection-outline',cls,kind);Object.assign(svg.style,{position:'absolute',inset:'0',width:'100%',height:'100%',overflow:'visible',pointerEvents:'none'});polygon.setAttribute('points',points.map(p=>p.x+','+p.y).join(' '));polygon.setAttribute('fill','none');polygon.setAttribute('stroke',kind==='readonly'?'var(--danger)':kind==='instance'?'var(--instance)':'var(--accent)');polygon.setAttribute('stroke-width',cls==='sel'?'2':'1.5');polygon.setAttribute('vector-effect','non-scaling-stroke');if(cls==='hover')polygon.setAttribute('stroke-dasharray','4 3');svg.append(polygon);overlayLayer.append(svg);return;}}catch{}
  drawBounds(el.getBoundingClientRect(),cls,kind);
}
function drawBounds(r,cls,kind,{rotation=0,origin='center'}={}){
  if (r.width === 0 && r.height === 0) return;
  const b = document.createElement('div');
  b.className = 'box ' + cls + ' ' + kind;
  b.style.left = r.left + 'px';
  b.style.top = r.top + 'px';
  b.style.width = r.width + 'px';
  b.style.height = r.height + 'px';
  if(rotation){b.style.rotate=rotation+'deg';b.style.transformOrigin=origin;b.style.borderRadius='0';}
  overlayLayer.appendChild(b);
}

/* ---------- panel ---------- */
function screenScopeSection() {
  const section = document.createElement('div');
  section.className = 'screen-scope';
  const label = document.createElement('label');
  label.textContent = 'Edit styles for';
  const picker = document.createElement('select');
  picker.setAttribute('aria-label', 'Style screen scope');
  const options = [{prefix:'',label:'All sizes · base'}];
  if(sel?.info.cssAuthoring) options.push(...[...new Set((sel.multiple||[sel.info]).flatMap(info=>Object.keys(info.cssRules||{})))].map(Number).filter(w=>w>0).sort((a,b)=>a-b).map(w=>({prefix:`min-[${w}px]:`,label:`${w} px and larger`})));
  else if (doc()) options.push(...RetouchResponsive.discover(doc()));
  const width = iframe.contentWindow?.innerWidth;
  let previewScope = null;
  if (Number.isInteger(width) && width >= 240) {
    const atWidth = (sel?.info.cssAuthoring||sel?.info.groupScale||sel?.info.scaleMember)?{prefix:`min-[${width}px]:`,label:`${width} px and larger`}:RetouchResponsive.atWidth(doc(),width,options.slice(1));
    previewScope = atWidth;
    if (!options.some(o=>o.prefix===atWidth.prefix)) options.push(atWidth);
  }
  if (styleScope && !options.some(o=>o.prefix===styleScope)) options.push({prefix:styleScope,label:styleScope.slice(0,-1)});
  for (const item of RetouchResponsive.orderedScopes(doc(),options)) {
    const option = document.createElement('option');
    option.value = item.prefix;
    option.textContent = RetouchResponsive.scopeLabel(doc(),item);
    option.title = item.condition || item.label;
    picker.append(option);
  }
  picker.value = styleScope;
  picker.onchange = () => {
    // Programmatic/accessibility selection can change this control without
    // blurring the prior input first. Finish that field in its original scope.
    const focused=document.activeElement;
    if(focused!==picker&&panelBody.contains(focused))focused.blur();
    stopDrawing?.(); styleScope = picker.value; renderPanel();
  };
  label.append(picker);section.append(label);
  RetouchInspector.note(section, styleScope
    ? 'Style changes apply to this breakpoint. Computed values reflect the preview; text and image content stay shared across sizes.'
    : 'Base styles apply at every size unless a breakpoint or state overrides them.');
  const chosen = options.find(o=>o.prefix===styleScope);
  const arbitrary = /^(min|max)-\[([\d.]+(?:px|rem|em))\]:$/.exec(styleScope);
  const condition = chosen?.condition || (arbitrary ? `(${arbitrary[1]}-width: ${arbitrary[2]})` : null);
  section.retouchPreviewDocument=iframe.contentDocument;
  section.retouchPreviewSize=()=>{const size={width:iframe.contentWindow.innerWidth,height:iframe.contentWindow.innerHeight};return condition?RetouchResponsive.previewSize({condition,queries:chosen?.queries},document,size):null;};
  section.retouchPreviewRange=()=>{const size=section.retouchPreviewSize();if(!size)return false;stopDrawing?.();window.RetouchScreens?.set(size);return true;};
  const scopeStatus=document.createElement('div');scopeStatus.className='scope-status';scopeStatus.setAttribute('role','status');scopeStatus.setAttribute('aria-label','Edit range status');
  const matchesPreview=styleScope?(condition?RetouchResponsive.matches({condition,queries:chosen?.queries},iframe.contentWindow):null):true;
  scopeStatus.dataset.match=matchesPreview===null?'unknown':String(matchesPreview);
  scopeStatus.textContent=!styleScope?'Base styles · all screen sizes':matchesPreview===true?'Preview matches edit range':matchesPreview===false?'Preview is outside edit range':'Preview match is unknown';
  section.append(scopeStatus);
  if(matchesPreview===false&&previewScope&&previewScope.prefix!==styleScope){
    const edit=RetouchInspector.button('Edit '+previewScope.label,()=>{
      picker.value=previewScope.prefix;
      picker.dispatchEvent(new Event('change',{bubbles:true}));
    });
    edit.id='editPreviewBreakpoint';
    edit.title='Keep the current preview and change the range for subsequent style edits. Switching ranges does not change the site.';
    section.append(edit);
  }
  window.dispatchEvent(new CustomEvent('retouch:style-scope',{detail:{prefix:styleScope,label:chosen?.label||styleScope,condition,queries:chosen?.queries}}));
  if (condition) {
    const applies=RetouchResponsive.matches({condition,queries:chosen?.queries},iframe.contentWindow),currentSize={width:iframe.contentWindow.innerWidth,height:iframe.contentWindow.innerHeight};
    if(applies===false)RetouchInspector.note(section, 'This breakpoint does not match the current preview. Its conditions may include width, height or orientation.');
    const previewSize=applies===true?currentSize:RetouchResponsive.previewSize({condition,queries:chosen?.queries},document,currentSize);
    if(previewSize){
      if(applies!==true){const preview=RetouchInspector.button('Preview this breakpoint',()=>{stopDrawing?.();preview.blur();window.RetouchScreens?.set(previewSize);});preview.id='previewBreakpoint';preview.title=`Preview at ${previewSize.width} × ${previewSize.height}. Undo preview size restores the previous screen.`;section.append(preview);}
      const compare=RetouchInspector.button('Compare this breakpoint',()=>{if(!window.RetouchComparisons?.showSize({...previewSize,label:chosen?.label||styleScope}))toast('Remove a comparison or finish the current operation first.','err');});compare.id='compareBreakpoint';compare.dataset.width=previewSize.width;compare.dataset.height=previewSize.height;compare.disabled=!window.RetouchComparisons?.canShowSize(previewSize);compare.title='Keep the main canvas size and open a matching comparison. Reuses an existing screen with the same dimensions.';section.append(compare);
      const outside=RetouchResponsive.previewSize({condition,queries:chosen?.queries},document,previewSize,false),inside=outside&&RetouchResponsive.previewSize({condition,queries:chosen?.queries},document,outside);
      if(inside){const pair=[{...outside,label:'Outside '+(chosen?.label||styleScope)},{...inside,label:chosen?.label||styleScope}],across=RetouchInspector.button('Compare across breakpoint',()=>{if(!window.RetouchComparisons?.showSizes(pair))toast('Make room for both comparison sizes or finish the current operation first.','err');});across.id='compareBreakpointBoundary';across.dataset.sizes=JSON.stringify(pair);across.disabled=!window.RetouchComparisons?.canShowSizes(pair);across.title=`Compare ${outside.width} × ${outside.height} with ${inside.width} × ${inside.height}. The main canvas stays unchanged.`;section.append(across);}

    }
  }
  if(sel.info.cssAuthoring&&styleScope&&(sel.multiple||[sel.info]).every(info=>info.cssAuthoring)){
    const scopeWidth=/^min-\[(\d+)px\]:$/.exec(styleScope),width=scopeWidth?Number(scopeWidth[1]):null;
    if(width!==null&&(sel.multiple||[sel.info]).some(info=>Object.keys(info.cssRules?.[width]||{}).length)){const reset=RetouchInspector.button('Reset overrides at this size',()=>{stopDrawing?.();if(sel.multiple?.length)void setHTMLCSSSelection(undefined,undefined,width,undefined,true);else void setHTMLCSS(undefined,undefined,width,true);});reset.title='Remove the selected layers’ local styles at '+width+' px and larger. Base styles and other breakpoints stay in place. Undo restores these overrides.';section.append(reset);}
  }
  if(!sel.info.cssAuthoring&&styleScope){
    const infos=sel.multiple||[sel.info],editable=infos.every(info=>!info.classNameDynamic&&(!sel.multiple?.length||info.classSelection));
    if(editable&&infos.some(info=>RetouchResponsive.project(info.className,styleScope)))section.append(RetouchInspector.button('Reset overrides at this size',()=>{
      if(sel.multiple?.length){const classes=Object.fromEntries(sel.multiple.map(info=>[info.id,RetouchResponsive.replaceScope(info.className,'',styleScope)]));void setReactClassesSelection(classes);}else void setClasses('');
    }));
  }
  return section;
}
window.addEventListener('retouch:comparisons',()=>{const across=document.getElementById('compareBreakpointBoundary');if(across)across.disabled=!window.RetouchComparisons?.canShowSizes(JSON.parse(across.dataset.sizes));const button=document.getElementById('compareBreakpoint');if(button)button.disabled=!window.RetouchComparisons?.canShowSize({width:Number(button.dataset.width),height:Number(button.dataset.height)});});
// Scope navigation needs fresh viewport choices even while its selector has focus.
// Paint menus live outside the panel, but their source control is still in use.
function panelPaintDraftFocused(){const picker=document.querySelector('.paint-picker[open], .svg-paint-menu');return !!picker&&panelBody.contains(picker.retouchSourceInput);}
function panelInteractionFocused(){return panelPaintDraftFocused()||panelBody.contains(document.activeElement)&&!document.activeElement.matches('[data-canvas-tool], [aria-label="Style screen scope"]');}
let viewportRenderPending = false;
function queueViewportPanelRefresh(){
  if(viewportRenderPending)return;
  viewportRenderPending=true;
  requestAnimationFrame(()=>{
    viewportRenderPending=false;
    if(sel){if(panelTasks||panelInteractionFocused())panelRenderDeferred=true;else renderPanel();}
  });
}
window.addEventListener('retouch:viewport',queueViewportPanelRefresh);
window.addEventListener('retouch:paint-menu-close',queueViewportPanelRefresh);
let renderedPanelSelection=null,panelPointer=null,panelRenderDeferred=false;
window.addEventListener('pointerdown',event=>{
  if(event.button===0&&panelBody.contains(event.target))panelPointer={id:event.pointerId};
},true);
function releasePanelPointer(event){
  const pointer=panelPointer;if(!pointer||event&&event.pointerId!==pointer.id)return;
  // Keep the existing control through the browser's compatibility click.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(panelPointer!==pointer)return;panelPointer=null;
    if(panelRenderDeferred&&sel&&!panelInteractionFocused()){panelRenderDeferred=false;renderPanel();}
  }));
}
// A late scope response can be deferred behind the selection click. If the user
// has already started editing another control, keep that draft and refresh only
// after focus leaves the inspector; Tab between fields must not release it.
panelBody.addEventListener('focusout',()=>requestAnimationFrame(()=>{
  if(panelRenderDeferred&&sel&&!panelPointer&&!panelInteractionFocused())renderPanel();
}));
window.addEventListener('pointerup',releasePanelPointer,true);
window.addEventListener('pointercancel',releasePanelPointer,true);
// Native accessibility activation can finish with click without delivering a
// pointerup. The completed click also ends our control-preservation window.
window.addEventListener('click',()=>{
  const pointer=panelPointer;
  // The click handler must finish, but a background native WebView may not
  // paint again promptly. A microtask releases only this completed gesture.
  queueMicrotask(()=>{
    if(!pointer||panelPointer!==pointer)return;
    panelPointer=null;
    if(panelRenderDeferred&&sel&&!panelInteractionFocused())renderPanel();
  });
});
window.addEventListener('blur',()=>releasePanelPointer());
function renderPanel(textEditing=false) {
  // A completed source write can outlive selection cleared by the frame reload.
  if(!sel?.info)return;
  // A reload or document.open() can leave the preview without a root. Keep
  // the current inspector until the frame load restores measurable content.
  const previewDocument=doc();
  if(!previewDocument?.documentElement||!previewDocument.body||!previewDocument.defaultView){panelRenderDeferred=true;return;}
  if(editing){panelRenderDeferred=true;return;}
  // Selection is part of the completed edit, even before the next paint.
  syncLayerSelection();
  const panel=document.getElementById('panel');
  const key=JSON.stringify([sel.info.file,sel.scope,sel.instanceId,(sel.multiple||[sel.info]).map(info=>info.id).sort()]);
  const focusedDraft=panelPaintDraftFocused()||panelInteractionFocused()&&document.activeElement.matches('input,textarea')&&(document.activeElement.matches('.component-props-search')||!panelTasks&&!sourceRequests&&!undoBusy);
  if((panelPointer||focusedDraft||document.querySelector('.svg-vertex-surface, .canvas-rotate-surface, .canvas-flow-resize-surface, .canvas-move-surface'))&&key===renderedPanelSelection){panelRenderDeferred=true;return;}
  panelRenderDeferred=false;
  const top=key===renderedPanelSelection?panel.scrollTop:0;
  const focusedScope=key===renderedPanelSelection&&document.activeElement?.getAttribute('aria-label')==='Style screen scope';
  const focusedTool=key===renderedPanelSelection&&panelBody.contains(document.activeElement)?document.activeElement.dataset.canvasTool:null;
  renderedPanelSelection=key;
  // Rebuilding an empty fieldset can clamp its scroll container to zero.
  // Restore synchronously after all sections (including early returns) exist.
  try { renderPanelContents(textEditing===true); panelBody.dataset.organized='false';RetouchInspectorUI.organize(panelBody); } finally { panel.scrollTop=top;if(focusedScope)panelBody.querySelector('[aria-label="Style screen scope"]')?.focus({preventScroll:true});if(focusedTool)[...panelBody.querySelectorAll('[data-canvas-tool]')].find(el=>el.dataset.canvasTool===focusedTool)?.focus({preventScroll:true}); }
}
function renderPanelContents(textEditing=false) {
  window.dispatchEvent(new CustomEvent('retouch:selection',{detail:activeId()}));
  window.dispatchEvent(new CustomEvent('retouch:selection-set',{detail:(sel.multiple||[sel.info]).map(info=>info.id)}));
  window.dispatchEvent(new CustomEvent('retouch:selection-details',{detail:(sel.multiple||[sel.info]).map(({id,kind,rootGroups,renderScope})=>({id,kind,rootGroups,renderScope}))}));
  const info = sel.info;
  const style = scopedInfo(info);
  panelEmpty.hidden = true;
  panelBody.hidden = false;
  panelBody.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'sec';head.dataset.strokeContext=JSON.stringify([info.id,styleScope]);head.dataset.layerTag=info.kind==='instance'?'':info.tag;
  const badge = document.createElement('span');
  badge.className = 'kindbadge' + (info.kind === 'instance' ? ' instance' : '');
  badge.textContent = info.svgBooleanGroup?'Boolean group':sel.multiple?.length>1?sel.multiple.length+(info.kind==='instance'?' components':' layers'):info.kind === 'instance' ? info.tag : info.tag.charAt(0).toUpperCase()+info.tag.slice(1);
  head.appendChild(badge);
  const file = document.createElement('div');
  file.className = 'filepath';
  file.textContent = info.file;
  head.appendChild(file);
  if(info.kind==='instance'&&sel.multiple?.length>1){panelBody.append(head,componentSelectionSection(sel.multiple));return;}
  if(!info.svgBooleanOwner&&!(sel.multiple||[]).some(i=>i.svgBooleanOwner))head.appendChild(screenScopeSection());
  panelBody.appendChild(head);
  if(groupMovementRoots())panelBody.append(groupMovementSection(info));
  else{const roots=groupMovementRoots(true);if(roots?.every(el=>el.namespaceURI==='http://www.w3.org/1999/xhtml')&&(sel.multiple||[info]).every(item=>item.kind!=='instance'&&(item.cssAuthoring||item.classSelection&&!item.classNameDynamic))){const section=RetouchInspector.section('Scale');appendSelectionScaleControls(section,info,roots);panelBody.append(section);}}
  if(info.svgBooleanOwner||(sel.multiple||[]).some(i=>i.svgBooleanOwner)){
   if(sel.multiple?.length>1){
    const infos=sel.multiple,elements=infos.map(item=>matchingEls(item.id).length===1?matchingEls(item.id)[0]:null),current=()=>sel?.multiple===infos&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests&&elements.every(el=>el&&!layerLocks.locked(el));
    if(infos.every(item=>item.svgTransform&&(!item.svgBooleanOwner||item.svgBooleanGroup)))panelBody.append(RetouchSVGSelection.mount(infos,elements,{current,save:writeSVGSelection,onGaps:axis=>svgSelectionGaps.toggle(infos,axis),gapsActive:axis=>svgSelectionGaps.active(infos,axis)}));
    const parents=infos.map(item=>item.svgBooleanGroup&&!item.svgBooleanGroup.ancestorId?item.svgBooleanGroup.parentId:item.svgBooleanReplacement?.parentId);if(parents.every(Boolean)&&new Set(parents).size===1)panelBody.append(RetouchSVGBooleanSelection.mount(infos,elements,{current,saveGroup:(path,operation)=>writeSVGBooleanGroup('createSVGBooleanGroup',{path,operation,ids:infos.map(item=>item.id)})}));
    const section=RetouchInspector.section('Boolean group');RetouchInspector.note(section,'Select one boolean group to edit its original shapes.');panelBody.append(section);return;
   }
   if(info.svgBooleanGroup){const target=matchingEls(info.id)[0];panelBody.append(RetouchSVGBooleanGroup.mount(info,target,{resolveTarget:()=>{const matches=matchingEls(info.id);return matches.length===1?matches[0]:null;},selected:()=>sel?.info.id===info.id&&sel.info.hash===info.hash,current:()=>sel?.info.id===info.id&&sel.info.hash===info.hash&&!sel.multiple?.length&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests&&matchingEls(info.id).length===1&&!layerLocks.locked(matchingEls(info.id)[0]),load:async ids=>{const responses=await Promise.all(ids.map(id=>api('GET',resolveUrl(id))));if(responses.some(r=>!r?.ok||r.element.hash!==info.hash))throw Error('The original shapes changed. Re-select the group.');return responses.map(r=>r.element);},save:writeSVGBooleanGroup,onBack:info.svgBooleanGroup.ancestorId?async()=>{await restoreLayerSelection([info.svgBooleanGroup.ancestorId]);if(sel)renderPanel();}:null,onCanvas:editBooleanOperandOnCanvas,onNested:async operand=>{await restoreLayerSelection([operand.id]);if(sel)renderPanel();}}));}
   else {const section=RetouchInspector.section('Boolean group');section.append(RetouchInspector.button('Back to boolean group',async()=>{await restoreLayerSelection([info.svgBooleanOwner]);if(sel)renderPanel();}));panelBody.append(section);}
   if(info.svgBooleanGroup&&!info.svgBooleanGroup.ancestorId){const target=matchingEls(info.id)[0],current=()=>sel?.info===info&&!panelTasks&&!undoBusy&&!sourceRequests&&!editing;const position=RetouchInspector.section('Vector position');RetouchSVGResize.positionFields(position,info,target,{onCanvas:()=>resizeSVGOnCanvas(info,target,null,'ne','rotate'),current,save:matrix=>writeSVGTransform(info,target,matrix)});const size=RetouchInspector.section('Vector size');RetouchSVGResize.sizeFields(size,info,target,{current,save:matrix=>writeSVGTransform(info,target,matrix)});panelBody.append(position,size);}
   return;
  }

  {const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0,scope=info.classColorStyles?styleScope:width;
   RetouchColorStyles.mount(panelBody,sel.multiple?.length>1?selectionColorOptions(scope):info.colorStyles||info.classColorStyles?{width:scope,readColor:property=>{const element=matchingEls(info.id)[0];if(!element)throw Error('Re-select the layer to read its color.');return property==='background-color'?RetouchBackgroundPaintUI.read(info,element).color:element.ownerDocument.defaultView.getComputedStyle(element).getPropertyValue(property);},allLinks:info.colorStyleLinks,links:info.colorStyleLinks?.[scope],overrides:info.colorStyleOverrides?.[scope]||[],inherited:info.classColorStyles?property=>RetouchResponsive.inheritedLink(Object.fromEntries(Object.entries(info.colorStyleLinks||{}).filter(([,group])=>group[property]).map(([key,group])=>[key,group[property]])),styleScope,matchingEls(info.id)[0]?.ownerDocument):undefined,apply:(styleId,libraryRevision,property)=>writeTextStyle('applyColorStyle',width,{scope:styleScope,styleId,libraryRevision,property,...backgroundStyleState(info,property)}),reset:(styleId,libraryRevision,property)=>writeTextStyle('resetColorStyle',width,{scope:styleScope,styleId,libraryRevision,property,...backgroundStyleState(info,property)}),detach:property=>writeTextStyle('detachColorStyle',width,{scope:styleScope,property})}:{});
  }

  if((sel.multiple?.length>1?sel.multiple.every(item=>item.variables):info.variables)){const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0;RetouchCollectionBindings.mount(panelBody,sel.multiple?.length>1?sel.multiple:info,width,sel.multiple?.length>1?writeVariableSelection:writeTextStyle);}
  else if(sel.multiple?.length>1?sel.multiple.every(item=>item.classVariables):info.classVariables){const scope=styleScope;RetouchCollectionBindings.mount(panelBody,sel.multiple?.length>1?sel.multiple:info,scope,(type,_width,extra)=>sel.multiple?.length>1?writeVariableSelection(type,0,{scope,...extra}):writeTextStyle(type,0,{scope,...extra}),{inherited:(property,ignoreOwn)=>RetouchCollectionBindings.classInherited(info,scope,property,matchingEls(info.id)[0]?.ownerDocument,ignoreOwn),scopeLabel:document.querySelector('[aria-label="Style screen scope"]')?.selectedOptions[0]?.textContent||scope||'all screen sizes'});}

  if(!sel.multiple?.length&&(info.cssAuthoring||info.classEffectStyles)&&!info.effectStyleLinkReason){
   const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0,scope=info.classEffectStyles?styleScope:width,links=info.effectStyleLinks||{},inheritedWidth=Object.keys(links).map(Number).filter(value=>value<width).sort((a,b)=>b-a)[0];
   const inherited=info.classEffectStyles?RetouchResponsive.inheritedLink(links,styleScope,matchingEls(info.id)[0]?.ownerDocument):!links[width]&&inheritedWidth!==undefined?{link:links[inheritedWidth],label:inheritedWidth?inheritedWidth+'px and larger':'All sizes'}:null;
   RetouchEffectStyles.mount(panelBody,matchingEls(info.id)[0],{info,link:links[scope],overrides:info.effectStyleOverrides?.[scope]||[],inherited,apply:(styleId,libraryRevision)=>writeTextStyle('applyEffectStyle',width,{scope:styleScope,styleId,libraryRevision}),reset:(styleId,libraryRevision)=>writeTextStyle('resetEffectStyle',width,{scope:styleScope,styleId,libraryRevision}),detach:()=>writeTextStyle('detachEffectStyle',width,{scope:styleScope}),update:(styleId,libraryRevision,name,properties)=>writeTextStyle('updateEffectStyle',width,{scope:styleScope,styleId,libraryRevision,name,properties})});
  }
  if(sel.multiple?.length>1&&sel.multiple.every(item=>item.svgTransform)){
   const infos=sel.multiple,elements=infos.map(item=>matchingEls(item.id).length===1?matchingEls(item.id)[0]:null),current=()=>sel?.multiple===infos&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests&&elements.every(el=>el&&!layerLocks.locked(el));
   panelBody.append(RetouchSVGSelection.mount(infos,elements,{current,save:writeSVGSelection,onGaps:axis=>svgSelectionGaps.toggle(infos,axis),gapsActive:axis=>svgSelectionGaps.active(infos,axis)}));if(elements.some(el=>!el))return;mountSelectionEffectStyles();mountSelectionTextStyles();
   if(infos.every(item=>item.svgBooleanReplacement)&&new Set(infos.map(item=>item.svgBooleanReplacement.parentId)).size===1)panelBody.append(RetouchSVGBooleanSelection.mount(infos,elements,{current,save:writeSVGBooleanSelection,saveGroup:(path,operation)=>writeSVGBooleanGroup('createSVGBooleanGroup',{path,operation,ids:infos.map(i=>i.id)})}));
   if(infos.every(item=>item.svgMask?.canCreate)&&new Set(infos.map(item=>item.svgMask.parentId)).size===1)panelBody.append(RetouchSVGMask.mount(infos,elements,{current,save:writeSVGMask}));
   panelBody.append(info.classSelection?RetouchReactSelection.mount(infos,elements,styleScope,setReactClassesSelection,(property,value,values)=>setSelectionColorOverride(property,value,undefined,values),id=>matchingEls(id)[0],changes=>setSelectionColorOverride('background-color',undefined,changes)):RetouchHTMLCSS.mountSelection(infos,elements,styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0,setHTMLCSSSelection));return;
  }
  if(sel.multiple?.length>1){mountSelectionEffectStyles();mountSelectionTextStyles();if(info.classSelection){const elements=sel.multiple.map(item=>matchingEls(item.id)[0]),strategy=RetouchReactSelectionGeometry.strategy(sel.multiple,elements,styleScope,{reason:reactGeometryReason,matches:matchingEls,save:setReactClassesSelection});panelBody.append(RetouchClassSiteVariables.mountSelection(sel.multiple,elements,styleScope,setReactClassesSelection,message=>toast(message,'err')),RetouchFlip.mountSelection(sel.multiple,elements,0,null,strategy),...(groupMovementRoots()?[]:[RetouchSelectionLayout.mount(sel.multiple,elements,0,null,transformLayerSelection,strategy)]),RetouchReactSelection.mount(sel.multiple,elements,styleScope,setReactClassesSelection,(property,value,values)=>setSelectionColorOverride(property,value,undefined,values),id=>matchingEls(id)[0],changes=>setSelectionColorOverride('background-color',undefined,changes)));return;}const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0;const elements=sel.multiple.map(info=>matchingEls(info.id)[0]);panelBody.append(RetouchFlip.mountSelection(sel.multiple,elements,width,(changes,w)=>setHTMLCSSSelection(null,null,w,changes)),...(groupMovementRoots()?[]:[RetouchSelectionLayout.mount(sel.multiple,elements,width,(changes,w)=>setHTMLCSSSelection(null,null,w,changes),transformLayerSelection)]),RetouchHTMLCSS.mountSelection(sel.multiple,elements,width,setHTMLCSSSelection));return;}

  if(info.svgMask?.canRelease||info.svgMask?.ownerId){const target=matchingEls(info.id)[0];panelBody.append(RetouchSVGMask.mount([info],[target],{current:()=>sel?.info===info&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests&&target?.isConnected&&!layerLocks.locked(target),save:writeSVGMask,edit:async ids=>{await restoreLayerSelection(ids);if(sel)renderPanel();await layers.refresh();}}));}
  if(info.canCreateComponent)panelBody.append(createComponentSection(info));

  if(info.components?.length) {
    const label=document.createElement('label');label.textContent='Component scope';
    const select=document.createElement('select');select.setAttribute('aria-label','Component scope');
    const prompt=document.createElement('option');prompt.value='';prompt.textContent='Choose a containing component';select.append(prompt);
    for(const component of info.components){const option=document.createElement('option');option.value=component.id;option.textContent=component.label;select.append(option);}
    select.value=info.components.some(c=>c.id===info.id)?info.id:'';
    select.onchange=async()=>{
      if(!select.value)return;
      const result=await api('GET',resolveUrl(select.value,info.context));
      if(result?.ok){sel={...sel,scope:'instance',instanceId:select.value,info:result.element};renderPanel();}
      else toast('This component no longer resolves. Re-select it.','err');
    };
    label.append(select);head.append(label);
  }

  // Scope switch when both IDs exist (R-12 a: instance is the default).
  if (sel.hostId && sel.instanceId) {
    const scopes = document.createElement('div');
    scopes.className = 'scopes sec';scopes.setAttribute('role','group');scopes.setAttribute('aria-label','Component editing scope');
    for (const s of ['instance', 'host']) {
      const b = document.createElement('button');
      b.textContent = s === 'instance' ? 'This instance' : 'Component';
      b.setAttribute('aria-pressed',String(sel.scope===s));if (sel.scope === s) b.classList.add('active');
      b.onclick = () => { sel.scope = s; loadScope(); };
      scopes.appendChild(b);
    }
    panelBody.appendChild(scopes);
  }

  if(info.canRename){
    const naming=RetouchInspector.section('Layer');
    const input=document.createElement('input');input.id='layerNameInput';input.type='text';input.maxLength=200;input.value=info.layerName||'';input.placeholder='Use the page’s element label';
    RetouchInspector.field(naming,'Layer name',input);input.onchange=()=>renameLayer(input.value);
    RetouchInspector.note(naming,'Names appear in the editor without changing page text or accessibility labels. Clear to use the original label.');panelBody.append(naming);
  }
  const componentTarget = matchingEls(activeId())[0]?.closest('[data-rt-i]');
  const componentId = sel.instanceId || componentTarget?.getAttribute('data-rt-i');
  if (componentId && !info.textLeaf) panelBody.appendChild(componentSection(componentId));
  if (info.kind === 'instance' && !info.canSetSrc) {
    return;
  }

  const target = (editing?.el.ownerDocument === doc() ? editing.el : null) || matchingEls(activeId()).find(el => inTextScope(el, info));
  const textLayer=info.kind!=='instance'&&(textEditing||RetouchInspector.isTextLayer(info.tag)||RetouchLayers.atomicText(target));
  head.dataset.textLayer=String(textLayer);
  if(target?.namespaceURI==='http://www.w3.org/2000/svg'){
    const exports=RetouchInspector.section('Export'),options=document.createElement('div');
    const canvas=target.closest('svg'),name=document.createElement('input'),preview=document.createElement('div');
    const defaultName=RetouchSVGExport.fileStem(canvas.getAttribute('aria-label')||canvas.id);
    name.type='text';name.maxLength=160;name.placeholder=defaultName;name.value=svgExportNames.get(canvas)||'';
    name.oninput=()=>{if(name.value)svgExportNames.set(canvas,name.value);else svgExportNames.delete(canvas);updatePreview();};
    RetouchInspector.field(exports,'Export file name',name);
    function updatePreview(){preview.textContent=RetouchSVGExport.fileStem(name.value,defaultName)+(svgExportFormat==='svg'||svgExportScale===1?'':'@'+svgExportScale+'x')+'.'+(svgExportFormat==='jpeg'?'jpg':svgExportFormat);}
    const format=RetouchInspector.select(exports,'Export format',[['svg','SVG · vector'],['png','PNG · transparent'],['jpeg','JPEG · opaque']],svgExportFormat,value=>{svgExportFormat=value;refreshOptions();});
    const download=RetouchInspector.button('',()=>runExport()),batch=RetouchInspector.button('Export 1×–4×',()=>runExport(true));
    async function runExport(all=false){
      const invalid=options.querySelector(':invalid');if(invalid){invalid.reportValidity();return;}
      const selected=svgExportFormat,settings={quality:jpegQuality,background:jpegBackground,name:name.value};
      const controls=[name,format,download,batch,...options.querySelectorAll('input,select,button')],states=controls.map(control=>control.disabled);
      controls.forEach(control=>{control.disabled=true;});
      try{
        if(all)await RetouchSVGExport.downloadAllScales(target,selected,settings);
        else if(selected==='svg')await RetouchSVGExport.download(target,svgEmbedImages,settings);
        else if(selected==='png')await RetouchSVGExport.downloadPNG(target,svgExportScale,settings);
        else await RetouchSVGExport.downloadJPEG(target,svgExportScale,settings);
        toast(all?'4 '+selected.toUpperCase()+' files exported':selected.toUpperCase()+' exported','ok');
      }catch(error){toast(error.message,'err');}
      finally{controls.forEach((control,i)=>{control.disabled=states[i];});}
    }
    function refreshOptions(){
      options.replaceChildren();
      if(svgExportFormat==='svg'){
        if(target.closest('svg')?.querySelector('image')){const embed=document.createElement('input');embed.type='checkbox';embed.checked=svgEmbedImages;embed.onchange=()=>{svgEmbedImages=embed.checked;};RetouchInspector.field(options,'Embed images in SVG',embed);}
        RetouchInspector.note(options,'Fonts must be available where you open the SVG file.');
      }else{
        RetouchInspector.select(options,'Export scale',[1,2,3,4].map(value=>[String(value),value+'×']),String(svgExportScale),value=>{svgExportScale=Number(value);updatePreview();});
        if(svgExportFormat==='jpeg'){
          RetouchInspector.number(options,'JPEG quality (%)',jpegQuality,1,100,value=>{if(Number.isInteger(value))jpegQuality=value;}).step='1';
          const color=document.createElement('input');color.type='color';color.value=jpegBackground;color.onchange=()=>{jpegBackground=color.value;};RetouchInspector.field(options,'JPEG background',color);
        }
        RetouchInspector.note(options,svgExportFormat==='jpeg'?'Lower quality makes smaller files. The background fills transparent areas.':'PNG preserves transparency. Bitmap images are embedded.');
      }
      download.textContent=svgExportFormat==='svg'?'Export SVG canvas':'Export '+svgExportFormat.toUpperCase();batch.hidden=svgExportFormat==='svg';updatePreview();
    }
    preview.className='hint';preview.setAttribute('aria-label','Export filename preview');exports.append(options,preview,download,batch);refreshOptions();RetouchInspector.note(exports,'Exports the containing SVG canvas at this screen size.');panelBody.append(exports);
  }
  if(info.svgTransform){const position=RetouchInspector.section('Vector position');RetouchSVGResize.positionFields(position,info,target,{onCanvas:()=>resizeSVGOnCanvas(info,target,null,'ne','rotate'),current:()=>sel?.info===info&&!panelTasks&&!undoBusy&&!sourceRequests&&!editing,save:matrix=>writeSVGTransform(info,target,matrix)});panelBody.append(position);}
  if(info.svgTransform){const size=RetouchInspector.section('Vector size');RetouchSVGResize.sizeFields(size,info,target,{current:()=>sel?.info===info&&!panelTasks&&!undoBusy&&!sourceRequests&&!editing,save:matrix=>writeSVGTransform(info,target,matrix)});panelBody.append(size);}
  if(info.svgGradientCreation)mountSVGGradientCreation(info,target);
  if(info.svgGradients?.length)mountSVGGradients(info,target);
  if(info.svgGeometry){
    const geometry=RetouchInspector.section('SVG geometry');
    if(info.svgConversion?.arrow){const convert=RetouchInspector.button('Convert line to arrow',()=>convertSVGToPath(info,true));convert.dataset.arrowAction='convert';geometry.append(convert);}
    if(info.svgConversion)geometry.append(RetouchInspector.button('Convert to vector path',()=>convertSVGToPath(info)));
    const pointField=info.svgGeometry.fields.find(field=>['points','d'].includes(field.name));
    if(editableVectorField(info)){const editPoints=RetouchInspector.button('Edit vector points',()=>editSVGPoints(info));editPoints.dataset.canvasTool='vertices';editPoints.title='Edit vector points · Enter or double-click on the canvas';geometry.append(editPoints);}
    RetouchSVGRadius.mount(geometry,info,target,changes=>setSVGGeometry(changes),input=>roundRectangleOnCanvas(target,input));
    const parametric=info.svgGeometry.parametric;
    if(parametric){
      const arrowValue=()=>pointField.name==='d'?RetouchSVGParametric.pointsFromPath(pointField.value):pointField.value;
      const writeArrow=points=>pointField.name==='points'?convertSVGToPath(info,false,points):setSVGGeometry('d',RetouchSVGParametric.arrowPath(points));
      const change=updates=>{const points=parametric.kind==='arrow'?RetouchSVGParametric.changeArrow(arrowValue(),updates):RetouchSVGParametric.generate({...parametric,...updates});if(points){if(parametric.kind==='arrow')writeArrow(points);else setSVGGeometry('points',points);}else toast('Choose valid shape parameters.','err');};
      if(parametric.kind==='arrow'){
        const reverse=RetouchInspector.button('Reverse arrow',()=>{const points=RetouchSVGParametric.reverseArrow(arrowValue());if(points)writeArrow(points);else toast('This arrow cannot be reversed within the supported coordinate range.','err');});reverse.dataset.arrowAction='reverse';geometry.append(reverse);
        const swap=RetouchInspector.button('Swap arrowheads',()=>{const points=RetouchSVGParametric.swapArrowheads(arrowValue());if(points&&points!==arrowValue())writeArrow(points);else if(!points)toast('These arrowheads cannot be swapped within the supported coordinate range.','err');});swap.dataset.arrowAction='swap';swap.disabled=parametric.endArrow===false&&!parametric.startArrow;geometry.append(swap);
        RetouchInspector.select(geometry,'Start point',[['none','None'],['arrow','Line arrow']],parametric.startArrow?'arrow':'none',value=>change({startArrow:value==='arrow'}));
        if(parametric.startArrow){
          RetouchInspector.number(geometry,'Start arrowhead length',Math.round(parametric.startHeadLength*1000000)/1000000,0,Math.hypot(parametric.x2-parametric.x1,parametric.y2-parametric.y1),value=>change({startHeadLength:value})).step='any';
          RetouchInspector.number(geometry,'Start arrowhead width',Math.round(parametric.startHeadWidth*1000000)/1000000,0,100000,value=>change({startHeadWidth:value})).step='any';
        }
        RetouchInspector.select(geometry,'End point',[['none','None'],['arrow','Line arrow']],parametric.endArrow===false?'none':'arrow',value=>change({endArrow:value==='arrow'}));
        if(parametric.endArrow!==false){
        RetouchInspector.number(geometry,'Arrowhead length',Math.round(parametric.headLength*1000000)/1000000,0,Math.hypot(parametric.x2-parametric.x1,parametric.y2-parametric.y1),value=>change({headLength:value})).step='any';
        RetouchInspector.number(geometry,'Arrowhead width',Math.round(parametric.headWidth*1000000)/1000000,0,100000,value=>change({headWidth:value})).step='any';
        }
      }else RetouchInspector.number(geometry,parametric.kind==='star'?'Star points':'Polygon sides',parametric.count,3,parametric.kind==='star'?256:512,value=>change({count:value})).step='1';
      if(parametric.kind==='star')RetouchInspector.number(geometry,'Star inner ratio (%)',Math.round(parametric.ratio*1000000)/10000,0,100,value=>change({ratio:value/100})).step='any';
    }
    for(const field of info.svgGeometry.fields){const input=document.createElement('input');input.type='text';input.value=field.value??'';input.placeholder=field.editable===false?'Dynamic value':'Default';input.disabled=field.editable===false;if(field.reason)input.title=field.reason;input.onchange=()=>setSVGGeometry(field.name,input.value.trim()||null);RetouchInspector.field(geometry,'Shape '+field.label,input);const reset=RetouchInspector.button('Reset shape '+field.label.toLowerCase(),()=>setSVGGeometry(field.name,null));reset.disabled=field.value===null||field.editable===false;geometry.append(reset);}
    RetouchInspector.note(geometry,pointField?'Drag empty space to select points. Shift-click or Shift-drag adds to the selection. Drag selected points or use arrows (Shift: 10 units). Click + to add; Delete removes selected points. Done/Enter saves; Escape cancels. Points are shared across screen sizes.':'Geometry is shared across screen sizes. Values use SVG coordinates, px or %. The SVG viewport and page CSS can affect the rendered result.');panelBody.append(geometry);
  }
  if(info.cssAuthoring){
    const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0;
    const position=target?.namespaceURI!=='http://www.w3.org/2000/svg'?RetouchHTMLPosition.mount(info,target,width,setHTMLCSS,(g,action,opener,initial)=>moveHTMLLayer(info,target,width,g,action,opener,initial)):null;
    panelBody.appendChild(RetouchHTMLCSS.mount(info,target,width,setHTMLCSS,position,writeTextStyle));
    const imageFill=RetouchImageFill.mount(info,target,null,changes=>setHTMLCSS(changes,null,width),info.cssRules?.[width]||{},imageFillUpload(info),/\.liquid$/i.test(info.file)?(src,initialize,action,stack)=>setLiquidImageFill(info,src,initialize,action,stack):null,projectImageBrowser(info));if(imageFill)panelBody.append(imageFill);
    if(target?.tagName==='IMG')panelBody.appendChild(RetouchImageStyle.mount(info,target,null,(property,value)=>setHTMLCSS(property,value,width),info.cssRules?.[width]||{},(save,preview)=>repositionImage(target,save,preview)));
    if(info.canSetTag){const section=RetouchInspector.section('Element');RetouchInspector.select(section,'HTML element',['h1','h2','h3','h4','h5','h6','p','span','div','blockquote','label','a','li'].map(tag=>[tag,tag]),info.tag,setTag);panelBody.appendChild(section);}
    if(info.src!==null)panelBody.appendChild(imageSection(info));
  }else{
  if(target)panelBody.appendChild(RetouchClassSiteVariables.mount(style,target,setClasses,message=>toast(message,'err')));
  const imageFill=RetouchImageFill.mount(style,target,setClasses,null,{},imageFillUpload(info),/\.liquid$/i.test(info.file)?(src,initialize,action,stack)=>setLiquidImageFill(info,src,initialize,action,stack):null,projectImageBrowser(info));if(imageFill)panelBody.append(imageFill);
  if(target?.namespaceURI==='http://www.w3.org/2000/svg')panelBody.appendChild(RetouchSVGPaint.mount(style,target,setClasses));
  if(textLayer) panelBody.appendChild(RetouchInspector.typography(style, target, setClasses, setTag,(type,scope,extra)=>writeTextStyle(type,undefined,{scope,...extra})));
  panelBody.appendChild(RetouchInspector.position(style, target, setClasses, message => toast(message, 'err'),(info.renderRevisionAttribute||info.classSelection)&&target?.namespaceURI==='http://www.w3.org/1999/xhtml'?(action,opener,initial)=>transformReactLayer(info,target,action,opener,initial):null,info.renderRevisionAttribute&&target?.namespaceURI==='http://www.w3.org/1999/xhtml'?(classes,g)=>writeReactBounds(info,classes,g):null,info.classSelection&&target?.namespaceURI==='http://www.w3.org/1999/xhtml'?(g,before,anchors)=>writeClassLayerGeometry(info,target,g,before,anchors):null));
  panelBody.appendChild(RetouchLayout.mount(style, target, setClasses));
  panelBody.appendChild(RetouchInspector.appearance(style, target, setClasses,info.classColorStyles?(property,value)=>writeTextStyle('setColorOverride',undefined,{scope:styleScope,property,value}):undefined,info.classColorStyles?changes=>writeTextStyle('setBackgroundPaint',undefined,{scope:styleScope,changes}):undefined));
  if (info.src !== null || info.srcDynamic) {
    if(target?.tagName==='IMG')panelBody.appendChild(RetouchImageStyle.mount(style,target,setClasses,null,{},(save,preview)=>repositionImage(target,save,preview)));
    panelBody.appendChild(imageSection(info));
  }
  if (!textLayer && (info.canSetTag || target?.textContent?.trim())) panelBody.appendChild(RetouchInspector.typography(style, target, setClasses, setTag,(type,scope,extra)=>writeTextStyle(type,undefined,{scope,...extra})));
  panelBody.appendChild(colorSection('Fill', 'bg', style));
  panelBody.appendChild(colorSection('Text color', 'text', style));
  panelBody.appendChild(RetouchInspector.effects(style, target, setClasses, message => toast(message, 'err')));

  }
  // Text
  const tsec = document.createElement('div');
  tsec.className = 'sec';
  tsec.innerHTML = '<h3>Text</h3>';
  if (info.textSource) {
    const provenance = document.createElement('p');
    provenance.className = 'filepath';
    provenance.textContent = (info.textSource.kind === 'locale' ? 'Shared translation: ' : 'Text source: ') + info.textSource.file + ' · ' + info.textSource.path;
    tsec.appendChild(provenance);
    if (info.richText) {
      const hint=document.createElement('p');
      hint.textContent='Edit in place. Select text, then Cmd+B or Cmd+I. Preserved placeholders stay connected to their source.';
      tsec.appendChild(hint);
    } else if (info.textSource.format !== 'text') {
      const label = document.createElement('p');
      label.textContent = info.textSource.format === 'html' ? 'Edit the stored HTML below.' : 'Edit the stored translation; keep its placeholders.';
      tsec.appendChild(label);
    }
  }
  configureSVGInlinePaint(info,target);
  if (info.text !== null) {
    const ta = document.createElement('textarea');
    ta.id = 'textEdit';
    ta.setAttribute('aria-label','Text content');
    ta.value = info.text;
    tsec.appendChild(ta);
    const btn = document.createElement('button');
    btn.id = 'textApply';
    btn.textContent = 'Apply text';
    ta.title='Enter adds a line. Command/Ctrl+Enter saves. Leaving the field saves. Escape cancels the draft.';
    let committing=false;
    const saveTextDraft=async()=>{
      if(committing||!ta.isConnected||sel?.info!==info||panelTasks||undoBusy||sourceRequests||ta.value===info.text)return;
      committing=true;const value=ta.value,task=Promise.resolve().then(()=>setText(value));inspectorTextCommit=task;try{await task;}finally{committing=false;if(inspectorTextCommit===task)inspectorTextCommit=null;}
    };
    ta.addEventListener('blur',saveTextDraft);
    ta.addEventListener('keydown',event=>{
      if(event.isComposing)return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();ta.value=info.text;ta.blur();}
      else if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)){event.preventDefault();event.stopPropagation();window.RetouchPanelFocus.queue(ta);saveTextDraft();}
    });
    btn.onclick = saveTextDraft;
    tsec.appendChild(document.createElement('br'));
    tsec.appendChild(btn);
  } else if (info.mixedText) {
    const p = document.createElement('p');
    p.style.color = 'var(--muted)';
    p.textContent = 'Rich text. Click the element and edit it in place. Select text, then Cmd+B or Cmd+I.';
    tsec.appendChild(p);
  } else if (info.textDynamic) {
    const p = document.createElement('p');
    p.className = 'refused';
    p.textContent = sel.scope === 'host' && sel.instanceId
      ? 'Text here is dynamic (it may come from the component instance — switch scope).'
      : (info.textReason || 'The text of this element is dynamic (R-6).');
    tsec.appendChild(p);
  } else {
    const p = document.createElement('p');
    p.style.color = 'var(--muted)';
    p.textContent = 'No text content.';
    tsec.appendChild(p);
  }
  panelBody.appendChild(tsec);

  if(info.cssAuthoring)return;
  // Advanced: raw CSS class manipulation, collapsed by default (not tier 1).
  const adv = document.createElement('details');
  adv.className = 'sec advanced';
  const sum = document.createElement('summary');
  sum.textContent = 'Advanced (CSS classes)';
  adv.appendChild(sum);
  const csec = document.createElement('div');
  csec.className = 'advbody';
  if (info.classNameDynamic) {
    const p = document.createElement('p');
    p.className = 'refused';
    p.textContent = info.classNameReason || 'This class value has no editable source.';
    csec.appendChild(p);
  } else {
    const chips = document.createElement('div');
    chips.id = 'chips';
    const tokens = (style.className || '').split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = t + ' ';
      const x = document.createElement('button');
      x.textContent = '×';
      x.onclick = () => setClasses(tokens.filter((k) => k !== t).join(' '));
      chip.appendChild(x);
      chips.appendChild(chip);
    }
    csec.appendChild(chips);
    const add = document.createElement('input');
    add.id = 'addClass';
    add.placeholder = 'add class… (Enter)';
    add.onkeydown = (e) => {
      if (e.key === 'Enter' && add.value.trim()) {
        setClasses(((style.className || '') + ' ' + add.value.trim()).trim());
      }
    };
    csec.appendChild(add);

    // Spacing steppers (OQ-D3: scale values only)
    const steppers = document.createElement('div');
    steppers.className = 'steppers';
    steppers.style.marginTop = '8px';
    for (const prefix of ['p', 'px', 'py', 'm', 'mx', 'my', 'gap']) {
      steppers.appendChild(makeStepper(prefix, tokens));
    }
    csec.appendChild(steppers);
  }
  adv.appendChild(csec);
  panelBody.appendChild(adv);
  const sizing = document.createElement('div');
  sizing.className = 'sec';
  const title = document.createElement('h3');title.textContent = 'Max width';
  const hint = document.createElement('p');hint.className = 'hint';
  hint.textContent = info.classNameDynamic
    ? 'Max-width dragging is unavailable here because the class attribute contains expressions. Select a container with literal classes.'
    : 'Drag horizontally from any selection edge to snap the maximum width to a Tailwind size. The popup shows the exact class being changed.';
  sizing.append(title, hint);panelBody.appendChild(sizing);

}

function createComponentSection(info) {
  const details=document.createElement('details');details.className='advanced';
  const summary=document.createElement('summary');summary.textContent='Create component';details.append(summary);
  const body=document.createElement('div');body.style.padding='0 12px 12px';details.append(body);
  const input=document.createElement('input');input.type='text';input.value='NewComponent';input.required=true;input.maxLength=80;input.pattern='[A-Z][A-Za-z0-9_$]{0,79}';
  RetouchInspector.field(body,'Component name',input);
  RetouchInspector.note(body,'Creates a reusable component in this source file and replaces the selected subtree with an instance. This changes all screen sizes. JavaScript local values become props automatically.');
  const button=RetouchInspector.button('Create component from layer',async()=>{
    if(!input.reportValidity())return;
    busyPanel(true);
    try{
      const result=await api('POST','/rt/__api/op',{type:'createComponent',id:info.id,fileHash:info.hash,name:input.value});
      if(!result?.ok){RetouchInspector.note(body,result?.reason||result?.error||'Could not create the component.','refused');return;}
      editorHistory.record({type:'createComponent',id:info.id,sourceIdMap:result.createdComponent.sourceIdMap,undoId:result.undoId});
      layerLocks.remap(result.createdComponent.sourceIdMap);
      const created=result.createdComponent;
      await refreshWrittenElement(result.element,el=>el.getAttribute('data-rt')===created.definitionId);
      sel={hostId:created.definitionId,instanceId:created.instanceId,scope:'instance',info:result.element};
      renderPanel();toast('Created '+created.name,'ok');
    }catch(error){toast(error.message,'err');}finally{busyPanel(false);}
  });body.append(button);return details;
}

function componentSection(id) {
  const sec = RetouchInspector.section('Component');
  sec.classList.add('component-section');
  const description = RetouchInspector.note(sec, 'Loading definition…');
  api('GET', componentUrl(id,sel?.info?.context)).then(component => {
    if (!sec.isConnected) return;
    if(component?.inlineComponent&&!componentLibrarySelections.has(id)){sec.remove();return;}
    if (!component?.ok) { description.textContent = component?.reason || 'Definition unavailable.'; return; }
    description.textContent = component.name + ' · ' + component.file;
    if (component.detached) sec.querySelector('h3').textContent = 'Detached component';
    const actions = document.createElement('div'); actions.className = 'component-actions';
    const view=RetouchInspector.button('View component', () => openComponent(id, component));view.dataset.componentAction='view';actions.append(view);
    const edit = RetouchInspector.button('Edit definition', () => editDefinition(id, component));
    edit.dataset.componentAction='definition';edit.disabled = !component.definitionId; actions.append(edit);
    const duplicate=RetouchInspector.button('Duplicate instance',()=>duplicateInstance(id,sel?.info?.context));duplicate.disabled=!component.canDuplicate;duplicate.title=component.duplicateReason||'Duplicate this source usage, keeping the shared definition.';actions.append(duplicate);
    const detach = RetouchInspector.button('Detach instance', () => detachInstance(id, component, detach));detach.disabled=!component.canDetach;
    detach.dataset.componentAction='detach';detach.title=component.reason||'Create an independent definition for this instance.';detach.disabled = !component.canDetach; if (!component.detached) actions.append(detach); sec.append(actions);
    const groups=RetouchComponentInstances.group(matchingInDocument(doc(),id,component),component.rootGroups),count=groups.length,unit=groups.every(group=>group.complete)?'instance':groups.every(group=>!group.complete)?'rendered layer':'selection target';
    RetouchInspector.note(sec, `${count} ${unit}${count === 1 ? '' : 's'} at this usage. ${component.detached ? 'This module is independent of the original component.' : 'Definition edits are shared.'}`);
    if(!component.canDetach&&!component.detached&&component.reason)RetouchInspector.note(sec,component.reason);
    if (component.props.length) {
      sec.append(propTable(component.props,id,component.usageHash));
      RetouchInspector.note(sec,component.props.some(prop=>prop.editor?.editable)?'Property changes apply to this source usage at every screen size. Edit the definition for shared styles.':'These properties are read-only here. Edit the definition for shared styles.');
    } else RetouchInspector.note(sec,'No instance properties to edit here. Edit the definition for shared styles and content.');
  });
  return sec;
}
function sizeComponentText(input){
  if(!input.isConnected||!input.clientWidth)return;
  const css=getComputedStyle(input),number=name=>parseFloat(css[name])||0;
  const border=number('borderTopWidth')+number('borderBottomWidth'),padding=number('paddingTop')+number('paddingBottom');
  input.style.height='auto';
  input.style.height=Math.min(input.scrollHeight+border,5*number('lineHeight')+padding+border)+'px';
}
let componentPropertyPanelWidth=0;
new ResizeObserver(entries=>{
  const width=entries[0]?.contentRect.width;if(width===componentPropertyPanelWidth)return;componentPropertyPanelWidth=width;
  panelBody.querySelectorAll('.component-prop-text').forEach(sizeComponentText);
}).observe(panelBody);
const componentPropertyFilters=new Map();
function propTable(props,instanceId,fileHash,options={}) {
  const table = document.createElement('table'); table.className = 'component-props'+(instanceId?' component-props-editable':'');
  const thead = document.createElement('thead'); const header = document.createElement('tr');
  for (const text of ['Prop', options.definitionOnly?'Type / options':'This instance', 'Default']) { const th=document.createElement('th');th.textContent=text;header.append(th); }
  thead.append(header); table.append(thead);
  const body=document.createElement('tbody');
  for(const prop of props){
    const row=document.createElement('tr'),name=document.createElement('td'),value=document.createElement('td'),fallback=document.createElement('td');row.dataset.propertyName=String(prop.name);name.textContent=prop.name;fallback.textContent=prop.default;
    if(instanceId&&prop.editor?.editable&&prop.editor.choices&&!(prop.editor.type==='boolean'&&typeof prop.editor.value==='boolean'&&prop.editor.choices.length===2&&!prop.editor.allowUnset&&!prop.editor.unset)){
      const meta=prop.editor,input=document.createElement('select');input.setAttribute('aria-label','Component property '+prop.name);
      meta.choices.forEach((choice,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=String(choice);input.append(option);});
      const selected=meta.choices.indexOf(meta.value);
      if(meta.allowUnset){const option=document.createElement('option');option.value='unset';option.textContent='Not set';input.prepend(option);}
      if(selected<0&&!meta.unset||meta.unset&&!meta.allowUnset){const option=document.createElement('option');option.value='-1';option.disabled=true;option.textContent=meta.unset?'Choose a value':String(meta.value)+' (outside declared choices)';input.prepend(option);}input.value=meta.unset&&meta.allowUnset?'unset':String(selected);
      input.addEventListener('change',()=>setComponentProperty(instanceId,prop.name,input.value==='unset'?undefined:meta.choices[Number(input.value)],fileHash,{definitionHash:meta.definitionHash,...(input.value==='unset'?{clear:true}:{})}));value.append(input);
    }else if(instanceId&&prop.editor?.editable){
      const meta=prop.editor,input=document.createElement(meta.type==='string'?'textarea':'input');let emptyButton=null,propertyError=null;input.setAttribute('aria-label','Component property '+prop.name);if(meta.type!=='string')input.type=meta.type==='boolean'?'checkbox':'number';
      if(meta.type==='string'){const resize=()=>sizeComponentText(input);input.className='component-prop-text';input.rows=1;input.title='Enter adds a line. Command/Ctrl+Enter saves. Escape cancels.';input.addEventListener('input',resize);requestAnimationFrame(resize);}
      if(meta.type==='boolean')input.checked=meta.value;else input.value=meta.unset?'':String(meta.value);if(meta.unset)input.placeholder=meta.allowUnset?'Not set':'Required';if(meta.type==='number')input.step='any';
      const clearError=()=>{input.setCustomValidity('');input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');propertyError?.remove();propertyError=null;};
      input.addEventListener('input',clearError);
      input.addEventListener('change',()=>{
        clearError();
        if(meta.type==='number'&&(input.value===''||!input.validity.valid||!Number.isFinite(Number(input.value)))){
          const message=meta.canClear?'Enter a number, or use Unset to remove it.':'Enter a number, or press Escape to cancel.';
          input.setCustomValidity(message);input.setAttribute('aria-invalid','true');propertyError=document.createElement('small');propertyError.id='component-prop-error-'+instanceId+'-'+prop.name;propertyError.className='property-error';propertyError.setAttribute('role','alert');propertyError.textContent=message;input.setAttribute('aria-describedby',propertyError.id);value.append(propertyError);return;
        }
        if(!input.reportValidity())return;const next=meta.type==='boolean'?input.checked:meta.type==='number'?Number(input.value):input.value;if(next!==meta.value)setComponentProperty(instanceId,prop.name,next,fileHash,{definitionHash:meta.definitionHash});
      });
      input.addEventListener('keydown',event=>{if(event.isComposing)return;if(event.key==='Enter'&&(meta.type!=='string'||event.metaKey||event.ctrlKey)){event.preventDefault();event.stopPropagation();window.RetouchPanelFocus.queue(input);input.blur();restorePanelFocus();}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();clearError();if(meta.type==='boolean')input.checked=meta.value;else input.value=meta.unset?'':String(meta.value);if(emptyButton)emptyButton.hidden=false;if(meta.type==='string')sizeComponentText(input);input.blur();}});value.append(input);
      if(meta.unset&&meta.type==='string'){emptyButton=RetouchInspector.button('Set empty text',()=>{window.RetouchPanelFocus.queueControl(emptyButton,'Component property '+prop.name);setComponentProperty(instanceId,prop.name,'',fileHash,{definitionHash:meta.definitionHash});});emptyButton.setAttribute('aria-label','Set '+prop.name+' to empty text');input.addEventListener('input',()=>{emptyButton.hidden=input.value!=='';});value.append(emptyButton);}
    }else{value.textContent=prop.value;value.title=prop.editor?.reason||'';}
    if(instanceId&&prop.editor?.canReset){const reset=RetouchInspector.button('Reset',()=>{window.RetouchPanelFocus.queueControl(reset,'Component property '+prop.name);setComponentProperty(instanceId,prop.name,undefined,fileHash,{reset:true,definitionHash:prop.editor.definitionHash});});reset.setAttribute('aria-label','Reset '+prop.name+' to default');reset.title='Remove this instance override and use the component default.';reset.textContent='↺';value.append(reset);}
    if(instanceId&&prop.editor?.canClear&&!prop.editor.choices){const clear=RetouchInspector.button('Unset',()=>{window.RetouchPanelFocus.queueControl(clear,'Component property '+prop.name);setComponentProperty(instanceId,prop.name,undefined,fileHash,{clear:true,definitionHash:prop.editor.definitionHash});});clear.setAttribute('aria-label','Unset property '+prop.name);value.append(clear);}
    if(prop.editor?.inherited){const note=document.createElement('small');note.textContent='Default';value.append(note);}
    if(instanceId){name.title='Default: '+prop.default;for(const control of value.querySelectorAll('input,textarea,select'))control.setAttribute('aria-description','Default: '+prop.default);}
    row.append(name,value,fallback);body.append(row);
  }
  table.append(body);
  if(!instanceId||props.length<8)return table;
  const group=document.createElement('div'),search=document.createElement('input'),status=document.createElement('small');search.type='search';search.className='component-props-search';search.setAttribute('aria-label','Search component properties');search.placeholder='Find a property…';search.value=componentPropertyFilters.get(instanceId)||'';status.className='component-props-count';status.setAttribute('role','status');
  const filter=()=>{
    const query=search.value.trim().toLowerCase();let count=0;
    for(const row of body.children){row.hidden=!row.dataset.propertyName.toLowerCase().includes(query);if(!row.hidden)count++;}
    status.textContent=count?(query?count+' of '+props.length+' properties':props.length+' properties'):'No properties match.';
    componentPropertyFilters.delete(instanceId);if(search.value)componentPropertyFilters.set(instanceId,search.value);if(componentPropertyFilters.size>50)componentPropertyFilters.delete(componentPropertyFilters.keys().next().value);
    requestAnimationFrame(()=>{if(group.isConnected)group.querySelectorAll('.component-prop-text').forEach(sizeComponentText);});
  };
  search.addEventListener('input',filter);search.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();search.value='';filter();}});group.append(search,status,table);filter();return group;
}
function componentSelectionSection(infos){
 const section=RetouchInspector.section('Shared component properties'),key=panelSelectionKey(),ids=infos.map(info=>info.id);
 section.classList.add('shared-component-props');
 RetouchInspector.note(section,'Changes apply to these component usages at every screen size.');
 const pending=document.createElement('p');pending.textContent='Loading shared properties…';section.append(pending);
 Promise.all(ids.map(id=>api('GET',componentUrl(id)))).then(components=>{
  if(!section.isConnected||key!==panelSelectionKey())return;
  pending.remove();
  if(components.some((component,i)=>!component?.ok||component.usageHash!==infos[i].hash)){RetouchInspector.note(section,'The component source changed. Select the instances again.');return;}
  const shared=components[0].props.filter(prop=>components.every(component=>component.props.some(other=>other.name===prop.name)));
  if(!shared.length){RetouchInspector.note(section,'These components have no shared properties.');return;}
  for(const prop of shared){
   const metas=components.map(component=>component.props.find(other=>other.name===prop.name).editor||{}),type=metas[0].type;
   const editable=metas.every(meta=>meta.editable&&meta.type===type),mixed=metas.some(meta=>meta.value!==metas[0].value||!!meta.unset!==!!metas[0].unset);
   const constrained=metas.filter(meta=>meta.choices),choices=constrained.length?constrained[0].choices.filter(value=>constrained.every(meta=>meta.choices.includes(value))):null;
   const booleanToggle=type==='boolean'&&(!choices||choices.length===2&&choices.includes(true)&&choices.includes(false));
   const hashes=Object.fromEntries(ids.map((id,i)=>[id,metas[i].definitionHash]).filter(([,hash])=>hash!==undefined));
   const row=document.createElement('div');row.className='field';const label=document.createElement('label');label.textContent=prop.name;
   const input=document.createElement(choices&&!booleanToggle?'select':type==='string'?'textarea':'input');input.setAttribute('aria-label','Shared component property '+prop.name);input.disabled=!editable||choices?.length===0;
   if(choices&&!booleanToggle){if(mixed||metas[0].unset){const option=new Option(mixed?'Mixed':'Not set','');option.disabled=true;input.append(option);}choices.forEach((value,i)=>input.append(new Option(String(value),String(i))));input.value=mixed||metas[0].unset?'':String(choices.indexOf(metas[0].value));}
   else if(type==='boolean'){input.type='checkbox';input.checked=!mixed&&!!metas[0].value;input.indeterminate=mixed;}
   else{if(type!=='string'){input.type='number';input.step='any';}else{input.rows=1;input.className='component-prop-text';}input.value=mixed||metas[0].unset?'':String(metas[0].value??'');input.placeholder=mixed?'Mixed':metas[0].unset?'Not set':'';}
   const save=(value,options={})=>setComponentPropertySelection(infos,key,prop.name,value,hashes,options);
   const initial={value:input.value,checked:input.checked,indeterminate:input.indeterminate};let canceled=false;
   const multiline=type==='string'&&!choices;
   if(multiline){input.title='Enter adds a line. Command/Ctrl+Enter saves. Escape cancels.';requestAnimationFrame(()=>sizeComponentText(input));}
   input.oninput=()=>{canceled=false;input.setCustomValidity('');if(multiline)sizeComponentText(input);};
   input.onchange=()=>{if(input.disabled||canceled)return;if(type==='number'&&(!input.value.trim()||!Number.isFinite(Number(input.value)))){input.setCustomValidity('Enter a finite number.');input.reportValidity();return;}if(!input.reportValidity())return;save(booleanToggle?input.checked:choices?choices[Number(input.value)]:type==='boolean'?input.checked:type==='number'?Number(input.value):input.value);};
   input.onkeydown=event=>{
    if(event.isComposing)return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();canceled=true;input.setCustomValidity('');input.value=initial.value;input.checked=initial.checked;input.indeterminate=initial.indeterminate;if(multiline)sizeComponentText(input);input.blur();return;}
    if(event.key==='Enter'&&(type!=='string'||event.metaKey||event.ctrlKey)){event.preventDefault();event.stopPropagation();input.blur();}
   };
   label.append(input);row.append(label);
   if(editable&&!choices&&type==='string'&&(mixed||metas.some(meta=>meta.unset)))row.append(RetouchInspector.button('Set '+prop.name+' to empty text',()=>save('')));
   if(!editable)RetouchInspector.note(row,metas.find(meta=>!meta.editable)?.reason||'These properties have different types.');
   if(choices?.length===0)RetouchInspector.note(row,'These properties have no allowed value in common.');
   if(metas.every(meta=>meta.canReset))row.append(RetouchInspector.button('Reset '+prop.name+' to defaults',()=>save(undefined,{reset:true})));
   if(metas.every(meta=>meta.canClear))row.append(RetouchInspector.button('Unset '+prop.name,()=>save(undefined,{clear:true})));
   section.append(row);
  }
 }).catch(error=>{if(section.isConnected)RetouchInspector.note(section,'Could not load shared properties: '+error.message);});
 return section;
}
async function refreshComponentSelection(ids){
 await restoreLayerSelection(ids);
 if(sel?.info.kind==='instance')await refreshWrittenElement(sel.info,el=>(sel.multiple||[sel.info]).every(info=>matchingInDocument(el.ownerDocument,info.id,info).some(root=>root.getAttribute(info.renderRevisionAttribute)===info.hash)));
 else await reloadFrame();
 await layers.refresh();if(sel)renderPanel();
}
async function setComponentPropertySelection(infos,key,name,value,definitionHashes,options={}){
 if(key!==panelSelectionKey()||panelTasks||undoBusy||sourceRequests)return;
 const ids=infos.map(info=>info.id);busyPanel(true);
 try{
  const result=await api('POST','/rt/__api/op',{type:'setComponentPropSelection',id:ids[0],ids,fileHash:infos[0].hash,name,value,definitionHashes,...options});
  if(!result?.ok){toast(result?.reason||result?.error||'Could not edit the selected properties','err');return;}
  if(result.undoId)editorHistory.record({type:'setComponentPropSelection',id:ids[0],selectionIds:ids,undoId:result.undoId});
  await refreshComponentSelection(ids);toast('Component properties updated','ok');
 }catch(error){toast(error.message||'Could not edit the selected properties','err');}finally{busyPanel(false);}
}
function mountedComponentHost(instanceId,component,context){
 const ids=component.definitionIds?.length?component.definitionIds:[component.definitionId].filter(Boolean);
 for(const root of selectedComponentGroups(doc(),instanceId,{...component,context}).flatMap(group=>group.elements)){
  if(ids.includes(root.getAttribute('data-rt')))return root;
  for(const id of ids){const host=root.querySelector('[data-rt="'+id+'"]');if(host)return host;}
 }
 return null;
}
async function refreshComponentProperty(instanceId,parentId){
  const parent=parentId?await api('GET',resolveUrl(parentId)):null;
  const usage=await api('GET',resolveUrl(instanceId));
  if(parent?.ok)await refreshWrittenElement(parent.element,()=>true);else if(usage?.ok)await refreshWrittenElement(usage.element,()=>true);else await reloadFrame();
  const component=await api('GET',componentUrl(instanceId));
  if(usage?.ok&&component?.ok){sel={hostId:mountedComponentHost(instanceId,component,usage.element.context)?.getAttribute('data-rt')||component.definitionId,instanceId,scope:'instance',info:usage.element};renderPanel();}else clearSelection();
}
async function setComponentProperty(instanceId,name,value,fileHash,options={}){
  busyPanel(true);try{
    const result=await api('POST','/rt/__api/op',{type:'setComponentProp',id:instanceId,fileHash,name,value,...options});if(!result?.ok)throw Error(result?.reason||result?.error||'Could not edit the property.');
    const parentId=result.componentProp.parentId;editorHistory.record({type:'setComponentProp',id:instanceId,parentId,undoId:result.undoId});await refreshComponentProperty(instanceId,parentId);toast('Instance property updated','ok');
  }catch(error){toast(error.message,'err');if(sel)renderPanel();}finally{busyPanel(false);}
}
async function editDefinition(instanceId, component) {
  if (!component.definitionId) return;
  const target=mountedComponentHost(instanceId,component,sel?.info?.context),hostId=target?.getAttribute('data-rt')||component.definitionId;
  const response = await api('GET', resolveUrl(hostId, target?renderContext(target):sel?.info?.context));
  if (!response?.ok) return toast('The definition changed. Re-select the component.', 'err');
  sel = { hostId, instanceId:component.definitionOnly?null:instanceId, scope: 'host', info: response.element };
  renderPanel(); toast(component.detached ? 'Editing detached definition' : 'Editing shared definition', 'ok');
}
async function refreshDeletedComponent(id,parentId){
 const ids=Array.isArray(id)?id:[id],absent=d=>ids.every(id=>!matchingInDocument(d,id).length);
 const parent=parentId?await api('GET',resolveUrl(parentId)):null;
 if(parent?.ok){await refreshWrittenElement(parent.element,el=>absent(el.ownerDocument));if(absent(doc()))return;}
 const location=iframe.contentWindow.location.href;
 for(let attempt=0;attempt<30;attempt++){
  if(iframe.contentWindow.location.href!==location)return;
  const response=await fetch(location,{cache:'no-store'});
  if(response.ok&&absent(new DOMParser().parseFromString(await response.text(),'text/html'))){if(!absent(doc()))await reloadFrame();if(absent(doc()))return;}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 throw Error('The usage was deleted, but its preview has not refreshed yet.');
}
async function moveInstance(info,direction,destinationId){
 busyPanel(true);try{
  const result=await api('POST','/rt/__api/op',{type:'moveComponent',id:info.id,fileHash:info.hash,direction,destinationId});if(!result?.ok)throw Error(result?.reason||result?.error||'Could not move the component.');
  if(result.unchanged){await selectInsertedComponent(info.id,null);return;}
  const moved=result.movedComponent;editorHistory.record({type:'moveComponent',id:moved.instanceId,previousInstanceId:moved.previousInstanceId,sourceIdMap:moved.sourceIdMap,undoId:result.undoId});
  layerLocks.remap(moved.sourceIdMap);await refreshSwappedComponent(moved.instanceId,null);await selectInsertedComponent(moved.instanceId,null);layers.refresh();toast('Component moved','ok');
 }catch(error){toast(error.message,'err');}finally{busyPanel(false);}
}
async function deleteComponentSelection(){
 const ids=sel.multiple.map(info=>info.id),hash=sel.info.hash;busyPanel(true);
 try{
  const result=await api('POST','/rt/__api/op',{type:'deleteComponentSelection',id:ids[0],ids,fileHash:hash});if(!result?.ok)throw Error(result?.reason||'Could not delete the selected components.');
  const deletedLocks=layerLocks.removeSourceIds(result.removedSourceIds);
  editorHistory.record({type:'deleteComponentSelection',id:ids[0],selectionBefore:ids,deletedComponentIds:result.deletedComponentIds,parentId:result.parentId,removedSourceIds:result.removedSourceIds,deletedLocks,undoId:result.undoId});
  await refreshDeletedComponent(result.deletedComponentIds,result.parentId);clearSelection();await layers.refresh();toast(result.rootCount+' components deleted','ok');
 }catch(error){toast(error.message,'err');}finally{busyPanel(false);}
}
async function deleteInstance(id,context){
 busyPanel(true);try{
  const usage=await api('GET',resolveUrl(id,context));if(!usage?.ok)throw Error('Re-select the component before deleting.');
  const result=await api('POST','/rt/__api/op',{type:'deleteComponent',id,fileHash:sel?.info.id===id?sel.info.hash:usage.element.hash});if(!result?.ok)throw Error(result?.reason||result?.error||'Could not delete the component usage.');
  const removedSourceIds=result.deletedComponent.removedSourceIds||[id],deletedLocks=layerLocks.removeSourceIds(removedSourceIds);
  editorHistory.record({type:'deleteComponent',id,parentId:result.deletedComponent.parentId,removedSourceIds,deletedLocks,undoId:result.undoId});
  await refreshDeletedComponent(id,result.deletedComponent.parentId);clearSelection();toast('Component usage deleted; definition remains available','ok');
 }catch(error){toast(error.message,'err');}finally{busyPanel(false);}
}
async function duplicateComponentSelection(){
 const infos=sel.multiple,ids=infos.map(info=>info.id);busyPanel(true);
 try{
  const result=await api('POST','/rt/__api/op',{type:'duplicateComponentSelection',id:ids[0],ids,fileHash:infos[0].hash});if(!result?.ok)throw Error(result?.reason||'Could not duplicate the selected components.');
  editorHistory.record({type:'duplicateComponentSelection',id:ids[0],selectionBefore:ids,selectionAfter:result.selectionIds,sourceIdMap:result.sourceIdMap,undoId:result.undoId});
  layerLocks.remap(result.sourceIdMap);await refreshComponentSelection(result.selectionIds);toast(result.rootCount+' components duplicated','ok');
 }catch(error){toast(error.message,'err');}finally{busyPanel(false);}
}
async function duplicateInstance(id,context) {
  busyPanel(true);
  try{
    const usage=await api('GET',resolveUrl(id,context));if(!usage?.ok)throw Error('Re-select the component before duplicating.');
    const result=await api('POST','/rt/__api/op',{type:'duplicateComponent',id,fileHash:usage.element.hash});if(!result?.ok)throw Error(result?.reason||result?.error||'Could not duplicate the instance.');
    const copied=result.duplicatedComponent;
    editorHistory.record({type:'duplicateComponent',id:copied.parentId||id,instanceCopyId:copied.instanceId,instanceOriginalId:id,sourceIdMap:copied.sourceIdMap,undoId:result.undoId});
    if(copied.sourceIdMap)layerLocks.remap(copied.sourceIdMap);
    const copy=await api('GET',resolveUrl(copied.instanceId)),parent=copied.parentId?await api('GET',resolveUrl(copied.parentId)):null;
    if(parent?.ok)await refreshWrittenElement(parent.element,el=>!!el.ownerDocument.querySelector('[data-rt-i="'+copied.instanceId+'"]'));
    else if(copy?.ok)await refreshWrittenElement(copy.element,el=>el.getAttribute('data-rt-i')===copied.instanceId);
    else await reloadFrame();
    const component=await api('GET',componentUrl(copied.instanceId));
    if(copy?.ok&&component?.ok){sel={hostId:mountedComponentHost(copied.instanceId,component,copy.element.context)?.getAttribute('data-rt')||component.definitionId,instanceId:copied.instanceId,scope:'instance',info:copy.element};renderPanel();}
    toast('Instance duplicated; definition remains shared','ok');
  }catch(error){toast(error.message,'err');}finally{busyPanel(false);}
}

async function detachInstance(id, component, button, context=sel?.info?.context) {
  button.disabled = true;
  try {
    const usage = await api('GET', resolveUrl(id,context));
    if (!usage?.ok) return toast('The usage no longer resolves.', 'err');
    const result = await api('POST', '/rt/__api/op', { type: 'detachComponent', id, fileHash: usage.element.hash, definitionHash: component.hash, context:usage.element.context });
    if (!result?.ok) return toast(result?.reason || result?.error || 'Detach failed', 'err');
    editorHistory.record({ type: 'detachComponent', id, undoId: result.undoId, context:usage.element.context });
    const detached = await api('GET', componentUrl(id,usage.element.context));
    if (detached?.ok) {
      await refreshWrittenElement(result.element || {...usage.element,hash:result.hash}, el => (detached.definitionIds || [detached.definitionId]).includes(el.getAttribute('data-rt')));
      await editDefinition(id, detached);
    }
    toast('Detached to ' + result.detachedFile, 'ok');
  } finally { button.disabled = false; }
}
async function refreshSwappedComponent(instanceId,parentId){
 if(parentId){const parent=await api('GET',resolveUrl(parentId));if(parent?.ok){await refreshWrittenElement(parent.element,()=>true);return;}}
 const usage=await api('GET',resolveUrl(instanceId)),component=await api('GET',componentUrl(instanceId));
 if(!usage?.ok||!component?.ok)throw Error('The swap was saved, but its component no longer resolves.');
 const roots=component.definitionIds?.length?component.definitionIds:[component.definitionId].filter(Boolean),matches=node=>roots.includes(node.getAttribute('data-rt'))&&node.getAttribute('data-rt-revision')===component.hash;
 const info=usage.element;
 await refreshWrittenElement(info,matches);
 if(!matchingInDocument(doc(),instanceId,info).some(node=>matches(node)&&node.getAttribute(info.renderRevisionAttribute)===info.hash))throw Error('The swap was saved, but its component has not appeared in the preview yet.');
}
async function selectInsertedComponent(id,parentId){
 const usage=await api('GET',resolveUrl(id)),component=await api('GET',componentUrl(id));
 if(!usage?.ok||!component?.ok){clearSelection();return;}
 componentLibrarySelections.add(id);sel={hostId:mountedComponentHost(id,component,usage.element.context)?.getAttribute('data-rt')||component.definitionId,instanceId:id,scope:'instance',info:usage.element};renderPanel();matchingInDocument(doc(),id)[0]?.scrollIntoView({block:'nearest',inline:'nearest'});
}
async function insertLibraryComponent(item,target,isActive){
 if(!target)throw Error('Select a frame before inserting a component.');
 if(panelTasks||sourceRequests||undoBusy)throw Error('Wait for the current edit to finish.');
 const definition=await api('GET','/rt/__api/component-definition?id='+item.definitionId);
 if(!isActive())return false;if(!definition?.ok)throw Error(definition?.reason||'Refresh the component library.');
 if(!definition.insertion?.ok)throw Error(definition.insertion?.reason||'Could not read component properties.');
 const previous=target.swap?await api('GET',componentUrl(target.id)):null;
 if(target.swap&&!previous?.swap?.ok)throw Error(previous?.swap?.reason||'This instance cannot be swapped.');
 const kept={},removed=[];if(previous)for(const [name,value] of Object.entries(previous.swap.props)){const prop=definition.insertion.properties.find(prop=>prop.name===name);if(prop&&(!prop.type||typeof value===prop.type)&&(!prop.choices||prop.choices.includes(value)))Object.defineProperty(kept,name,{value,enumerable:true});else removed.push(name);}
 const submit=async props=>{
 if(!isActive())return false;busyPanel(true);try{
  const result=await api('POST','/rt/__api/op',{type:target.swap?'swapComponent':'insertComponent',dropProps:removed,id:target.id,fileHash:target.hash,definitionFile:definition.file,definitionId:definition.definitionId,definitionHash:definition.hash,contractHash:definition.insertion.revision,props});
  if(!result?.ok)throw Error(result?.reason||result?.error||'Could not insert the component.');
  const inserted=result.insertedComponent;editorHistory.record({type:target.swap?'swapComponent':'insertComponent',previousInstanceId:inserted.previousInstanceId,sourceIdMap:inserted.sourceIdMap,id:inserted.parentId,instanceId:inserted.instanceId,previousParentId:inserted.previousParentId,undoId:result.undoId});
  if(inserted.sourceIdMap)layerLocks.remap(inserted.sourceIdMap);
  if(target.swap)await refreshSwappedComponent(inserted.instanceId,inserted.parentId);
  else{const parent=await api('GET',resolveUrl(inserted.parentId));if(parent?.ok)await refreshWrittenElement(parent.element,el=>!!el.ownerDocument.querySelector('[data-rt-i="'+inserted.instanceId+'"]'));else await reloadFrame();}
  await selectInsertedComponent(inserted.instanceId,inserted.parentId);toast(target.swap?'Component swapped':'Component inserted','ok');
 }finally{busyPanel(false);}
 };
 return target.swap||definition.insertion.properties.some(prop=>prop.required)?RetouchComponentLibrary.configure({component:definition,target,submit,mode:target.swap?'swap':'insert',initial:kept,removed}):submit({});
}
const componentLibrarySelections=new Set();
const componentLibraryButton=document.getElementById('componentLibrary');
componentLibraryButton.hidden=!window.__RT_RENDERING?.componentLibrary;
componentLibraryButton.addEventListener('click',()=>RetouchComponentLibrary.open({
 read:()=>api('GET','/rt/__api/components'),
 insertTarget:sel?.info.canInsertComponent?{id:sel.info.id,hash:sel.info.hash,context:sel.info.context,label:'<'+sel.info.tag+'> · '+sel.info.file}:null,
 insert:window.__RT_RENDERING?.componentInsertion?insertLibraryComponent:undefined,
 swapTarget:sel?.info.kind==='instance'?{swap:true,id:sel.info.id,hash:sel.info.hash,definitionId:sel.info.definitionId,context:sel.info.context}:null,

 instances:item=>item.usages.length?item.usages.flatMap(usage=>RetouchComponentInstances.group(matchingInDocument(doc(),usage.id),item.rootGroups).map(group=>({...group,id:usage.id,layerName:usage.layerName,label:(usage.layerName?usage.layerName+' · ':'')+usage.file+(usage.line?':'+usage.line:'')+(group.elements.length>1?' · '+group.elements.length+' layers':'')}))):matchingInDocument(doc(),item.definitionId).map(element=>({id:item.definitionId,definition:true,element,label:item.file})),
 select:async(instance,isActive)=>{
  if(!instance?.element?.isConnected)throw Error('This instance is no longer on the page. Refresh the component list.');
  if(panelTasks||sourceRequests||undoBusy)throw Error('Wait for the current edit to finish.');
  const serial=classificationSerial,context=renderContext(instance.element),usage=await api('GET',resolveUrl(instance.id,context)),component=await api('GET',instance.definition?'/rt/__api/component-definition?id='+instance.id:componentUrl(instance.id,context));
  if(!isActive()||serial!==classificationSerial)return;
  if(!instance.element.isConnected)throw Error('This instance is no longer on the page. Refresh the list.');
  if(!usage?.ok||!component?.ok)throw Error('This component no longer resolves. Refresh the list.');
  if(!instance.definition){componentLibrarySelections.add(instance.id);if(componentLibrarySelections.size>1000)componentLibrarySelections.delete(componentLibrarySelections.values().next().value);}
  stopDrawing?.();classificationSerial++;renderedSelection={id:instance.id,element:instance.element};sel={hostId:mountedComponentHost(instance.id,component,context)?.getAttribute('data-rt')||component.definitionId,instanceId:instance.definition?null:instance.id,scope:instance.definition?'host':'instance',info:usage.element};renderPanel();instance.element.scrollIntoView({block:'nearest',inline:'nearest'});
 },
 view:async(id,onPage,isActive,definitionOnly,element)=>{const component=await api('GET',definitionOnly?'/rt/__api/component-definition?id='+id:componentUrl(id));if(!isActive())return;if(!component?.ok)throw Error(component?.reason||'This component no longer resolves.');openComponent(id,component,{preview:onPage,element});}
}));
function openComponent(id, component,options={}) {
  const selectedElement=options.element||(renderedSelection?.id===id?renderedSelection.element:null),sourceMatches=matchingInDocument(doc(),id,component),sourceGroups=RetouchComponentInstances.group(sourceMatches,component.rootGroups),sourceGroup=sourceGroups.find(group=>group.elements.includes(selectedElement))||sourceGroups[0],previewBookmark=RetouchComponentInstances.captureOccurrence(sourceMatches,sourceGroup?.element);
  const modal = document.createElement('dialog');modal.className = 'component-modal';modal.setAttribute('aria-label',component.name+' component');
  const header = document.createElement('header');
  const title = document.createElement('h2');title.textContent = component.name;
  const close = RetouchInspector.button('Close',()=>modal.close());header.append(title,close);modal.append(header);
  RetouchInspector.note(modal, component.file, 'filepath');
  const content=document.createElement('div');content.className='component-workspace';if(options.preview===false)content.classList.add('component-source-only');
  const canvas=document.createElement('div');canvas.className='component-canvas';
  RetouchInspector.note(canvas,options.preview===false?'No matching instance was found on this page. Its source and property definitions are shown here.':component.definitionOnly?'Live preview · current page rendering':'Live preview · current instance props');
  const preview=document.createElement('iframe');preview.title='Component preview';preview.style.visibility='hidden';preview.setAttribute('aria-busy','true');canvas.append(preview);const loading=RetouchInspector.note(canvas,'Loading component preview…');loading.setAttribute('role','status');
  const sidebar=document.createElement('div');sidebar.className='component-details';
  const h=document.createElement('h3');h.textContent='Props';sidebar.append(h,propTable(component.props,null,null,{definitionOnly:component.definitionOnly}));
  RetouchInspector.note(sidebar,component.definitionOnly?'Declared properties and defaults. No instance values are applied.':'Values show the usage source. Expressions keep their application context.');
  const details=document.createElement('details');details.open=options.preview===false;const summary=document.createElement('summary');summary.textContent='Component definition';
  const code=document.createElement('pre');code.textContent=component.source;details.append(summary,code);sidebar.append(details);
  const edit=RetouchInspector.button('Edit definition',()=>{modal.close();editDefinition(id,component);});edit.disabled=!component.definitionId||options.preview===false;sidebar.append(edit);
  content.append(canvas,sidebar);modal.append(content);document.body.append(modal);
  let stop;
  preview.onload=()=>{
    stop?.();stop=null;if(!modal.isConnected)return;
    try {
      const d=preview.contentDocument;
      // Keep the actual mounted component, its providers, and HMR alive. Hide
      // surrounding layout in this separate frame instead of cloning markup.
      // A constructed stylesheet leaves React-owned DOM attributes intact
      // even when its hydration completes after the frame load event.
      const sheet=new preview.contentWindow.CSSStyleSheet();
      d.adoptedStyleSheets=[...d.adoptedStyleSheets,sheet];
      const selector=node=>{
        const parts=[];
        for(let n=node;n&&n!==d.documentElement;n=n.parentElement)parts.unshift(n.tagName.toLowerCase()+':nth-child('+([...n.parentElement.children].indexOf(n)+1)+')');
        return 'html'+(parts.length?' > '+parts.join(' > '):'');
      };
      const isolate=()=>{
        const matches=matchingInDocument(d,id,component),target=RetouchComponentInstances.restoreOccurrence(matches,previewBookmark),group=RetouchComponentInstances.group(matches,component.rootGroups).find(group=>group.elements.includes(target));if(!group){preview.style.visibility='hidden';preview.setAttribute('aria-busy','true');loading.textContent='Waiting for the selected component…';if(!loading.isConnected)canvas.append(loading);return;}
        const roots=group.elements,retained=new Set(roots),ancestors=new Set(),rules=[];
        for(const el of roots)for(let parent=el.parentElement;parent;parent=parent.parentElement){retained.add(parent);ancestors.add(parent);}
        for(const parent of ancestors){
          for(const sibling of parent.children)if(!retained.has(sibling)&&!['STYLE','LINK','SCRIPT','HEAD'].includes(sibling.tagName))rules.push(selector(sibling)+'{display:none!important}');
          if(parent!==d.documentElement)rules.push(selector(parent)+'{'+Object.entries({display:'block',position:'static',width:'auto',height:'auto','min-height':'0',margin:'0',padding:parent===d.body?'32px':'0',transform:'none',overflow:'visible'}).map(([p,v])=>p+':'+v+'!important').join(';')+'}');
        }
        for(const el of roots)rules.push(selector(el)+'{margin:0!important}');sheet.replaceSync(rules.join('\n'));preview.style.visibility='visible';preview.setAttribute('aria-busy','false');loading.remove();
      };
      isolate(); const observer=new MutationObserver(isolate);observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['id','data-rt','data-rt-i']});stop=()=>observer.disconnect();
      d.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();},true);
    }catch{loading.textContent='Preview could not attach to this page.';}
  };
  if(options.preview===false){preview.remove();loading.remove();}else{
    const url=iframe.contentWindow.location.href;
    const refresh=RetouchInspector.button('Refresh preview',()=>{stop?.();stop=null;preview.style.visibility='hidden';preview.setAttribute('aria-busy','true');loading.textContent='Loading component preview…';if(!loading.isConnected)canvas.append(loading);preview.src=url;});refresh.setAttribute('aria-label','Refresh preview');refresh.title='Refresh preview';refresh.textContent='↻';refresh.className+=' component-preview-refresh';header.insertBefore(refresh,close);preview.src=url;
  }
  modal.addEventListener('close',()=>{stop?.();stop=null;preview.onload=null;modal.remove();});
  modal.showModal();close.focus();
}

async function setTag(tag) {
  busyPanel(true);
  try { return await writeTag(tag); } finally { busyPanel(false); }
}
async function writeTag(tag) {
  if (!sel || !sel.info || sel.info.tag === tag) return;
  const info = sel.info;
  const prev = info.tag;
  const res = await api('POST', '/rt/__api/op', { type: 'setTag', id: info.id, tag, fileHash: info.hash, ...sourcePayload(info,info.tagSource) });
  if (res && res.ok) {
    editorHistory.record({ type: 'setTag', id: info.id, tag: prev, undoId: res.undoId, context:info.context });
    info.tag = tag;
    info.hash = res.hash;
    if (res.element?.tagSource) info.tagSource=res.element.tagSource;
    toast('Saved', 'ok');
    await refreshWrittenElement(info, el => el.tagName.toLowerCase() === tag, {expectedTag:tag});
    renderPanel();
  } else {
    toast((res && res.reason) || (res && res.error) || 'Write failed', 'err');
  }
}

// Undo path: resolve the element fresh and set its tag by id.
async function applyTag(id, tag) {
  const r = await api('GET', '/rt/__api/resolve?id=' + id);
  if (!r || !r.ok) return toast('Cannot resolve the element for undo', 'err');
  const res = await api('POST', '/rt/__api/op', { type: 'setTag', id, tag, fileHash: r.element.hash });
  if (res && res.ok) { toast('Saved', 'ok'); reloadFrame(); }
  else toast((res && res.reason) || (res && res.error) || 'Undo failed', 'err');
}

function makeStepper(prefix, tokens) {
  const re = new RegExp('^' + prefix + '-([0-9]+(?:\\.5)?)$');
  const current = tokens.map((t) => t.match(re)).find(Boolean);
  const value = current ? parseFloat(current[1]) : null;
  const wrap = document.createElement('div');
  wrap.className = 'stepper';
  const label = document.createElement('label');
  label.textContent = prefix;
  const val = document.createElement('b');
  val.textContent = value === null ? '—' : String(value);
  const mk = (txt, delta) => {
    const b = document.createElement('button');
    b.textContent = txt;
    b.onclick = () => {
      const idx = value === null ? (delta > 0 ? -1 : 0) : SPACING_STEPS.indexOf(value);
      let next = SPACING_STEPS[Math.min(Math.max(idx + delta, 0), SPACING_STEPS.length - 1)];
      if (next === undefined) next = SPACING_STEPS[0];
      const rest = tokens.filter((t) => !re.test(t));
      setClasses([...rest, `${prefix}-${next}`].join(' '));
    };
    return b;
  };
  wrap.appendChild(label);
  wrap.appendChild(mk('−', -1));
  wrap.appendChild(val);
  wrap.appendChild(mk('+', +1));
  return wrap;
}

/* ---------- color pickers (Fill / Text color) ---------- */
const COLOR_NAMES = ['slate','gray','zinc','neutral','stone','red','orange','amber','yellow','lime','green','emerald','teal','cyan','sky','blue','indigo','violet','purple','fuchsia','pink','rose'];
const SHADES = ['50','100','200','300','400','500','600','700','800','900','950'];
// Swatch preview values (Tailwind default palette). The class token is what
// gets written; the hex here is only how the swatch looks in the panel.
const PALETTE = {
  slate:['#f8fafc','#f1f5f9','#e2e8f0','#cbd5e1','#94a3b8','#64748b','#475569','#334155','#1e293b','#0f172a','#020617'],
  gray:['#f9fafb','#f3f4f6','#e5e7eb','#d1d5db','#9ca3af','#6b7280','#4b5563','#374151','#1f2937','#111827','#030712'],
  zinc:['#fafafa','#f4f4f5','#e4e4e7','#d4d4d8','#a1a1aa','#71717a','#52525b','#3f3f46','#27272a','#18181b','#09090b'],
  neutral:['#fafafa','#f5f5f5','#e5e5e5','#d4d4d4','#a3a3a3','#737373','#525252','#404040','#262626','#171717','#0a0a0a'],
  stone:['#fafaf9','#f5f5f4','#e7e5e4','#d6d3d1','#a8a29e','#78716c','#57534e','#44403c','#292524','#1c1917','#0c0a09'],
  red:['#fef2f2','#fee2e2','#fecaca','#fca5a5','#f87171','#ef4444','#dc2626','#b91c1c','#991b1b','#7f1d1d','#450a0a'],
  orange:['#fff7ed','#ffedd5','#fed7aa','#fdba74','#fb923c','#f97316','#ea580c','#c2410c','#9a3412','#7c2d12','#431407'],
  amber:['#fffbeb','#fef3c7','#fde68a','#fcd34d','#fbbf24','#f59e0b','#d97706','#b45309','#92400e','#78350f','#451a03'],
  yellow:['#fefce8','#fef9c3','#fef08a','#fde047','#facc15','#eab308','#ca8a04','#a16207','#854d0e','#713f12','#422006'],
  lime:['#f7fee7','#ecfccb','#d9f99d','#bef264','#a3e635','#84cc16','#65a30d','#4d7c0f','#3f6212','#365314','#1a2e05'],
  green:['#f0fdf4','#dcfce7','#bbf7d0','#86efac','#4ade80','#22c55e','#16a34a','#15803d','#166534','#14532d','#052e16'],
  emerald:['#ecfdf5','#d1fae5','#a7f3d0','#6ee7b7','#34d399','#10b981','#059669','#047857','#065f46','#064e3b','#022c22'],
  teal:['#f0fdfa','#ccfbf1','#99f6e4','#5eead4','#2dd4bf','#14b8a6','#0d9488','#0f766e','#115e59','#134e4a','#042f2e'],
  cyan:['#ecfeff','#cffafe','#a5f3fc','#67e8f9','#22d3ee','#06b6d4','#0891b2','#0e7490','#155e75','#164e63','#083344'],
  sky:['#f0f9ff','#e0f2fe','#bae6fd','#7dd3fc','#38bdf8','#0ea5e9','#0284c7','#0369a1','#075985','#0c4a6e','#082f49'],
  blue:['#eff6ff','#dbeafe','#bfdbfe','#93c5fd','#60a5fa','#3b82f6','#2563eb','#1d4ed8','#1e40af','#1e3a8a','#172554'],
  indigo:['#eef2ff','#e0e7ff','#c7d2fe','#a5b4fc','#818cf8','#6366f1','#4f46e5','#4338ca','#3730a3','#312e81','#1e1b4b'],
  violet:['#f5f3ff','#ede9fe','#ddd6fe','#c4b5fd','#a78bfa','#8b5cf6','#7c3aed','#6d28d9','#5b21b6','#4c1d95','#2e1065'],
  purple:['#faf5ff','#f3e8ff','#e9d5ff','#d8b4fe','#c084fc','#a855f7','#9333ea','#7e22ce','#6b21a8','#581c87','#3b0764'],
  fuchsia:['#fdf4ff','#fae8ff','#f5d0fe','#f0abfc','#e879f9','#d946ef','#c026d3','#a21caf','#86198f','#701a75','#4a044e'],
  pink:['#fdf2f8','#fce7f3','#fbcfe8','#f9a8d4','#f472b6','#ec4899','#db2777','#be185d','#9d174d','#831843','#500724'],
  rose:['#fff1f2','#ffe4e6','#fecdd3','#fda4af','#fb7185','#f43f5e','#e11d48','#be123c','#9f1239','#881337','#4c0519'],
};

function colorTokenRe(kind) {
  return new RegExp(
    '^' + kind + '-(?:(?:' + COLOR_NAMES.join('|') + ')-(?:' + SHADES.join('|') +
    ')|white|black|transparent|current|inherit|\\[(?:#[0-9a-fA-F]+|(?:color:|rgb|hsl|oklch|oklab|lab|lch)[^\\]]*)\\])(?:/\\d{1,3})?$'
  );
}

function swatchColor(token) {
  const m = token.match(/^(?:bg|text)-(?:\[([^\]]+)\]|(white|black|transparent|current|inherit)|([a-z]+)-(\d{2,3}))(?:\/\d{1,3})?$/);
  if (!m) return '#888';
  if (m[1]) return m[1];
  if (m[2] === 'white') return '#ffffff';
  if (m[2] === 'black') return '#000000';
  if (m[2] === 'transparent') return 'transparent';
  if (m[2]) return '#888';
  const hues = PALETTE[m[3]];
  const idx = SHADES.indexOf(m[4]);
  return hues && idx >= 0 ? hues[idx] : '#888';
}

function colorSection(title, kind, info) {
  const sec = document.createElement('div');
  sec.className = 'sec';
  const h = document.createElement('h3');
  h.textContent = title;
  sec.appendChild(h);
  if (info.classNameDynamic) {
    const p = document.createElement('p');
    p.className = 'refused';
    p.textContent = info.classNameReason || 'className is dynamic (R-6).';
    sec.appendChild(p);
    return sec;
  }
  const tokens = (info.className || '').split(/\s+/).filter(Boolean);
  const re = colorTokenRe(kind);
  const current = tokens.find((t) => re.test(t)) || null;
  const target = matchingEls(info.id)[0];
  const computed = target && target.ownerDocument.defaultView.getComputedStyle(target)[kind === 'bg' ? 'backgroundColor' : 'color'];

  const row = document.createElement('div');
  row.className = 'colorrow';
  const sw = document.createElement('button');
  sw.className = 'swatch' + (current ? '' : ' empty');
  sw.setAttribute('aria-label', 'Choose ' + title.toLowerCase());
  if (computed || current) { sw.style.background = computed || swatchColor(current); sw.classList.remove('empty'); }
  const label = document.createElement('span');
  label.className = 'colorlabel';
  label.textContent = current || computed || 'default';
  row.appendChild(sw);
  row.appendChild(label);
  if (current) {
    const clear = document.createElement('button');
    clear.className = 'colorclear';
    clear.textContent = '×';
    clear.title = 'Remove';
    clear.onclick = () => applyColor(tokens, current, null);
    row.appendChild(clear);
  }
  sec.appendChild(row);

  const pal = buildPalette(kind, tokens, current);
  if (computed && current) RetouchInspector.note(sec, computed, 'computed-value');
  pal.hidden = true;
  sec.appendChild(pal);
  sw.onclick = () => { pal.hidden = !pal.hidden; };
  label.onclick = sw.onclick;
  return sec;
}

function applyColor(tokens, current, token) {
  const rest = tokens.filter((t) => t !== current);
  setClasses(token ? [...rest, token].join(' ') : rest.join(' '));
}

function buildPalette(kind, tokens, current) {
  const pal = document.createElement('div');
  pal.className = 'palette';
  const top = document.createElement('div');
  top.className = 'palrow';
  for (const t of ['white', 'black', 'transparent']) {
    top.appendChild(palBtn(tokens, current, kind + '-' + t, t === 'white' ? '#fff' : t === 'black' ? '#000' : 'transparent'));
  }
  const hex = document.createElement('input');
  hex.className = 'hexinput';
  hex.placeholder = '#hex ⏎';
  hex.setAttribute('aria-label', kind === 'bg' ? 'Fill hex color' : 'Text hex color');
  hex.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const v = hex.value.trim().replace(/^#?/, '#');
      if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) applyColor(tokens, current, `${kind}-[${v.toLowerCase()}]`);
      else toast('Enter a hex color like #1a4e8a', 'err');
    }
  };
  top.appendChild(hex);
  pal.appendChild(top);
  for (const name of COLOR_NAMES) {
    const row = document.createElement('div');
    row.className = 'palrow';
    PALETTE[name].forEach((hexv, i) => row.appendChild(palBtn(tokens, current, `${kind}-${name}-${SHADES[i]}`, hexv)));
    pal.appendChild(row);
  }
  pal.setAttribute('role','toolbar');pal.setAttribute('aria-label',kind==='bg'?'Fill color presets':'Text color presets');
  const swatches=[...pal.querySelectorAll('.palbtn')],initial=swatches.find(button=>button.classList.contains('cur')&&!button.disabled)||swatches.find(button=>!button.disabled);
  for(const button of swatches){button.tabIndex=button===initial?0:-1;button.addEventListener('focus',()=>{for(const item of swatches)item.tabIndex=item===button?0:-1;});}
  pal.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    const items=swatches.filter(button=>!button.matches(':disabled')),index=items.indexOf(document.activeElement);if(index<0)return;event.preventDefault();event.stopPropagation();let next;
    if(event.key==='Home'||event.key==='End')next=event.key==='Home'?items[0]:items.at(-1);
    else if(event.key==='ArrowLeft'||event.key==='ArrowRight')next=items[(index+(event.key==='ArrowRight'?1:-1)+items.length)%items.length];
    else{const rows=[...pal.querySelectorAll('.palrow')].map(row=>[...row.querySelectorAll('.palbtn')].filter(button=>items.includes(button))).filter(row=>row.length),rowIndex=rows.findIndex(row=>row.includes(items[index])),column=rows[rowIndex].indexOf(items[index]),row=rows[(rowIndex+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length];next=row[Math.min(column,row.length-1)];}
    next?.focus();
  });
  return pal;
}

function palBtn(tokens, current, token, color) {
  const b = document.createElement('button');
  b.className = 'palbtn' + (token === current ? ' cur' : '');
  b.title = token;b.setAttribute('aria-label',token);
  b.style.background = color;
  b.onclick = () => applyColor(tokens, current, token);
  return b;
}

/* ---------- image swap ---------- */
async function refreshLiquidImageFill(info){
 await refreshLiteralLiquidClasses([info],{[info.id]:matchingEls(info.id)[0]?.getAttribute('class')||''});
 const select=d=>matchingInDocument(d,info.id,info);
 await RetouchRenderSync.sync({frame:iframe,serverRendered:true,select});
 await window.RetouchComparisons?.syncImage({select,matches:()=>true});
}
async function setLiquidImageFill(info,src,initialize,action='apply',stack=null){
 if(sel?.info!==info)return;busyPanel(true);
 try{
  const result=await api('POST','/rt/__api/op',{type:'setImageFill',id:info.id,fileHash:info.hash,context:info.context,scope:styleScope,src,initialize,action,stack});
  if(!result?.ok)throw Error(result?.reason||result?.error||'Could not save the image fill.');
  if(result.undoId)editorHistory.record({type:'setImageFill',id:info.id,context:info.context,undoId:result.undoId});
  sel.info=result.element;await refreshLiquidImageFill(result.element);renderPanel();toast('Saved','ok');
 }catch(error){toast(error.message,'err');renderPanel();}finally{busyPanel(false);}
}
function projectImageBrowser(info){
 const scope=styleScope,hash=info.hash,serial=classificationSerial;
 return onSelect=>RetouchProjectImages.open({
  current:()=>sel?.info===info&&info.hash===hash&&styleScope===scope&&classificationSerial===serial,
  list:async({query,offset,signal})=>{const response=await fetch('/rt/__api/images?q='+encodeURIComponent(query)+'&offset='+offset+'&limit=60',{headers:{'x-retouch-token':TOKEN},signal});return response.json();},
  preview:async(src,signal)=>{const response=await fetch('/rt/__api/image-preview?src='+encodeURIComponent(src),{headers:{'x-retouch-token':TOKEN},signal});if(!response.ok)throw Error('Preview unavailable');return response.blob();},onSelect
 });
}
function imageFillUpload(info){
 const scope=styleScope,hash=info.hash,serial=classificationSerial;
 return async file=>{
  if(file.size>10_000_000)throw Error('Image too large (max 10 MB)');
  if(sel?.info!==info||info.hash!==hash||styleScope!==scope||classificationSerial!==serial)throw Error('The selected image or screen scope changed.');
  const response=await fetch('/rt/__api/upload?name='+encodeURIComponent(file.name),{method:'POST',headers:{'x-retouch-token':TOKEN},body:file}),result=await response.json();
  if(!result.ok)throw Error(result.reason||result.error||'Image upload failed.');
  if(sel?.info!==info||info.hash!==hash||styleScope!==scope||classificationSerial!==serial)throw Error('The selected image or screen scope changed before the upload finished.');
  return result.src;
 };
}
function imageSection(info) {
  const sec = document.createElement('div');
  sec.className = 'sec';
  const h = document.createElement('h3');
  h.textContent = 'Image';
  sec.appendChild(h);
  if (info.srcDynamic || info.canSetSrc === false) {
    const p = document.createElement('p');
    p.className = 'refused';
    p.textContent = info.srcReason || 'This image source is computed. Choose an image with an editable source.';
    sec.appendChild(p);
    return sec;
  }
  const img = document.createElement('img');
  img.className = 'imgthumb';
  const target = matchingEls(info.id)[0];
  img.src = target?.currentSrc || target?.src || info.src;
  img.alt = 'Selected image';
  sec.appendChild(img);
  if(target?.tagName==='IMG')sec.append(RetouchInspector.button('Crop image',()=>{stopDrawing?.();const hash=info.hash,source=target.currentSrc;RetouchImageCrop.open({target,current:()=>sel?.info===info&&info.hash===hash&&target.currentSrc===source&&!panelTasks&&!sourceRequests&&!undoBusy,onError:message=>toast(message,'err'),onApply:async blob=>{const response=await fetch('/rt/__api/upload?name=cropped-image.svg',{method:'POST',headers:{'x-retouch-token':TOKEN},body:blob}),result=await response.json();if(!result.ok)throw Error(result.reason||result.error||'Crop upload failed.');if(sel?.info!==info||info.hash!==hash||target.currentSrc!==source)throw Error('The selected image changed before the crop was saved.');await setSrc(result.src,false,info);if(info.src!==result.src)throw Error('The cropped image could not be applied.');}});}));
  const pathEl = document.createElement('div');
  pathEl.className = 'filepath';
  pathEl.textContent = info.src;
  sec.appendChild(pathEl);
  const pathInput = document.createElement('input'); pathInput.type = 'text'; pathInput.placeholder = '/images/example.png'; pathInput.value = info.srcImported ? '' : info.src;
  RetouchInspector.field(sec, 'Image path', pathInput);
  sec.append(RetouchInspector.button('Apply image path', () => setSrc(pathInput.value.trim(), false, info)));
  const browse=RetouchInspector.button('Browse project images',event=>{event.currentTarget.focus({preventScroll:true});projectImageBrowser(info)(async src=>{await setSrc(src,false,info);if(info.src!==src)throw Error('The selected image could not be applied.');});});sec.append(browse);
  const pick = document.createElement('button');
  pick.id = 'imgPick';
  pick.textContent = 'Choose image…';
  const fileIn = document.createElement('input');
  fileIn.type = 'file';fileIn.setAttribute('aria-label','Upload image source');
  fileIn.accept = 'image/*';
  fileIn.hidden = true;
  pick.onclick = () => fileIn.click();
  const upload=imageFillUpload(info);
  fileIn.onchange=async()=>{const file=fileIn.files[0];if(!file)return;pick.disabled=true;try{const src=await upload(file);await setSrc(src,false,info);}catch(error){toast(error.message,'err');}finally{pick.disabled=false;fileIn.value='';}};
  sec.appendChild(pick);
  sec.appendChild(fileIn);
  return sec;
}

async function setSrc(src, isUndo, info = sel?.info) {
  busyPanel(true);
  try { return await writeSrc(src, isUndo, info); } finally { busyPanel(false); }
}
function imageMatches(el,src,matcher) {
  const value=new URL(el.getAttribute('src')||'',location.origin);
  return value.href===new URL(src||'',location.origin).href || value.searchParams.get('url')===src ||
    !!matcher?.pathnameSuffix&&value.pathname.endsWith(matcher.pathnameSuffix);
}
async function writeSrc(src, isUndo, info) {
  if (!info) return;
  const prev = info.src;
  const target = matchingEls(info.id)[0];
  const dimensions = target ? { width: Number(target.getAttribute('width')) || target.naturalWidth, height: Number(target.getAttribute('height')) || target.naturalHeight } : undefined;
  const res = await api('POST', '/rt/__api/op', { type: 'setSrc', id: info.id, src, fileHash: info.hash, dimensions, context:info.context });
  if (res && res.ok) {
    if (!isUndo) editorHistory.record({ type: 'setSrc', id: info.id, src: prev, undoId: res.undoId, context:info.context });
    info.src = src;
    info.srcImported = false;
    info.hash = res.hash;
    toast('Saved', 'ok');
    info.srcMatch=res.element?.srcMatch;
    await refreshWrittenElement(info, el => imageMatches(el,src,info.srcMatch),{imageSource:true});
    if (sel?.info === info) renderPanel();
  } else {
    toast((res && res.reason) || (res && res.error) || 'Write failed', 'err');
    if (sel?.info === info) loadScope();
  }
}

/* ---------- ops ---------- */
async function renameLayer(name){
  if(!sel?.info.canRename)return;const info=sel.info;busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/op',{type:'renameElement',id:info.id,fileHash:info.hash,name,context:info.context});
    if(!result?.ok)return toast(result?.reason||result?.error||'Could not name layer','err');
    if(result.undoId)editorHistory.record({type:info.kind==='instance'?'renameComponent':'renameElement',id:info.id,context:info.context,undoId:result.undoId});
    if(info.kind==='instance'){await refreshSwappedComponent(info.id,null);await selectInsertedComponent(info.id,null);layers.refresh();}
    else{sel.info=result.element;if(sel.info.renderRevisionAttribute)await refreshWrittenElement(sel.info,el=>(el.getAttribute('data-rt-layer-name')||'')===sel.info.layerName);else await reloadFrame();layers.refresh();renderPanel();}toast('Layer named','ok');
  }finally{busyPanel(false);}
}
async function setSelectionColorOverride(property,value,backgroundChanges,valuesById){
 const selection=sel?.multiple,info=sel?.info;if(!selection?.length)return;const ids=selection.map(item=>item.id);busyPanel(true);
 try{
  const result=await api('POST','/rt/__api/op',{type:backgroundChanges?'setBackgroundPaintSelection':'setColorOverrideSelection',id:info.id,ids,fileHash:info.hash,...selectionSourceContexts(selection),scope:styleScope,...(backgroundChanges?{changesById:backgroundChanges}:{property,...(valuesById?{valuesById}:{value}),...(value===null?{}:selectionBackgroundStates(selection,property))})});
  if(!result?.ok)throw Error(result?.reason||result?.error||'Could not update selected paint.');
  if(result.undoId)editorHistory.record({type:info.contextSelection?'collectionSelection':'setClassesSelection',id:info.id,selectionIds:ids,undoId:result.undoId});
  sel.info=result.element;sel.multiple=result.selection;if(info.contextSelection){await reloadFrame();await restoreLayerSelection(ids);}else await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument),{classSource:true});renderPanel();
 }finally{busyPanel(false);}
}
function selectionSourceContexts(selection){
 if(!selection[0]?.contextSelection)return {};
 const contexts=Object.fromEntries(selection.map(item=>{const element=matchingEls(item.id)[0];if(!element)throw Error('Re-select the missing layer.');return [item.id,renderContext(element)];}));
 return {contexts,context:contexts[sel.info.id]};
}
async function writeVariableSelection(type,width,extra){
 const selection=sel?.multiple,info=sel?.info;if(!selection?.length)return;const ids=selection.map(item=>item.id),react=!!info.classVariables;busyPanel(true);
 try{
  const result=await api('POST','/rt/__api/op',{type:type+'Selection',id:info.id,ids,fileHash:info.hash,width,...selectionSourceContexts(selection),...extra});
  if(!result?.ok)throw Error(result?.reason||result?.error||'Could not update selected variable bindings.');
  if(result.undoId)editorHistory.record({type:info.contextSelection?'collectionSelection':react?'setClassesSelection':'setCSSSelection',id:info.id,selectionIds:ids,undoId:result.undoId});
  sel.info=result.element;sel.multiple=result.selection;if(info.contextSelection){await reloadFrame();await restoreLayerSelection(ids);}else if(react)await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument),{classSource:true});else await reloadFrame();renderPanel();toast('Selected bindings updated','ok');
 }finally{busyPanel(false);}
}
function selectionColorOptions(width){
  const selection=sel.multiple;
  if(!selection.every(info=>info.colorStyles||info.classColorStyles))return {};
  async function write(type,property,styleId,libraryRevision){
    const info=sel.info,ids=selection.map(item=>item.id),react=!!info.classColorStyles;busyPanel(true);
    try{
      const result=await api('POST','/rt/__api/op',{type,id:info.id,ids,fileHash:info.hash,...selectionSourceContexts(selection),width:react?0:width,scope:react?width:undefined,property,styleId,libraryRevision,...(type.startsWith('detach')?{}:selectionBackgroundStates(selection,property))});
      if(!result?.ok)throw Error(result?.reason||result?.error||'Could not update selected colors.');
      if(result.undoId)editorHistory.record({type:info.contextSelection?'collectionSelection':react?'setClassesSelection':'setCSSSelection',id:info.id,selectionIds:ids,undoId:result.undoId});
      sel.info=result.element;sel.multiple=result.selection;if(info.contextSelection){await reloadFrame();await restoreLayerSelection(ids);}else if(react)await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument),{classSource:true});else await reloadFrame();renderPanel();toast('Selected colors updated','ok');
    }finally{busyPanel(false);}
  }
  const inheritedForSelection=(info,property)=>info.classColorStyles?RetouchResponsive.inheritedLink(Object.fromEntries(Object.entries(info.colorStyleLinks||{}).filter(([,group])=>group[property]).map(([key,group])=>[key,group[property]])),width,matchingEls(info.id)[0]?.ownerDocument):RetouchColorStyles.inheritedLink(info.colorStyleLinks,width,property);
  return {width,selection,inheritedForSelection,apply:(id,revision,property)=>write('applyColorStyleSelection',property,id,revision),resetSelection:(revision,property)=>write('resetColorStyleSelection',property,undefined,revision),detachSelection:property=>write('detachColorStyleSelection',property)};
}
function mountSelectionEffectStyles(){
  const selection=sel.multiple,element=matchingEls(sel.info.id)[0];
  if(!element||!selection.every(info=>info.cssAuthoring||info.classEffectStyles))return;
  const scope=sel.info.classEffectStyles?styleScope:String(styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0);
  const links=selection.map(info=>info.effectStyleLinks?.[scope]).filter(Boolean),overrides=selection.reduce((sum,info)=>sum+(info.effectStyleOverrides?.[scope]?.length||0),0);
  async function write(type,styleId,libraryRevision){
    const info=sel.info,ids=selection.map(item=>item.id),react=!!info.classEffectStyles;busyPanel(true);
    try{
      const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0;
      const result=await api('POST','/rt/__api/op',{type,id:info.id,ids,fileHash:info.hash,...selectionSourceContexts(selection),scope:styleScope,width,styleId,libraryRevision});
      if(!result?.ok)throw Error(result?.reason||result?.error||'Could not update effect styles in this selection.');
      if(result.undoId)editorHistory.record({type:info.contextSelection?'collectionSelection':react?'setClassesSelection':'setCSSSelection',id:info.id,selectionIds:ids,undoId:result.undoId});
      sel.info=result.element;sel.multiple=result.selection;
      if(info.contextSelection){await reloadFrame();await restoreLayerSelection(ids);}else if(react)await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument),{classSource:true});else await reloadFrame();
      renderPanel();toast('Selected effect styles updated','ok');
    }finally{busyPanel(false);}
  }
  RetouchEffectStyles.mount(panelBody,element,{selection:selection.length,selectionLinks:{linked:links.length,styles:new Set(links.map(link=>link.id)).size,overrides},apply:(id,revision)=>write('applyEffectStyleSelection',id,revision),resetSelection:revision=>write('resetEffectStyleSelection',undefined,revision),detachSelection:()=>write('detachEffectStyleSelection')});
}
function mountSelectionTextStyles(){
  const selection=sel.multiple,element=matchingEls(sel.info.id)[0];
  if(!element||!selection.every(info=>info.classTextStyles||info.cssAuthoring))return;
  const scope=sel.info.classTextStyles?styleScope:String(styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0);
  const links=selection.map(info=>info.textStyleLinks?.[scope]).filter(Boolean),overrides=selection.reduce((sum,info)=>sum+(info.textStyleOverrides?.[scope]?.length||0),0);
  async function write(type,styleId,libraryRevision){
    const info=sel.info,ids=selection.map(item=>item.id),react=!!info.classTextStyles;busyPanel(true);
    try{
      const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0;
      const result=await api('POST','/rt/__api/op',{type,id:info.id,ids,fileHash:info.hash,...selectionSourceContexts(selection),scope:styleScope,width,styleId,libraryRevision});
      if(!result?.ok)throw Error(result?.reason||result?.error||'Could not update text styles in this selection.');
      if(result.undoId)editorHistory.record({type:info.contextSelection?'collectionSelection':react?'setClassesSelection':'setCSSSelection',id:info.id,selectionIds:ids,undoId:result.undoId});
      sel.info=result.element;sel.multiple=result.selection;
      if(info.contextSelection){await reloadFrame();await restoreLayerSelection(ids);}else if(react)await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument),{classSource:true});else await reloadFrame();
      renderPanel();toast('Selected text styles updated','ok');
    }finally{busyPanel(false);}
  }
  RetouchTextStyles.mount(panelBody,element,{selection:selection.length,selectionLinks:{linked:links.length,styles:new Set(links.map(link=>link.id)).size,overrides},apply:(id,revision)=>write('applyTextStyleSelection',id,revision),resetSelection:revision=>write('resetTextStyleSelection',undefined,revision),detachSelection:()=>write('detachTextStyleSelection')});
}
async function setHTMLCSSSelection(property,value,width,changesById,resetScope=false){
  if(!sel?.multiple?.length)return;const selection=sel.multiple,info=sel.info;let saved=false;busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/op',{type:'setCSSSelection',id:info.id,ids:selection.map(item=>item.id),fileHash:info.hash,...(resetScope?{resetScope:true}:changesById?{changesById}:{property,value}),width});
    if(!result?.ok){renderPanel();return toast(result?.reason||result?.error||'Could not style selected layers','err');}
    saved=true;if(result.undoId)editorHistory.record({type:'setCSSSelection',managedCSS:true,id:info.id,selectionIds:selection.map(item=>item.id),undoId:result.undoId});
    sel.info=result.element;sel.multiple=result.selection;await RetouchRenderSync.syncCSS({frame:iframe,entries:result.selection.map(item=>({id:item.id,rules:item.cssRules,texts:item.cssRuleTexts}))});await window.RetouchComparisons?.syncCSS(result.selection);renderPanel();toast('Selected layers updated','ok');
  }catch(error){toast((saved?'Styles saved; preview refresh failed: ':'Could not style selected layers: ')+error.message,'err');renderPanel();}finally{busyPanel(false);}
}
function classSelectionMatches(infos,document){
  const tokens=value=>(value||'').split(/\s+/).filter(Boolean).sort().join(' ');
  return infos.every(info=>{const elements=matchingInDocument(document,info.id,info);return elements.length&&elements.every(el=>el.getAttribute(info.renderRevisionAttribute)===info.hash&&tokens(el.getAttribute('class'))===tokens(info.className));});
}
async function setReactClassesSelection(classesById,expected=null){
  if(!sel?.multiple?.length||panelTasks||undoBusy||sourceRequests)return;stopDrawing?.();const selection=sel.multiple,info=sel.info;let saved=false;busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/op',{type:'setClassesSelection',id:info.id,ids:selection.map(item=>item.id),fileHash:info.hash,...selectionSourceContexts(selection),classesById});
    if(!result?.ok){renderPanel();return toast(result?.reason||result?.error||'Could not style selected layers','err');}
    saved=true;const literalLiquid=info.contextSelection&&selection.every(item=>item.classSourceLiteral)&&result.selection.every(item=>item.classSourceLiteral),before=Object.fromEntries(selection.map(item=>[item.id,item.className])),after=Object.fromEntries(result.selection.map(item=>[item.id,item.className]));
    if(result.undoId)editorHistory.record({type:literalLiquid?'setLiquidClassesSelection':info.contextSelection?'collectionSelection':'setClassesSelection',id:info.id,selectionIds:selection.map(item=>item.id),...(literalLiquid?{classesBefore:before,classesAfter:after}:{}),undoId:result.undoId});
    sel.info=result.element;sel.multiple=result.selection;if(literalLiquid){await refreshLiteralLiquidClasses(result.selection,before);}else if(info.contextSelection){await reloadFrame();await restoreLayerSelection(selection.map(item=>item.id));}else await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument),{classSource:true});
    if(expected){let ready=false;for(let attempt=0;attempt<50;attempt++){ready=Object.entries(expected).every(([id,g])=>{const el=matchingEls(id)[0];if(!el?.isConnected)return false;try{const actual=RetouchInspector.geometry(el,{allowRotation:Object.hasOwn(g,'rotation'),allowScale:Object.hasOwn(g,'scaleX')});return ['x','y','width','height'].every(key=>Math.abs(actual[key]-g[key])<.6);}catch{return false;}});if(ready)break;await new Promise(resolve=>setTimeout(resolve,100));}if(!ready){renderPanel();toast('Saved selection classes, but the bounds did not settle. Check responsive or inline overrides.','err');return false;}}
    renderPanel();toast('Selected layers updated','ok');return true;
  }catch(error){renderPanel();toast((saved?'Classes saved; preview refresh failed: ':'Could not save classes: ')+error.message,'err',saved?'class-preview':undefined);return false;}finally{busyPanel(false);}
}
async function refreshLiteralLiquidClasses(infos,before){
 const entries=infos.map(info=>({id:info.id,before:before[info.id],classes:info.className}));
 // Each document must observe the transition even if another preview fails.
 const results=await Promise.allSettled([
  RetouchRenderSync.syncClasses({frame:iframe,entries,revalidate:!!window.__RT_RENDERING?.revalidateStyles}),
  window.RetouchComparisons?.syncClasses(entries),
 ]);
 const failed=results.find(result=>result.status==='rejected');
 if(failed){offerClassPreviewRetry(infos,before);throw failed.reason;}
 const retry=document.getElementById('retryClassPreview'),pending=retry?.retouchRetry;
 retry?.remove();
 if(pending?.preview===iframe.contentDocument){const completed=new Set(infos.map(info=>info.id)),remaining=pending.infos.filter(info=>!completed.has(info.id));if(remaining.length)offerClassPreviewRetry(remaining,pending.before);}
 if(!document.getElementById('retryClassPreview'))document.querySelectorAll('#toasts .toast[data-kind="class-preview"]').forEach(el=>el.remove());
}
function offerClassPreviewRetry(infos,before){
 const previous=document.getElementById('retryClassPreview'),pending=previous?.retouchRetry;previous?.remove();
 const preview=iframe.contentDocument,href=iframe.contentWindow.location.href;
 if(pending?.preview===preview&&pending.href===href){infos=[...new Map([...pending.infos,...infos].map(info=>[info.id,info])).values()];before={...before,...pending.before};}
 const retry=document.createElement('button');retry.id='retryClassPreview';retry.textContent='Retry preview refresh';
 retry.title='Load the saved classes again without changing source or undo history.';
 retry.retouchRetry={preview,href,infos,before};
 statusEl.after(retry);
 retry.onclick=async()=>{
  if(panelTasks||sourceRequests||undoBusy)return;
  if(iframe.contentDocument!==preview||iframe.contentWindow.location.href!==href){retry.remove();return;}
  busyPanel(true);retry.disabled=true;
  try{
   const resolved=await Promise.all(infos.map(info=>api('GET',resolveUrl(info.id,info.context))));
   if(!resolved.every(result=>result?.ok&&result.element.classSourceLiteral))throw Error('The literal class layers no longer resolve.');
   await refreshLiteralLiquidClasses(resolved.map(result=>result.element),before);
   renderPanel();toast('Preview refreshed','ok');
  }catch(error){toast('Preview refresh failed: '+error.message,'err','class-preview');}
  finally{retry.disabled=false;busyPanel(false);}
 };
}
iframe.addEventListener('load',()=>document.getElementById('retryClassPreview')?.remove());
function svgGeometryMatches(el,info){return info.svgGeometry?.fields.every(field=>field.editable===false||el.getAttribute(field.name)===field.value);}
async function convertSVGToPath(info,toArrow=false,arrowPoints){
  const conversion=toArrow?info.svgConversion?.arrow:info.svgConversion;if(!conversion)return toast('This arrow cannot be converted with its current source settings.','err');const editedArrow=arrowPoints!==undefined;if(editedArrow&&(toArrow||info.tag!=='polyline'||!RetouchSVGParametric.arrowPath(arrowPoints)))return;const targetTag='path',desiredPath=editedArrow?RetouchSVGParametric.arrowPath(arrowPoints):toArrow?RetouchSVGParametric.arrowPath(conversion.points):conversion.path,operation=toArrow?'convertSVGToArrow':'convertSVGToPath';
  if(panelTasks||undoBusy||sourceRequests||editing||sel?.info!==info)return;
  const targets=matchingEls(info.id);if(targets.length!==1)return toast('Select a shape rendered once to convert it.','err');
  const target=targets[0],w=target.ownerDocument.defaultView,probe=target.ownerDocument.createElementNS('http://www.w3.org/2000/svg',targetTag);
  for(const attr of target.attributes)if(!conversion.properties.includes(attr.name)&&!/^on/i.test(attr.name))probe.setAttribute(attr.name,attr.value);
  for(const child of target.children)if(['title','desc'].includes(child.tagName.toLowerCase())){const copy=child.cloneNode(false);for(const attr of [...copy.attributes])if(/^on/i.test(attr.name))copy.removeAttribute(attr.name);copy.textContent=child.textContent;probe.append(copy);}
  if(toArrow){probe.setAttribute('d',desiredPath);probe.setAttribute('fill','none');probe.setAttribute('data-rt-shape','arrow');}else probe.setAttribute('d',desiredPath);probe.style.setProperty('visibility','hidden','important');
  try{
    const before=w.getComputedStyle(target),paint=['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','opacity','transform','vector-effect','filter','clip-path','mask','marker-start','marker-mid','marker-end'],expected=Object.fromEntries(paint.map(p=>[p,before.getPropertyValue(p)]));
    if(info.svgGeometry?.parametric?.kind==='arrow'&&before.fill!=='none')return toast('Remove the arrow fill before separating its strokes.','err');
    if(target.querySelector('animate,set,animateTransform')||target.ownerSVGElement?.querySelector('animate,set,animateTransform'))return toast('Remove SVG animations before converting the shape.','err');
    const radii=Object.fromEntries(info.svgGeometry.fields.map(f=>[f.name,f.value==null?null:parseFloat(f.value)]));if(target.tagName.toLowerCase()==='rect')for(const axis of ['rx','ry']){const value=before.getPropertyValue(axis).trim();if(value&&value!=='auto'&&Math.abs(parseFloat(value)-(radii[axis]??radii[axis==='rx'?'ry':'rx']??0))>1e-6)return toast('This shape has CSS corner geometry. Edit those styles before converting.','err');}
    target.after(probe);const actual=w.getComputedStyle(probe),a=target.getBBox(),b=probe.getBBox(),cssPath=actual.getPropertyValue('d').match(/^path\(["']([\s\S]*)["']\)$/);if(cssPath){const computed=actual.getPropertyValue('d'),prior=probe.style.getPropertyValue('d'),priority=probe.style.getPropertyPriority('d');let expected;try{probe.style.setProperty('d','path('+JSON.stringify(desiredPath)+')','important');expected=w.getComputedStyle(probe).getPropertyValue('d');}finally{if(prior)probe.style.setProperty('d',prior,priority);else probe.style.removeProperty('d');}if(computed!==expected){const expectedPath=expected.match(/^path\(["']([\s\S]*)["']\)$/);if(!expectedPath||!RetouchSVGPath.equivalentCompound(RetouchSVGPath.parseCompound(cssPath[1]),RetouchSVGPath.parseCompound(expectedPath[1])))return toast('This shape has a CSS path override. Edit that style before converting.','err');}}if((toArrow||target.tagName.toLowerCase()!=='line')&&['marker-start','marker-mid','marker-end'].some(p=>expected[p]&&expected[p]!=='none'))return toast('Remove SVG markers before converting this shape.','err');if(toArrow&&actual.fill!=='none'||paint.some(p=>(!toArrow||p!=='fill')&&actual.getPropertyValue(p)!==expected[p])||!toArrow&&!editedArrow&&['x','y','width','height'].some(p=>Math.abs(a[p]-b[p])>1e-5))return toast('CSS changes the appearance of this shape when converted. Conversion is unavailable for these styles.','err');
  }finally{probe.remove();}
  busyPanel(true);
  try{const result=await api('POST','/rt/__api/op',{type:operation,id:info.id,fileHash:info.hash,...(editedArrow?{arrowPoints}:{})});if(!result?.ok)return toast(result?.reason||result?.error||'Could not convert shape','err');if(result.undoId)editorHistory.record({type:operation,id:info.id,selectionBefore:[info.id],selectionAfter:[info.id],undoId:result.undoId});renderedSelection=null;sel.info=result.element;await refreshWrittenElement(sel.info,el=>el.tagName.toLowerCase()===targetTag&&svgGeometryMatches(el,sel.info));await restoreLayerSelection([info.id]);renderPanel();toast(editedArrow?'Arrow updated':toArrow?'Converted to an editable arrow':'Converted to an editable vector path','ok');}finally{busyPanel(false);}
}
function groupMovementRoots(allowLayers=false){
 if(!sel?.info)return null;const roots=(sel.multiple||[sel.info]).map(info=>{const matches=matchingEls(info.id);return matches.length===1?matches[0]:null;});
 return roots.every(Boolean)&&(allowLayers||roots.some(el=>el.hasAttribute('data-rt-group'))||roots.some(el=>el?.ownerDocument[Symbol.for('retouch.group-scale.runtime')]?.manages?.(el)))?roots:null;
}
function groupNudgeShortcut(e){
 if(e.defaultPrevented||e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||mode!=='edit'||editing||stopDrawing||panelTasks||sourceRequests||undoBusy||canvasPan.active||!sel?.info||document.querySelector('dialog[open]'))return false;
 if(e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')||e.target.ownerDocument===document&&e.target.closest?.('button,summary,[role="treeitem"],[role="slider"],[role="tab"],[role="menuitem"]'))return false;
 const info=sel.info,roots=groupMovementRoots();if(!roots||roots.some(el=>layerLocks.locked(el)))return false;
 const selection=sel,hash=info.hash,scope=styleScope,d=doc(),current=()=>mode==='edit'&&sel===selection&&sel.info.hash===hash&&styleScope===scope&&doc()===d&&roots.every(el=>el.isConnected&&!layerLocks.locked(el))&&!editing&&!panelTasks&&!sourceRequests&&!undoBusy;
 e.preventDefault();e.stopImmediatePropagation();
 stopDrawing=RetouchGroupNudge.mount({document:d,initialKey:e,current,prepare:()=>moveGroupOnCanvas(info,null,{prepareOnly:true,valid:current}),onCommit:writeGroupMove,onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});return true;
}
function vectorNudgeShortcut(e){
  if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||mode!=='edit'||editing||stopDrawing||panelTasks||sourceRequests||undoBusy||canvasPan.active||!sel?.info.svgTransform?.editable||document.querySelector('dialog[open]'))return false;
  if(e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')||e.target.ownerDocument===document&&e.target.closest?.('button,summary,[role="treeitem"],[role="slider"],[role="tab"],[role="menuitem"]'))return false;
  if(sel?.multiple?.length>1){
   const infos=sel.multiple,elements=infos.map(info=>{const found=matchingEls(info.id);return found.length===1?found[0]:null;});
   if(infos.some(info=>!info.svgTransform?.editable)||elements.some(el=>!el||layerLocks.locked(el)))return false;
   e.preventDefault();e.stopImmediatePropagation();moveSVGSelection({initialKey:e});return true;
  }
  const targets=matchingEls(sel.info.id),target=targets.length===1?targets[0]:null;if(!target||layerLocks.locked(target)||RetouchSVGResize.reason(target,sel.info))return false;
  e.preventDefault();e.stopImmediatePropagation();void resizeSVGOnCanvas(sel.info,target,null,'se','move',{initialKey:e});return true;
}
function moveSVGSelection(gesture){
 const infos=sel?.multiple;if(!infos?.length)return;const elements=infos.map(info=>{const found=matchingEls(info.id);return found.length===1?found[0]:null;});
 if(elements.some(el=>!el||layerLocks.locked(el)))return;
 const current=()=>mode==='edit'&&sel?.multiple===infos&&!editing&&!panelTasks&&!sourceRequests&&!undoBusy&&!document.querySelector('dialog[open]')&&elements.every(el=>!layerLocks.locked(el));
 stopDrawing=RetouchSVGSelection.nudge(infos,elements,{...gesture,current,frame:iframe,canvas:canvasSurface,onCommit:matrices=>{if(current())void writeSVGSelection(matrices);},onError:message=>toast(message,'err'),onEnd:()=>{stopDrawing=null;if(panelRenderDeferred)queueViewportPanelRefresh();}});
}
async function resizeSVGOnCanvas(info,target=null,initialPointer=null,handle='se',action='resize',gesture={}){
  if(panelTasks||undoBusy||sourceRequests||editing||!info?.svgTransform?.editable)return;stopDrawing?.();
  const targets=matchingEls(info.id);if(targets.length!==1)return toast('Select a vector rendered once to transform it.','err');target=target||targets[0];
  if(target!==targets[0]||target.getAttribute('transform')!==info.svgTransform.value)return toast('The vector changed. Re-select it before transforming.','err');
  if(!initialPointer&&!gesture.initialKey&&!await prepareVectorCanvas(info,target))return;
  const key=JSON.stringify([info.id,info.hash,styleScope]),current=()=>mode==='edit'&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests&&!(sel?.multiple?.length>1)&&!panelBody.inert&&!document.querySelector('dialog[open]')&&key===JSON.stringify([sel?.info.id,sel?.info.hash,styleScope]);if(!current())return;canvasPan.cancel();
  stopDrawing=RetouchSVGResize.mount({target,info,frame:iframe,canvas:canvasSurface,current,initialPointer,handle,action,...gesture,onEnd:()=>{stopDrawing=null;if(panelRenderDeferred)queueViewportPanelRefresh();},onError:message=>toast(message,'err'),onCommit:async matrix=>{
   if(current())await writeSVGTransform(info,target,matrix);
  }});
}
async function refreshSVGBooleanSelection(parentId,ids){
 const parent=await api('GET',resolveUrl(parentId));
 if(!parent?.ok)throw Error('The combined shape parent no longer resolves.');
 const matches=el=>ids.every(id=>matchingInDocument(el.ownerDocument,id,null).length===1);
 if(/\.(?:html?|liquid)$/i.test(parent.element.file))await RetouchRenderSync.sync({frame:iframe,serverRendered:true,select:d=>matchingInDocument(d,parentId,parent.element),matches});
 else await refreshWrittenElement(parent.element,matches);
 await restoreLayerSelection(ids);if(sel)renderPanel();await layers.refresh();
}
async function writeSVGMask(type,extra){
 const infos=sel?.multiple||[sel?.info];if(!infos[0]||panelTasks||sourceRequests||undoBusy||editing)return;const primary=sel.info,ids=infos.map(i=>i.id);busyPanel(true);
 try{const result=await api('POST','/rt/__api/op',{type,id:primary.id,fileHash:primary.hash,...extra});if(!result?.ok)throw Error(result?.reason||result?.error||'Could not update the mask.');if(result.unchanged)return;
 const deletedLocks=layerLocks.removeSourceIds(result.removedSourceIds||[]);editorHistory.record({type:'replaceSVGSelection',id:result.parentId,selectionBefore:ids,selectionAfter:result.selectionIds,sourceIdMap:result.sourceIdMap,deletedLocks,removedSourceIds:result.removedSourceIds,undoId:result.undoId});layerLocks.remap(result.sourceIdMap);await refreshSVGBooleanSelection(result.parentId,result.selectionIds);toast(type==='createSVGMask'?'Mask created':type==='setSVGMaskType'?'Mask type updated':type==='setSVGMaskBounds'?'Mask bounds updated':'Mask released','ok');
 }catch(error){toast(error.message,'err');}finally{busyPanel(false);}
}
let booleanOperandCanvasSerial=0;
async function editBooleanOperandOnCanvas(info,operand,infos,action){
 if(panelTasks||sourceRequests||undoBusy||editing||sel?.info.id!==info.id)return;
 const entry=++booleanOperandCanvasSerial;stopDrawing?.();const groups=matchingEls(info.id);if(groups.length!==1||layerLocks.locked(groups[0]))return;
 const group=groups[0],container=group.querySelector(':scope > [data-rt-boolean-operands]'),result=group.querySelector(':scope > [data-rt-boolean-result]'),target=container?.querySelector('[data-rt="'+operand.id+'"]');
 if(!target||!result||layerLocks.locked(target))return;
 let preview;const restore=()=>preview?.restore();
 const current=()=>entry===booleanOperandCanvasSerial&&preview?.valid?.()!==false&&mode==='edit'&&sel?.info.id===info.id&&sel.info.hash===info.hash&&!sel.multiple?.length&&!editing&&!panelTasks&&!sourceRequests&&!undoBusy&&group.isConnected&&!layerLocks.locked(target)&&!layerLocks.locked(group);
 try{const prepared=info.svgBooleanGroup.ancestorId?await RetouchSVGBooleanGroup.prepareCascade(info,group,async ids=>{const responses=await Promise.all(ids.map(id=>api('GET',resolveUrl(id))));if(responses.some(result=>!result.ok||result.element.hash!==info.hash))throw Error('The boolean source changed. Re-select the group.');return responses.map(result=>result.element);}):null;if(!current())return;preview=prepared?RetouchSVGBooleanGroup.nestedPreview(info,group,infos,operand,prepared):RetouchSVGBooleanGroup.preview(group,infos,operand,info.svgBooleanGroup.operation);}catch(error){restore();if(current())toast(error.message,'err');return;}
 canvasPan.cancel();
 const cleanup=RetouchSVGResize.mount({target,info:{...operand,booleanOperandPreview:true},frame:iframe,canvas:canvasSurface,current,action,outline:true,onPreview:matrix=>preview.update(matrix),handle:action==='rotate'?'ne':'se',onError:message=>toast(message,'err'),onEnd:()=>{restore();stopDrawing=null;if(panelRenderDeferred)queueViewportPanelRefresh();},onCommit:matrix=>{
  if(!current())return;const edit={operandId:operand.id,operandOp:{type:'setSVGTransform',matrix}};
  try{const path=RetouchSVGBooleanGroup.compute(group,infos,info.svgBooleanGroup.operation,edit);void writeSVGBooleanGroup('setSVGBooleanOperand',{...edit,path});}catch(error){toast(error.message,'err');}
 }});
 if(cleanup)stopDrawing=cleanup;else restore();
}
async function writeSVGBooleanGroup(type,extra,groupInfo=null){
 const primary=groupInfo||sel?.info;if(!primary||panelTasks||sourceRequests||undoBusy||editing)return;const ids=(sel.multiple||[sel.info]).map(i=>i.id);busyPanel(true);
 const checkLocks=()=>{const affected=type==='createSVGBooleanGroup'?extra.ids:['setSVGBooleanOperand','removeSVGBooleanOperand'].includes(type)?(extra.operandIds||[extra.operandId]):ids;for(const id of new Set([primary.id,...(affected||[])])){const matches=matchingEls(id);if(matches.length!==1)throw Error('Re-select the boolean shapes rendered once on this page.');if(layerLocks.locked(matches[0]))throw Error('Unlock the selected original or its containing layer before editing it.');}};
 try{checkLocks();let request={type,id:primary.id,fileHash:primary.hash,...extra};if(type==='removeSVGBooleanSelection'){const selection=sel.multiple||[primary];request.results=await RetouchSVGBooleanGroup.selectionRemoval(selection,selection.map(info=>matchingEls(info.id)[0]),async ids=>{const responses=await Promise.all(ids.map(id=>api('GET',resolveUrl(id))));if(responses.some(result=>!result.ok||result.element.hash!==primary.hash))throw Error('The boolean source changed. Re-select the originals.');return responses.map(result=>result.element);});if(sel?.multiple!==selection)throw Error('The selection changed. Re-select the originals.');}else if(primary.svgBooleanGroup&&(primary.svgBooleanGroup.ancestorId||['createSVGBooleanGroup','removeSVGBooleanOperand'].includes(type))){const group=matchingEls(primary.id)[0],prepared=await RetouchSVGBooleanGroup.prepareCascade(primary,group,async ids=>{const responses=await Promise.all(ids.map(id=>api('GET',resolveUrl(id))));if(responses.some(result=>!result.ok||result.element.hash!==primary.hash))throw Error('The boolean source changed. Re-select the group.');return responses.map(result=>result.element);});const derived=prepared.run(type,extra);request={type:'setSVGBooleanNested',id:primary.id,fileHash:primary.hash,targetId:primary.id,edit:{type,...extra,...(['createSVGBooleanGroup','removeSVGBooleanOperand'].includes(type)?{path:derived.path}:{})},results:derived.results};if(type==='removeSVGBooleanOperand'&&!primary.svgBooleanGroup.ancestorId)request={type,id:primary.id,fileHash:primary.hash,...extra,path:derived.path};}checkLocks();const result=await api('POST','/rt/__api/op',request);if(!result?.ok)throw Error(result?.reason||result?.error||'Could not update the boolean group.');if(result.unchanged)return true;
 const selectionAfter=type==='setSVGBooleanOperand'?[primary.id]:result.selectionIds,removed=result.removedSourceIds||[],deletedLocks=layerLocks.removeSourceIds(removed);editorHistory.record({type:'replaceSVGSelection',id:result.parentId,selectionBefore:ids,selectionAfter,sourceIdMap:result.sourceIdMap,deletedLocks,removedSourceIds:removed,undoId:result.undoId});layerLocks.remap(result.sourceIdMap);await refreshSVGBooleanSelection(result.parentId,selectionAfter);toast(type==='releaseSVGBooleanGroup'?'Original shapes restored':type==='removeSVGBooleanSelection'?'Original shapes removed':type==='removeSVGBooleanOperand'?'Original shape removed':'Boolean group updated','ok','boolean-edit');return true;
 }catch(error){toast(error.message,'err','boolean-edit');return false;}finally{busyPanel(false);}
}
async function writeSVGBooleanSelection(path){
 const infos=sel?.multiple;if(!infos||panelTasks||sourceRequests||undoBusy||editing)return;const ids=infos.map(info=>info.id),primary=sel.info;busyPanel(true);
 try{const result=await api('POST','/rt/__api/op',{type:'replaceSVGSelection',id:primary.id,ids,fileHash:primary.hash,path});if(!result?.ok)throw Error(result?.reason||result?.error||'Could not combine these shapes.');
 const deletedLocks=layerLocks.removeSourceIds(result.removedSourceIds);
 editorHistory.record({type:'replaceSVGSelection',id:result.parentId,selectionBefore:ids,selectionAfter:result.selectionIds,sourceIdMap:result.sourceIdMap,deletedLocks,removedSourceIds:result.removedSourceIds,undoId:result.undoId});layerLocks.remap(result.sourceIdMap);
 await refreshSVGBooleanSelection(result.parentId,result.selectionIds);toast('Shapes combined','ok');
 }catch(error){toast(error.message,'err');}finally{busyPanel(false);}
}
async function writeSVGSelection(matrices){
 const infos=sel?.multiple;if(!infos||panelTasks||sourceRequests||undoBusy||editing)return;const ids=infos.map(info=>info.id),primary=sel.info;busyPanel(true);
 try{const result=await api('POST','/rt/__api/op',{type:'setSVGTransforms',id:primary.id,ids,fileHash:primary.hash,matrices});if(!result?.ok)throw Error(result?.reason||result?.error||'Could not transform the selected vectors.');if(result.undoId)editorHistory.record({type:'setSVGTransforms',id:primary.id,selectionIds:ids,undoId:result.undoId});await refreshWrittenElement(result.element,el=>svgSelectionMatches(result.selection,el.ownerDocument),{svgGeometry:true});await restoreLayerSelection(ids);if(sel)renderPanel();toast('Vectors updated','ok');}catch(error){toast(error.message,'err');}finally{busyPanel(false);}
}
function svgSelectionMatches(infos,d){return infos.every(info=>matchingInDocument(d,info.id,info).some(el=>el.getAttribute('transform')===info.svgTransform?.value));}
async function writeSVGTransform(info,target,matrix){
  if(sel?.info!==info||panelTasks||undoBusy||sourceRequests||editing)return;
  const reason=RetouchSVGResize.reason(target,info,true);if(reason)return toast(reason,'err');busyPanel(true);
   try{const result=await api('POST','/rt/__api/op',{type:'setSVGTransform',id:info.id,fileHash:info.hash,matrix});if(!result?.ok)return toast(result?.reason||result?.error||'Could not update vector','err');if(result.undoId)editorHistory.record({type:'setSVGTransform',id:info.id,undoId:result.undoId});sel.info=result.element;await refreshWrittenElement(sel.info,el=>el.getAttribute('transform')===sel.info.svgTransform?.value,{svgGeometry:true});renderPanel();toast('Vector updated','ok');}finally{busyPanel(false);}
}
function svgGradientsMatch(el,info){return (info.svgGradientCreation?.values||[]).every(item=>el.getAttribute(item.paint)===item.value)&&(info.svgGradients||[]).every(gradient=>{const node=el.ownerDocument.getElementById(gradient.id),reference=/^url\(\s*(['"]?)#([\w:.-]+)\1\s*\)$/.exec(el.getAttribute(gradient.paint)||'');if(!node||node.localName!==gradient.type||reference?.[2]!==gradient.id)return false;const stops=[...node.children].filter(child=>child.localName==='stop');return gradient.fields.every(field=>node.getAttribute(field.name)===field.value)&&stops.length===gradient.stops.length&&gradient.stops.every((stop,i)=>stops[i].getAttribute('offset')===stop.offset&&stops[i].getAttribute('stop-color')===stop.color&&stops[i].getAttribute('stop-opacity')===stop.opacity);});}
function svgGradientStopValues(nodes){
 let previous=0;return nodes.map((node,index)=>{const css=node.ownerDocument.defaultView.getComputedStyle(node),offset=previous=Math.max(previous,Math.max(0,Math.min(1,node.offset.baseVal)));return {index,offset,color:css.stopColor,opacity:Math.max(0,Math.min(1,parseFloat(css.stopOpacity)/(css.stopOpacity.endsWith('%')?100:1)))};});
}
function svgGradientStopInsertion(stops,offset){
  const right=stops.findIndex(stop=>stop.offset>offset),index=right<0?stops.length:right,left=stops[Math.max(0,index-1)],next=stops[Math.min(index,stops.length-1)],ratio=next.offset>left.offset?Math.max(0,Math.min(1,(offset-left.offset)/(next.offset-left.offset))):0;
  let color=left.color;
  try{const a=RetouchPaletteValues.parse(RetouchPaletteValues.convert(RetouchColorStyles.fromComputed(left.color),'srgb',true).value),b=RetouchPaletteValues.parse(RetouchPaletteValues.convert(RetouchColorStyles.fromComputed(next.color),'srgb',true).value);color=RetouchPaletteValues.srgb(a.channels.map((n,i)=>Math.round((n+(b.channels[i]-n)*ratio)*255)/255),a.alpha+(b.alpha-a.alpha)*ratio);}catch{}
  return {index,value:{offset:String(Math.round(offset*1000000)/1000000),color,opacity:String(Math.round((left.opacity+(next.opacity-left.opacity)*ratio)*1000000)/1000000)}};
}
function mountSVGGradientStopRail(section,info,target,gradient){
 const definition=target?.ownerDocument.getElementById(gradient.id),nodes=[...(definition?.children||[])].filter(node=>node.localName==='stop');if(nodes.length!==gradient.stops.length)return;
 const w=target.ownerDocument.defaultView,stops=svgGradientStopValues(nodes);
 const rail=document.createElement('div');rail.className='gradient-stop-rail';rail.setAttribute('aria-label','Gradient stops');
 const strip=RetouchInspector.button('',event=>{const rect=strip.getBoundingClientRect();add(event.detail===0 ? .5 : Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)));});strip.className='gradient-stop-strip';strip.setAttribute('aria-label','Add gradient stop at position');strip.title='Click to add a color stop';strip.style.border='0';strip.style.cursor='crosshair';strip.disabled=stops.length>=64;
 let movingOrder=null;const paintStrip=()=>{strip.style.backgroundImage='linear-gradient(to right,'+(movingOrder?movingOrder.map(index=>stops[index]):stops.slice().sort((a,b)=>a.offset-b.offset||a.index-b.index)).map(stop=>'color-mix(in srgb,'+stop.color+' '+stop.opacity*100+'%,transparent) '+stop.offset*100+'%').join(',')+'),repeating-conic-gradient(#ddd 0% 25%,white 0% 50%)';};paintStrip();rail.append(strip);
 const add=offset=>{
  const insertion=svgGradientStopInsertion(stops,offset);setSVGGradient(info,gradient.paint,undefined,insertion.index,'insertStop',insertion.value);
 };
 const handles=stops.map(stop=>{const handle=RetouchInspector.button('',()=>{if(handle.retouchDragged)return;const field=section.querySelector('[aria-label="Stop '+(stop.index+1)+' color"]');field?.focus();field?.select();});handle.addEventListener('pointerdown',()=>{handle.retouchDragged=false;});handle.className='gradient-stop-handle';handle.style.left=stop.offset*100+'%';handle.style.backgroundColor=stop.color;handle.setAttribute('aria-label','Select gradient stop '+(stop.index+1));handle.title='Drag to move stop · Arrow keys: 1% · Shift: 10% · Option: 0.1% · Escape cancels';rail.append(handle);return handle;});
 section.retouchGradientPaint=()=>{for(const stop of stops){const css=w.getComputedStyle(nodes[stop.index]);stop.color=css.stopColor;stop.opacity=Math.max(0,Math.min(1,parseFloat(css.stopOpacity)/(css.stopOpacity.endsWith('%')?100:1)));handles[stop.index].style.backgroundColor=stop.color;}paintStrip();};
 section.append(rail);const button=RetouchInspector.button('Add gradient stop',()=>{const positions=[0,...stops.map(stop=>stop.offset),1];let best=0;for(let i=1;i<positions.length-1;i++)if(positions[i+1]-positions[i]>positions[best+1]-positions[best])best=i;add((positions[best]+positions[best+1])/2);});button.disabled=stops.length>=64;section.append(button);
 return ()=>{
  for(const stop of stops){const input=section.querySelector('[aria-label="Stop '+(stop.index+1)+' position"]'),handle=handles[stop.index];if(!input)continue;
   RetouchInspector.numericLabelDrag(input,raw=>{if(!/^[-+]?(?:\d+\.?\d*|\.\d+)%?$/.test(raw))return null;const value=parseFloat(raw)*(raw.endsWith('%')?1:100),original=input.value,percent=original.trim().endsWith('%');return {value,min:0,max:100,format:next=>Math.abs(next-value)<.0000005?original:percent?String(Math.round(next*1000000)/1000000)+'%':String(Math.round(next*1000000)/100000000)};});
   input.retouchNumericPreview=()=>{
    const node=nodes[stop.index],original=nodes.map(node=>node.getAttribute('offset')),nextSibling=node.nextSibling,initial=stop.offset,rect=strip.getBoundingClientRect();let last=[...original],lastOrder=[...nodes],expected=definition.outerHTML;
    const current=()=>sel?.info===info&&!panelTasks&&!undoBusy&&!sourceRequests&&target.isConnected&&definition.isConnected&&definition.outerHTML===expected&&strip.isConnected&&Math.abs(strip.getBoundingClientRect().width-rect.width)<.1&&Math.abs(strip.getBoundingClientRect().left-rect.left)<.1;
    return {current,update(value){
     if(!current())throw Error('The gradient changed during this gesture.');handle.retouchDragged=true;stop.offset=value/100;
     for(const item of stops)if(item.index===stop.index||Math.abs(nodes[item.index].offset.baseVal-item.offset)>1e-8){last[item.index]=String(item.offset*100)+'%';nodes[item.index].setAttribute('offset',last[item.index]);}
     movingOrder=RetouchSVGGradientOrder.move(stops.map(item=>({offset:String(item.index===stop.index?initial:item.offset)})),stop.index,String(value/100)).order;const ordered=movingOrder.map(index=>stops[index]),next=ordered[ordered.indexOf(stop)+1];definition.insertBefore(node,next?nodes[next.index]:null);lastOrder=[...definition.children].filter(child=>nodes.includes(child));expected=definition.outerHTML;handle.style.left=value+'%';paintStrip();
    },restore(){
     const order=[...definition.children].filter(child=>nodes.includes(child));if(node.parentNode===definition&&order.length===lastOrder.length&&order.every((child,index)=>child===lastOrder[index]))definition.insertBefore(node,nextSibling?.parentNode===definition?nextSibling:null);
     nodes.forEach((node,index)=>{if(node.getAttribute('offset')===last[index]){if(original[index]===null)node.removeAttribute('offset');else node.setAttribute('offset',original[index]);}});stop.offset=initial;movingOrder=null;handle.style.left=initial*100+'%';paintStrip();
    }};
   };
   const destination=()=>RetouchSVGGradientOrder.move(stops.map(stop=>({offset:String(stop.offset)})),stop.index,input.value.trim()||null)?.index??stop.index;
   input.onchange=()=>{
    if(sel?.info!==info||panelTasks||undoBusy||sourceRequests)return;
    const index=destination(),prefix='Stop '+(stop.index+1)+' ',pendingLabel=pendingPanelFocus?.controlLabel||(pendingPanelFocus?.identity?JSON.parse(pendingPanelFocus.identity)[1]:null);
    const oldLabel=pendingLabel?.startsWith(prefix)?prefix:pendingLabel?.startsWith('Edit '+prefix)?'Edit '+prefix:null;
    if(index!==stop.index&&oldLabel){const label=(oldLabel.startsWith('Edit ')?'Edit ':'')+'Stop '+(index+1)+' '+pendingLabel.slice(oldLabel.length);if(pendingPanelFocus.identity){const identity=JSON.parse(pendingPanelFocus.identity);identity[1]=label;pendingPanelFocus.identity=JSON.stringify(identity);}else pendingPanelFocus.controlLabel=label;pendingPanelFocus.gradientPaint=gradient.paint;pendingPanelFocus.index=0;}
    if(handle.retouchDragged&&!pendingPanelFocus){RetouchPanelFocus.queue(input,'Stop '+(index+1)+' position');if(pendingPanelFocus)pendingPanelFocus.gradientPaint=gradient.paint;}setSVGGradient(info,gradient.paint,undefined,stop.index,'moveStop',input.value.trim()||null);
   };
   input.retouchNumericHandle(handle,{axis:'x',canvas:true,scale:()=>strip.getBoundingClientRect().width/100,initialValue:()=>stop.offset*100+'%',onCommit:()=>{RetouchPanelFocus.queue(handle,'Select gradient stop '+(destination()+1));if(pendingPanelFocus)pendingPanelFocus.gradientPaint=gradient.paint;}});
  }
 };
}
function editSVGGradientOnCanvas(info,target,gradient,focusLabel=null){
 stopDrawing?.();const current=()=>mode==='edit'&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests&&sel?.info===info&&!sel?.multiple?.length&&!document.querySelector('dialog[open]');if(!current())return;canvasPan.cancel();
 const save=async(changes,focus,keepEditing,stop,action,value)=>{
  if(!keepEditing)return setSVGGradient(info,gradient.paint,changes,stop,action,value);
  let cancelled=false;const cancel=()=>{cancelled=true;if(stopDrawing===cancel)stopDrawing=null;},events=['blur','resize','retouch:screen','retouch:viewport','retouch:before-zoom'];const pending=setSVGGradient(info,gradient.paint,changes,stop,action,value,{keepDrawing:cancel});stopDrawing=cancel;events.forEach(name=>window.addEventListener(name,cancel));canvasSurface.addEventListener('scroll',cancel);
  try{const saved=await pending;if(saved!==true||cancelled||stopDrawing!==cancel||sel?.info.id!==info.id)return;const fresh=sel.info,next=fresh.svgGradients?.find(item=>item.paint===gradient.paint&&item.id===gradient.id),element=target.isConnected&&target.ownerDocument===doc()?target:matchingEls(info.id)[0];if(!next||!element)return;stopDrawing=null;editSVGGradientOnCanvas(fresh,element,next,focus);}
  finally{events.forEach(name=>window.removeEventListener(name,cancel));canvasSurface.removeEventListener('scroll',cancel);if(stopDrawing===cancel)stopDrawing=null;}
 };
 const addStop=offset=>{const nodes=[...(target.ownerDocument.getElementById(gradient.id)?.children||[])].filter(node=>node.localName==='stop');if(nodes.length!==gradient.stops.length)return;const insertion=svgGradientStopInsertion(svgGradientStopValues(nodes),offset);return save(undefined,'Gradient color stop '+(insertion.index+1),true,insertion.index,'insertStop',insertion.value);};
 const removeStop=index=>save(undefined,'Gradient color stop '+(Math.min(index,gradient.stops.length-2)+1),true,index,'removeStop');
 const editStopColor=(index,bounds)=>{
  const section=panelBody.querySelector('[data-gradient-paint="'+gradient.paint+'"]'),input=section?.querySelector('[aria-label="Stop '+(index+1)+' color"]');if(!input)return;
  const focus='Gradient color stop '+(index+1);let cancelled=false,dialog;
  const events=['retouch:screen','retouch:viewport','retouch:before-zoom'],cancel=()=>{cancelled=true;dialog?.close();if(stopDrawing===cancel)stopDrawing=null;},cleanup=()=>{events.forEach(name=>window.removeEventListener(name,cancel));canvasSurface.removeEventListener('scroll',cancel);target.ownerDocument.defaultView.removeEventListener('scroll',cancel,true);if(stopDrawing===cancel)stopDrawing=null;};
  dialog=RetouchPaintPicker.open(input,{anchor:{getBoundingClientRect:()=>bounds},onApply:value=>{cleanup();return save({'stop-color':value},focus,true,index);},onClose:({applied})=>{cleanup();if(!applied&&!cancelled&&current()&&target.isConnected&&target.ownerDocument===doc()&&svgGradientsMatch(target,info))editSVGGradientOnCanvas(info,target,gradient,focus);}});
  if(!dialog)return;stopDrawing=cancel;events.forEach(name=>window.addEventListener(name,cancel));canvasSurface.addEventListener('scroll',cancel);target.ownerDocument.defaultView.addEventListener('scroll',cancel,true);
 };

 stopDrawing=RetouchSVGGradientCanvas.mount({target,gradient,frame:iframe,canvas:canvasSurface,current,save,addStop,removeStop,editStopColor,saveStop:(stop,value,focus,keepEditing)=>save(undefined,focus,keepEditing,stop,'moveStop',value),focusLabel,onEnd:()=>{stopDrawing=null;if(panelRenderDeferred)queueViewportPanelRefresh();},onError:message=>toast(message,'err')});
}
function configureSVGInlinePaint(info,target){
 const creation=info.svgGradientCreation;if(!creation||creation.reason||!target)return;
 for(const paint of creation.paints){
  if(!styleScope&&creation.inlinePaints?.includes(paint)&&!creation.paintReasons?.[paint]&&!RetouchSVGPaint.attributeReason(target,paint,true)){
   const input=panelBody.querySelector('[aria-label="SVG '+paint+'"]');
   if(input){input.disabled=false;input.title='Edit this inline paint';input.onchange=()=>{const color=input.value.trim();if(color!=='none'&&!CSS.supports('color',color)){input.setCustomValidity('Enter a color or none.');input.reportValidity();return;}const blocked=RetouchSVGPaint.attributeReason(target,paint,true);if(blocked)return toast(blocked,'err');setSVGGradient(info,paint,undefined,undefined,'create',{type:'solid',color});};}
  }
 }
}
function mountSVGGradientCreation(info,target){
 const creation=info.svgGradientCreation;if(!creation.paints.length||!target)return;
 const section=RetouchInspector.section('Create gradient');
 if(creation.reason){RetouchInspector.note(section,creation.reason,'refused');panelBody.append(section);return;}
 for(const paint of creation.paints){
  const reason=creation.paintReasons?.[paint]||RetouchSVGPaint.attributeReason(target,paint,creation.inlinePaints?.includes(paint));const select=RetouchInspector.select(section,paint==='fill'?'Fill type':'Stroke type',[['solid','Solid'],['linearGradient','Linear'],['radialGradient','Radial']],'solid',type=>{
  if(type==='solid')return;const blocked=creation.paintReasons?.[paint]||RetouchSVGPaint.attributeReason(target,paint,creation.inlinePaints?.includes(paint));if(blocked){select.value='solid';toast(blocked,'err');return;}const color=target.ownerDocument.defaultView.getComputedStyle(target).getPropertyValue(paint).trim();
  setSVGGradient(info,paint,undefined,undefined,'create',{type,color:color==='none'?'#000000':color});
 });select.disabled=!!reason;select.title=reason||'Create a gradient from the current color to transparent';}
 RetouchInspector.note(section,'Creates shared SVG paint from the current color to transparent. Page styles can override attribute paint.');panelBody.append(section);
}
function mountSVGGradients(info,target){
 for(const gradient of info.svgGradients){
  const section=RetouchInspector.section(gradient.paint==='fill'?'Fill gradient':'Stroke gradient');section.dataset.gradientPaint=gradient.paint;
  RetouchInspector.note(section,(gradient.type==='linearGradient'?'Linear':'Radial')+' · #'+gradient.id);
  const reason=gradient.reason; if(reason){RetouchInspector.note(section,reason,'refused');panelBody.append(section);continue;}
  const type=RetouchInspector.select(section,'Gradient type',[['solid','Solid'],['linearGradient','Linear'],['radialGradient','Radial']],gradient.type,value=>{
   if(value!=='solid')return setSVGGradient(info,gradient.paint,undefined,undefined,'setType',value);
   try{const node=target?.ownerDocument.getElementById(gradient.id)?.querySelector('stop');if(!node)throw Error('The gradient stop is no longer available.');const css=node.ownerDocument.defaultView.getComputedStyle(node),color=RetouchPaletteValues.parse(RetouchColorStyles.fromComputed(css.stopColor)),opacity=Math.max(0,Math.min(1,parseFloat(css.stopOpacity)/(css.stopOpacity.endsWith('%')?100:1))),alpha=Math.round(color.alpha*opacity*1e12)/1e12;
    setSVGGradient(info,gradient.paint,undefined,undefined,'solid',color.space==='display-p3'?RetouchPaletteValues.p3(color.channels,alpha):RetouchPaletteValues.srgb(color.channels,alpha));
   }catch(error){type.value=gradient.type;toast(error.message,'err');}
  });type.title='Solid uses the first stop’s color and opacity for this layer';
  const canvas=RetouchInspector.button('Edit gradient on canvas',()=>editSVGGradientOnCanvas(info,target,gradient));canvas.setAttribute('aria-label','Edit '+gradient.paint+' gradient on canvas');section.append(canvas);
  const unique=RetouchInspector.button('Make unique',()=>setSVGGradient(info,gradient.paint,undefined,undefined,'detach'));unique.setAttribute('aria-label','Make '+gradient.paint+' gradient unique');section.append(unique);
  const reverse=RetouchInspector.button('Reverse gradient',()=>setSVGGradient(info,gradient.paint,undefined,undefined,'reverse'));reverse.setAttribute('aria-label','Reverse '+gradient.paint+' gradient');section.append(reverse);
  const bindStops=mountSVGGradientStopRail(section,info,target,gradient);
  const write=(changes,stop)=>setSVGGradient(info,gradient.paint,changes,stop);
  const field=(parent,label,value,property,stop,options)=>{let input;
   if(options){input=RetouchInspector.select(parent,label,options.map(value=>[value,({objectBoundingBox:'Object bounds',userSpaceOnUse:'SVG viewport',pad:'Extend',reflect:'Reflect',repeat:'Repeat'})[value]||value||'Default']),value||'',value=>write({[property]:value||null},stop));}
   else{input=document.createElement('input');input.type='text';input.value=value??'';input.placeholder='Default';input.onchange=()=>write({[property]:input.value.trim()||null},stop);RetouchInspector.field(parent,label,input);}
   if(property==='stop-color'){
    const definition=target?.ownerDocument.getElementById(gradient.id),node=[...(definition?.children||[])].filter(child=>child.localName==='stop')[stop];
    if(node){input.dataset.paintProperty='stop-color';input.retouchPaintShared=true;input.retouchPaintValue=()=>node.ownerDocument.defaultView.getComputedStyle(node).stopColor;RetouchInspector.fieldDraft(input);
     input.retouchPaintPreview=()=>{const preview=RetouchPaintPicker.propertyPreview({el:node,input,property:'stop-color',respectScope:false});return {update(value){preview.update(value);section.retouchGradientPaint?.();},restore(){preview.restore();section.retouchGradientPaint?.();}};};
    }
   }
  };
  for(const item of gradient.fields)field(section,'Gradient '+item.name,item.value,item.name,undefined,item.name==='gradientUnits'?['','objectBoundingBox','userSpaceOnUse']:item.name==='spreadMethod'?['','pad','reflect','repeat']:null);
  gradient.stops.forEach((stop,index)=>{const group=document.createElement('div');group.className='svg-gradient-stop';const title=document.createElement('p');title.className='hint';title.textContent='Stop '+(index+1);group.append(title);field(group,'Stop '+(index+1)+' position',stop.offset,'offset',index);field(group,'Stop '+(index+1)+' color',stop.color,'stop-color',index);field(group,'Stop '+(index+1)+' opacity',stop.opacity,'stop-opacity',index);const remove=RetouchInspector.button('Remove gradient stop '+(index+1),()=>setSVGGradient(info,gradient.paint,undefined,index,'removeStop'));remove.setAttribute('aria-label','Remove gradient stop '+(index+1));remove.title='Remove stop';remove.textContent='−';remove.classList.add('svg-gradient-stop-remove');remove.disabled=gradient.stops.length<=2;group.append(remove);section.append(group);});
  bindStops?.();
  RetouchInspector.note(section,'Shared gradient · Edits affect all referencing layers and screen sizes. Page styles can override stop colors.');section.lastElementChild.classList.add('gradient-scope');panelBody.append(section);
 }
}
async function setSVGGradient(info,paint,changes,stop,action,value,refreshOptions={}){
 if(sel?.info!==info||panelTasks||undoBusy||sourceRequests)return;busyPanel(true);
 try{const result=await api('POST','/rt/__api/op',{type:'setSVGGradient',id:info.id,fileHash:info.hash,paint,...(changes===undefined?{}:{changes}),...(stop===undefined?{}:{stop}),...(action===undefined?{}:{action,value})});if(!result?.ok)return toast(result?.reason||result?.error||'Could not update gradient','err');if(result.undoId)editorHistory.record({type:'setSVGGradient',id:info.id,undoId:result.undoId});sel.info=result.element;await refreshWrittenElement(sel.info,el=>svgGradientsMatch(el,sel.info),refreshOptions);renderPanel();toast(value?.type==='solid'?'Paint updated':'Gradient updated','ok');return true;}finally{busyPanel(false);}
}
async function setSVGGeometry(property,value){
  if(!sel||panelTasks||undoBusy||sourceRequests)return;const info=sel.info;busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/op',{type:'setSVGGeometry',id:info.id,fileHash:info.hash,...(typeof property==='object'?{changes:property}:{property,value})});
    if(!result?.ok)return toast(result?.reason||result?.error||'Could not update shape','err');
    if(result.undoId)editorHistory.record({type:'setSVGGeometry',id:info.id,undoId:result.undoId});
    sel.info=result.element;await refreshWrittenElement(sel.info,el=>svgGeometryMatches(el,sel.info),{svgGeometry:true});renderPanel();toast('Shape updated','ok');
  }finally{busyPanel(false);}
}
function reactGeometryReason(info,target){
  if(info.svgPaint?.reason)return info.svgPaint.reason;
  if(['position','inset','inset-inline','inset-block','inset-inline-start','inset-inline-end','inset-block-start','inset-block-end','left','right','top','bottom','width','height','margin','margin-left','margin-right','margin-top','margin-bottom','box-sizing'].some(p=>target?.style.getPropertyValue(p)))return 'This layer has inline geometry styles. Edit those source styles before moving or resizing with classes.';
  return null;
}

function classGeometryStrategy(info,target,scope=styleScope){
 // A null member means unchanged; never project it into an empty scope.
 return RetouchReactSelectionGeometry.strategy([info],[target],scope,{reason:reactGeometryReason,matches:matchingEls,save:(changes,expected)=>changes[info.id]==null?false:writeReactBounds(info,RetouchResponsive.project(changes[info.id],scope),expected[info.id])});
}
function writeClassLayerGeometry(info,target,g,before,anchors=null){
 if(anchors){try{classGeometryStrategy(info,target).validate();const classes=RetouchReactSelectionGeometry.classesForBounds(info.className,styleScope,g,target.ownerDocument.defaultView.getComputedStyle(target),target.ownerDocument,anchors);return writeReactBounds(info,RetouchResponsive.project(classes,styleScope),g);}catch(error){toast(error.message,'err');return false;}}
 return classGeometryStrategy(info,target).write([{geometry:before}],[{x:g.x-before.x,y:g.y-before.y,width:g.width,height:g.height}]);
}
async function writeReactBounds(info,classes,expected){
  const reason=reactGeometryReason(info,matchingEls(info.id)[0]);if(reason){toast(reason,'err');renderPanel();return false;}
  busyPanel(true);try{
    if(!await setClasses(classes))return false;
    const current=sel.info;await refreshWrittenElement(current,el=>current.className.split(/\s+/).filter(Boolean).every(token=>el.classList.contains(token)));
    for(let i=0;i<50;i++){const target=matchingEls(current.id)[0];if(target?.isConnected&&target.ownerDocument.defaultView.getComputedStyle(target).position==='absolute'){const actual=expected.localCoordinates?RetouchInspector.localPositionGeometry(target):RetouchInspector.geometry(target,{allowRotation:Object.hasOwn(expected,'rotation'),allowScale:Object.hasOwn(expected,'scaleX')});if(['x','y','width','height'].every(key=>Math.abs(actual[key]-expected[key])<.6)){renderPanel();return true;}}await new Promise(resolve=>setTimeout(resolve,100));}
    renderPanel();toast('Saved classes, but the bounds did not settle. Check responsive or inline overrides.','err');return false;
  }catch(error){toast(error.message,'err');return false;}finally{busyPanel(false);}
}

function resizeFlowOnCanvas(target,control,save,initial=null){
  stopDrawing?.();const key=JSON.stringify([sel?.info.id,sel?.info.hash,styleScope]);const current=()=>mode==='edit'&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests&&!sel?.multiple?.length&&!document.querySelector('dialog[open]')&&key===JSON.stringify([sel?.info.id,sel?.info.hash,styleScope])&&document.querySelector('[aria-label="Edit range status"]')?.dataset.match!=='false';if(!current())return;canvasPan.cancel();
  stopDrawing=RetouchFlowResize.mount({target,frame:iframe,canvas:canvasSurface,control,save,current,initial,onEnd:()=>{stopDrawing=null;if(panelRenderDeferred)queueViewportPanelRefresh();},onError:message=>toast(message,'err')});
}
function roundRectangleOnCanvas(target,input,initialPointer=null,corner=0){
  stopDrawing?.();const key=JSON.stringify([sel?.info.id,sel?.info.hash,styleScope]);
  const current=()=>mode==='edit'&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests&&!sel?.multiple?.length&&!document.querySelector('dialog[open]')&&input.isConnected&&!input.disabled&&!input.closest('[inert]')&&key===JSON.stringify([sel?.info.id,sel?.info.hash,styleScope]);
  if(!current())return;canvasPan.cancel();
  stopDrawing=RetouchSVGRadiusCanvas.mount({target,input,frame:iframe,canvas:canvasSurface,current,initialPointer,corner,onEnd:()=>{stopDrawing=null;if(panelRenderDeferred)queueViewportPanelRefresh();},onError:message=>toast(message,'err')});
}
function rotateLayerOnCanvas(target,input,initialPointer=null){
  stopDrawing?.();
  const key=JSON.stringify([sel?.info.id,sel?.info.hash,styleScope]);
  const current=()=>mode==='edit'&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests&&!sel?.multiple?.length&&!document.querySelector('dialog[open]')&&input.isConnected&&!input.matches(':disabled')&&!input.closest('[inert]')&&document.querySelector('[aria-label="Edit range status"]')?.dataset.match!=='false'&&key===JSON.stringify([sel?.info.id,sel?.info.hash,styleScope]);
  if(!current())return;
  canvasPan.cancel();
  stopDrawing=RetouchCanvasRotate.mount({target,frame:iframe,canvas:canvasSurface,input,current,initialPointer,onEnd:()=>{stopDrawing=null;if(panelRenderDeferred)queueViewportPanelRefresh();},onError:message=>toast(message,'err')});
}

function layerMovementSpace(target,g,action,opener){
 if(!g.localCoordinates)return {current:()=>true,convert:delta=>delta};
 if(action==='resize')return {current:()=>true,convert:delta=>delta};
 const space=RetouchSVGDraw.nativeSpace(target.offsetParent),m=space.matrix,inverse=m.inverse(),w=target.ownerDocument.defaultView;
 const outlinePoints=RetouchInspector.localPositionCorners(g).map(({x,y})=>new w.DOMPoint(x,y).matrixTransform(m)),transformState=()=>{const css=w.getComputedStyle(target);return [css.transform,css.rotate,css.scale,css.transformOrigin,css.transformBox,css.zoom].join('|');},originalTransform=transformState(),originalTranslate=w.getComputedStyle(target).translate;
 const convert=delta=>({...delta,x:inverse.a*delta.x+inverse.c*delta.y,y:inverse.b*delta.x+inverse.d*delta.y});let preview,restored=false;
 const contentPreview={current:()=>!preview||preview.current(),update:delta=>{preview??=RetouchPaintPicker.propertyPreview({el:target,input:opener||document.body,property:'translate'});const local=convert(delta);preview.update(RetouchTranslateValues.add(originalTranslate,local));},restore:()=>{preview?.restore();restored=true;}};
 return {current:()=>space.current()&&transformState()===originalTransform&&((preview&&!restored)||w.getComputedStyle(target).translate===originalTranslate),outlinePoints,convert,contentPreview};
}

function transformReactLayer(info,target,action,opener,initial=null){
  stopDrawing?.();if(panelTasks||undoBusy||sourceRequests||!target?.isConnected||info.classNameDynamic)return;
  let g,space;try{if(info.classSelection)classGeometryStrategy(info,target).validate();const reason=reactGeometryReason(info,target);if(reason)throw Error(reason);if(target.ownerDocument.defaultView.getComputedStyle(target).position!=='absolute')throw Error('Choose a screen where this layer is absolute before transforming it.');g=RetouchInspector.positionGeometry(target);space=layerMovementSpace(target,g,action,opener);}catch(error){toast(error.message,'err');return;}
  const scope=styleScope,hash=info.hash,classes=RetouchResponsive.project(info.className,scope),base=RetouchResponsive.inherited(info.className,scope,doc()),x=RetouchInspector.inferredAnchor(classes,'x',base),y=RetouchInspector.inferredAnchor(classes,'y',base);
  canvasPan.cancel();
  stopDrawing=(g.localCoordinates&&action==='resize'?RetouchLocalResize:RetouchCanvasMove).mount({target,frame:iframe,canvas:canvasSurface,mode:action,preserveBox:!!info.classSelection,opener,initial,current:space.current,outlinePoints:space.outlinePoints,contentPreview:space.contentPreview,
    onCommit:async(delta,options)=>{if(sel?.info.id!==info.id||sel?.info.hash!==hash||styleScope!==scope)return;try{if(!space.current())throw Error('The containing frame changed during the gesture.');delta=space.convert(delta);const current=RetouchInspector.positionGeometry(target);if(['x','y','width','height','parentWidth','parentHeight','rotation','scaleX','scaleY'].some(key=>Math.abs((current[key]??0)-(g[key]??0))>(key.startsWith('scale')?1e-9:.5)))throw Error('The layer changed during the gesture. Re-select it and try again.');const geometry={...g,...(action==='resize'?{width:delta.width,height:delta.height}:{}),x:g.x+delta.x,y:g.y+delta.y};if(![geometry.x,geometry.y,geometry.width,geometry.height].every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))throw Error('Keep layer bounds within 100,000 pixels.');if(await (info.classSelection?writeClassLayerGeometry(info,target,geometry,g):writeReactBounds(info,RetouchInspector.anchorClasses(classes,geometry,x,y,base),geometry))){if(options?.keyboard)document.querySelector('[data-canvas-tool='+action+']')?.focus({preventScroll:true});}}catch(error){toast(error.message,'err');}},
    onEnd:()=>{stopDrawing=null;if(panelRenderDeferred)queueViewportPanelRefresh();},onError:message=>toast(message,'err')});
}

async function refreshGroupMove(infos,before){
 if(infos.every(info=>info.cssAuthoring)){await RetouchRenderSync.syncCSS({frame:iframe,entries:infos.map(info=>({id:info.id,rules:info.cssRules,texts:info.cssRuleTexts}))});await window.RetouchComparisons?.syncCSS(infos);}
 else if(infos.every(info=>info.contextSelection&&info.classSourceLiteral))await refreshLiteralLiquidClasses(infos,before);
 else await refreshWrittenElement(infos[0],el=>classSelectionMatches(infos,el.ownerDocument),{classSource:true});
}
function movementMembers(roots){
 const visibleOnly=roots.length===1&&!sel?.multiple?.length&&!!sel?.info.groupScale&&roots[0].hasAttribute('data-rt-group');
 const members=RetouchGroupMove.measureSelection(roots,el=>layerLocks.locked(el),undefined,{visibleOnly});
 if(!members.length)throw Error('Choose a screen where at least one group layer is visible.');return members;
}
async function moveGroupOnCanvas(info,opener,gesture={}){
 if(!gesture.prepareOnly)stopDrawing?.();if(panelTasks||sourceRequests||undoBusy||editing||sel?.info!==info)return;
 const scope=styleScope,hash=info.hash,selection=sel,selectionIds=(sel.multiple||[info]).map(item=>item.id),roots=groupMovementRoots(gesture.allowLayers),current=()=>mode==='edit'&&sel===selection&&sel.info.hash===hash&&styleScope===scope&&selectionEditRangeActive()&&!editing&&!panelTasks&&!sourceRequests&&!undoBusy&&!document.querySelector('dialog[open]');
 try{
  if(!roots)throw Error('Select groups and layers with one rendered occurrence each.');
  const width=scope?Number(/^min-\[(\d+)px\]:$/.exec(scope)?.[1]):0;
  if(info.cssAuthoring?(!Number.isInteger(width)||width>doc().defaultView.innerWidth):(scope&&document.querySelector('[aria-label="Edit range status"]')?.dataset.match!=='true'))throw Error('Choose a screen where the group edit range is active.');
  const members=gesture.prepared?.members||movementMembers(roots),responses=gesture.prepared?gesture.prepared.infos.map(element=>({ok:true,element})):await Promise.all(members.map(item=>api('GET',resolveUrl(item.id))));
  if(!current()||gesture.valid&&!gesture.valid())return;
  if(!responses.every(r=>r?.ok&&r.element.hash===info.hash&&r.element.file===info.file))throw Error('Re-select group contents from the same source file.');
  const infos=responses.map(r=>r.element),css=infos.every(item=>item.cssAuthoring);
  if(!css&&!infos.every(item=>item.classSelection&&!item.classNameDynamic))throw Error('Group movement needs editable child styles.');
  if(members.some(item=>matchingEls(item.id).length!==1))throw Error('Group movement needs one rendered occurrence of each child.');
  if(gesture.prepareOnly)return {info,roots,selectionIds,members,infos,scope,width,css,current,preview:()=>RetouchGroupMove.preview(members)};
  canvasPan.cancel();
  stopDrawing=RetouchCanvasMove.mount({initial:gesture.event?gesture:null,target:members[0].el,targets:members.map(item=>item.el),selectionId:info.id,frame:iframe,canvas:canvasSurface,mode:'move',opener,current,contentPreview:RetouchGroupMove.preview(members),
   onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err'),onCommit:delta=>writeGroupMove({info,roots,selectionIds,members,infos,scope,width,css,current},delta)
   });
 }catch(error){toast(error.message,'err');}
}

function groupMovementSection(info){
 const I=RetouchInspector,section=I.section(sel.multiple?.length||matchingEls(info.id)[0]?.hasAttribute('data-rt-group')?'Group':'Position'),roots=groupMovementRoots(),outer=roots.filter(el=>!roots.some(parent=>parent!==el&&parent.contains(el))),key=roots.map(el=>el.getAttribute('data-rt')).sort().join(',');
 const parent=RetouchGroupMove.parentBounds(roots);
 if(key!==groupAlignmentKey){groupAlignmentKey=key;groupAlignmentTarget=outer.length===1?'parent':'selection';}
 if(outer.length>1||parent){
  const choices=[...(outer.length>1?[['selection','Selection bounds']]:[]),...outer.filter(()=>outer.length>1).map((el,i)=>{const id=el.getAttribute('data-rt'),item=(sel.multiple||[info]).find(item=>item.id===id);return ['layer:'+id,'Layer: '+(i+1)+'. '+(item?.layerName||el.getAttribute('aria-label')||item?.text?.trim().slice(0,32)||item?.tag||'Layer')];}),...(parent?[['parent','Parent bounds']]:[])];
  if(!choices.some(([value])=>value===groupAlignmentTarget))groupAlignmentTarget=choices[0][0];
  const toolbar=RetouchSelectionLayout.alignmentToolbar((mode,event,control)=>void alignGroupSelection(mode,control,undefined,event.shiftKey&&!mode.startsWith('gap-')),true);
  const update=()=>{for(const control of toolbar.querySelectorAll('button')){control.title=control.getAttribute('aria-label')+(parent&&!control.dataset.distribution?' · Shift: align the whole selection to parent bounds':'');if(control.dataset.distribution)control.disabled=outer.length<3||groupAlignmentTarget.startsWith('layer:');}};
  section.append(toolbar);I.select(section,'Align to',choices,groupAlignmentTarget,value=>{groupAlignmentTarget=value;update();});update();
  if(outer.length>1)try{const bounds=RetouchGroupMove.selectionBounds(roots,movementMembers(roots));
   I.select(section,'Canvas gap adjustment',[['equal','All gaps equally'],['individual','Only the dragged gap']],groupGapMode,value=>{groupGapMode=value;window.dispatchEvent(new Event('retouch:selection-layout'));});
   for(const [axis,label]of [['x','Horizontal gap (px)'],['y','Vertical gap (px)']]){const values=RetouchSelectionLayout.gaps(bounds,axis).values,mixed=values.some(value=>Math.abs(value-values[0])>=1/32),input=I.number(section,label,mixed?NaN:values[0],-100000,100000,value=>void alignGroupSelection('spacing-'+axis,input,value));input.placeholder=mixed?'Mixed':'';input.title='Space the selected groups and layers without changing their internal layout. The first layer stays fixed, or the chosen reference layer.';I.fieldDraft(input);const control=I.button('Adjust '+(axis==='x'?'horizontal':'vertical')+' gaps on canvas',event=>void spaceGroupsOnCanvas(axis,event.currentTarget));control.dataset.canvasTool='spacing-'+axis;section.append(control);}
  }catch(error){I.note(section,error.message,'refused');}

 }
 try{const fields=document.createElement('div');fields.className='property-pair';section.insertBefore(fields,section.querySelector('.inspector-field'));const measured=groupPositionMeasurement(roots);
  for(const axis of ['x','y']){const input=I.number(fields,'Group '+axis.toUpperCase()+' (px)',measured[axis],-100000,100000,value=>void positionGroup(info,axis,value,input));input.parentElement.querySelector('span').textContent=axis.toUpperCase();input.title=measured.parent?'Selection position from the parent’s rendered bounds in screen pixels.':'Selection position on the page in pixels.';I.fieldDraft(input);
   input.retouchNumericPreview=()=>{if(!selectionEditRangeActive())throw Error('Preview the selected edit range before moving.');const selection=sel,scope=styleScope,hash=info.hash,start=groupPositionMeasurement(roots),preview=RetouchGroupMove.preview(start.members);let delta={x:0,y:0};return {current:()=>{try{return sel===selection&&info.hash===hash&&styleScope===scope&&selectionEditRangeActive()&&!panelTasks&&!sourceRequests&&!undoBusy&&preview.current()&&start.members.every(item=>{const r=item.el.getBoundingClientRect();return ['x','y','width','height'].every(key=>Math.abs(r[key]-item.rect[key]-(key==='x'?delta.x:key==='y'?delta.y:0))<.1);});}catch{return false;}},update:value=>{delta={x:axis==='x'?value-start.x:0,y:axis==='y'?value-start.y:0};preview.update(delta);},restore:preview.restore};};
  }
 }catch(error){I.note(section,error.message,'refused');}
 appendSelectionScaleControls(section,info,roots);
 const button=I.button(sel.multiple?.length?'Move selection on canvas':matchingEls(info.id)[0]?.hasAttribute('data-rt-group')?'Move group on canvas':'Move layer on canvas',event=>void moveGroupOnCanvas(info,event.currentTarget));button.dataset.canvasTool='move-group';button.title='Drag selected groups and layers on the canvas. Arrow keys move 1 px; Shift moves 10 px.';section.append(button);
 if(!selectionEditRangeActive()){for(const control of section.querySelectorAll('input,button')){control.disabled=true;control.title='Preview the selected edit range to transform this selection.';}I.note(section,'Preview the selected edit range to move, align, space, or scale this selection.');}
 return section;
}

function selectionEditRangeActive(){return !styleScope||document.querySelector('[aria-label="Edit range status"]')?.dataset.match==='true';}

function appendSelectionScaleControls(section,info,roots){
 const I=RetouchInspector,active=selectionEditRangeActive();
 const scaling=I.number(section,'Scale selection (%)',100,1,10000,value=>void scaleGroup(info,value,scaling));scaling.disabled=!active;scaling.title=active?'Scale selected content proportionally from its top-left corner. Layout slots stay unchanged.':'Preview the selected edit range before scaling.';I.fieldDraft(scaling);scaling.retouchNumericPreview=()=>{if(!selectionEditRangeActive())throw Error('Preview the selected edit range before scaling.');const selection=sel,scope=styleScope,hash=info.hash,preview=RetouchGroupMove.scalePreview(movementMembers(roots));return {current:()=>sel===selection&&info.hash===hash&&styleScope===scope&&selectionEditRangeActive()&&!editing&&!panelTasks&&!sourceRequests&&!undoBusy&&preview.current(),update:value=>preview.update(value/100),restore:preview.restore};};
 const scaleCanvas=I.button('Scale selection on canvas',event=>void scaleGroupOnCanvas(info,event.currentTarget));scaleCanvas.disabled=!active;scaleCanvas.dataset.canvasTool='scale';scaleCanvas.setAttribute('aria-keyshortcuts','K');scaleCanvas.title=active?'Scale selection on canvas · K':'Preview the selected edit range before scaling.';section.append(scaleCanvas);
}

async function scaleGroupOnCanvas(info,opener){
 stopDrawing?.();
 let cancelled=false;
 const frameDocument=doc(),onKey=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();}};
 const cancel=()=>{cancelled=true;frameDocument.removeEventListener('keydown',onKey,true);if(stopDrawing===cancel){stopDrawing=null;window.dispatchEvent(new Event('retouch:shape-tools'));}};
 stopDrawing=cancel;frameDocument.addEventListener('keydown',onKey,true);window.dispatchEvent(new Event('retouch:shape-tools'));
 try{
  const context=await moveGroupOnCanvas(info,null,{prepareOnly:true,allowLayers:true});
  if(cancelled||!context||!context.current())return;
  RetouchGroupMove.scalePlan(context.members,1);
  const rect=RetouchCanvasMove.union(context.members.map(item=>item.rect)),preview=RetouchGroupMove.scalePreview(context.members);
  canvasPan.cancel();
  stopDrawing=RetouchCanvasMove.mount({target:context.members[0].el,targets:context.members.map(item=>item.el),selectionId:info.id,frame:iframe,canvas:canvasSurface,mode:'scale',opener,current:context.current,contentPreview:preview,
   onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err'),
   onCommit:result=>{try{const plan=RetouchGroupMove.scalePlan(context.members,result.width/rect.width,{x:result.x,y:result.y});return writeGroupMove(context,plan.deltas,plan);}catch(error){toast(error.message,'err');}}
  });
 }catch(error){if(!cancelled)toast(error.message,'err');}
 finally{frameDocument.removeEventListener('keydown',onKey,true);if(stopDrawing===cancel)cancel();window.dispatchEvent(new Event('retouch:shape-tools'));}
}

async function refreshHTMLGroupScale(info){
 const select=d=>matchingInDocument(d,info.id,info),state=info.groupScale;
 const matches=el=>el.getAttribute('data-rt-scale')===state.metadata&&Object.entries(state.members).every(([id,value])=>{const members=matchingInDocument(el.ownerDocument,id);return members.length&&members.every(member=>member.getAttribute('data-rt-scale-member')===value);});
 await RetouchRenderSync.sync({frame:iframe,serverRendered:true,select,matches});await RetouchRenderSync.ensureGroupScaleRuntime(iframe,state.runtimeRevision);
 const result=await window.RetouchComparisons?.syncRendered({select,matches,kind:'Scale',afterSync:frame=>RetouchRenderSync.ensureGroupScaleRuntime(frame,state.runtimeRevision)});if(result?.failures.length)throw Error('Retry the failed comparison previews.');
}
async function writeHTMLGroupScale(info,percent,offset=[0,0],move=[0,0]){
 if(!selectionEditRangeActive()||sel?.info!==info)return;
 const context=await moveGroupOnCanvas(info,null,{prepareOnly:true,allowLayers:true});if(!context||!context.current())return;RetouchGroupMove.scalePlan(context.members,percent/100);
 const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0;if(!Number.isInteger(width))throw Error('Choose an explicit pixel screen range for group scaling.');busyPanel(true);
 try{
  const result=await api('POST','/rt/__api/op',{type:'scaleGroup',id:info.id,fileHash:info.hash,width,factor:percent/100,offset,move});if(!result?.ok)throw Error(result?.reason||result?.error||'Could not scale the group.');
  if(result.undoId)editorHistory.record({type:'htmlGroupScale',id:info.id,undoId:result.undoId});sel.info=result.element;
  try{await refreshHTMLGroupScale(result.element);}finally{await restoreLayerSelection([info.id]);if(sel)renderPanel();}
 }finally{busyPanel(false);}
}
async function scaleGroup(info,percent,input){
 try{if(percent===100)return;if(info.groupScale&&!sel?.multiple?.length){await writeHTMLGroupScale(info,percent);return;}const context=await moveGroupOnCanvas(info,null,{prepareOnly:true,allowLayers:true});if(!context||!context.current())return;const plan=RetouchGroupMove.scalePlan(context.members,percent/100);if(document.activeElement===input)RetouchPanelFocus.queue(input);await writeGroupMove(context,plan.deltas,plan);}catch(error){toast(error.message,'err');}
}

function groupPositionMeasurement(roots,members=movementMembers(roots)){
 const bounds=RetouchGroupMove.selectionBounds(roots,members),rect=RetouchCanvasMove.union(bounds),parent=RetouchGroupMove.parentBounds(roots),w=roots[0].ownerDocument.defaultView;return {members,parent,x:rect.left-(parent?.left??-w.scrollX),y:rect.top-(parent?.top??-w.scrollY)};
}
async function positionGroup(info,axis,value,input){
 try{const context=await moveGroupOnCanvas(info,null,{prepareOnly:true});if(!context||!context.current())return;const before=groupPositionMeasurement(context.roots,context.members),amount=value-before[axis];if(Math.abs(amount)<1/32)return;if(document.activeElement===input)RetouchPanelFocus.queue(input);await writeGroupMove(context,{x:axis==='x'?amount:0,y:axis==='y'?amount:0});}catch(error){toast(error.message,'err');}
}

async function spaceGroupsOnCanvas(axis,opener){
 stopDrawing?.();const info=sel?.info,choice=groupAlignmentTarget,gapMode=groupGapMode;if(!info)return;
 try{const context=await moveGroupOnCanvas(info,null,{prepareOnly:true});if(!context||!context.current()||choice!==groupAlignmentTarget||gapMode!==groupGapMode)return;
  const bounds=RetouchGroupMove.selectionBounds(context.roots,context.members),targets=bounds.map(bound=>bound.el),anchor=!choice.startsWith('layer:')?null:bounds.findIndex(bound=>'layer:'+bound.el.getAttribute('data-rt')===choice);if(anchor===-1)throw Error('Choose a selected reference layer.');
  const parent=choice==='parent'?RetouchGroupMove.parentBounds(context.roots):null;if(choice==='parent'&&!parent)throw Error('Choose layers with the same visible parent.');const spacing={axis,independent:gapMode==='individual',anchor,...(parent?{start:parent[axis==='x'?'left':'top']}: {})},preview=context.preview();canvasPan.cancel();
  stopDrawing=RetouchCanvasMove.mount({target:targets[0],targets,selectionId:info.id,frame:iframe,canvas:canvasSurface,mode:'spacing-'+axis,spacing,opener,current:()=>context.current()&&choice===groupAlignmentTarget&&gapMode===groupGapMode,
   measureBounds:el=>RetouchGroupMove.selectionBounds([el],RetouchGroupMove.measureSelection([el],node=>layerLocks.locked(node)))[0],
   contentPreview:{current:preview.current,restore:preview.restore,update:deltas=>preview.update(RetouchGroupMove.memberDeltas(bounds,context.members,deltas))},
   onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err'),onCommit:result=>writeGroupMove(context,RetouchGroupMove.memberDeltas(bounds,context.members,result.deltas))});
 }catch(error){toast(error.message,'err');}
}

async function alignGroupSelection(mode,control,gap,asUnit=false){
 const info=sel?.info,targetChoice=groupAlignmentTarget;if(!info)return;
 try{const context=await moveGroupOnCanvas(info,null,{prepareOnly:true});if(!context||!context.current()||groupAlignmentTarget!==targetChoice)return;const bounds=RetouchGroupMove.selectionBounds(context.roots,context.members),target=asUnit?RetouchGroupMove.parentBounds(context.roots):targetChoice==='selection'?null:targetChoice==='parent'?RetouchGroupMove.parentBounds(context.roots):bounds.find(bound=>'layer:'+bound.el.getAttribute('data-rt')===targetChoice);if(asUnit&&!target)throw Error('Choose layers with the same visible parent.');if(!asUnit&&targetChoice!=='selection'&&!target)throw Error('Choose a selected reference layer.');if(targetChoice.startsWith('layer:')&&mode.startsWith('gap-'))throw Error('Use selection bounds to distribute spacing.');const deltas=asUnit?Array(bounds.length).fill(RetouchSelectionLayout.arrange([RetouchCanvasMove.union(bounds)],mode,target)[0]):mode.startsWith('spacing-')?RetouchSelectionLayout.setSpacing(bounds,mode.slice(-1),gap,{anchor:targetChoice.startsWith('layer:')?bounds.indexOf(target):null,...(targetChoice==='parent'?{start:target[mode.endsWith('x')?'left':'top']}: {})}):RetouchSelectionLayout.arrange(bounds,mode,target);if(!asUnit&&targetChoice.startsWith('layer:'))deltas[bounds.indexOf(target)]={x:0,y:0};if(deltas.every(d=>Math.abs(d.x)+Math.abs(d.y)<1/32))return;if(document.activeElement===control)RetouchPanelFocus.queue(control);await writeGroupMove(context,RetouchGroupMove.memberDeltas(bounds,context.members,deltas));}catch(error){toast(error.message,'err');}
}

async function writeGroupMove({info,roots,selectionIds,members,infos,scope,width,css,current},delta,scaling=null){
    if(!current())return;
    let busy=false;try{
     const fresh=movementMembers(roots);
     if(fresh.length!==members.length||fresh.some((item,i)=>item.el!==members[i].el||item.translate!==members[i].translate||item.matrix.some((n,j)=>Math.abs(n-members[i].matrix[j])>1e-9)||['x','y','width','height'].some(key=>Math.abs(item.rect[key]-members[i].rect[key])>.1)))throw Error('The group changed during movement. Re-select it.');
     const deltas=Array.isArray(delta)?delta:members.map(()=>delta);if(deltas.length!==members.length)throw Error('Resolve every layer offset.');
     if(info.groupScale&&selectionIds.length===1&&(scaling||info.groupScale.metadata)){
      const bounds=RetouchCanvasMove.union(members.map(item=>item.rect)),factor=scaling?scaling.expected[0].width/members[0].rect.width:1;
      if(!scaling&&deltas.some(d=>Math.abs(d.x-deltas[0].x)>.001||Math.abs(d.y-deltas[0].y)>.001))throw Error('Move the scaled group as one selection.');
      const dx=scaling?scaling.expected[0].x-(bounds.left+(members[0].rect.x-bounds.left)*factor):deltas[0].x,dy=scaling?scaling.expected[0].y-(bounds.top+(members[0].rect.y-bounds.top)*factor):deltas[0].y;
      return await writeHTMLGroupScale(info,factor*100,scaling?[dx/bounds.width,dy/bounds.height]:[0,0],scaling?[0,0]:[dx,dy]);
     }
     const moving=members.map((item,i)=>({item,delta:deltas[i],info:infos[i]})).filter(({delta})=>scaling||delta.x!==0||delta.y!==0);if(!moving.length)return;const writeInfos=moving.map(entry=>entry.info),changesById=Object.fromEntries(moving.map(({item,delta})=>{
      if(item.el.ownerDocument[Symbol.for('retouch.group-scale.runtime')]?.manages?.(item.el)){const prior=RetouchGroupMove.scaleMovement(item.el),expected=scaling?.expected[members.indexOf(item)],shift=expected?{x:expected.x-item.rect.x,y:expected.y-item.rect.y}:delta,factor=expected?RetouchGroupMove.memberScale(item.el)*expected.width/item.rect.width:null;if(factor!==null&&(!Number.isFinite(factor)||factor<.01||factor>100))throw Error('Keep the layer scale between 1 and 10,000 percent.');return [item.id,{'--rt-scale-move-x':(prior.x+shift.x)+'px','--rt-scale-move-y':(prior.y+shift.y)+'px',...(expected?{'--rt-scale-factor':String(factor)}:{})}];}
      return [item.id,{translate:RetouchGroupMove.translation(item.translate,RetouchGroupMove.localDelta(item.matrix,delta)),...(scaling?{scale:scaling.scales[item.id]}:{})}];
     })),classesById=css?{}:Object.fromEntries(writeInfos.map(item=>[item.id,Object.hasOwn(changesById[item.id],'--rt-scale-move-x')?RetouchGroupScaleClasses.write(item.className,scope,changesById[item.id]):scaling?RetouchGroupMove.scaleClasses(RetouchGroupMove.classes(item.className,scope,changesById[item.id].translate),scope,scaling.scales[item.id]):RetouchGroupMove.classes(item.className,scope,changesById[item.id].translate)])),first=writeInfos[0],multi=writeInfos.length>1;
     busyPanel(true);busy=true;
     const result=await api('POST','/rt/__api/op',{type:css?(multi?'setCSSSelection':'setCSS'):(multi?'setClassesSelection':'setClasses'),id:first.id,fileHash:first.hash,...(multi?{ids:writeInfos.map(item=>item.id)}:{}),...(css?{width,...(multi?{changesById}:{changes:changesById[first.id]})}:multi?{classesById,...selectionSourceContexts(writeInfos)}:{classes:classesById[first.id],context:first.context})});
     if(!result?.ok)throw Error(result?.reason||result?.error||'Could not move group.');
     const updated=result.selection||[result.element],before=Object.fromEntries(writeInfos.map(item=>[item.id,item.className])),after=Object.fromEntries(updated.map(item=>[item.id,item.className]));
     if(result.undoId)editorHistory.record({type:'moveGroup',id:first.id,groupId:info.id,selectionIds,childIds:writeInfos.map(item=>item.id),classesBefore:before,classesAfter:after,undoId:result.undoId});
     try{await refreshGroupMove(updated,before);}finally{await restoreLayerSelection(selectionIds);if(sel)renderPanel();}let settled=false;for(let attempt=0;attempt<50;attempt++){settled=members.every((item,i)=>{const el=matchingEls(item.id)[0],r=el?.getBoundingClientRect();const expected=scaling?.expected[i]||{x:item.rect.x+deltas[i].x,y:item.rect.y+deltas[i].y,width:item.rect.width,height:item.rect.height};return r&&['x','y','width','height'].every(key=>Math.abs(r[key]-expected[key])<.6);});if(settled)break;await new Promise(resolve=>setTimeout(resolve,100));}if(!settled)throw Error('Group changes saved, but the canvas did not match. Check style overrides.');toast(scaling?'Selection scaled':'Group moved','ok');
    }catch(error){toast(error.message,'err');}finally{if(busy)busyPanel(false);}
}

function transformLayerSelection(elements,commit,opener,action='move',spacing=null){
  stopDrawing?.();if(panelTasks||undoBusy||sourceRequests||!sel?.multiple?.length)return;
  const hash=sel.info.hash,scope=styleScope,key=sel.multiple.map(info=>info.id).sort().join(',');
  canvasPan.cancel();
  stopDrawing=RetouchCanvasMove.mount({target:elements[0],targets:elements,selectionId:activeId(),frame:iframe,canvas:canvasSurface,mode:action,spacing,opener,
    onCommit:async(delta,options)=>{if(sel?.info.hash!==hash||styleScope!==scope||sel.multiple?.map(info=>info.id).sort().join(',')!==key)return;try{if(![delta.x,delta.y,...(action==='resize'?[delta.width,delta.height]:spacing?[delta.gap,...(spacing.independent?delta.values:[])]:[])].every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))throw Error('Keep selection bounds within 100,000 pixels.');await commit(delta);if(options?.keyboard)document.querySelector('[data-canvas-tool='+action+']')?.focus({preventScroll:true});}catch(error){toast(error.message,'err');}},
    onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});
}

function moveHTMLLayer(info,target,width,g,action='move',opener,initial=null){
  stopDrawing?.();if(panelTasks||undoBusy||sourceRequests||!target?.isConnected)return;
  const scope=styleScope;let space;
  try{if(!Number.isInteger(width)||width>target.ownerDocument.defaultView.innerWidth)throw Error('Choose a screen where this scope is active.');if(target.ownerDocument.defaultView.getComputedStyle(target).position!=='absolute')throw Error('Choose an absolute layer in the current screen.');g=RetouchInspector.positionGeometry(target);space=layerMovementSpace(target,g,action,opener);}catch(error){toast(error.message,'err');return;}
  const inherited=Object.entries(info.cssRules||{}).filter(([w])=>Number(w)<=target.ownerDocument.defaultView.innerWidth).sort(([a],[b])=>Number(a)-Number(b)).reduce((all,[,values])=>Object.assign(all,values),{});
  canvasPan.cancel();
  stopDrawing=(g.localCoordinates&&action==='resize'?RetouchLocalResize:RetouchCanvasMove).mount({target,frame:iframe,canvas:canvasSurface,mode:action,preserveBox:true,opener,initial,current:space.current,outlinePoints:space.outlinePoints,contentPreview:space.contentPreview,
    onCommit:(delta,options)=>{if(sel?.info.id!==info.id||sel?.info.hash!==info.hash||styleScope!==scope)return;try{if(!space.current())throw Error('The containing frame changed during the gesture.');delta=space.convert(delta);const current=RetouchInspector.positionGeometry(target);if(['x','y','width','height','parentWidth','parentHeight','rotation','scaleX','scaleY'].some(key=>Math.abs((current[key]??0)-(g[key]??0))>(key.startsWith('scale')?1e-9:.5)))throw Error('The layer changed during the gesture. Re-select it and try again.');const geometry={...g,...(action==='resize'?{width:delta.width,height:delta.height}:{}),x:g.x+delta.x,y:g.y+delta.y};if(![geometry.x,geometry.y,geometry.width,geometry.height].every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))throw Error('Move within 100,000 pixels of the container.');setHTMLCSS(RetouchSelectionLayout.preserveBox(RetouchHTMLPosition.placement(geometry,inherited),geometry,target.ownerDocument.defaultView.getComputedStyle(target)),null,width).then(()=>{if(options?.keyboard&&sel?.info.id===info.id)document.querySelector('[data-canvas-tool='+action+']')?.focus({preventScroll:true});});}catch(error){toast(error.message,'err');}},
    onEnd:()=>{stopDrawing=null;if(panelRenderDeferred)queueViewportPanelRefresh();},onError:message=>toast(message,'err')});
}

window.RetouchVariableModePreview=async request=>{const result=await api('POST','/rt/__api/variables/resolve',request);if(!result?.ok)throw Error(result?.reason||result?.error||'Could not preview variable modes.');return result;};
window.RetouchVariableLibraryRequest=async operation=>{
 if(!operation){const result=await api('GET','/rt/__api/variables');if(!result?.ok)throw Error(result?.reason||result?.error||'Could not load variable collections.');return result;}
 busyPanel(true);try{const result=await api('POST','/rt/__api/variables',operation);if(!result?.ok)throw Error(result?.reason||result?.error||'Could not save variable collections.');if(result.undoId)editorHistory.record({type:'sourceHistory',undoId:result.undoId});if(result.updated){const info=sel?.info,ids=sel?.multiple?.map(item=>item.id),fresh=info?await api('GET',resolveUrl(info.id,info.context)):null;if(fresh?.ok&&sel?.info.id===info.id)sel.info=fresh.element;if(fresh?.ok&&fresh.element.classVariables)await refreshTextStyleElement(fresh.element);else await reloadFrame();if(ids?.length>1)await restoreLayerSelection(ids);else if(sel)renderPanel();}return result;}finally{busyPanel(false);}
};
window.RetouchColorStyleRequest=async operation=>{
 const info=sel?.info;busyPanel(true);
 try{
  const result=await api('POST','/rt/__api/color-styles',operation);if(!result?.ok)throw Error(result?.reason||result?.error||'Could not save color styles');
  if(result.undoId)editorHistory.record({type:'colorStyleCatalog',id:info?.id,context:info?.context,undoId:result.undoId});
  if(result.updated){const fresh=info?await api('GET',resolveUrl(info.id,info.context)):null;if(fresh?.ok&&sel?.info.id===info.id){sel.info=fresh.element;await refreshTextStyleElement(fresh.element);}else await reloadFrame();if(sel)renderPanel();}
  return result;
 }finally{busyPanel(false);}
};
window.RetouchEffectStyleRequest=async operation=>{
  const info=sel?.info;busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/effect-styles',operation);
    if(!result?.ok)throw Error(result?.reason||result?.error||'Could not save effect styles');
    if(result.undoId)editorHistory.record({type:'effectStyleCatalog',id:info?.id,context:info?.context,undoId:result.undoId});
    if(result.updated){
      const fresh=info?await api('GET',resolveUrl(info.id,info.context)):null;
      if(fresh?.ok&&sel?.info.id===info.id){sel.info=fresh.element;await refreshTextStyleElement(fresh.element);}else await reloadFrame();
      if(sel)renderPanel();
    }
    return result;
  }finally{busyPanel(false);}
};
window.RetouchTextStyleRequest=async operation=>{
  const info=sel?.info;busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/text-styles',operation);
    if(!result?.ok)throw Error(result?.reason||result?.error||'Could not save text styles');
    if(result.undoId)editorHistory.record({type:'textStyleCatalog',id:info?.id,context:info?.context,undoId:result.undoId});
    if(result.updated){
      const fresh=info?await api('GET',resolveUrl(info.id,info.context)):null;
      if(fresh?.ok&&sel?.info.id===info.id){sel.info=fresh.element;await refreshTextStyleElement(fresh.element);}else await reloadFrame();
      if(sel)renderPanel();
    }
    return result;
  }finally{busyPanel(false);}
};
async function refreshTextStyleElement(info){
  if(info.classTextStyles||info.classVariables)await refreshWrittenElement(info,el=>{
    try{return JSON.stringify(JSON.parse(el.getAttribute('data-rt-text-styles')||'{}'))===JSON.stringify(info.textStyleLinks||{})&&JSON.stringify(JSON.parse(el.getAttribute('data-rt-color-styles')||'{}'))===JSON.stringify(info.colorStyleLinks||{})&&JSON.stringify(JSON.parse(el.getAttribute('data-rt-effect-styles')||'{}'))===JSON.stringify(info.effectStyleLinks||{})&&(!info.classVariables||JSON.stringify(JSON.parse(el.getAttribute('data-rt-variables')||'{}'))===JSON.stringify(info.variableLinks||{}))&&(info.className||'').split(/\s+/).filter(Boolean).every(token=>el.classList.contains(token));}catch{return false;}
  },{classSource:true});else await reloadFrame();
}
function selectionBackgroundStates(selection,property){
 if(property!=='background-color'||document.querySelector('[aria-label="Edit range status"]')?.dataset.match==='false')return {};
 return {backgroundPaints:Object.fromEntries(selection.map(info=>[info.id,backgroundStyleState(info,property).backgroundPaint]))};
}
function backgroundStyleState(info,property){
 if(property!=='background-color'||document.querySelector('[aria-label="Edit range status"]')?.dataset.match==='false')return {};
 const element=matchingEls(info.id)[0];if(!element)throw Error('Re-select the layer to read its background paint.');
 const {current,stored}=RetouchBackgroundPaintUI.sourceState(info,styleScope)||RetouchBackgroundPaintUI.read(info,element);return {backgroundPaint:{current,stored}};
}
async function writeTextStyle(type,width,extra={}){
  if(!sel)return;const info=sel.info;busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/op',{type,id:info.id,fileHash:info.hash,context:info.context,width,...extra});
    if(!result?.ok)throw Error(result?.reason||result?.error||'Could not save text style');
    if(result.undoId)editorHistory.record({type:'setCSS',id:info.id,context:info.context,undoId:result.undoId});
    if(sel?.info.id===info.id){
      sel.info=result.element;
      await refreshTextStyleElement(result.element);
      renderPanel();
    }toast('Saved','ok');
  }finally{busyPanel(false);}
}
async function setHTMLCSS(property,value,width,resetScope=false){
  if(!sel)return;const info=sel.info;let saved=false;busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/op',{type:'setCSS',id:info.id,fileHash:info.hash,width,...(resetScope?{resetScope:true}:typeof property==='object'?{changes:property}:{property,value})});
    if(!result?.ok){toast(result?.reason||result?.error||'Could not save CSS','err');renderPanel();return;}
    saved=true;if(result.undoId)editorHistory.record({type:'setCSS',managedCSS:true,id:info.id,undoId:result.undoId});
    sel.info=result.element;await RetouchRenderSync.syncCSS({frame:iframe,id:info.id,rules:result.element.cssRules,texts:result.element.cssRuleTexts});await window.RetouchComparisons?.syncCSS(result.element);renderPanel();toast('Saved','ok');
  }catch(error){toast((saved?'Styles saved; preview refresh failed: ':'Could not save styles: ')+error.message,'err');renderPanel();}finally{busyPanel(false);}
}
async function setClasses(classes, isUndo) {
  busyPanel(true);
  try {
    if (!isUndo && sel) classes = RetouchResponsive.replaceScope(sel.info.className, classes, styleScope);
    return await writeClasses(classes, isUndo);
  } catch (e) { toast(e.message, 'err'); return false; } finally { busyPanel(false); }
}
async function writeClasses(classes, isUndo) {
  if (!sel || !sel.info) return;
  const info = sel.info;
  const prev = info.className || '';
  if(classes===prev)return true;
  const literalLiquid = info.contextSelection && info.classSourceLiteral;
  if (!literalLiquid) optimisticClasses(classes);
  const res = await api('POST', '/rt/__api/op', {
    type: 'setClasses', id: info.id, classes, fileHash: info.fileHash || info.hash, context: info.context,
  });
  if (res && res.ok) {
    if (!isUndo) editorHistory.record(literalLiquid ? {type:'setLiquidClassesSelection',id:info.id,selectionIds:[info.id],classesBefore:{[info.id]:prev},classesAfter:{[info.id]:res.element.className},undoId:res.undoId} : { type: 'setClasses', id: info.id, classes: prev, undoId: res.undoId, context: info.context });
    info.className = res.element?.className ?? classes;
    info.hash = res.hash;
    if(info.classTextStyles&&res.element)for(const key of ['textStyleLinks','textStyleOverrides','classTextStyles','textStyleLinkReason'])info[key]=res.element[key];
    if(res.element)for(const key of ['colorStyleLinks','colorStyleOverrides','classColorStyles','colorStyleLinkReason','effectStyleLinks','effectStyleOverrides','classEffectStyles','effectStyleLinkReason','classVariables','variableLinks','variableOverrides','variableReason'])info[key]=res.element[key];
    try {
      if (literalLiquid) await refreshLiteralLiquidClasses([res.element],{[info.id]:prev});
      else if (window.__RT_RENDERING?.reloadAfterWrite||info.renderRevisionAttribute) await refreshWrittenElement(info, el => info.className.split(/\s+/).filter(Boolean).every(token => el.classList.contains(token)),{classSource:true});
    } catch (error) {
      renderPanel();toast('Classes saved; preview refresh failed: '+error.message,'err','class-preview');return false;
    }
    toast('Saved', 'ok');
    renderPanel();
  } else {
    if (!literalLiquid) optimisticClasses(prev);
    toast((res && res.reason) || (res && res.error) || 'Write failed', 'err');
    loadScope();
  }
  return !!res?.ok;
}

async function setText(text, isUndo) {
  if (!sel || !sel.info) return;
  const info = sel.info;
  const prev = info.text;
  optimisticText(text);
  const res = await api('POST', '/rt/__api/op', {
    type: 'setText', id: info.id, text, fileHash: info.fileHash || info.hash, ...sourcePayload(info),
  });
  if (res && res.ok) {
    if (!isUndo) editorHistory.record({ type: 'setText', id: info.id, text: prev, undoId: res.undoId, context: info.context, sourceId: info.textSource?.id });
    info.text = text;
    updateSource(info, res);
    // A preview navigation may have replaced the optimistically edited node.
    if(info.kind==='host'&&!info.textSource)for(const el of matchingInDocument(doc(),info.id,info))if(el.textContent!==text)el.textContent=text;
    await window.RetouchComparisons?.syncText(info);
    if(sel?.info===info)renderPanel();
    toast('Saved', 'ok');
  } else {
    optimisticText(prev);
    toast((res && res.reason) || (res && res.error) || 'Write failed', 'err');
    loadScope();
  }
}

function matchingEls(id) {
  const d = doc();
  if (!d) return [];
  const info=sel?.info?.id===id?sel.info:sel?.multiple?.find(info=>info.id===id)||null;
  return info?.kind==='instance'?selectedComponentGroups(d,id,info).flatMap(group=>group.elements):RetouchComponentInstances.prioritize(matchingInDocument(d,id,info).map(el=>({element:el,elements:[el]})),renderedSelection?.id===id?renderedSelection.element:null).flatMap(group=>group.elements);
}
function selectedComponentGroups(d,id,info){
 return RetouchComponentInstances.prioritize(RetouchComponentInstances.group(matchingInDocument(d,id,info),info?.rootGroups),renderedSelection?.id===id?renderedSelection.element:null);
}
function matchingInDocument(d,id,info) {
  if(!d)return [];
  const direct=[...d.querySelectorAll(`[data-rt="${id}"], [data-rt-i="${id}"]`)];
  if(direct.length){
    const attrs=info?.context?.attributes;
    if(attrs){const preferred=el=>Object.entries(attrs).every(([name,value])=>el.getAttribute(name)===value);direct.sort((a,b)=>Number(preferred(b))-Number(preferred(a)));}
    return direct;
  }
  const scope=info?.renderScope;
  if(!scope||!Object.keys(scope).length)return [];
  const matches=[...d.querySelectorAll('[data-rt], [data-rt-i]')].filter(el=>Object.entries(scope).every(([name,value])=>el.getAttribute(name)===value));
  const set=new Set(matches);
  return matches.filter(el=>{for(let parent=el.parentElement;parent;parent=parent.parentElement)if(set.has(parent))return false;return true;});
}

function optimisticClasses(classes) {
  for (const el of matchingEls(sel.info.id)) el.setAttribute('class', classes);
}

function optimisticText(text) {
  if (!sel?.info || sel.info.textSource) return;
  for (const el of matchingEls(sel.info.id)) el.textContent = text;
}

window.addEventListener('retouch:tool-history',syncHistoryControls);
async function undo() { return restoreDirection('undo'); }
async function redo() { return restoreDirection('redo'); }
async function restoreDirection(direction) {
  const toolHistory=document.querySelector('.svg-pen-surface')?.retouchHistory;
  if(toolHistory){if(!undoBusy&&!panelTasks&&!sourceRequests)toolHistory[direction]();return;}
  stopDrawing?.();
  if(undoBusy || panelTasks || sourceRequests)return;
  if(caretHistoryStep(direction==='redo'))return;
  if(ownsNativeTextHistory()&&editing.el.innerHTML!==editing.historyBaselineHTML)return;
  await commitInlineEdit();
  if(undoBusy || panelTasks || sourceRequests)return;
  try {
    const result=await editorHistory[direction]();
    if(result?.empty)toast('Nothing to '+direction);
    else if(!result?.ok&&!result?.busy)toast(result?.reason||result?.error||'History restore failed','err');
  } catch(error){toast(error.message,'err');}
}
async function showHistoryPage(route){
  if(!route||route===currentPageRoute())return;
  const target=new URL(route,location.origin);
  if(target.origin!==location.origin)throw Error('The edited page is outside this editor.');
  clearSelection();
  await new Promise((resolve,reject)=>{
    const done=()=>{clearTimeout(timer);iframe.removeEventListener('load',done);resolve();};
    const timer=setTimeout(()=>{iframe.removeEventListener('load',done);reject(Error('The edited page did not finish loading.'));},10000);
    iframe.addEventListener('load',done);iframe.src=target.href;
  });
}
async function refreshSourceHistory(manifest) {
  const target=RetouchHistoryRender.targets(manifest,doc());
  if(!target){await reloadFrame();return;}
  const route=iframe.contentWindow.location.href;
  let stable=0;
  for(let attempt=0;attempt<40;attempt++){
    if(iframe.contentWindow.location.href!==route)return;
    try{
      const d=doc(),stylesReady=[...d.querySelectorAll('link[rel="stylesheet"]')].every(link=>link.disabled||!!link.sheet);
      stable=stylesReady&&RetouchHistoryRender.matches(target,d)?stable+1:0;
      if(stable>=3)return;
    }catch{stable=0;}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  // Frameworks may require a reload even with stable source identities. Wait
  // for the server-rendered revision before asking the canvas to load it.
  for(let attempt=0;attempt<20;attempt++){
    if(iframe.contentWindow.location.href!==route)return;
    try{
      const response=await fetch(route,{cache:'no-store'});
      if(response.ok&&RetouchHistoryRender.matches(target,new DOMParser().parseFromString(await response.text(),'text/html'))){await reloadFrame();return;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw Error('The restored source has not reached the preview yet.');
}
async function restoreHistory(direction,op) {
  if(op.type==='layerLock'){
    await showHistoryPage(op.route);
    const result=layerLocks.restoreMany(op.lockChanges||[op.lockChange],direction);
    if(result.ok){clearSelection();hoverEl=null;layers.refresh();toast(direction==='undo'?'Undone':'Redone','ok');}
    return result;
  }
  const result=await api('POST','/rt/__api/op',{type:direction,undoId:op.undoId});
  if(!result?.ok)return result;
  // Source history has already moved. A renderer failure must not leave the
  // client stack on the old side of a successful transaction.
  try {
    await showHistoryPage(op.route);
    if(['insertComponent','swapComponent'].includes(op.type)){if(op.sourceIdMap)layerLocks.remap(op.sourceIdMap,direction);const parentId=direction==='redo'?op.id:op.previousParentId,parent=parentId?await api('GET',resolveUrl(parentId)):null;if(op.type==='swapComponent')await refreshSwappedComponent(direction==='redo'?op.instanceId:op.previousInstanceId,parentId);else if(parent?.ok)await refreshWrittenElement(parent.element,()=>true);else await reloadFrame();if(direction==='redo')await selectInsertedComponent(op.instanceId,op.id);else if(op.type==='swapComponent')await selectInsertedComponent(op.previousInstanceId,op.previousParentId);else if(parent?.ok){sel={hostId:parentId,instanceId:null,scope:'host',info:parent.element};renderPanel();}else clearSelection();toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='moveComponent'){layerLocks.remap(op.sourceIdMap,direction);const id=direction==='undo'?op.previousInstanceId:op.id;await refreshSwappedComponent(id,null);await selectInsertedComponent(id,null);layers.refresh();toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.removedSourceIds&&direction==='redo')layerLocks.removeSourceIds(op.removedSourceIds);
    if(op.sourceIdMap)layerLocks.remap(op.sourceIdMap,direction);
    if(op.deletedLocks&&direction==='undo'){const restored=layerLocks.restoreMany(op.deletedLocks,'undo');if(!restored.ok)toast(restored.reason,'err');}
    if(op.type==='replaceSVGSelection'){await refreshSVGBooleanSelection(op.id,direction==='undo'?op.selectionBefore:op.selectionAfter);toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='renameComponent'){await refreshSwappedComponent(op.id,null);await selectInsertedComponent(op.id,null);layers.refresh();toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='deleteComponentSelection'){if(direction==='undo')await refreshComponentSelection(op.selectionBefore);else{await refreshDeletedComponent(op.deletedComponentIds,op.parentId);clearSelection();await layers.refresh();}toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='deleteComponent'){if(direction==='undo'){await refreshSwappedComponent(op.id,null);await selectInsertedComponent(op.id,op.parentId);}else{await refreshDeletedComponent(op.id,op.parentId);clearSelection();}toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='reparentComponentSelection'){await refreshComponentSelection(direction==='undo'?op.selectionBefore:op.selectionAfter);toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='duplicateComponentSelection'){await refreshComponentSelection(direction==='undo'?op.selectionBefore:op.selectionAfter);toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='duplicateComponent'){const id=direction==='redo'?op.instanceCopyId:op.instanceOriginalId;await refreshSwappedComponent(id,null);await selectInsertedComponent(id,null);toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='setComponentProp'){await refreshComponentProperty(op.id,op.parentId);toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='htmlGroupScale'){const resultInfo=await api('GET',resolveUrl(op.id));if(!resultInfo?.ok)throw Error('The scaled group no longer resolves.');try{await refreshHTMLGroupScale(resultInfo.element);}finally{await restoreLayerSelection([op.id]);if(sel)renderPanel();}return result;}
    if(op.type==='sourceHistory'){try{await refreshSourceHistory(result.renderRevisions);}finally{clearSelection();}toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='setComponentPropSelection'){await refreshComponentSelection(op.selectionIds);toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='moveGroup'){const results=await Promise.all(op.childIds.map(id=>api('GET',resolveUrl(id))));if(!results.every(r=>r?.ok))throw Error('The group contents no longer resolve.');try{await refreshGroupMove(results.map(r=>r.element),direction==='undo'?op.classesAfter:op.classesBefore);}finally{await restoreLayerSelection(op.selectionIds||[op.groupId]);if(sel)renderPanel();}return result;}
    if(op.type==='setLiquidClassesSelection'){const results=await Promise.all(op.selectionIds.map(id=>api('GET',resolveUrl(id))));if(!results.every(item=>item?.ok&&item.element.classSourceLiteral))throw Error('The literal class selection no longer resolves.');await refreshLiteralLiquidClasses(results.map(item=>item.element),direction==='undo'?op.classesAfter:op.classesBefore);await restoreLayerSelection(op.selectionIds);if(sel)renderPanel();toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='collectionSelection'){await reloadFrame();await restoreLayerSelection(op.selectionIds);if(sel)renderPanel();toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    const fresh = await api('GET', resolveUrl(op.id, op.context));
    if (fresh?.ok) { sel = { hostId: op.id, instanceId: null, scope: 'host', info: fresh.element }; renderPanel(); }
    else clearSelection();
    if (fresh?.ok) {
      const info = fresh.element;
      const selectionResult=(['setClassesSelection','setSVGTransforms'].includes(op.type)||op.type==='setCSSSelection'&&op.managedCSS)?await Promise.all(op.selectionIds.map(id=>api('GET',resolveUrl(id)))):null;
      const component = op.type === 'detachComponent'||op.type==='createComponent'&&direction==='redo' ? await api('GET', componentUrl(op.id,op.context)) : null;
      const refresh=()=>refreshWrittenElement(info, el => {
        if(selectionResult)return selectionResult.every(result=>result?.ok)&&(op.type==='setSVGTransforms'?svgSelectionMatches:classSelectionMatches)(selectionResult.map(result=>result.element),el.ownerDocument);
        if(op.svgCreatedId){const found=matchingInDocument(el.ownerDocument,op.svgCreatedId,null).length>0;return direction==='undo'?!found:found;}
        if(op.type==='createComponent'&&direction==='undo')return el.getAttribute('data-rt')===op.id;
        if (component?.ok) return (component.definitionIds || [component.definitionId]).includes(el.getAttribute('data-rt'));
        if (op.type === 'setSrc') return imageMatches(el,info.src,info.srcMatch);
        if (op.type === 'setSVGGradient') return svgGradientsMatch(el,info);
        if (op.type === 'setSVGGeometry') return svgGeometryMatches(el,info);
        if (op.type === 'setSVGTransform') return el.getAttribute('transform')===info.svgTransform?.value;
        if (['convertSVGToPath','convertSVGToArrow'].includes(op.type)) return el.tagName.toLowerCase()===info.tag&&svgGeometryMatches(el,info);
        if (op.type === 'setTag') return el.tagName.toLowerCase() === info.tag;
        if (op.type === 'setClasses' && !info.classNameDynamic) {
          const tokens = value => (value || '').split(/\s+/).filter(Boolean).sort().join(' ');
          return tokens(el.getAttribute('class')) === tokens(info.className);
        }
        return (info.className || '').split(/\s+/).filter(Boolean).every(t => el.classList.contains(t));
      },{classSource:['setClasses','setClassesSelection'].includes(op.type),verifyText:op.type==='setText'&&!info.textSource,imageSource:op.type==='setSrc',svgGeometry:['setSVGGeometry','setSVGTransform','setSVGTransforms'].includes(op.type)});
      if(op.type==='setImageFill'){await refreshLiquidImageFill(info);renderPanel();}
      else if(op.type==='setText'&&info.kind==='host'&&!info.textSource&&window.__RT_RENDERING?.reloadAfterWrite){
        await RetouchRenderSync.sync({frame:iframe,serverRendered:true,select:d=>matchingInDocument(d,info.id,info)});
      }else if(op.type==='setCSSSelection'&&op.managedCSS){if(!selectionResult?.every(item=>item?.ok&&item.element.cssAuthoring))throw Error('The restored CSS selection could not be resolved.');const infos=selectionResult.map(item=>item.element);await RetouchRenderSync.syncCSS({frame:iframe,entries:infos.map(item=>({id:item.id,rules:item.cssRules,texts:item.cssRuleTexts}))});await window.RetouchComparisons?.syncCSS(infos);}else if(op.type==='setCSS'&&op.managedCSS&&info.cssAuthoring)await RetouchRenderSync.syncCSS({frame:iframe,id:info.id,rules:info.cssRules,texts:info.cssRuleTexts});else await refresh();
      if(op.type==='setText')await window.RetouchComparisons?.syncText(info);
      if(op.type==='setCSS'&&op.managedCSS&&info.cssAuthoring)await window.RetouchComparisons?.syncCSS(info);
      if(op.type==='createComponent'&&component?.ok)sel={hostId:component.definitionId,instanceId:op.id,scope:'instance',info};
    } else await reloadFrame();

    const selectionIds=direction==='undo'?op.selectionBefore||op.selectionIds:op.selectionAfter||op.selectionIds;
    // Refresh can invalidate a stale occurrence and clear sel. History owns
    // the target selection independently of that temporary preview state.
    if(selectionIds)await restoreLayerSelection(selectionIds);
    if (sel) renderPanel();

  } catch(error){toast('Source restored; preview refresh failed: '+error.message,'err');}
  toast(direction==='undo'?'Undone':'Redone','ok');
  return result;
}

/* ---------- chrome ---------- */
modeBtn.onclick = () => {
  canvasPan.cancel();
  stopDrawing?.();
  mode = mode === 'edit' ? 'interact' : 'edit';
  modeBtn.textContent = mode === 'edit' ? 'Edit mode' : 'Interact mode';
  modeBtn.classList.toggle('mode-edit', mode === 'edit');
  if (mode === 'interact') { hoverEl = null; }
};
for(const button of [undoBtn,redoBtn])button.addEventListener('pointerdown',event=>{if(editing)event.preventDefault();});
undoBtn.onclick = () => undo();
redoBtn.onclick = () => redo();
routeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') navigatePage(routeInput.value || '/');
});
window.addEventListener('keydown', (e) => {
  if(e.key==='Escape'){vectorEntrySerial++;if(pendingVectorEntry){pendingVectorEntry=null;e.preventDefault();return;}}
  if(groupNudgeShortcut(e)||vectorNudgeShortcut(e)||flipShortcut(e)||alignmentShortcut(e)||opacityShortcut(e)||visibilityShortcut(e)||canvasZoomShortcut(e)||lockShortcut(e)||(e.key==='Enter'&&e.target.closest?.('[role=treeitem][aria-selected="true"]')&&layerNavigationShortcut(e))||((e.metaKey||e.ctrlKey)&&['[',']','{','}'].includes(e.key)&&canvasLayerShortcut(e)))return;
  if (document.querySelector('dialog[open]')) return;
  if (e.key === 'Alt') measuring = true;
  if(sourceHistoryShortcut(e))return;
  if (e.key === 'Escape') {
    const paintPopover=document.querySelector('.image-paint-popover:popover-open');if(paintPopover){e.preventDefault();paintPopover.querySelector('header > button')?.click();return;}
    if(stopDrawing){e.preventDefault();stopDrawing();return;}
    if(e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return;
    if(window.RetouchWorkspacePanels?.closeIfOpen()){e.preventDefault();return;}
    clearSelection();
  }
});
window.addEventListener('keyup', (e) => { if (!e.altKey) measuring = false; });
window.addEventListener('blur', () => { measuring = false; });

/* ---------- util ---------- */
async function api(method, url, body) {
  const writes = method === 'POST' && ['/rt/__api/op','/rt/__api/text-styles','/rt/__api/color-styles','/rt/__api/effect-styles','/rt/__api/variables'].includes(url);
  const route = writes ? currentPageRoute() : null;
  if(writes&&historyRecoveryRequired)return {ok:false,reason:'Source recovery is required before editing can resume.'};
  if(writes && editorHistory.busy && !['undo','redo'].includes(body?.type)) return {ok:false,reason:'Wait for history restoration to finish.'};
  if(writes){sourceRequests++;syncHistoryControls();}
  try {
    // History must remain usable to recover from a change that cannot mount.
    if(writes&&!(url==='/rt/__api/op'&&['undo','redo'].includes(body?.type))&&!await waitForClientMount(doc()))return {ok:false,reason:'The preview has not finished mounting. Wait for it to load before editing.'};
    const res = await fetch(url, {
      method,
      headers: { 'x-retouch-token': TOKEN, ...(route?{'x-retouch-route':encodeURIComponent(route)}:{}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result=await res.json();
    if(Object.hasOwn(result,'historyPersistenceError'))showHistoryPersistence(result.historyPersistenceError,!!result.historyRecoveryRequired);
    if(writes&&result.ok&&result.undoId&&!['undo','redo'].includes(body?.type)){
      if(!historyRoutes.has(result.undoId))historyRoutes.set(result.undoId,route);
      while(historyRoutes.size>200)historyRoutes.delete(historyRoutes.keys().next().value);
    }
    return result;
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {if(writes){sourceRequests--;syncHistoryControls();}}
}

function toast(msg, cls, kind) {
  if(kind)document.querySelectorAll('#toasts .toast').forEach(el=>{if(el.dataset.kind===kind)el.remove();});
  if (cls === 'ok') document.querySelectorAll('#toasts .toast.ok').forEach(el=>el.remove());
  const t = document.createElement('div');
  t.className = 'toast ' + (cls || '');
  t.textContent = msg;
  if(kind)t.dataset.kind=kind;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), cls === 'err' ? 6000 : 1800);
  statusEl.textContent = msg;
  statusEl.title = msg;
}


window.RetouchCanvasHint={show(message,details){
  const previous={message:statusEl.textContent,details:statusEl.title};
  document.querySelectorAll('#toasts .toast.ok').forEach(el=>el.remove());
  statusEl.textContent=message;statusEl.title=details;
  return ()=>{if(statusEl.textContent===message&&statusEl.title===details){statusEl.textContent=previous.message;statusEl.title=previous.details;}};
}};


RetouchMaxWidth.mount({
  container: overlayLayer.parentElement,
  getTarget() {
    if (mode !== 'edit' || undoBusy || sourceRequests || !sel || sel.multiple?.length>1 || sel.info.classNameDynamic || sel.info.kind === 'instance') return null;
    const el = editing?.el || matchingEls(activeId()).find(el => inTextScope(el, sel.info));
    return el ? { el, info: scopedInfo(sel.info) } : null;
  },
  beforeDrag: commitInlineEdit,
  save: classes => setClasses(classes),
  notify: message => toast(message, 'err'),
});


async function setLayerLocks(el,value){
  if(panelTasks||undoBusy||sourceRequests)return;
  await commitInlineEdit();stopDrawing?.();
  const lockChanges=layerLocks.changeMany(Array.isArray(el)?el:[el],value);if(!lockChanges.length)return;
  editorHistory.record({type:'layerLock',undoId:'lock:'+crypto.randomUUID(),route:lockChanges[0].route,lockChanges});hoverEl=null;
  if(value)clearSelection();
  layers.refresh();
  toast(value?'Selection locked on the canvas. Use Layers or the Select layer menu to select it.':'Selection unlocked.','ok');
}
function flipShortcut(e){
 if(e.defaultPrevented||e.isComposing||!e.shiftKey||e.metaKey||e.ctrlKey||e.altKey||!['h','v'].includes(e.key.toLowerCase()))return false;
 if(mode!=='edit'||editing||stopDrawing||canvasPan.active||!sel||panelTasks||undoBusy||sourceRequests||e.target.isContentEditable||e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="menu"]')||document.querySelector('dialog[open]'))return false;
 const button=panelBody.querySelector('[data-flip-axis="'+(e.key.toLowerCase()==='h'?'x':'y')+'"]');if(!button||button.matches(':disabled')||button.closest('[inert]'))return false;
 e.preventDefault();e.stopPropagation();if(!e.repeat)button.click();return true;
}
function alignmentShortcut(e){
 const alignment=window.RetouchSelectionLayout?.alignmentKey(e);
 if(!alignment||mode!=='edit'||editing||stopDrawing||canvasPan.active||!sel||panelTasks||undoBusy||sourceRequests||e.target.isContentEditable||e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="menu"]')||document.querySelector('dialog[open]'))return false;
 const button=panelBody.querySelector('[data-align="'+alignment+'"]');if(!button||button.matches(':disabled')||button.closest('[inert]'))return false;
 e.preventDefault();e.stopPropagation();if(!e.repeat)button.dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:e.shiftKey}));return true;
}
function canvasLayerShortcut(e){
 if(e.defaultPrevented||e.isComposing||e.altKey||mode!=='edit'||editing||!sel||e.target.isContentEditable||e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')||document.querySelector('dialog[open]'))return false;
 const mod=e.metaKey||e.ctrlKey,key=e.key.toLowerCase(),bracket=mod&&['[',']','{','}'].includes(key);
 if(e.shiftKey&&!bracket)return false;
 const id=bracket?(['[','{'].includes(key)?(e.shiftKey?'layer-first':'layer-before'):(e.shiftKey?'layer-last':'layer-after')):mod?{c:'layer-copyElement',v:'layer-pasteElement',d:'layer-duplicateElement'}[key]:key==='f2'?'rename-layer':['delete','backspace'].includes(key)?'layer-deleteElement':null;
 if(!id)return false;e.preventDefault();e.stopPropagation();
 if(!e.repeat&&!panelTasks&&!undoBusy&&!sourceRequests)window.RetouchActions?.run(id);
 return true;
}
function layerNavigationShortcut(e){
  if(e.defaultPrevented||e.isComposing||e.metaKey||e.ctrlKey||e.altKey||!['Enter','Tab'].includes(e.key)||mode!=='edit'||editing||!sel||sel.multiple?.length>1||e.target.isContentEditable||e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')||document.querySelector('dialog[open]'))return false;
  e.preventDefault();e.stopPropagation();if(e.repeat||panelTasks||undoBusy||sourceRequests)return true;
  if(e.key==='Enter'&&!e.shiftKey&&editableVectorField(sel.info)){void editSVGPoints(sel.info).catch(error=>toast(error.message,'err'));return true;}
  const textTarget=renderedSelection?.element;
  if(e.key==='Enter'&&!e.shiftKey&&textTarget&&layers.isTextLayer(textTarget)&&!layerLocks.locked(textTarget)&&sel.scope!=='instance'){void startInlineEdit(textTarget,null,true).then(()=>{if(editing?.el===textTarget){const range=textTarget.ownerDocument.createRange();range.selectNodeContents(textTarget);const selection=textTarget.ownerDocument.getSelection();selection.removeAllRanges();selection.addRange(range);}}).catch(error=>toast(error.message,'err'));return true;}
  const direction=e.key==='Enter'?(e.shiftKey?'parent':'child'):(e.shiftKey?'previous':'next');void layers.navigate(direction).catch(error=>toast(error.message,'err'));return true;
}
function sourceHistoryShortcut(e,canvas=false){
  if(e.defaultPrevented||e.isComposing||e.altKey||!(e.metaKey||e.ctrlKey)||canvas&&mode!=='edit'||e.target.isContentEditable||e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')||document.querySelector('dialog[open]'))return false;
  const key=e.key.toLowerCase();if(key!=='z'&&(key!=='y'||e.shiftKey))return false;
  e.preventDefault();e.stopPropagation();if(key==='y'||e.shiftKey)redo();else undo();return true;
}
let opacityEntry=null;
function cancelOpacityEntry(){if(opacityEntry){clearTimeout(opacityEntry.timer);opacityEntry=null;}}
document.addEventListener('pointerdown',cancelOpacityEntry,true);
window.addEventListener('blur',cancelOpacityEntry);
function opacityShortcut(e){
  if(opacityEntry&&(e.key==='Escape'||(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z')){cancelOpacityEntry();e.preventDefault();e.stopImmediatePropagation();return true;}
  if(e.defaultPrevented||e.isComposing||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey||!/^\d$/.test(e.key)){cancelOpacityEntry();return false;}
  if(mode!=='edit'||editing||!sel||e.target.isContentEditable||document.querySelector('dialog[open]')||e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')||e.target.ownerDocument===document&&e.target.closest?.('button,[role="button"],#screenToolbar')){cancelOpacityEntry();return false;}
  const input=panelBody.querySelector('input[aria-label="Shared Opacity (%)"],input[aria-label="Opacity (%)"]');
  if(!input||input.matches(':disabled')||input.closest('[inert]')){cancelOpacityEntry();return false;}
  e.preventDefault();e.stopImmediatePropagation();
  if(e.repeat||panelTasks||undoBusy||sourceRequests)return true;
  const key=JSON.stringify([(sel.multiple||[sel.info]).map(info=>[info.id,info.fileHash||info.hash]).sort(),styleScope]);
  let digits=opacityEntry?.key===key?opacityEntry.digits+e.key:e.key;
  if(digits.length>3||Number(digits)>100)digits=e.key;
  cancelOpacityEntry();
  const entry={key,digits};opacityEntry=entry;
  entry.timer=setTimeout(()=>{
    if(opacityEntry!==entry)return;opacityEntry=null;
    const target=panelBody.querySelector('input[aria-label="Shared Opacity (%)"],input[aria-label="Opacity (%)"]');
    if(!target||target.matches(':disabled')||target.closest('[inert]')||mode!=='edit'||editing||!sel||panelTasks||undoBusy||sourceRequests||document.querySelector('dialog[open]')||key!==JSON.stringify([(sel.multiple||[sel.info]).map(info=>[info.id,info.fileHash||info.hash]).sort(),styleScope]))return;
    target.value=String(digits.length===1?(digits==='0'?100:Number(digits)*10):Number(digits));target.dispatchEvent(new Event('change',{bubbles:true}));
  },450);
  return true;
}
function visibilityShortcut(e){
  if(e.defaultPrevented||e.isComposing||!(e.metaKey||e.ctrlKey)||!e.shiftKey||e.altKey||e.key.toLowerCase()!=='h')return false;
  if(mode!=='edit'||editing||!sel||e.target.isContentEditable||document.querySelector('dialog[open]')||e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return false;
  const input=panelBody.querySelector('select[aria-label="Shared Visibility"],select[aria-label="Visibility"],input[aria-label="Visible layer"]');
  if(!input||input.matches(':disabled')||input.closest('[inert]'))return false;
  e.preventDefault();e.stopImmediatePropagation();
  if(e.repeat||panelTasks||undoBusy||sourceRequests)return true;
  if(input.type==='checkbox')input.checked=!input.checked;else input.value=['hidden','collapse'].includes(input.value)?'visible':'hidden';
  input.dispatchEvent(new Event('change',{bubbles:true}));return true;
}
function canvasZoomShortcut(e){
  if(!e.shiftKey||e.metaKey||e.ctrlKey||e.altKey||!['Digit1','Digit2'].includes(e.code))return false;
  if(mode!=='edit'||editing||e.target.isContentEditable||document.querySelector('dialog[open]')||e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return false;
  e.preventDefault();e.stopImmediatePropagation();
  if(e.repeat||panelTasks||undoBusy||sourceRequests)return true;
  const button=document.getElementById(e.code==='Digit1'?'fitScreen':'zoomSelection');
  if(!button.disabled)button.click();
  return true;
}
function lockShortcut(e){
  if(!(e.metaKey||e.ctrlKey)||!e.shiftKey||e.altKey||e.key.toLowerCase()!=='l')return false;
  if(mode!=='edit'||editing||e.target.isContentEditable||document.querySelector('dialog[open]')||e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return false;
  e.preventDefault();e.stopImmediatePropagation();
  if(e.repeat||panelTasks||undoBusy||sourceRequests||!sel)return true;
  const elements=sel.multiple?sel.multiple.flatMap(info=>matchingEls(info.id)):matchingEls(activeId());
  if(elements.length)void setLayerLocks(elements,!elements.every(el=>layerLocks.direct(el)));
  return true;
}

document.getElementById('zoomSelection').onclick=async e=>{
  if(!sel||panelTasks||undoBusy||sourceRequests)return;
  const button=e.currentTarget;
  await commitInlineEdit();if(!sel||panelTasks||undoBusy||sourceRequests)return;stopDrawing?.();
  const elements=sel.multiple?sel.multiple.flatMap(info=>matchingEls(info.id)):sel.info.kind==='instance'?selectedComponentGroups(doc(),activeId(),sel.info)[0]?.elements||[]:matchingEls(activeId()).filter(el=>inTextScope(el,sel.info)).slice(0,1);
  busyPanel(true);button.setAttribute('aria-busy','true');
  try{
    const result=await window.RetouchZoom.toSelection(elements);
    if(!result.ok)toast(result.reason,'err');else if(result.clipped)toast('Some selected layers extend beyond the current screen viewport.');
  }catch(error){toast(error.message,'err');}finally{button.setAttribute('aria-busy','false');busyPanel(false);}
};

let layerClipboard=null;
const layers = RetouchLayers.mount({
  canSelectWhileBusy:()=>!!inspectorTextCommit&&!panelTasks&&!undoBusy&&!historyRecoveryRequired,
  readComponents:window.__RT_RENDERING?.componentInsertion?()=>api('GET','/rt/__api/components'):undefined,
  locks:layerLocks,
  onLock:setLayerLocks,
  getClipboard:()=>layerClipboard,
  dragEnabled:window.__RT_RENDERING?.layerReparenting===true&&!historyRecoveryRequired,
  multiSelectEnabled:window.__RT_RENDERING?.selectionStyling===true,
  onMoveComponent:window.__RT_RENDERING?.componentInsertion&&!historyRecoveryRequired?async(source,destination,position,move)=>{
    if(historyRecoveryRequired||panelTasks||undoBusy||sourceRequests||!source.isConnected||!destination.isConnected||layerLocks.locked(source)||(position==='inside'?layerLocks.locked(destination):layerLocks.locked(destination.parentElement)))return;
    await commitInlineEdit();
    if(move.ids?.length>1){const infos=sel?.multiple;if(!['inside','before','after'].includes(position)||!infos||infos.length!==move.ids.length||infos.some(info=>!move.ids.includes(info.id)||info.hash!==move.fileHash)||!(position==='inside'?sharedComponentContainers(infos):sharedComponentTargets(infos)).includes(move.destinationId)||infos.some(info=>matchingEls(info.id).some(el=>layerLocks.locked(el))))return;await reparentComponentSelection(infos,move.destinationId,position);return;}
    await moveInstance({id:move.id,hash:move.fileHash},position,move.destinationId);
  }:undefined,
  onMove:async(source,destination,position)=>{
    if(historyRecoveryRequired||panelTasks||undoBusy||sourceRequests||!source.isConnected||!destination.isConnected)return;
    await commitInlineEdit();if(sel?.multiple?.some(info=>info.id===source.getAttribute('data-rt')))return structureSelection('reparentElement',{destinationId:destination.getAttribute('data-rt'),position});await select(source);
    if(!sel?.info.structure?.canReparent)return toast(sel?.info.structure?.reason||'This layer cannot be moved into another container.','err');
    await moveLayerInto(sel.info,destination.getAttribute('data-rt'),position);
  },
  host:document.getElementById('layersPanel'),
  onSelect:async(el,options)=>{
    const serial=++inspectorSelectionSerial,pending=inspectorTextCommit,target=captureInspectorSelectionTarget(el,options?.sourceId);
    if(pending)await pending;
    if(serial!==inspectorSelectionSerial||panelTasks||undoBusy||sourceRequests)return;
    el=target();if(!el)return;
    await commitInlineEdit();if(options?.component&&options.sourceId)componentLibrarySelections.add(options.sourceId);await select(el,options);el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  },
  onSelectMany:async(nodes,options)=>{if(panelTasks||undoBusy||sourceRequests)return;await commitInlineEdit();await selectMany(nodes,options);},
  onAction:action=>structureAction(action),
  onContextMenu:async({event,select:choose,selected,opener,keyboard})=>{
    if(event.defaultPrevented||event.isComposing||mode!=='edit'||editing||panelTasks||undoBusy||sourceRequests||document.querySelector('dialog[open]'))return;
    event.preventDefault();event.stopPropagation();const serial=++canvasContextSerial;
    try{if(!selected)await choose();if(serial!==canvasContextSerial||mode!=='edit'||!sel||!opener.isConnected)return;const box=opener.getBoundingClientRect();window.RetouchActions?.contextMenu({x:keyboard?box.left:event.clientX,y:keyboard?box.bottom:event.clientY,opener});}catch(error){toast(error.message,'err');}
  },
});
window.RetouchLayerNavigation={
  available:direction=>mode==='edit'&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests&&(direction==='siblings'?layers.canSelectSiblings():layers.canNavigate(direction)),
  run:direction=>{if(window.RetouchLayerNavigation.available(direction))return (direction==='siblings'?layers.selectSiblings():layers.navigate(direction)).catch(error=>toast(error.message,'err'));}
};
function sharedComponentContainers(infos){
 const candidates=infos[0]?.componentMovement?.selectionContainers||infos[0]?.componentMovement?.containers||[];
 return candidates.filter(id=>infos.every(info=>(info.componentMovement?.selectionContainers||info.componentMovement?.containers||[]).includes(id)));
}
function sharedNativeFraming(infos){
 if(infos.length<2||new Set(infos.map(info=>info.file+'#'+info.hash)).size!==1||infos.some(info=>info.kind!=='host'))return false;
 const matches=infos.map(info=>matchingEls(info.id));if(matches.some(nodes=>nodes.length!==1))return false;
 const all=matches.map(nodes=>nodes[0]),nodes=all.filter(node=>!all.some(other=>other!==node&&other.contains(node))),roots=nodes.map(node=>infos[all.indexOf(node)]),parent=nodes[0]?.parentElement;
 if(!parent||nodes.some(node=>node.parentElement!==parent)||roots.some(info=>!info.structure?.canFrame||!info.structure?.parentId)||new Set(roots.map(info=>info.structure.parentId)).size!==1)return false;
 const siblings=[...parent.children],indices=nodes.map(node=>siblings.indexOf(node)).sort((a,b)=>a-b);return indices.every((at,i)=>at===indices[0]+i);
}
function sharedNativeOrdering(infos){
 const unavailable={before:false,after:false,first:false,last:false};
 if(infos.length<2||new Set(infos.map(info=>info.file+'#'+info.hash)).size!==1||infos.some(info=>info.kind!=='host'))return unavailable;
 const matches=infos.map(info=>matchingEls(info.id));if(matches.some(nodes=>nodes.length!==1))return unavailable;const all=matches.map(nodes=>nodes[0]),nodes=all.filter(node=>!all.some(other=>other!==node&&other.contains(node))),roots=nodes.map(node=>infos[all.indexOf(node)]);
 if(new Set(roots.map(info=>info.structure?.parentId)).size!==1||roots.some(info=>!info.structure?.canDelete||!info.structure?.parentId))return unavailable;
 const parent=nodes[0]?.parentElement;if(!parent||nodes.some(node=>node.parentElement!==parent))return unavailable;
 const siblings=[...parent.children].filter(node=>node.hasAttribute('data-rt')),selected=new Set(nodes),before=siblings.some((node,i)=>selected.has(node)&&siblings.slice(0,i).some(other=>!selected.has(other))),after=siblings.some((node,i)=>selected.has(node)&&siblings.slice(i+1).some(other=>!selected.has(other)));return {before,after,first:before,last:after};
}
function sharedComponentOrdering(infos){
 const siblings=infos[0]?.componentMovement?.siblingIds,ids=new Set(infos.map(info=>info.id));if(!siblings||!infos.every(info=>siblings.includes(info.id)&&JSON.stringify(info.componentMovement?.siblingIds)===JSON.stringify(siblings)))return {};
 const first=siblings.findIndex(id=>ids.has(id)),last=siblings.findLastIndex(id=>ids.has(id)),gaps=last-first+1>ids.size;
 return {before:first>0,after:last<siblings.length-1,first:first>0||gaps,last:last<siblings.length-1||gaps};
}
function sharedComponentTargets(infos){const targets=info=>[...new Set([...(info.componentMovement?.targets||[]),...(info.componentMovement?.crossTargets||[])])];return targets(infos[0]).filter(id=>!infos.some(info=>info.id===id)&&infos.every(info=>targets(info).includes(id)));}
async function reparentComponentSelection(infos,destinationId,direction='inside'){
 if(panelTasks||undoBusy||sourceRequests)return;const ids=infos.map(info=>info.id);busyPanel(true);
 try{
  const result=await api('POST','/rt/__api/op',{type:'reparentComponentSelection',id:ids[0],ids,destinationId,direction,fileHash:infos[0].hash});if(!result?.ok)throw Error(result?.reason||'Could not move the selected components.');
  if(result.unchanged)return toast('The selected components are already in this position.','ok');
  editorHistory.record({type:'reparentComponentSelection',id:ids[0],selectionBefore:ids,selectionAfter:result.selectionIds,sourceIdMap:result.sourceIdMap,undoId:result.undoId});layerLocks.remap(result.sourceIdMap);
  await refreshComponentSelection(result.selectionIds);toast(result.rootCount+' components moved','ok');
 }catch(error){toast(error.message,'err');}finally{busyPanel(false);}
}
function chooseComponentParent(info){
 const selection=sel?.multiple?.length>1?sel.multiple:[info],group=selection.length>1,ids=new Set(group?sharedComponentContainers(selection):info.componentMovement?.containers||[]),candidates=[...doc().querySelectorAll('[data-rt]')].filter(el=>ids.has(el.getAttribute('data-rt'))&&!layerLocks.locked(el));
 if(!candidates.length)return toast('No compatible container is visible on this page.','err');
 const modal=document.createElement('dialog'),heading=document.createElement('h3');heading.textContent=group?'Move components into':'Move component into';modal.setAttribute('aria-label',heading.textContent);modal.className='layer-move-dialog';modal.append(heading);
 const picker=document.createElement('select');picker.setAttribute('aria-label','Destination container');const seen=new Set();for(const el of candidates){const id=el.getAttribute('data-rt');if(seen.has(id))continue;seen.add(id);const option=document.createElement('option');option.value=id;option.textContent=RetouchLayers.label(el);picker.append(option);}modal.append(picker);
 const close=()=>{modal.close();modal.remove();};modal.append(RetouchInspector.button(group?'Move components':'Move component',()=>{const destinationId=picker.value;close();if(group)reparentComponentSelection(selection,destinationId);else moveInstance(info,'inside',destinationId);}),RetouchInspector.button('Cancel',close));modal.addEventListener('cancel',()=>modal.remove());document.body.append(modal);modal.showModal();picker.focus();
}
function chooseLayerParent(info){
  const selected=matchingEls(info.id)[0];if(!selected)return;
  const sources=sel.multiple?sel.multiple.map(info=>matchingEls(info.id)[0]).filter(Boolean):[selected];
  const candidates=[...doc().querySelectorAll('[data-rt]')].filter(el=>RetouchLayers.canNestMany(sources,el));
  if(!candidates.length)return toast('No other content container is available on this page.','err');
  const modal=document.createElement('dialog'),heading=document.createElement('h3');heading.textContent=sources.length>1?'Move layers into':'Move layer into';modal.className='layer-move-dialog';modal.append(heading);
  const picker=document.createElement('select');picker.setAttribute('aria-label','Destination container');
  for(const el of candidates){const option=document.createElement('option');option.value=el.getAttribute('data-rt');option.textContent=RetouchLayers.label(el);picker.append(option);}modal.append(picker);
  const close=()=>{modal.close();modal.remove();};
  modal.append(RetouchInspector.button('Move layer',()=>{const destinationId=picker.value;close();if(sources.length>1)structureSelection('reparentElement',{destinationId,position:'inside'});else moveLayerInto(info,destinationId);}),RetouchInspector.button('Cancel',close));
  modal.addEventListener('cancel',()=>modal.remove());document.body.append(modal);modal.showModal();picker.focus();
}
async function moveLayerInto(info,destinationId,position='inside'){
  busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/op',{type:'reparentElement',id:info.id,fileHash:info.hash,destinationId,position});
    if(!result?.ok)return toast(result?.reason||result?.error||'Could not move layer','err');
    editorHistory.record({type:'structureSelection',id:result.parentId,selectionBefore:[info.id],selectionAfter:[result.movedId],sourceIdMap:result.sourceIdMap,undoId:result.undoId});
    if(result.sourceIdMap)layerLocks.remap(result.sourceIdMap);if(/\.[jt]sx$/i.test(info.file)){const parent=await api('GET',resolveUrl(result.parentId));if(!parent?.ok)throw Error('The moved parent could not be resolved.');await refreshWrittenElement(parent.element,()=>true);}else await reloadFrame();
    const fresh=await api('GET',resolveUrl(result.movedId));if(fresh?.ok){sel={hostId:result.movedId,instanceId:null,scope:'host',info:fresh.element};renderPanel();}
    toast('Layer moved','ok');
  }finally{busyPanel(false);}
}
async function prepareVectorCanvas(info,target){
  if(mode!=='edit')modeBtn.click();canvasPan.cancel();
  // Keep handles away from the clipped canvas edge without changing site size or zoom.
  const f=iframe.getBoundingClientRect(),c=canvasSurface.getBoundingClientRect(),r=RetouchSVGResize.screenBounds(target),scale=f.width/iframe.contentWindow.innerWidth;
  const left=f.left+r.left*scale,top=f.top+r.top*scale,right=f.left+r.right*scale,bottom=f.top+r.bottom*scale;
  if(r.width*scale+24<c.width)canvasSurface.scrollLeft+=left<c.left+12?left-c.left-12:right>c.right-12?right-c.right+12:0;
  if(r.height*scale+24<c.height)canvasSurface.scrollTop+=top<c.top+12?top-c.top-12:bottom>c.bottom-12?bottom-c.bottom+12:0;
  let cancelled=false;
  const cancelPending=()=>{cancelled=true;if(stopDrawing===cancelPending)stopDrawing=null;};
  stopDrawing=cancelPending;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(cancelled)return false;
  stopDrawing=null;
  return sel?.info===info&&mode==='edit'&&!panelTasks&&!undoBusy&&!sourceRequests&&!editing&&target.isConnected;
}
function openPendingVectorEntry(){
  if(panelTasks||!pendingVectorEntry)return;
  const {info,serial}=pendingVectorEntry;pendingVectorEntry=null;
  if(sel?.info===info&&classificationSerial===serial)void editSVGPoints(info).catch(error=>toast(error.message,'err'));
}
function editableVectorField(info){
  const field=info.svgGeometry?.fields.find(field=>['points','d'].includes(field.name));
  if(!field||field.editable===false)return null;
  const points=field.name==='d'?RetouchSVGPath.parseCompound(field.value)?.subpaths[0].nodes:RetouchSVGPoints.parse(field.value);
  return points?.length>=2?field:null;
}
async function editSVGPoints(info){
  if(panelTasks||undoBusy||sourceRequests||editing)return;
  stopDrawing?.();
  const targets=matchingEls(info.id),field=info.svgGeometry?.fields.find(field=>['points','d'].includes(field.name)),pathData=field?.name==='d'?RetouchSVGPath.parseCompound(field.value):null,points=pathData?.subpaths[0].nodes||RetouchSVGPoints.parse(field?.value);
  if(targets.length!==1)return toast('Select a vector rendered once to edit its points.','err');
  if(!points||points.length<2||field.editable===false)return;
  const target=targets[0];
  if(field.name==='d'?!RetouchSVGPath.equivalentCompound(pathData,RetouchSVGPath.parseCompound(target.getAttribute('d'))):target.getAttribute(field.name)!==field.value)return toast('The vector changed. Re-select it before editing.','err');
  if(!await prepareVectorCanvas(info,target))return;
  stopDrawing=RetouchSVGVertices.mount({target,points,pathData,propertiesPane:panelBody,frame:iframe,canvas:canvasSurface,
    onCommit:value=>{if(sel?.info===info)setSVGGeometry(field.name,value);},
    onEnd:()=>{stopDrawing=null;if(panelRenderDeferred)queueViewportPanelRefresh();},onError:message=>toast(message,'err')});
}
async function startCreationAt(target,point,action){
 const serial=++creationEntrySerial,documentBefore=doc(),valid=()=>serial===creationEntrySerial&&armedCanvasTool===action&&doc()===documentBefore&&target.isConnected&&mode==='edit'&&!canvasPan.active;
 preparingShapeDrag=true;
 try{
  for(let candidate=target;candidate&&valid();candidate=candidate.parentElement?.closest('[data-rt]')){
   if(layerLocks.locked(candidate))return;
   await select(candidate,{current:valid});if(!valid())return;
   if(action==='text'){
    const element=renderedSelection?.element,info=sel?.info;
    if(info?.structure?.canInsert&&element?.contains(target)&&matchingEls(info.id).length===1){
     try{const space=RetouchSVGDraw.nativeSpace(element),w=element.ownerDocument.defaultView,p=new w.DOMPoint(point.x,point.y).matrixTransform(space.matrix.inverse());if(!valid()||!space.current())return;setArmedCanvasTool(null);await insertLayer('text',info,'insertElement',{position:{x:p.x,y:p.y}});}catch(error){toast(error.message,'err');}return;
    }
    continue;
   }
   if((action==='pen'?sel?.info.svgInsertion?.pen:sel?.info.svgInsertion?.presets.includes(action.slice(5)))&&renderedSelection?.element?.contains(target)&&!layerLocks.locked(renderedSelection.element)){
    const info=sel.info;setArmedCanvasTool(null);if(action==='pen')await drawVector(info,point);else await drawShape(action.slice(5),info,point);return;
   }
  }
  if(valid())toast('Choose an editable container to create a layer in.','err');
 }finally{preparingShapeDrag=false;}
}
async function drawVector(info,initialPoint=null){
  if(panelTasks||undoBusy||sourceRequests||editing)return;
  stopDrawing?.();const targets=matchingEls(info.id);
  if(targets.length!==1)return toast('Select a container rendered once to draw into.','err');
  if(!await prepareVectorCanvas(info,targets[0]))return;
  stopDrawing=RetouchSVGPen.mount({target:targets[0],frame:iframe,canvas:canvasSurface,native:info.svgInsertion.createsViewport,initialPoint,
    onCommit:(points,closed,nodes)=>insertLayer(nodes?'path':closed?'polygon':'polyline',info,'insertSVG',{...(nodes?{nodes,closed}:{points}),...(info.svgInsertion.createsViewport?{nativeCanvas:true}:{})}),
    onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});
}
async function drawShape(preset,info,initialPoint=null){
  if(panelTasks||undoBusy||sourceRequests||editing)return;
  stopDrawing?.();
  const target=matchingEls(info.id)[0];if(!target)return;
  if(!await prepareVectorCanvas(info,target))return;
  stopDrawing=RetouchSVGDraw.mount({target,frame:iframe,canvas:canvasSurface,preset,native:info.svgInsertion.createsViewport,initialPoint,
    onCommit:points=>insertLayer(preset,info,'insertSVG',{points,...(info.svgInsertion.createsViewport?{nativeCanvas:true}:{})}),
    onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});
  if(stopDrawing)toast('Drag to draw '+preset+'. Space repositions; Shift constrains; Option/Alt draws from center. Escape cancels.','ok');
}
async function insertLayer(preset,info,type='insertElement',extra={}){
  if(panelTasks||undoBusy||sourceRequests)return;
  let textTarget=null;
  busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/op',{type,id:info.id,fileHash:info.fileHash||info.hash,preset,...extra});
    if(!result?.ok)return toast(result?.reason||result?.error||'Could not add layer','err');
    editorHistory.record({type:'structureSelection',id:info.id,selectionBefore:[info.id],selectionAfter:[result.createdId],undoId:result.undoId,...(type==='insertSVG'?{svgCreatedId:result.createdId}:{})});
    const fresh=await api('GET',resolveUrl(result.createdId));
    if(fresh?.ok)await refreshWrittenElement(fresh.element,el=>el.getAttribute('data-rt')===result.createdId);else await reloadFrame();
    if(fresh?.ok){sel={hostId:result.createdId,instanceId:null,scope:'host',info:fresh.element};renderPanel();if(type==='insertElement'&&preset==='text')textTarget=matchingEls(result.createdId)[0];}
    toast('Layer added','ok');
  }finally{busyPanel(false);}
  if(textTarget?.isConnected&&mode==='edit'&&sel?.hostId===textTarget.getAttribute('data-rt')){
    await startInlineEdit(textTarget,null,true);
    if(editing?.el===textTarget){const d=textTarget.ownerDocument,range=d.createRange(),selection=d.getSelection();range.selectNodeContents(textTarget);selection.removeAllRanges();selection.addRange(range);}
  }
}
async function restoreLayerSelection(ids){
  const selected=await Promise.all(ids.map(id=>{const element=matchingEls(id)[0];return api('GET',resolveUrl(id,element?renderContext(element):undefined));}));
  if(!selected.length||selected.some(result=>!result?.ok))return;
  const infos=selected.map(result=>result.element),first=infos[0];sel={hostId:first.id,instanceId:first.kind==='instance'?first.id:null,scope:first.kind==='instance'?'instance':'host',info:first,multiple:infos.length>1?infos:undefined};
}
async function structureSelection(action,extra={}){
  if(sel.multiple?.length>1&&!sel.info.cssAuthoring&&!['duplicateElement','deleteElement','moveSelection','reparentElement','frameSelection','groupSelection'].includes(action))return toast('This structural action is not available for these source layers yet.','err');
  const selection=sel.multiple||[sel.info],info=sel.info;busyPanel(true);
  try{
    const type=['frameSelection','groupSelection','removeFrame','moveSelection'].includes(action)?action:action==='duplicateElement'?'duplicateSelection':action==='deleteElement'?'deleteSelection':'reparentSelection';
    const result=await api('POST','/rt/__api/op',{type,id:info.id,ids:selection.map(item=>item.id),fileHash:info.hash,...extra});
    if(!result?.ok)return toast(result?.reason||result?.error||'Could not update selected layers','err');
    const deletedLocks=result.removedSourceIds?layerLocks.removeSourceIds(result.removedSourceIds):null;
    editorHistory.record({type:'structureSelection',id:result.parentId,selectionBefore:selection.map(item=>item.id),selectionAfter:result.selectionIds,undoId:result.undoId,...(result.sourceIdMap?{sourceIdMap:result.sourceIdMap}:{}),...(deletedLocks?{deletedLocks,removedSourceIds:result.removedSourceIds}:{})});
    if(result.sourceIdMap)layerLocks.remap(result.sourceIdMap);
    if(/\.[jt]sx$/i.test(info.file)){const parent=await api('GET',resolveUrl(result.parentId));if(!parent?.ok)throw Error('The edited source parent no longer resolves.');await refreshWrittenElement(parent.element,()=>true);}else await reloadFrame();await restoreLayerSelection(result.selectionIds);if(sel)renderPanel();
    toast(result.rootCount+' layer'+(result.rootCount===1?'':'s')+(action==='duplicateElement'?' duplicated':action==='deleteElement'?' deleted':action==='frameSelection'?' framed':action==='groupSelection'?' grouped':action==='removeFrame'?' released from frame':' moved'),'ok');
  }finally{busyPanel(false);}
}
async function structureAction(action) {
  if(!sel || panelTasks || undoBusy || sourceRequests)return;
  if(sel.info.kind==='instance'&&sel.multiple?.length>1){if(action==='duplicateElement')return duplicateComponentSelection();if(action==='deleteElement')return deleteComponentSelection();if(action==='reparentElement')return chooseComponentParent(sel.info);if(['before','after','first','last'].includes(action)&&sharedComponentOrdering(sel.multiple)[action])return reparentComponentSelection(sel.multiple,undefined,action);return toast('Choose one component for this structural edit.','err');}
  if(['frameSelection','groupSelection','removeFrame'].includes(action)){await commitInlineEdit();if(sel)return structureSelection(action);return;}
  if(action==='deleteElement'&&sel.multiple?.length>1){
    const selection=sel.multiple,owners=selection.map(info=>info.svgBooleanGroup?info.svgBooleanGroup.ancestorId:info.svgBooleanOwner);
    if(owners.every(Boolean)&&new Set(owners).size===1){const response=await api('GET',resolveUrl(owners[0]));if(sel?.multiple!==selection)return;if(!response?.ok||selection.some(info=>info.hash!==response.element.hash||!response.element.svgBooleanGroup?.operandIds.includes(info.id)))return toast('Re-select direct originals from the same boolean group.','err','boolean-edit');return writeSVGBooleanGroup('removeSVGBooleanOperand',{operandIds:selection.map(info=>info.id)},response.element);}
    if(selection.some(info=>info.svgBooleanOwner)&&selection.every(info=>info.svgBooleanOwner||info.svgTransform||info.svgGeometry))return writeSVGBooleanGroup('removeSVGBooleanSelection',{ids:selection.map(info=>info.id)});
  }
  if(sel.multiple?.length>1){if(['before','after','first','last'].includes(action)&&sharedNativeOrdering(sel.multiple)[action])return structureSelection('moveSelection',{direction:action});if(action==='reparentElement')return chooseLayerParent(sel.info);if(['duplicateElement','deleteElement'].includes(action))return structureSelection(action);return toast('Choose one layer for this structural edit.','err');}
  await commitInlineEdit();
  const info=sel?.info;if(!info)return;
  if(action==='deleteElement'&&info.svgBooleanOwner){
    const ownerId=info.svgBooleanGroup?.ancestorId||(!info.svgBooleanGroup?info.svgBooleanOwner:null);
    if(ownerId){const response=await api('GET',resolveUrl(ownerId));if(sel?.info!==info)return;if(!response?.ok||response.element.hash!==info.hash||!response.element.svgBooleanGroup?.operandIds.includes(info.id))return toast('Re-select a direct original shape in the boolean group.','err','boolean-edit');return writeSVGBooleanGroup('removeSVGBooleanOperand',{operandId:info.id},response.element);}
  }
  if(['before','after','first','last'].includes(action)&&info.kind==='instance')return moveInstance(info,action);
  if(action==='deleteElement'&&info.kind==='instance'){if(!info.canDeleteComponent)return toast('This component usage cannot be deleted here.','err');return deleteInstance(info.id,info.context);}
  if(action==='duplicateElement'&&info.kind==='instance'){if(!info.canDuplicateComponent)return toast(info.componentDuplicateReason||'This instance cannot be duplicated here.','err');return duplicateInstance(info.id,info.context);}
  if(action==='deleteElement'&&info.svgDeletion||action==='duplicateElement'&&info.svgDuplication||['before','after','first','last'].includes(action)&&info.svgMovement){
    const deleting=action==='deleteElement',duplicating=action==='duplicateElement';
    busyPanel(true);
    try{
      const result=await api('POST','/rt/__api/op',{type:deleting?'deleteElement':duplicating?'duplicateElement':'moveElement',direction:action,id:info.id,fileHash:info.hash});
      if(!result?.ok)return toast(result?.reason||result?.error||'Could not update SVG layer','err');
      const selectionAfter=[deleting?result.parentId:duplicating?result.createdId:result.movedId];
      const deletedLocks=result.removedSourceIds?layerLocks.removeSourceIds(result.removedSourceIds):null;
      editorHistory.record({type:duplicating?'replaceSVGSelection':'structureSelection',id:result.parentId,selectionBefore:[info.id],selectionAfter,undoId:result.undoId,...(result.sourceIdMap?{sourceIdMap:result.sourceIdMap}:{}),...(deletedLocks?{deletedLocks,removedSourceIds:result.removedSourceIds}:{})});
      if(result.sourceIdMap)layerLocks.remap(result.sourceIdMap);
      if(duplicating)await refreshSVGBooleanSelection(result.parentId,selectionAfter);
      else{await restoreLayerSelection(selectionAfter);if(sel?.info.renderRevisionAttribute)await refreshWrittenElement(sel.info,()=>true);else await reloadFrame();}
      renderPanel();toast(deleting?'Layer deleted':duplicating?'Layer duplicated':'Layer moved','ok');
    }finally{busyPanel(false);}
    return;
  }
  if(action==='reparentElement')return info.kind==='instance'?chooseComponentParent(info):chooseLayerParent(info);
  if(action==='renameElement'){const input=document.getElementById('layerNameInput');input?.focus();input?.select();return;}
  if(action==='insertText'||action==='insertFrame')return insertLayer(action==='insertText'?'text':'frame',info);
  const target=matchingEls(info.id).find(el=>inTextScope(el,info));
  if(!target?.parentElement)return;
  const siblings=[...target.parentElement.children];
  const signature=el=>el.tagName+'|'+el.textContent.trim();
  const expected=siblings.map(signature),at=siblings.indexOf(target);
  if(action==='copyElement'){
    if(!(info.structure?.canCopy??info.structure?.canDuplicate))return toast('Copy is unavailable for this layer.','err');
    layerClipboard={id:info.id,hash:info.fileHash||info.hash,file:info.file,parentId:info.structure.parentId,signature:signature(target)};toast('Layer copied','ok');return;
  }
  if(action==='pasteElement'){
    if(!layerClipboard||layerClipboard.file!==info.file||layerClipboard.parentId!==info.structure?.parentId||layerClipboard.hash!==(info.fileHash||info.hash))return toast('Copy an unchanged sibling in this source parent before pasting.','err');
    expected.splice(at+1,0,layerClipboard.signature);
  }else if(action==='duplicateElement')expected.splice(at+1,0,expected[at]);
  else if(action==='deleteElement')expected.splice(at,1);
  else if(['before','after','first','last'].includes(action)) {
    const to=action==='first'?0:action==='last'?expected.length-1:at+(action==='before'?-1:1);
    if(to<0||to>=expected.length)return;
    const item=expected.splice(at,1)[0];expected.splice(to,0,item);
  } else return;
  busyPanel(true);
  try {
    const result=await api('POST','/rt/__api/op',{type:['before','after','first','last'].includes(action)?'moveElement':action,direction:action,id:info.id,fileHash:info.fileHash||info.hash,context:info.context,...(action==='pasteElement'?{copiedId:layerClipboard.id,copiedHash:layerClipboard.hash}:{})});
    if(!result?.ok){toast(result?.reason||result?.error||'Could not change this layer','err');return;}
    const parentId=result.parentId||info.structure?.parentId;
    const selectionAfter=result.createdId||result.movedId||(action==='deleteElement'?parentId:null);
    const deletedLocks=result.removedSourceIds?layerLocks.removeSourceIds(result.removedSourceIds):null;
    editorHistory.record({...(deletedLocks?{deletedLocks,removedSourceIds:result.removedSourceIds}:{}),type:selectionAfter?'structureSelection':'structure',id:parentId||info.id,undoId:result.undoId,context:info.context,...(result.sourceIdMap?{sourceIdMap:result.sourceIdMap}:{}),...(selectionAfter?{selectionBefore:[info.id],selectionAfter:[selectionAfter]}:{})});
    if(result.sourceIdMap)layerLocks.remap(result.sourceIdMap);
    const fresh=parentId?await api('GET',resolveUrl(parentId,info.context)):null;
    if(fresh?.ok) {
      await refreshWrittenElement(fresh.element,el=>JSON.stringify([...el.children].map(signature))===JSON.stringify(expected));
      sel={hostId:parentId,instanceId:null,scope:'host',info:fresh.element};if(result.createdId||result.movedId)await restoreLayerSelection([result.createdId||result.movedId]);renderPanel();
    } else {await reloadFrame();clearSelection();if(result.createdId||result.movedId){await restoreLayerSelection([result.createdId||result.movedId]);if(sel)renderPanel();}}
    toast('Layer updated','ok');
  } finally {busyPanel(false);}
}

function setArmedCanvasTool(value){
 if(armedCanvasTool===value)return;armedCanvasTool=value;window.dispatchEvent(new Event('retouch:shape-tools'));
}
function advanceArmedCanvasTool(){
 if(!armedCanvasTool)return;
 if(mode!=='edit'||historyRecoveryRequired||canvasPan.active){setArmedCanvasTool(null);return;}
 if(preparingShapeDrag||!sel?.info||editing||panelTasks||sourceRequests||undoBusy||stopDrawing||document.querySelector('dialog[open]'))return;
 const action=armedCanvasTool,source=window.RetouchShapeTools?.get(action);if(source?.available()&&!source.requiresTarget){setArmedCanvasTool(null);source.run(action==='scale'?document.getElementById('canvasScale'):undefined);}
}
window.addEventListener('keydown',event=>{if(armedCanvasTool&&event.key==='Escape'&&!event.isComposing){setArmedCanvasTool(null);event.preventDefault();}});
// Shape commands belong to the canvas tools, independent of inspector markup.
window.RetouchShapeTools={
 scaleArmed:()=>armedCanvasTool==='scale',
 armed:()=>armedCanvasTool,
 commands(){
  const canMove=()=>mode==='edit'&&!editing&&!panelTasks&&!sourceRequests&&!undoBusy&&!historyRecoveryRequired;
  const move={id:'shape-move',action:'move',label:'Move tool',keywords:'select pointer canvas V',element:modeBtn,available:()=>armedCanvasTool||canMove(),reason:'Finish the current edit and switch to Edit mode.',run(){setArmedCanvasTool(null);if(canMove()){stopDrawing?.();canvasPan.cancel();}}};
  const scaleInfo=sel?.info,scaleControl=panelBody.querySelector('[data-canvas-tool=scale]'),common=[move],canScale=()=>canMove()&&!!scaleInfo&&sel?.info===scaleInfo&&selectionEditRangeActive()&&!scaleControl?.matches(':disabled')&&!stopDrawing&&!canvasPan.active;
  common.push({id:'shape-scale',action:'scale',label:'Scale tool',keywords:'resize proportional selection canvas K',element:scaleControl||modeBtn,available:()=>!scaleInfo?canMove()&&!stopDrawing&&!canvasPan.active:!!scaleControl&&canScale(),reason:'Select editable layers and finish the current gesture.',run(opener=scaleControl){if(!scaleInfo&&canMove()&&!stopDrawing&&!canvasPan.active){setArmedCanvasTool('scale');return;}if(scaleControl&&canScale()){setArmedCanvasTool(null);return scaleGroupOnCanvas(scaleInfo,opener);}}});
  common.push({id:'shape-text',action:'text',label:'Text tool',keywords:'text type create canvas T',requiresTarget:true,element:modeBtn,available:()=>canMove()&&!stopDrawing&&!canvasPan.active,reason:'Finish the current edit and switch to Edit mode.',run(){if(canMove()&&!stopDrawing&&!canvasPan.active)setArmedCanvasTool('text');}});
  const hasDrawingTarget=()=>!!sel?.info?.svgInsertion&&!(sel.multiple?.length>1)&&sel.info.kind!=='instance';
  if(!hasDrawingTarget()){
   const available=()=>canMove()&&!hasDrawingTarget()&&!stopDrawing&&!canvasPan.active;
   for(const action of ['draw-rectangle','draw-ellipse','draw-circle','draw-triangle','draw-star','draw-arrow','draw-line','pen'])common.push({id:'shape-'+action,action,label:action==='pen'?'Pen':'Draw '+action.slice(5),owner:'awaiting-container',requiresTarget:true,element:modeBtn,available,keywords:'shape vector canvas',reason:'Switch to Edit mode and finish the current gesture.',run(){if(available())setArmedCanvasTool(action);}});
  }
  const info=sel?.info;if(!info||!info.svgInsertion&&!info.svgTransform?.editable||sel.multiple?.length>1||info.kind==='instance')return common;
  const owner=JSON.stringify([info.file,info.id,info.hash,sel.instanceId,sel.scope]);
  const available=()=>mode==='edit'&&!editing&&!panelTasks&&!sourceRequests&&!undoBusy&&!historyRecoveryRequired&&!panelBody.inert&&!(sel?.multiple?.length>1)&&owner===JSON.stringify([sel?.info.file,sel?.info.id,sel?.info.hash,sel?.instanceId,sel?.scope]);
  const command=(action,label,fn)=>({id:'shape-'+action,action,label,owner,element:panelBody,available,keywords:'shape vector canvas',reason:'Select an editable container or SVG canvas in Edit mode and finish the current edit.',run(){if(available()){setArmedCanvasTool(null);return fn(sel.info);}}});
  const rows=(info.svgInsertion?.presets||[]).flatMap(preset=>[command('draw-'+preset,'Draw '+preset,current=>drawShape(preset,current)),command('add-'+preset,'Add '+preset,current=>insertLayer(preset,current,'insertSVG'))]);
  if(info.svgTransform?.editable)rows.push(command('resize-vector','Resize vector on canvas',current=>resizeSVGOnCanvas(current)),command('rotate-vector','Rotate vector on canvas',current=>resizeSVGOnCanvas(current,null,null,'ne','rotate')),command('move-vector','Move vector on canvas',current=>resizeSVGOnCanvas(current,null,null,'se','move')));
  if(info.svgInsertion?.pen)rows.push(command('pen','Pen',current=>drawVector(current)));
  return [...common,...rows];
 },
 get(action){return this.commands().find(row=>row.action===action);}
};
window.dispatchEvent(new Event('retouch:shape-tools'));
