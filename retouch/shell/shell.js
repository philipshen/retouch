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
let mode = historyRecoveryRequired?'interact':'edit'; // 'edit' | 'interact'
let renderedSelection=null; // Live DOM anchor for the explicitly chosen occurrence.
let sel = null; // { hostId, instanceId, scope: 'host'|'instance', info }
let editing = null; // { el, id, info, original, originalHTML, snapshot, originalTree } during inline text editing
let hoverEl = null;
let measuring = false;
let selectionMarquee=null,stopMarquee=null,stopDrawing=null;
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
  const target=candidates[pending.index];
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
window.addEventListener('blur',()=>{pendingPanelFocus=null;});
// Metadata can rebuild an input after the source save has completed.
new MutationObserver(restorePanelFocus).observe(panelBody,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled']});

const canvasPan=RetouchCanvasPan.mount({enabled:()=>mode==='edit'&&!editing&&!panelTasks&&!sourceRequests&&!undoBusy,onActivate:()=>{window.dispatchEvent(new Event('retouch:before-zoom'));stopDrawing?.();hoverEl=null;}});
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
const svgExportNames=new WeakMap();
let svgExportScale=1,svgEmbedImages=true,svgExportFormat='svg',jpegQuality=92,jpegBackground='#ffffff';
function scopedInfo(info) { return {...info,styleScope,anchorInheritedClasses:RetouchResponsive.inherited(info.className,styleScope,doc()),className:RetouchResponsive.project(info.className,styleScope)}; }

let lockStorage;try{lockStorage=sessionStorage;}catch{}
const layerLocks=RetouchLayerLocks.create({route:()=>currentPageRoute()||'',storage:lockStorage,scope:window.__RT_RENDERING?.stateScope});
window.RetouchCanvasSelection={marqueeTargets:resolveMarqueeTargets,pick:(node,x,y)=>layerLocks.pick(node,x,y),selectable:node=>!layerLocks.locked(node),canMarquee:()=>window.__RT_RENDERING?.selectionStyling===true&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests};
const historyRoutes = new Map();
function currentPageRoute(){try{const loc=iframe.contentWindow.location;return loc.origin===location.origin?loc.pathname+loc.search+loc.hash:null;}catch{return null;}}
const editorHistory = RetouchHistory.createHistory({apply:restoreHistory,onChange:syncHistoryControls,storage:lockStorage,scope:window.__RT_RENDERING?.stateScope,initialState:window.__RT_RENDERING?.history,capture:entry=>({route:historyRoutes.get(entry.undoId)||currentPageRoute()})});
function syncHistoryControls() {
  undoBusy = editorHistory.busy;
  const busy = undoBusy || panelTasks > 0 || sourceRequests > 0;
  if(busy)canvasPan.cancel();
  undoBtn.disabled = busy || historyRecoveryRequired || !editorHistory.canUndo;
  redoBtn.disabled = busy || historyRecoveryRequired || !editorHistory.canRedo;
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
    if (editing?.el.ownerDocument !== iframe.contentDocument) editing = null;
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
 const target=keyboard?matchingEls(activeId())[0]:layerLocks.pick(event.target,event.clientX,event.clientY);
 if(!target)return;
 const selectedTargets=!sel?[]:sel.multiple?sel.multiple.flatMap(info=>matchingEls(info.id)):sel.info.kind==='instance'?selectedComponentGroups(doc(),activeId(),sel.info)[0]?.elements||[]:matchingEls(activeId()).filter(el=>inTextScope(el,sel.info)).slice(0,1);
 if(!keyboard&&!selectedTargets.includes(target))await select(target);
 if(keyboard)await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 if(serial!==canvasContextSerial||mode!=='edit'||!sel)return;
 const frame=iframe.getBoundingClientRect(),box=target.getBoundingClientRect(),x=keyboard?box.left:event.clientX,y=keyboard?box.bottom:event.clientY;
 const body=doc().body;body.tabIndex=-1;
 window.RetouchActions?.contextMenu({x:frame.left+x*frame.width/iframe.offsetWidth,y:frame.top+y*frame.height/iframe.offsetHeight,opener:body});
}
function hookFrame(d, w) {
  d.addEventListener('contextmenu',event=>void canvasContextMenu(event).catch(error=>toast(error.message,'err')),true);
  d.addEventListener('keydown',event=>{if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey)void canvasContextMenu(event,true).catch(error=>toast(error.message,'err'));},true);
  d.addEventListener('pointerdown',()=>{canvasContextSerial++;window.RetouchActions?.closeContext();},true);
  d.addEventListener('scroll',()=>window.RetouchActions?.closeContext(),true);
  w.addEventListener('pointerup',releasePanelPointer,true);
  w.addEventListener('pointercancel',releasePanelPointer,true);
  stopDrawing?.();
  stopMarquee?.();
  stopMarquee=RetouchMarquee.mount({document:d,frame:iframe,surface:canvasSurface,enabled:()=>window.__RT_RENDERING?.selectionStyling===true&&mode==='edit'&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests,
    onChange:rect=>{selectionMarquee=rect?{document:d,rect}:null;},
    selectable:node=>!layerLocks.locked(node),
    onSelect:(nodes,options)=>selectMarquee(d,nodes,options),
    onClick:(node,options)=>{if(panelTasks||undoBusy||sourceRequests)return;const target=layerLocks.pick(node,options.point?.x,options.point?.y);if(target)select(target,options);else if(!options.toggle)clearSelection();},
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
    if (panelTasks > 0 || undoBusy || sourceRequests) { e.preventDefault(); e.stopPropagation(); return; }
    if ((e.shiftKey||e.metaKey||e.ctrlKey)&&(sel?.info.cssAuthoring||sel?.info.classSelection||sel?.info.contextSelection||sel?.info.kind==='instance')){e.preventDefault();e.stopPropagation();await commitInlineEdit();const target=layerLocks.pick(e.target,e.clientX,e.clientY);if(target)await select(target,{toggle:true});return;}
    if (editing) {
      if (editing.el.contains(e.target)) return;
      commitInlineEdit(); // clicking away commits (R-5)
    }
    e.preventDefault();
    e.stopPropagation();
    const t = layerLocks.pick(e.target,e.clientX,e.clientY);
    // Single click selects AND, when the element has editable literal text,
    // enters in-place editing directly (user decision, 2026-09-02).
    if (t&&!layerLocks.locked(t)) startInlineEdit(t, e, true);
    else clearSelection();
  }, true);
  // Double-click opens vector points or starts inline text editing.
  d.addEventListener('dblclick', (e) => {
    if (mode !== 'edit') return;
    if(undoBusy||sourceRequests){e.preventDefault();e.stopPropagation();return;}
    if (editing) {
      if (editing.el.contains(e.target)) return;
      commitInlineEdit(); // moving to another element commits the current one
    }
    e.preventDefault();
    e.stopPropagation();
    const t = layerLocks.pick(e.target,e.clientX,e.clientY);
    if (t&&!layerLocks.locked(t)) startInlineEdit(t, e, false, true);
  }, true);
  d.addEventListener('mousemove', (e) => {
    if (mode !== 'edit') { hoverEl = null; return; }
    measuring = e.altKey;
    hoverEl = layerLocks.pick(e.target,e.clientX,e.clientY);
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
    if (editing && e.target === editing.el) { commitInlineEdit(); return; }
    suppress(e);
  }, true);
  d.addEventListener('blur', suppress, true);
  d.addEventListener('paste', (e) => {
    if (!editing || !editing.el.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    const selection = d.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editing.el.contains(range.commonAncestorContainer)) return;
    range.deleteContents();
    const text = d.createTextNode(e.clipboardData?.getData('text/plain') || '');
    range.insertNode(text);
    range.setStartAfter(text);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }, true);
  d.addEventListener('drop', (e) => {
    if (!editing || !editing.el.contains(e.target)) return;
    // Do not let native rich HTML drops bypass the plain-text paste path.
    e.preventDefault();
    e.stopPropagation();
  }, true);
  d.addEventListener('beforeinput', (e) => {
    if (editing && editing.el.contains(e.target) && e.inputType.startsWith('format')) {
      e.preventDefault();
    }
  }, true);
  d.addEventListener('pointerdown',cancelOpacityEntry,true);
  d.addEventListener('keydown', (e) => {
    if(e.key==='Escape'){vectorEntrySerial++;if(pendingVectorEntry){pendingVectorEntry=null;e.preventDefault();e.stopPropagation();return;}}
    if(mode==='edit'&&!editing&&window.RetouchActions?.shortcut(e)){cancelOpacityEntry();return;}
    if(opacityShortcut(e)||visibilityShortcut(e)||canvasZoomShortcut(e)||lockShortcut(e)||layerNavigationShortcut(e)||canvasLayerShortcut(e))return;
    if (editing) {
      e.stopPropagation(); // typing stays native; app shortcuts stay out
      if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'i')) {
        e.preventDefault(); // never let the browser's own rich-edit commands run (R-5)
        toggleWrap(e.key === 'b' ? 'strong' : 'em');
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
  const serial = ++classificationSerial;
  busyPanel(true);
  try {
    let result;
    if(sourceId&&[node?.getAttribute?.('data-rt'),node?.getAttribute?.('data-rt-i')].includes(sourceId)){
      const resolved=await api('GET',resolveUrl(sourceId,renderContext(node)));result=resolved?.ok?{el:node,info:resolved.element,...idsOf(node)}:null;
    }else result = await classifyNode(node);
    return serial === classificationSerial ? result : { superseded: true };
  } finally {
    busyPanel(false);
  }
}
function isStandaloneText(el, info) {
  if(!info || (info.text==null && !info.mixedText))return false;
  if(!/^(H[1-6]|P|SPAN|LABEL|BLOCKQUOTE|DIV)$/.test(el.tagName))return false;
  return !!el.textContent.trim() && [...el.querySelectorAll('*')].every(child=>
    /^(SPAN|STRONG|EM|B|I|U|S|DEL|BR|A|CODE|SMALL|SUB|SUP)$/.test(child.tagName));
}
async function classifyNode(node) {
  let el = node && node.closest ? node.closest('[data-rt], [data-rt-i]') : null;
  while (el) {
    const { hostId, instanceId } = idsOf(el);
    let inlineComponent=false;
    if(hostId && instanceId) {
      const host=await api('GET',resolveUrl(hostId,renderContext(el)));
      if(host?.ok && isStandaloneText(el,host.element)) {
        const usage=await api('GET',resolveUrl(instanceId,renderContext(el)));
        return {el,info:{...host.element,textLeaf:true},hostId,instanceId:usage?.element?.inlineComponent?null:instanceId};
      }
    }
    for (const id of [instanceId, hostId]) {
      if (!id || !/^[0-9a-f]{10}$/.test(id)) continue;
      const res = await api('GET', resolveUrl(id, renderContext(el)));
      if(res?.ok && res.element.inlineComponent&&!componentLibrarySelections.has(id)){inlineComponent=true;continue;}
      if (res && res.ok) return { el, info: res.element, hostId, instanceId:inlineComponent?null:instanceId };
    }
    el = el.parentElement ? el.parentElement.closest('[data-rt], [data-rt-i]') : null;
  }
  return null;
}

async function select(node,{toggle=false,sourceId}={}) {
  stopDrawing?.();
  const componentToggle=toggle&&sel?.info.kind==='instance';
  if(componentToggle&&!sourceId){
    const root=node?.closest?.('[data-rt-i]');
    if(!root||layerLocks.locked(root))return toast('Choose an unlocked component to add to this selection.','err');
    node=root;sourceId=root.getAttribute('data-rt-i');
  }
  const c = await classify(node,sourceId);
  if (c?.superseded) return;
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
  const detail=event.detail||{},serial=++comparisonSelectionSerial;
  if(panelTasks||undoBusy||sourceRequests||!['width','height'].every(key=>Number.isInteger(detail[key])&&detail[key]>=240&&detail[key]<=7680))return;
  const validId=id=>id===null||id===undefined||/^[a-f0-9]{10}$/.test(id);
  if(!validId(detail.hostId)||!validId(detail.instanceId)||!Number.isInteger(detail.occurrence)||detail.occurrence<0||detail.occurrence>10000)return;
  const group=detail.selection;if(detail.component!==undefined&&typeof detail.component!=='boolean')return;
  if(group!==undefined&&(!Array.isArray(group)||group.length>100||group.some(item=>!item||!item.hostId||!validId(item.hostId)||!validId(item.instanceId)||!Number.isInteger(item.occurrence)||item.occurrence<0||item.occurrence>10000)))return;
  await commitInlineEdit();if(serial!==comparisonSelectionSerial)return;
  const sameRoute=()=>{try{const loc=iframe.contentWindow.location;return loc.pathname+loc.search+loc.hash===detail.route;}catch{return false;}};
  if(!sameRoute())return toast('The page changed. Select the layer in the refreshed comparison.','err');
  if(mode!=='edit')modeBtn.click();
  window.RetouchScreens.set({width:detail.width,height:detail.height});
  if(detail.scopeAtWidth){
    if(!sel)return toast('Select a layer before choosing its style scope.','err');
    styleScope=sel.info.cssAuthoring?`min-[${detail.width}px]:`:RetouchResponsive.atWidth(doc(),detail.width).prefix;renderPanel();
  }
  if(group?.length===0){if(!detail.append)clearSelection();return;}
  if(!group&&!detail.hostId&&!detail.instanceId)return;
  const classification=classificationSerial;
  for(let attempt=0;attempt<60;attempt++){
    await new Promise(resolve=>setTimeout(resolve,50));
    if(serial!==comparisonSelectionSerial||classification!==classificationSerial||!sameRoute())return;
    if(group){
      if(iframe.contentWindow.innerWidth!==detail.width||iframe.contentWindow.innerHeight!==detail.height)continue;
      const nodes=[...doc().querySelectorAll('[data-rt],[data-rt-i]')],targets=group.map(item=>nodes.filter(el=>el.getAttribute('data-rt')===item.hostId&&el.getAttribute('data-rt-i')===item.instanceId)[item.occurrence]);
      if(targets.some(target=>!target))continue;
      if(targets.some(target=>layerLocks.locked(target)))return toast('A selected layer is now locked. Select the group again.','err');
      await selectMany(targets,{append:detail.append===true,component:detail.component===true});return;
    }
    const matches=[...doc().querySelectorAll('[data-rt],[data-rt-i]')].filter(el=>el.getAttribute('data-rt')===detail.hostId&&el.getAttribute('data-rt-i')===detail.instanceId),target=matches[detail.occurrence];
    if(!target||iframe.contentWindow.innerWidth!==detail.width)continue;
    if(layerLocks.locked(target))return toast('This layer is locked. Select it in Layers to edit.','err');
    await select(target,{toggle:detail.toggle===true});if(serial!==comparisonSelectionSerial||classificationSerial!==classification+1)return;target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});return;
  }
  toast('This layer is not present on the main canvas at this size.','err');
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
async function resolveMarqueeTargets(d,nodes,rect){
 if(sel?.info.kind!=='instance')return {nodes,component:false};
 const selection=sel,serial=classificationSerial;
 const library=await api('GET','/rt/__api/components');
 if(sel!==selection||serial!==classificationSerial||d.defaultView?.document!==d)return null;
 if(!library?.ok)throw Error('Could not resolve components for this selection.');
 return {nodes:componentMarqueeTargets(d,rect,library),component:true};
}

async function selectMarquee(d,nodes,options){
 if(sel?.info.kind!=='instance')return selectMany(nodes,options);
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
  renderedSelection={id:c.info.id,element:c.el};
  sel = {
    hostId: c.hostId,
    instanceId: c.instanceId,
    scope: c.instanceId && info.id === c.instanceId ? 'instance' : 'host',
    info,
  };
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
  const editId = info.id;
  renderPanel();
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
    const cid = c.getAttribute('data-rt-keep') || c.getAttribute('data-rt') || c.getAttribute('data-rt-i');
    if (cid) editing.snapshot.set(cid, {html:c.innerHTML});
  }
  editing.originalTree = serializeChildren(el, editing.snapshot);
  // plaintext-only forces pre-wrap in Chromium even over author !important
  // styles, exposing template indentation. Keep native layout; paste is plain
  // text through the frame hook below.
  el.setAttribute('contenteditable', 'true');
  el.focus();
  try {
    const d = doc();
    const range = d.caretRangeFromPoint(evt.clientX, evt.clientY);
    if (range) {
      const s = d.getSelection();
      s.removeAllRanges();
      s.addRange(range);
    }
  } catch {}
}

async function commitInlineEdit() {
  if (!editing) return;
  const ed = editing;
  editing = null;
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
  const structural = op.type === 'setChildren';
  Object.assign(op, sourcePayload(ed.info));
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
    if (structural || window.__RT_RENDERING?.reloadAfterWrite) reloadFrame();
    else if (sel && sel.info && sel.info.id === ed.id) {
      sel.info.hash = res.hash;
      renderPanel();
    }
    toast('Saved', 'ok');
  } else {
    ed.el.innerHTML = ed.originalHTML;
    toast((res && res.reason) || (res && res.error) || 'Write failed', 'err');
  }
}

// Reload the iframe to its current path, preserving scroll where possible.
function clientMountReady(d){return !!d?.body&&[...d.querySelectorAll('[data-rt-client-revision]')].every(el=>el.getAttribute('data-rt-client-mounted')===el.getAttribute('data-rt-client-revision'));}
async function waitForClientMount(d){for(let attempt=0;attempt<80;attempt++){if(d!==doc())return false;if(clientMountReady(d))return true;await new Promise(resolve=>setTimeout(resolve,50));}return false;}
window.RetouchClientMount={ready:clientMountReady};
function reloadFrame() {
  stopDrawing?.();
  const selectionBefore=sel,anchorBefore=renderedSelection,routeBefore=iframe.contentWindow?.location.href;
  const bookmark=sel&&!sel.multiple&&renderedSelection?.id===activeId()?RetouchComponentInstances.captureOccurrence(matchingInDocument(doc(),activeId(),sel.info),renderedSelection.element):null;
  return new Promise(resolve => {
    classificationSerial++;
    editing = null;
    hoverEl = null;
    const y = iframe.contentWindow?.scrollY || 0;
    let timeout, finished = false;
    const done = async () => {
      if (finished) return;
      finished = true;
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
async function refreshWrittenElement(info, matches) {
  const location = iframe.contentWindow.location.href;
  async function liveUpdateReady(){
    // Only compiler-stamped revisions can prove the live page reflects this write.
    if(!info.renderRevisionAttribute)return false;
    let stable=0;
    for(let attempt=0;attempt<20;attempt++){
      if(iframe.contentWindow.location.href!==location)return false;
      try{
        const d=doc(),el=matchingInDocument(d,info.id,info)[0];
        const stylesReady=[...d.querySelectorAll('link[rel="stylesheet"]')].every(link=>link.disabled||!!link.sheet);
        const ready=el&&el.getAttribute(info.renderRevisionAttribute)===info.hash&&matches(el)&&stylesReady&&clientMountReady(d);
        stable=ready?stable+1:0;
        if(stable>=3)return true;
      }catch{stable=0;}
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    return false;
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    if (iframe.contentWindow.location.href !== location) return;
    try {
      const response = await fetch(location, { cache: 'no-store' });
      if (response.ok) {
        const html = new DOMParser().parseFromString(await response.text(), 'text/html');
        const el = matchingInDocument(html,info.id,info)[0];
        if (el && (!info.renderRevisionAttribute||el.getAttribute(info.renderRevisionAttribute)===info.hash) && matches(el)) {
          if(await liveUpdateReady())return;
          if(iframe.contentWindow.location.href===location)await reloadFrame();
          return;
        }
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  await reloadFrame();
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

/* ---------- bold / italic on selection (Cmd+B / Cmd+I) ---------- */
function toggleWrap(tag) {
  const d = doc();
  if (!d || !editing) return;
  if (editing.info.canSetChildren === false) return toast('This source cannot preserve rich text formatting.', 'err');
  const s = d.getSelection();
  if (!s || !s.rangeCount) return;
  const r = s.getRangeAt(0);
  if (r.collapsed) return;
  // Toggle off: the selection sits inside an unstamped wrapper of this tag.
  const cac = r.commonAncestorContainer;
  const start = cac.nodeType === 1 ? cac : cac.parentElement;
  const selector = tag === 'strong' ? 'strong,b' : tag === 'em' ? 'em,i' : tag;
  const existing = start && start.closest(selector);
  if (
    existing &&
    existing !== editing.el &&
    editing.el.contains(existing) &&
    !existing.getAttribute('data-rt') &&
    !existing.getAttribute('data-rt-i')
  ) {
    const parent = existing.parentNode;
    const moved = [...existing.childNodes];
    for (const child of moved) parent.insertBefore(child, existing);
    parent.removeChild(existing);
    // Keep the just-unwrapped text selected so the highlight and toolbar stay.
    if (moved.length) {
      s.removeAllRanges();
      const nr = d.createRange();
      nr.setStartBefore(moved[0]);
      nr.setEndAfter(moved[moved.length - 1]);
      s.addRange(nr);
    }
    return;
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
  s.addRange(nr);
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
function paintLoop() {
  overlayLayer.textContent = '';
  const d = doc();
  let badge=null;
  if (d && sel && mode==='edit') {
    const id=activeId();
    let first=true;
    const targets=matchingInDocument(d,id,sel.info).filter(el=>inTextScope(el,sel.info));
    const groups=RetouchComponentInstances.prioritize(sel.info.kind==='instance'?RetouchComponentInstances.group(targets,sel.info.rootGroups):targets.map(el=>({element:el,elements:[el]})),renderedSelection?.id===id?renderedSelection.element:null);
    for(const group of groups) {
      const el=group.element,kind=outlineKind(el,sel.info);
      const bounds=RetouchComponentInstances.bounds(group.elements);if(bounds)drawBounds(bounds,first?'sel':'co',kind);
      if(first && kind==='instance')badge={el,elements:group.elements,id:el.getAttribute('data-rt-i') || id,name:sel.info.tag};
      first=false;
    }
  }
  if(d&&sel?.multiple&&mode==='edit')for(const info of sel.multiple)if(info.id!==activeId()){
    const targets=matchingEls(info.id).filter(el=>inTextScope(el,info));
    const groups=info.kind==='instance'?RetouchComponentInstances.group(targets,info.rootGroups):targets.map(el=>({element:el,elements:[el]}));
    for(const group of groups){const bounds=RetouchComponentInstances.bounds(group.elements);if(bounds)drawBounds(bounds,'co',outlineKind(group.element,info));}
  }
  if(d && editing?.el.isConnected)drawBox(editing.el,'editing',outlineKind(editing.el,editing.info));
  if(d && hoverEl?.isConnected && mode==='edit' && !editing) {
    const hovered=hoverDescription(hoverEl),target=hovered.element,info=hovered.info,kind=outlineKind(target,info);
    const group=kind==='instance'?RetouchComponentInstances.group(matchingInDocument(d,info.id,info),info.rootGroups).find(group=>group.elements.includes(target)):null;
    const elements=group?.elements||[target],bounds=RetouchComponentInstances.bounds(elements);
    if(kind&&bounds)drawBounds(bounds,'hover',kind);
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
  layers.selection(sel ? matchingEls(activeId()).find(el=>inTextScope(el,sel.info)) : null, sel?.multiple?.length>1&&sel.info.kind==='instance'?{...sel.info,selectionIds:sel.multiple.map(info=>info.id),selectionCanDuplicate:sel.multiple.every(info=>info.canDuplicateComponent),selectionCanDelete:sel.multiple.every(info=>info.canDeleteComponent),selectionCanReparent:sharedComponentContainers(sel.multiple).length>0,selectionContainers:sharedComponentContainers(sel.multiple),selectionTargets:sharedComponentTargets(sel.multiple),selectionOrdering:sharedComponentOrdering(sel.multiple)}:sel?.info, !!panelTasks || undoBusy || !!sourceRequests,sel?.multiple?.flatMap(info=>matchingEls(info.id))||[],historyRecoveryRequired);
}

function inTextScope(el, info) {
  return Object.entries(info.renderScope || {}).every(([name,value])=>el.getAttribute(name)===value);
}
function drawBox(el, cls, kind) {
  drawBounds(el.getBoundingClientRect(),cls,kind);
}
function drawBounds(r,cls,kind){
  if (r.width === 0 && r.height === 0) return;
  const b = document.createElement('div');
  b.className = 'box ' + cls + ' ' + kind;
  b.style.left = r.left + 'px';
  b.style.top = r.top + 'px';
  b.style.width = r.width + 'px';
  b.style.height = r.height + 'px';
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
  if(sel?.info.cssAuthoring) options.push(...Object.keys(sel.info.cssRules||{}).map(Number).filter(w=>w>0).sort((a,b)=>a-b).map(w=>({prefix:`min-[${w}px]:`,label:`${w} px and larger`})));
  else if (doc()) options.push(...RetouchResponsive.discover(doc()));
  const width = iframe.contentWindow?.innerWidth;
  if (Number.isInteger(width) && width >= 240) {
    const atWidth = sel?.info.cssAuthoring?{prefix:`min-[${width}px]:`,label:`${width} px and larger`}:RetouchResponsive.atWidth(doc(),width,options.slice(1));
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
  const scopeStatus=document.createElement('div');scopeStatus.className='scope-status';scopeStatus.setAttribute('role','status');scopeStatus.setAttribute('aria-label','Edit range status');
  const matchesPreview=styleScope?(condition?RetouchResponsive.matches({condition,queries:chosen?.queries},iframe.contentWindow):null):true;
  scopeStatus.dataset.match=matchesPreview===null?'unknown':String(matchesPreview);
  scopeStatus.textContent=!styleScope?'Base styles · all screen sizes':matchesPreview===true?'Preview matches edit range':matchesPreview===false?'Preview is outside edit range':'Preview match is unknown';
  section.append(scopeStatus);
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
  if (!sel.multiple?.length && !sel.info.cssAuthoring && styleScope && RetouchResponsive.project(sel.info.className,styleScope)) {
    section.append(RetouchInspector.button('Reset overrides at this size',()=>setClasses('')));
  }
  return section;
}
window.addEventListener('retouch:comparisons',()=>{const across=document.getElementById('compareBreakpointBoundary');if(across)across.disabled=!window.RetouchComparisons?.canShowSizes(JSON.parse(across.dataset.sizes));const button=document.getElementById('compareBreakpoint');if(button)button.disabled=!window.RetouchComparisons?.canShowSize({width:Number(button.dataset.width),height:Number(button.dataset.height)});});
// Scope navigation needs fresh viewport choices even while its selector has focus.
function panelPaintDraftFocused(){const picker=document.querySelector('.paint-picker[open]');return !!picker&&panelBody.contains(picker.retouchSourceInput);}
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
function renderPanel() {
  // A reload or document.open() can leave the preview without a root. Keep
  // the current inspector until the frame load restores measurable content.
  const previewDocument=doc();
  if(!previewDocument?.documentElement||!previewDocument.body||!previewDocument.defaultView){panelRenderDeferred=true;return;}
  // Selection is part of the completed edit, even before the next paint.
  syncLayerSelection();
  const panel=document.getElementById('panel');
  const key=JSON.stringify([sel.info.file,sel.scope,sel.instanceId,(sel.multiple||[sel.info]).map(info=>info.id).sort()]);
  const focusedDraft=panelPaintDraftFocused()||panelInteractionFocused()&&document.activeElement.matches('input,textarea')&&(document.activeElement.matches('.component-props-search')||!panelTasks&&!sourceRequests&&!undoBusy);
  if((panelPointer||focusedDraft||document.querySelector('.svg-vertex-surface'))&&key===renderedPanelSelection){panelRenderDeferred=true;return;}
  panelRenderDeferred=false;
  const top=key===renderedPanelSelection?panel.scrollTop:0;
  const focusedScope=key===renderedPanelSelection&&document.activeElement?.getAttribute('aria-label')==='Style screen scope';
  const focusedTool=key===renderedPanelSelection&&panelBody.contains(document.activeElement)?document.activeElement.dataset.canvasTool:null;
  renderedPanelSelection=key;
  // Rebuilding an empty fieldset can clamp its scroll container to zero.
  // Restore synchronously after all sections (including early returns) exist.
  try { renderPanelContents(); panelBody.dataset.organized='false';RetouchInspectorUI.organize(panelBody); } finally { panel.scrollTop=top;if(focusedScope)panelBody.querySelector('[aria-label="Style screen scope"]')?.focus({preventScroll:true});if(focusedTool)[...panelBody.querySelectorAll('[data-canvas-tool]')].find(el=>el.dataset.canvasTool===focusedTool)?.focus({preventScroll:true}); }
}
function renderPanelContents() {
  window.dispatchEvent(new CustomEvent('retouch:selection',{detail:activeId()}));
  window.dispatchEvent(new CustomEvent('retouch:selection-set',{detail:(sel.multiple||[sel.info]).map(info=>info.id)}));
  window.dispatchEvent(new CustomEvent('retouch:selection-details',{detail:(sel.multiple||[sel.info]).map(({id,kind,rootGroups,renderScope})=>({id,kind,rootGroups,renderScope}))}));
  const info = sel.info;
  const style = scopedInfo(info);
  panelEmpty.hidden = true;
  panelBody.hidden = false;
  panelBody.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'sec';head.dataset.layerTag=info.kind==='instance'?'':info.tag;
  const badge = document.createElement('span');
  badge.className = 'kindbadge' + (info.kind === 'instance' ? ' instance' : '');
  badge.textContent = sel.multiple?.length>1?sel.multiple.length+(info.kind==='instance'?' components':' layers'):info.kind === 'instance' ? info.tag : info.tag.charAt(0).toUpperCase()+info.tag.slice(1);
  head.appendChild(badge);
  const file = document.createElement('div');
  file.className = 'filepath';
  file.textContent = info.file;
  head.appendChild(file);
  if(info.kind==='instance'&&sel.multiple?.length>1){panelBody.append(head,componentSelectionSection(sel.multiple));return;}
  head.appendChild(screenScopeSection());
  panelBody.appendChild(head);
  {const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0,scope=info.classColorStyles?styleScope:width;
   RetouchColorStyles.mount(panelBody,sel.multiple?.length>1?selectionColorOptions(scope):info.colorStyles||info.classColorStyles?{width:scope,readColor:property=>{const element=matchingEls(info.id)[0];if(!element)throw Error('Re-select the layer to read its color.');return element.ownerDocument.defaultView.getComputedStyle(element).getPropertyValue(property);},allLinks:info.colorStyleLinks,links:info.colorStyleLinks?.[scope],overrides:info.colorStyleOverrides?.[scope]||[],inherited:info.classColorStyles?property=>RetouchResponsive.inheritedLink(Object.fromEntries(Object.entries(info.colorStyleLinks||{}).filter(([,group])=>group[property]).map(([key,group])=>[key,group[property]])),styleScope,matchingEls(info.id)[0]?.ownerDocument):undefined,apply:(styleId,libraryRevision,property)=>writeTextStyle('applyColorStyle',width,{scope:styleScope,styleId,libraryRevision,property}),reset:(styleId,libraryRevision,property)=>writeTextStyle('resetColorStyle',width,{scope:styleScope,styleId,libraryRevision,property}),detach:property=>writeTextStyle('detachColorStyle',width,{scope:styleScope,property})}:{});
  }

  if((sel.multiple?.length>1?sel.multiple.every(item=>item.variables):info.variables)){const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0;RetouchCollectionBindings.mount(panelBody,sel.multiple?.length>1?sel.multiple:info,width,sel.multiple?.length>1?writeVariableSelection:writeTextStyle);}
  else if(sel.multiple?.length>1?sel.multiple.every(item=>item.classVariables):info.classVariables){const scope=styleScope;RetouchCollectionBindings.mount(panelBody,sel.multiple?.length>1?sel.multiple:info,scope,(type,_width,extra)=>sel.multiple?.length>1?writeVariableSelection(type,0,{scope,...extra}):writeTextStyle(type,0,{scope,...extra}),{inherited:(property,ignoreOwn)=>RetouchCollectionBindings.classInherited(info,scope,property,matchingEls(info.id)[0]?.ownerDocument,ignoreOwn),scopeLabel:document.querySelector('[aria-label="Style screen scope"]')?.selectedOptions[0]?.textContent||scope||'all screen sizes'});}

  if(!sel.multiple?.length&&(info.cssAuthoring||info.classEffectStyles)&&!info.effectStyleLinkReason){
   const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0,scope=info.classEffectStyles?styleScope:width,links=info.effectStyleLinks||{},inheritedWidth=Object.keys(links).map(Number).filter(value=>value<width).sort((a,b)=>b-a)[0];
   const inherited=info.classEffectStyles?RetouchResponsive.inheritedLink(links,styleScope,matchingEls(info.id)[0]?.ownerDocument):!links[width]&&inheritedWidth!==undefined?{link:links[inheritedWidth],label:inheritedWidth?inheritedWidth+'px and larger':'All sizes'}:null;
   RetouchEffectStyles.mount(panelBody,matchingEls(info.id)[0],{link:links[scope],overrides:info.effectStyleOverrides?.[scope]||[],inherited,apply:(styleId,libraryRevision)=>writeTextStyle('applyEffectStyle',width,{scope:styleScope,styleId,libraryRevision}),reset:(styleId,libraryRevision)=>writeTextStyle('resetEffectStyle',width,{scope:styleScope,styleId,libraryRevision}),detach:()=>writeTextStyle('detachEffectStyle',width,{scope:styleScope}),update:(styleId,libraryRevision,name,properties)=>writeTextStyle('updateEffectStyle',width,{scope:styleScope,styleId,libraryRevision,name,properties})});
  }
  if(sel.multiple?.length>1){mountSelectionEffectStyles();mountSelectionTextStyles();if(info.classSelection){const elements=sel.multiple.map(item=>matchingEls(item.id)[0]),strategy=RetouchReactSelectionGeometry.strategy(sel.multiple,elements,styleScope,{reason:reactGeometryReason,matches:matchingEls,save:setReactClassesSelection});panelBody.append(RetouchClassSiteVariables.mountSelection(sel.multiple,elements,styleScope,setReactClassesSelection,message=>toast(message,'err')),RetouchSelectionLayout.mount(sel.multiple,elements,0,null,transformLayerSelection,strategy),RetouchReactSelection.mount(sel.multiple,elements,styleScope,setReactClassesSelection,setSelectionColorOverride,id=>matchingEls(id)[0]));return;}const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0;const elements=sel.multiple.map(info=>matchingEls(info.id)[0]);panelBody.append(RetouchSelectionLayout.mount(sel.multiple,elements,width,(changes,w)=>setHTMLCSSSelection(null,null,w,changes),transformLayerSelection),RetouchHTMLCSS.mountSelection(sel.multiple,elements,width,setHTMLCSSSelection));return;}

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
  if(info.svgGeometry){
    const geometry=RetouchInspector.section('SVG geometry');
    if(info.svgConversion)geometry.append(RetouchInspector.button('Convert to vector path',()=>convertSVGToPath(info)));
    const pointField=info.svgGeometry.fields.find(field=>['points','d'].includes(field.name));
    if(editableVectorField(info)){const editPoints=RetouchInspector.button('Edit vector points',()=>editSVGPoints(info));editPoints.dataset.canvasTool='vertices';editPoints.title='Edit vector points · Enter or double-click on the canvas';geometry.append(editPoints);}
    for(const field of info.svgGeometry.fields){const input=document.createElement('input');input.type='text';input.value=field.value??'';input.placeholder=field.editable===false?'Dynamic value':'Default';input.disabled=field.editable===false;if(field.reason)input.title=field.reason;input.onchange=()=>setSVGGeometry(field.name,input.value.trim()||null);RetouchInspector.field(geometry,'Shape '+field.label,input);const reset=RetouchInspector.button('Reset shape '+field.label.toLowerCase(),()=>setSVGGeometry(field.name,null));reset.disabled=field.value===null||field.editable===false;geometry.append(reset);}
    RetouchInspector.note(geometry,pointField?'Drag empty space to select points. Shift-click or Shift-drag adds to the selection. Drag selected points or use arrows (Shift: 10 units). Click + to add; Delete removes selected points. Done/Enter saves; Escape cancels. Points are shared across screen sizes.':'Geometry is shared across screen sizes. Values use SVG coordinates, px or %. The SVG viewport and page CSS can affect the rendered result.');panelBody.append(geometry);
  }
  if(info.svgInsertion){
    const shapes=RetouchInspector.section('Add shape'),buttons=document.createElement('div');buttons.className='stack-presets';
    for(const preset of info.svgInsertion.presets)buttons.append(RetouchInspector.button('Add '+preset,()=>insertLayer(preset,info,'insertSVG')));
    if(!info.svgInsertion.createsViewport)for(const preset of info.svgInsertion.presets)buttons.append(RetouchInspector.button('Draw '+preset,()=>drawShape(preset,info)));
    if(info.svgInsertion.pen)buttons.append(RetouchInspector.button('Pen',()=>drawVector(info)));
    shapes.append(buttons);RetouchInspector.note(shapes,info.svgInsertion.createsViewport?'Adds a shape in a new 200 × 200 canvas.':'Choose Draw and drag a shape, or Pen: click for straight segments, drag for curves. In Pen, click the first point to close; Enter finishes an open line. Shift constrains direction. Escape cancels.');panelBody.append(shapes);
  }
  if(info.cssAuthoring){
    const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0;
    const position=target?.namespaceURI!=='http://www.w3.org/2000/svg'?RetouchHTMLPosition.mount(info,target,width,setHTMLCSS,(g,action,opener)=>moveHTMLLayer(info,target,width,g,action,opener)):null;
    panelBody.appendChild(RetouchHTMLCSS.mount(info,target,width,setHTMLCSS,position,writeTextStyle));
    if(target?.tagName==='IMG')panelBody.appendChild(RetouchImageStyle.mount(info,target,null,(property,value)=>setHTMLCSS(property,value,width),info.cssRules?.[width]||{}));
    if(info.canSetTag){const section=RetouchInspector.section('Element');RetouchInspector.select(section,'HTML element',['h1','h2','h3','h4','h5','h6','p','span','div','blockquote','label','a','li'].map(tag=>[tag,tag]),info.tag,setTag);panelBody.appendChild(section);}
    if(info.src!==null)panelBody.appendChild(imageSection(info));
  }else{
  if(target)panelBody.appendChild(RetouchClassSiteVariables.mount(style,target,setClasses,message=>toast(message,'err')));
  if(target?.namespaceURI==='http://www.w3.org/2000/svg')panelBody.appendChild(RetouchSVGPaint.mount(style,target,setClasses));
  const textLayer=RetouchInspector.isTextLayer(info.tag);
  if(textLayer) panelBody.appendChild(RetouchInspector.typography(style, target, setClasses, setTag,(type,scope,extra)=>writeTextStyle(type,undefined,{scope,...extra})));
  panelBody.appendChild(RetouchInspector.position(style, target, setClasses, message => toast(message, 'err'),info.renderRevisionAttribute&&target?.namespaceURI==='http://www.w3.org/1999/xhtml'?(action,opener)=>transformReactLayer(info,target,action,opener):null,info.renderRevisionAttribute&&target?.namespaceURI==='http://www.w3.org/1999/xhtml'?(classes,g)=>writeReactBounds(info,classes,g):null));
  panelBody.appendChild(RetouchLayout.mount(style, target, setClasses));
  panelBody.appendChild(RetouchInspector.appearance(style, target, setClasses,info.classColorStyles?(property,value)=>writeTextStyle('setColorOverride',undefined,{scope:styleScope,property,value}):undefined));
  if (info.src !== null || info.srcDynamic) {
    if(target?.tagName==='IMG')panelBody.appendChild(RetouchImageStyle.mount(style,target,setClasses));
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
  if (info.text !== null) {
    const ta = document.createElement('textarea');
    ta.id = 'textEdit';
    ta.value = info.text;
    tsec.appendChild(ta);
    const btn = document.createElement('button');
    btn.id = 'textApply';
    btn.textContent = 'Apply text';
    btn.onclick = () => setText(ta.value);
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
    await refreshWrittenElement(info, el => el.tagName.toLowerCase() === tag);
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
  const pathEl = document.createElement('div');
  pathEl.className = 'filepath';
  pathEl.textContent = info.src;
  sec.appendChild(pathEl);
  const pathInput = document.createElement('input'); pathInput.type = 'text'; pathInput.placeholder = '/images/example.png'; pathInput.value = info.srcImported ? '' : info.src;
  RetouchInspector.field(sec, 'Image path', pathInput);
  sec.append(RetouchInspector.button('Apply image path', () => setSrc(pathInput.value.trim(), false, info)));
  const assets = document.createElement('div'); assets.className = 'image-assets'; assets.hidden = true;
  const browse = RetouchInspector.button('Browse project images', async () => {
    assets.hidden = !assets.hidden; if (assets.hidden || assets.childElementCount) return;
    const result = await api('GET', '/rt/__api/images');
    if (!result?.ok) return toast(result?.reason || result?.error || 'Could not list images', 'err');
    const search = document.createElement('input');search.type='search';search.placeholder='Find an image…';search.setAttribute('aria-label','Find a project image');
    assets.append(search);
    const buttons=[];
    for (const asset of result.images) {
      const b = RetouchInspector.button('', () => setSrc(asset.src, false, info)); b.title = asset.src;
      const preview=document.createElement('img');preview.src=asset.src;preview.alt='';preview.loading='lazy';
      const label=document.createElement('span');label.textContent=asset.name;b.append(preview,label);assets.append(b);buttons.push({button:b,path:decodeURIComponent(asset.src).toLowerCase()});
    }
    const empty=document.createElement('p');empty.className='note';empty.textContent='No matching images';empty.hidden=true;assets.append(empty);
    search.oninput=()=>{const query=search.value.trim().toLowerCase();let count=0;for(const item of buttons){item.button.hidden=!item.path.includes(query);if(!item.button.hidden)count++;}empty.hidden=count>0;};
    if (!result.images.length) RetouchInspector.note(assets, 'No project images found. Choose a file to upload.');
  });
  sec.append(browse, assets);
  const pick = document.createElement('button');
  pick.id = 'imgPick';
  pick.textContent = 'Choose image…';
  const fileIn = document.createElement('input');
  fileIn.type = 'file';
  fileIn.accept = 'image/*';
  fileIn.hidden = true;
  pick.onclick = () => fileIn.click();
  fileIn.onchange = async () => {
    const f = fileIn.files[0];
    if (!f) return;
    if (f.size > 10_000_000) return toast('Image too large (max 10 MB)', 'err');
    toast('Uploading…');
    let res;
    try {
      res = await fetch('/rt/__api/upload?name=' + encodeURIComponent(f.name), {
        method: 'POST',
        headers: { 'x-retouch-token': TOKEN },
        body: f,
      }).then((r) => r.json());
    } catch (err) {
      res = { ok: false, error: err.message };
    }
    if (!res.ok) return toast(res.reason || res.error || 'Upload failed', 'err');
    setSrc(res.src, false, info);
  };
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
    await refreshWrittenElement(info, el => imageMatches(el,src,info.srcMatch));
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
async function setSelectionColorOverride(property,value){
 const selection=sel?.multiple,info=sel?.info;if(!selection?.length)return;const ids=selection.map(item=>item.id);busyPanel(true);
 try{
  const result=await api('POST','/rt/__api/op',{type:'setColorOverrideSelection',id:info.id,ids,fileHash:info.hash,...selectionSourceContexts(selection),scope:styleScope,property,value});
  if(!result?.ok)throw Error(result?.reason||result?.error||'Could not update selected paint.');
  if(result.undoId)editorHistory.record({type:info.contextSelection?'collectionSelection':'setClassesSelection',id:info.id,selectionIds:ids,undoId:result.undoId});
  sel.info=result.element;sel.multiple=result.selection;if(info.contextSelection){await reloadFrame();await restoreLayerSelection(ids);}else await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument));renderPanel();
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
  sel.info=result.element;sel.multiple=result.selection;if(info.contextSelection){await reloadFrame();await restoreLayerSelection(ids);}else if(react)await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument));else await reloadFrame();renderPanel();toast('Selected bindings updated','ok');
 }finally{busyPanel(false);}
}
function selectionColorOptions(width){
  const selection=sel.multiple;
  if(!selection.every(info=>info.colorStyles||info.classColorStyles))return {};
  async function write(type,property,styleId,libraryRevision){
    const info=sel.info,ids=selection.map(item=>item.id),react=!!info.classColorStyles;busyPanel(true);
    try{
      const result=await api('POST','/rt/__api/op',{type,id:info.id,ids,fileHash:info.hash,...selectionSourceContexts(selection),width:react?0:width,scope:react?width:undefined,property,styleId,libraryRevision});
      if(!result?.ok)throw Error(result?.reason||result?.error||'Could not update selected colors.');
      if(result.undoId)editorHistory.record({type:info.contextSelection?'collectionSelection':react?'setClassesSelection':'setCSSSelection',id:info.id,selectionIds:ids,undoId:result.undoId});
      sel.info=result.element;sel.multiple=result.selection;if(info.contextSelection){await reloadFrame();await restoreLayerSelection(ids);}else if(react)await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument));else await reloadFrame();renderPanel();toast('Selected colors updated','ok');
    }finally{busyPanel(false);}
  }
  return {width,selection,apply:(id,revision,property)=>write('applyColorStyleSelection',property,id,revision),resetSelection:(revision,property)=>write('resetColorStyleSelection',property,undefined,revision),detachSelection:property=>write('detachColorStyleSelection',property)};
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
      if(info.contextSelection){await reloadFrame();await restoreLayerSelection(ids);}else if(react)await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument));else await reloadFrame();
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
      if(info.contextSelection){await reloadFrame();await restoreLayerSelection(ids);}else if(react)await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument));else await reloadFrame();
      renderPanel();toast('Selected text styles updated','ok');
    }finally{busyPanel(false);}
  }
  RetouchTextStyles.mount(panelBody,element,{selection:selection.length,selectionLinks:{linked:links.length,styles:new Set(links.map(link=>link.id)).size,overrides},apply:(id,revision)=>write('applyTextStyleSelection',id,revision),resetSelection:revision=>write('resetTextStyleSelection',undefined,revision),detachSelection:()=>write('detachTextStyleSelection')});
}
async function setHTMLCSSSelection(property,value,width,changesById){
  if(!sel?.multiple?.length)return;const selection=sel.multiple,info=sel.info;busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/op',{type:'setCSSSelection',id:info.id,ids:selection.map(item=>item.id),fileHash:info.hash,...(changesById?{changesById}:{property,value}),width});
    if(!result?.ok){renderPanel();return toast(result?.reason||result?.error||'Could not style selected layers','err');}
    if(result.undoId)editorHistory.record({type:'setCSSSelection',id:info.id,selectionIds:selection.map(item=>item.id),undoId:result.undoId});
    sel.info=result.element;sel.multiple=result.selection;await reloadFrame();renderPanel();toast('Selected layers updated','ok');
  }finally{busyPanel(false);}
}
function classSelectionMatches(infos,document){
  const tokens=value=>(value||'').split(/\s+/).filter(Boolean).sort().join(' ');
  return infos.every(info=>{const elements=matchingInDocument(document,info.id,info);return elements.length&&elements.every(el=>el.getAttribute(info.renderRevisionAttribute)===info.hash&&tokens(el.getAttribute('class'))===tokens(info.className));});
}
async function setReactClassesSelection(classesById,expected=null){
  if(!sel?.multiple?.length||panelTasks||undoBusy||sourceRequests)return;stopDrawing?.();const selection=sel.multiple,info=sel.info;busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/op',{type:'setClassesSelection',id:info.id,ids:selection.map(item=>item.id),fileHash:info.hash,...selectionSourceContexts(selection),classesById});
    if(!result?.ok){renderPanel();return toast(result?.reason||result?.error||'Could not style selected layers','err');}
    if(result.undoId)editorHistory.record({type:info.contextSelection?'collectionSelection':'setClassesSelection',id:info.id,selectionIds:selection.map(item=>item.id),undoId:result.undoId});
    sel.info=result.element;sel.multiple=result.selection;if(info.contextSelection){await reloadFrame();await restoreLayerSelection(selection.map(item=>item.id));}else await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument));
    if(expected){let ready=false;for(let attempt=0;attempt<50;attempt++){ready=Object.entries(expected).every(([id,g])=>{const el=matchingEls(id)[0];if(!el?.isConnected)return false;try{const actual=RetouchInspector.geometry(el);return ['x','y','width','height'].every(key=>Math.abs(actual[key]-g[key])<.6);}catch{return false;}});if(ready)break;await new Promise(resolve=>setTimeout(resolve,100));}if(!ready){renderPanel();toast('Saved selection classes, but the bounds did not settle. Check responsive or inline overrides.','err');return false;}}
    renderPanel();toast('Selected layers updated','ok');return true;
  }catch(error){renderPanel();toast(error.message,'err');return false;}finally{busyPanel(false);}
}
function svgGeometryMatches(el,info){return info.svgGeometry?.fields.every(field=>field.editable===false||el.getAttribute(field.name)===field.value);}
async function convertSVGToPath(info){
  if(panelTasks||undoBusy||sourceRequests||editing||sel?.info!==info)return;
  const targets=matchingEls(info.id);if(targets.length!==1)return toast('Select a shape rendered once to convert it.','err');
  const target=targets[0],w=target.ownerDocument.defaultView,probe=target.ownerDocument.createElementNS('http://www.w3.org/2000/svg','path');
  for(const attr of target.attributes)if(!info.svgConversion.properties.includes(attr.name)&&!/^on/i.test(attr.name))probe.setAttribute(attr.name,attr.value);
  for(const child of target.children)if(['title','desc'].includes(child.tagName.toLowerCase())){const copy=child.cloneNode(false);for(const attr of [...copy.attributes])if(/^on/i.test(attr.name))copy.removeAttribute(attr.name);copy.textContent=child.textContent;probe.append(copy);}
  probe.setAttribute('d',info.svgConversion.path);probe.style.setProperty('visibility','hidden','important');
  try{
    const before=w.getComputedStyle(target),paint=['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','opacity','transform','vector-effect','filter','clip-path','mask','marker-start','marker-mid','marker-end'],expected=Object.fromEntries(paint.map(p=>[p,before.getPropertyValue(p)]));
    if(target.querySelector('animate,set,animateTransform')||target.ownerSVGElement?.querySelector('animate,set,animateTransform'))return toast('Remove SVG animations before converting the shape.','err');
    const radii=Object.fromEntries(info.svgGeometry.fields.map(f=>[f.name,f.value==null?null:parseFloat(f.value)]));if(target.tagName.toLowerCase()==='rect')for(const axis of ['rx','ry']){const value=before.getPropertyValue(axis).trim();if(value&&value!=='auto'&&Math.abs(parseFloat(value)-(radii[axis]??radii[axis==='rx'?'ry':'rx']??0))>1e-6)return toast('This shape has CSS corner geometry. Edit those styles before converting.','err');}
    target.after(probe);const actual=w.getComputedStyle(probe),a=target.getBBox(),b=probe.getBBox(),cssPath=actual.getPropertyValue('d').match(/^path\(["']([\s\S]*)["']\)$/);if(cssPath&&!RetouchSVGPath.equivalentCompound(RetouchSVGPath.parseCompound(cssPath[1]),RetouchSVGPath.parseCompound(info.svgConversion.path)))return toast('This shape has a CSS path override. Edit that style before converting.','err');if(target.tagName.toLowerCase()!=='line'&&['marker-start','marker-mid','marker-end'].some(p=>expected[p]&&expected[p]!=='none'))return toast('Remove SVG markers before converting this shape.','err');if(paint.some(p=>actual.getPropertyValue(p)!==expected[p])||['x','y','width','height'].some(p=>Math.abs(a[p]-b[p])>1e-5))return toast('CSS changes the appearance of this shape when converted. Conversion is unavailable for these styles.','err');
  }finally{probe.remove();}
  busyPanel(true);
  try{const result=await api('POST','/rt/__api/op',{type:'convertSVGToPath',id:info.id,fileHash:info.hash});if(!result?.ok)return toast(result?.reason||result?.error||'Could not convert shape','err');if(result.undoId)editorHistory.record({type:'convertSVGToPath',id:info.id,selectionBefore:[info.id],selectionAfter:[info.id],undoId:result.undoId});renderedSelection=null;sel.info=result.element;await refreshWrittenElement(sel.info,el=>el.tagName.toLowerCase()==='path'&&svgGeometryMatches(el,sel.info));await restoreLayerSelection([info.id]);renderPanel();toast('Converted to an editable vector path','ok');}finally{busyPanel(false);}
}
async function setSVGGeometry(property,value){
  if(!sel||panelTasks||undoBusy||sourceRequests)return;const info=sel.info;busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/op',{type:'setSVGGeometry',id:info.id,fileHash:info.hash,property,value});
    if(!result?.ok)return toast(result?.reason||result?.error||'Could not update shape','err');
    if(result.undoId)editorHistory.record({type:'setSVGGeometry',id:info.id,undoId:result.undoId});
    sel.info=result.element;await refreshWrittenElement(sel.info,el=>svgGeometryMatches(el,sel.info));renderPanel();toast('Shape updated','ok');
  }finally{busyPanel(false);}
}
function reactGeometryReason(info,target){
  if(info.svgPaint?.reason)return info.svgPaint.reason;
  if(['position','inset','inset-inline','inset-block','inset-inline-start','inset-inline-end','inset-block-start','inset-block-end','left','right','top','bottom','width','height','margin','margin-left','margin-right','margin-top','margin-bottom','box-sizing'].some(p=>target?.style.getPropertyValue(p)))return 'This layer has inline geometry styles. Edit those source styles before moving or resizing with classes.';
  return null;
}

async function writeReactBounds(info,classes,expected){
  const reason=reactGeometryReason(info,matchingEls(info.id)[0]);if(reason){toast(reason,'err');renderPanel();return false;}
  busyPanel(true);try{
    if(!await setClasses(classes))return false;
    const current=sel.info;await refreshWrittenElement(current,el=>current.className.split(/\s+/).filter(Boolean).every(token=>el.classList.contains(token)));
    for(let i=0;i<50;i++){const target=matchingEls(current.id)[0];if(target?.isConnected&&target.ownerDocument.defaultView.getComputedStyle(target).position==='absolute'){const actual=RetouchInspector.geometry(target);if(['x','y','width','height'].every(key=>Math.abs(actual[key]-expected[key])<.6)){renderPanel();return true;}}await new Promise(resolve=>setTimeout(resolve,100));}
    renderPanel();toast('Saved classes, but the bounds did not settle. Check responsive or inline overrides.','err');return false;
  }catch(error){toast(error.message,'err');return false;}finally{busyPanel(false);}
}

function transformReactLayer(info,target,action,opener){
  stopDrawing?.();if(panelTasks||undoBusy||sourceRequests||!target?.isConnected||info.classNameDynamic)return;
  let g;try{const reason=reactGeometryReason(info,target);if(reason)throw Error(reason);if(target.ownerDocument.defaultView.getComputedStyle(target).position!=='absolute')throw Error('Choose a screen where this layer is absolute before transforming it.');g=RetouchInspector.geometry(target);}catch(error){toast(error.message,'err');return;}
  const scope=styleScope,hash=info.hash,classes=RetouchResponsive.project(info.className,scope),base=RetouchResponsive.inherited(info.className,scope,doc()),x=RetouchInspector.inferredAnchor(classes,'x',base),y=RetouchInspector.inferredAnchor(classes,'y',base);
  canvasPan.cancel();
  stopDrawing=RetouchCanvasMove.mount({target,frame:iframe,canvas:canvasSurface,mode:action,opener,
    onCommit:async(delta,options)=>{if(sel?.info.id!==info.id||sel?.info.hash!==hash||styleScope!==scope)return;try{const geometry={...g,...(action==='resize'?{width:delta.width,height:delta.height}:{}),x:g.x+delta.x,y:g.y+delta.y};if(![geometry.x,geometry.y,geometry.width,geometry.height].every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))throw Error('Keep layer bounds within 100,000 pixels.');if(await writeReactBounds(info,RetouchInspector.anchorClasses(classes,geometry,x,y,base),geometry)){if(options?.keyboard)document.querySelector('[data-canvas-tool='+action+']')?.focus({preventScroll:true});}}catch(error){toast(error.message,'err');}},
    onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});
  if(stopDrawing)toast(action==='resize'?'Drag a handle or use arrow keys. Shift keeps proportions; Option/Alt centers. Enter applies keyboard changes; Escape cancels.':'Drag the outline or use arrow keys (Shift: 10px). Enter applies keyboard changes; Escape cancels.','ok');
}

function transformLayerSelection(elements,commit,opener,action='move',spacing=null){
  stopDrawing?.();if(panelTasks||undoBusy||sourceRequests||!sel?.multiple?.length)return;
  const hash=sel.info.hash,scope=styleScope,key=sel.multiple.map(info=>info.id).sort().join(',');
  canvasPan.cancel();
  stopDrawing=RetouchCanvasMove.mount({target:elements[0],targets:elements,selectionId:activeId(),frame:iframe,canvas:canvasSurface,mode:action,spacing,opener,
    onCommit:async(delta,options)=>{if(sel?.info.hash!==hash||styleScope!==scope||sel.multiple?.map(info=>info.id).sort().join(',')!==key)return;try{if(![delta.x,delta.y,...(action==='resize'?[delta.width,delta.height]:spacing?[delta.gap,...(spacing.independent?delta.values:[])]:[])].every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))throw Error('Keep selection bounds within 100,000 pixels.');await commit(delta);if(options?.keyboard)document.querySelector('[data-canvas-tool='+action+']')?.focus({preventScroll:true});}catch(error){toast(error.message,'err');}},
    onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});
  if(stopDrawing)toast(spacing?(spacing.independent?'Drag a gap label to adjust just that gap.':'Drag a gap label to set equal spacing.')+' Arrow keys: 1px; Shift: 10px. Enter applies; Escape cancels.':action==='resize'?'Drag a selection handle. Shift keeps proportions; Option/Alt centers. Enter applies keyboard changes; Escape cancels.':'Drag the selection outline or use arrow keys (Shift: 10px). Enter applies keyboard changes; Escape cancels.','ok');
}

function moveHTMLLayer(info,target,width,g,action='move',opener){
  stopDrawing?.();if(panelTasks||undoBusy||sourceRequests||!target?.isConnected)return;
  try{g=RetouchInspector.geometry(target);}catch(error){toast(error.message,'err');return;}
  const inherited=Object.entries(info.cssRules||{}).filter(([w])=>Number(w)<=target.ownerDocument.defaultView.innerWidth).sort(([a],[b])=>Number(a)-Number(b)).reduce((all,[,values])=>Object.assign(all,values),{});
  canvasPan.cancel();
  stopDrawing=RetouchCanvasMove.mount({target,frame:iframe,canvas:canvasSurface,mode:action,opener,
    onCommit:(delta,options)=>{if(sel?.info.id!==info.id||sel?.info.hash!==info.hash)return;try{const geometry={...g,...(action==='resize'?{width:delta.width,height:delta.height}:{}),x:g.x+delta.x,y:g.y+delta.y};if(![geometry.x,geometry.y,geometry.width,geometry.height].every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))throw Error('Move within 100,000 pixels of the container.');setHTMLCSS(RetouchHTMLPosition.placement(geometry,inherited),null,width).then(()=>{if(options?.keyboard&&sel?.info.id===info.id)document.querySelector('[data-canvas-tool='+action+']')?.focus({preventScroll:true});});}catch(error){toast(error.message,'err');}},
    onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});
  if(stopDrawing)toast(action==='resize'?'Drag a handle or use arrow keys. Shift keeps proportions; Option/Alt centers. Enter applies keyboard changes; Escape cancels.':'Drag the outline or use arrow keys (Shift: 10px). Enter applies keyboard changes; Escape cancels.','ok');
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
  });else await reloadFrame();
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
async function setHTMLCSS(property,value,width){
  if(!sel)return;const info=sel.info;busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/op',{type:'setCSS',id:info.id,fileHash:info.hash,width,...(typeof property==='object'?{changes:property}:{property,value})});
    if(!result?.ok){toast(result?.reason||result?.error||'Could not save CSS','err');renderPanel();return;}
    if(result.undoId)editorHistory.record({type:'setCSS',id:info.id,undoId:result.undoId});
    sel.info=result.element;await reloadFrame();renderPanel();toast('Saved','ok');
  }finally{busyPanel(false);}
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
  optimisticClasses(classes);
  const res = await api('POST', '/rt/__api/op', {
    type: 'setClasses', id: info.id, classes, fileHash: info.fileHash || info.hash, context: info.context,
  });
  if (res && res.ok) {
    if (!isUndo) editorHistory.record({ type: 'setClasses', id: info.id, classes: prev, undoId: res.undoId, context: info.context });
    info.className = res.element?.className ?? classes;
    info.hash = res.hash;
    if(info.classTextStyles&&res.element)for(const key of ['textStyleLinks','textStyleOverrides','classTextStyles','textStyleLinkReason'])info[key]=res.element[key];
    if(res.element)for(const key of ['colorStyleLinks','colorStyleOverrides','classColorStyles','colorStyleLinkReason','effectStyleLinks','effectStyleOverrides','classEffectStyles','effectStyleLinkReason','classVariables','variableLinks','variableOverrides','variableReason'])info[key]=res.element[key];
    if (window.__RT_RENDERING?.reloadAfterWrite||info.renderRevisionAttribute) await refreshWrittenElement(info, el => info.className.split(/\s+/).filter(Boolean).every(token => el.classList.contains(token)));
    toast('Saved', 'ok');
    renderPanel();
  } else {
    optimisticClasses(prev);
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
  if (sel.info.textSource) return;
  for (const el of matchingEls(sel.info.id)) el.textContent = text;
}

async function undo() { return restoreDirection('undo'); }
async function redo() { return restoreDirection('redo'); }
async function restoreDirection(direction) {
  stopDrawing?.();
  if(undoBusy || panelTasks || sourceRequests)return;
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
    if(op.type==='renameComponent'){await refreshSwappedComponent(op.id,null);await selectInsertedComponent(op.id,null);layers.refresh();toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='deleteComponentSelection'){if(direction==='undo')await refreshComponentSelection(op.selectionBefore);else{await refreshDeletedComponent(op.deletedComponentIds,op.parentId);clearSelection();await layers.refresh();}toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='deleteComponent'){if(direction==='undo'){await refreshSwappedComponent(op.id,null);await selectInsertedComponent(op.id,op.parentId);}else{await refreshDeletedComponent(op.id,op.parentId);clearSelection();}toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='reparentComponentSelection'){await refreshComponentSelection(direction==='undo'?op.selectionBefore:op.selectionAfter);toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='duplicateComponentSelection'){await refreshComponentSelection(direction==='undo'?op.selectionBefore:op.selectionAfter);toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='duplicateComponent'){const id=direction==='redo'?op.instanceCopyId:op.instanceOriginalId;await refreshSwappedComponent(id,null);await selectInsertedComponent(id,null);toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='setComponentProp'){await refreshComponentProperty(op.id,op.parentId);toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='sourceHistory'){try{await refreshSourceHistory(result.renderRevisions);}finally{clearSelection();}toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='setComponentPropSelection'){await refreshComponentSelection(op.selectionIds);toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    if(op.type==='collectionSelection'){await reloadFrame();await restoreLayerSelection(op.selectionIds);if(sel)renderPanel();toast(direction==='undo'?'Undone':'Redone','ok');return result;}
    const fresh = await api('GET', resolveUrl(op.id, op.context));
    if (fresh?.ok) { sel = { hostId: op.id, instanceId: null, scope: 'host', info: fresh.element }; renderPanel(); }
    else clearSelection();
    if (fresh?.ok) {
      const info = fresh.element;
      const selectionResult=op.type==='setClassesSelection'?await Promise.all(op.selectionIds.map(id=>api('GET',resolveUrl(id)))):null;
      const component = op.type === 'detachComponent'||op.type==='createComponent'&&direction==='redo' ? await api('GET', componentUrl(op.id,op.context)) : null;
      await refreshWrittenElement(info, el => {
        if(selectionResult)return selectionResult.every(result=>result?.ok)&&classSelectionMatches(selectionResult.map(result=>result.element),el.ownerDocument);
        if(op.svgCreatedId){const found=matchingInDocument(el.ownerDocument,op.svgCreatedId,null).length>0;return direction==='undo'?!found:found;}
        if(op.type==='createComponent'&&direction==='undo')return el.getAttribute('data-rt')===op.id;
        if (component?.ok) return (component.definitionIds || [component.definitionId]).includes(el.getAttribute('data-rt'));
        if (op.type === 'setSrc') return imageMatches(el,info.src,info.srcMatch);
        if (op.type === 'setSVGGeometry') return svgGeometryMatches(el,info);
        if (op.type === 'convertSVGToPath') return el.tagName.toLowerCase()===info.tag&&svgGeometryMatches(el,info);
        if (op.type === 'setTag') return el.tagName.toLowerCase() === info.tag;
        if (op.type === 'setClasses' && !info.classNameDynamic) {
          const tokens = value => (value || '').split(/\s+/).filter(Boolean).sort().join(' ');
          return tokens(el.getAttribute('class')) === tokens(info.className);
        }
        return (info.className || '').split(/\s+/).filter(Boolean).every(t => el.classList.contains(t));
      });
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
undoBtn.onclick = () => undo();
redoBtn.onclick = () => redo();
routeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') navigatePage(routeInput.value || '/');
});
window.addEventListener('keydown', (e) => {
  if(e.key==='Escape'){vectorEntrySerial++;if(pendingVectorEntry){pendingVectorEntry=null;e.preventDefault();return;}}
  if(opacityShortcut(e)||visibilityShortcut(e)||canvasZoomShortcut(e)||lockShortcut(e)||((e.metaKey||e.ctrlKey)&&['[',']','{','}'].includes(e.key)&&canvasLayerShortcut(e)))return;
  if (document.querySelector('dialog[open]')) return;
  if (e.key === 'Alt') measuring = true;
  if(sourceHistoryShortcut(e))return;
  if (e.key === 'Escape') {
    if(stopDrawing){e.preventDefault();stopDrawing();return;}
    if(!e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')&&window.RetouchWorkspacePanels?.closeIfOpen()){e.preventDefault();return;}
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

function toast(msg, cls) {
  if (cls === 'ok') document.querySelectorAll('#toasts .toast.ok').forEach(el=>el.remove());
  const t = document.createElement('div');
  t.className = 'toast ' + (cls || '');
  t.textContent = msg;
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
  toast(value?'Selection locked on the canvas. Select it in Layers to edit.':'Selection unlocked.','ok');
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
  if(mode!=='edit'||editing||!sel||e.target.isContentEditable||document.querySelector('dialog[open]')||e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')){cancelOpacityEntry();return false;}
  const input=panelBody.querySelector('input[aria-label="Shared Opacity (%)"],input[aria-label="Opacity (%)"]');
  if(!input||input.matches(':disabled')||input.closest('[inert]')){cancelOpacityEntry();return false;}
  e.preventDefault();e.stopImmediatePropagation();
  if(e.repeat||panelTasks||undoBusy||sourceRequests)return true;
  const key=JSON.stringify([(sel.multiple||[sel.info]).map(info=>info.id).sort(),styleScope]);
  let digits=opacityEntry?.input===input&&opacityEntry.key===key?opacityEntry.digits+e.key:e.key;
  if(digits.length>3||Number(digits)>100)digits=e.key;
  cancelOpacityEntry();
  const entry={input,key,digits};opacityEntry=entry;
  entry.timer=setTimeout(()=>{
    if(opacityEntry!==entry)return;opacityEntry=null;
    if(!input.isConnected||input.matches(':disabled')||input.closest('[inert]')||mode!=='edit'||editing||!sel||panelTasks||undoBusy||sourceRequests||document.querySelector('dialog[open]')||key!==JSON.stringify([(sel.multiple||[sel.info]).map(info=>info.id).sort(),styleScope]))return;
    input.value=String(digits.length===1?(digits==='0'?100:Number(digits)*10):Number(digits));input.dispatchEvent(new Event('change',{bubbles:true}));
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
  onSelect:async(el,options)=>{if(panelTasks||undoBusy||sourceRequests)return;await commitInlineEdit();if(options?.component&&options.sourceId)componentLibrarySelections.add(options.sourceId);await select(el,options);el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});},
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
    if(result.sourceIdMap)layerLocks.remap(result.sourceIdMap);await reloadFrame();
    const fresh=await api('GET',resolveUrl(result.movedId));if(fresh?.ok){sel={hostId:result.movedId,instanceId:null,scope:'host',info:fresh.element};renderPanel();}
    toast('Layer moved','ok');
  }finally{busyPanel(false);}
}
async function prepareVectorCanvas(info,target){
  if(mode!=='edit')modeBtn.click();canvasPan.cancel();
  // Keep handles away from the clipped canvas edge without changing site size or zoom.
  const f=iframe.getBoundingClientRect(),c=canvasSurface.getBoundingClientRect(),r=target.getBoundingClientRect(),scale=f.width/iframe.contentWindow.innerWidth;
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
async function drawVector(info){
  if(panelTasks||undoBusy||sourceRequests||editing)return;
  stopDrawing?.();const targets=matchingEls(info.id);
  if(targets.length!==1)return toast('Select an SVG container rendered once to draw into.','err');
  if(!await prepareVectorCanvas(info,targets[0]))return;
  stopDrawing=RetouchSVGPen.mount({target:targets[0],frame:iframe,canvas:canvasSurface,
    onCommit:(points,closed,nodes)=>insertLayer(nodes?'path':closed?'polygon':'polyline',info,'insertSVG',nodes?{nodes,closed}:{points}),
    onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});
}
function drawShape(preset,info){
  if(panelTasks||undoBusy||sourceRequests||editing)return;
  stopDrawing?.();
  const target=matchingEls(info.id)[0];if(!target)return;
  if(mode!=='edit')modeBtn.click();
  canvasPan.cancel();
  stopDrawing=RetouchSVGDraw.mount({target,frame:iframe,canvas:canvasSurface,preset,
    onCommit:points=>insertLayer(preset,info,'insertSVG',{points}),
    onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});
  if(stopDrawing)toast('Drag to draw '+preset+'. Shift constrains; Option/Alt draws from center. Escape cancels.','ok');
}
async function insertLayer(preset,info,type='insertElement',extra={}){
  if(panelTasks||undoBusy||sourceRequests)return;
  busyPanel(true);
  try{
    const result=await api('POST','/rt/__api/op',{type,id:info.id,fileHash:info.fileHash||info.hash,preset,...extra});
    if(!result?.ok)return toast(result?.reason||result?.error||'Could not add layer','err');
    editorHistory.record({type:'structureSelection',id:info.id,selectionBefore:[info.id],selectionAfter:[result.createdId],undoId:result.undoId,...(type==='insertSVG'?{svgCreatedId:result.createdId}:{})});
    const fresh=await api('GET',resolveUrl(result.createdId));
    if(fresh?.ok)await refreshWrittenElement(fresh.element,el=>el.getAttribute('data-rt')===result.createdId);else await reloadFrame();
    if(fresh?.ok){sel={hostId:result.createdId,instanceId:null,scope:'host',info:fresh.element};renderPanel();}
    toast('Layer added','ok');
  }finally{busyPanel(false);}
}
async function restoreLayerSelection(ids){
  const selected=await Promise.all(ids.map(id=>{const element=matchingEls(id)[0];return api('GET',resolveUrl(id,element?renderContext(element):undefined));}));
  if(!selected.length||selected.some(result=>!result?.ok))return;
  const infos=selected.map(result=>result.element),first=infos[0];sel={hostId:first.id,instanceId:first.kind==='instance'?first.id:null,scope:first.kind==='instance'?'instance':'host',info:first,multiple:infos.length>1?infos:undefined};
}
async function structureSelection(action,extra={}){
  if(sel.multiple?.length>1&&!sel.info.cssAuthoring)return toast('React selection structure editing is not available yet.','err');
  const selection=sel.multiple||[sel.info],info=sel.info;busyPanel(true);
  try{
    const type=['frameSelection','removeFrame'].includes(action)?action:action==='duplicateElement'?'duplicateSelection':action==='deleteElement'?'deleteSelection':'reparentSelection';
    const result=await api('POST','/rt/__api/op',{type,id:info.id,ids:selection.map(item=>item.id),fileHash:info.hash,...extra});
    if(!result?.ok)return toast(result?.reason||result?.error||'Could not update selected layers','err');
    const deletedLocks=result.removedSourceIds?layerLocks.removeSourceIds(result.removedSourceIds):null;
    editorHistory.record({type:'structureSelection',id:result.parentId,selectionBefore:selection.map(item=>item.id),selectionAfter:result.selectionIds,undoId:result.undoId,...(result.sourceIdMap?{sourceIdMap:result.sourceIdMap}:{}),...(deletedLocks?{deletedLocks,removedSourceIds:result.removedSourceIds}:{})});
    if(result.sourceIdMap)layerLocks.remap(result.sourceIdMap);
    await reloadFrame();await restoreLayerSelection(result.selectionIds);if(sel)renderPanel();
    toast(result.rootCount+' layer'+(result.rootCount===1?'':'s')+(action==='duplicateElement'?' duplicated':action==='deleteElement'?' deleted':action==='frameSelection'?' framed':action==='removeFrame'?' released from frame':' moved'),'ok');
  }finally{busyPanel(false);}
}
async function structureAction(action) {
  if(!sel || panelTasks || undoBusy || sourceRequests)return;
  if(sel.info.kind==='instance'&&sel.multiple?.length>1){if(action==='duplicateElement')return duplicateComponentSelection();if(action==='deleteElement')return deleteComponentSelection();if(action==='reparentElement')return chooseComponentParent(sel.info);if(['before','after','first','last'].includes(action)&&sharedComponentOrdering(sel.multiple)[action])return reparentComponentSelection(sel.multiple,undefined,action);return toast('Choose one component for this structural edit.','err');}
  if(['frameSelection','removeFrame'].includes(action)){await commitInlineEdit();if(sel)return structureSelection(action);return;}
  if(sel.multiple?.length>1){if(action==='reparentElement')return chooseLayerParent(sel.info);if(['duplicateElement','deleteElement'].includes(action))return structureSelection(action);return toast('Choose one layer for this structural edit.','err');}
  await commitInlineEdit();
  const info=sel?.info;if(!info)return;
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
      editorHistory.record({type:'structureSelection',id:result.parentId,selectionBefore:[info.id],selectionAfter,undoId:result.undoId,...(result.sourceIdMap?{sourceIdMap:result.sourceIdMap}:{}),...(deletedLocks?{deletedLocks,removedSourceIds:result.removedSourceIds}:{})});
      if(result.sourceIdMap)layerLocks.remap(result.sourceIdMap);
      await restoreLayerSelection(selectionAfter);
      if(sel?.info.renderRevisionAttribute)await refreshWrittenElement(sel.info,()=>true);else await reloadFrame();
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
