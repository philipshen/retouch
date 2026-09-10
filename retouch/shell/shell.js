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

let mode = 'edit'; // 'edit' | 'interact'
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
let pendingPanelFocus=null;
const panelSelectionKey=()=>sel?JSON.stringify([sel.info.file,sel.scope,sel.instanceId,(sel.multiple||[sel.info]).map(info=>info.id).sort()]):null;
const controlIdentity=el=>JSON.stringify([el.tagName,el.getAttribute('aria-label'),el.getAttribute('name'),el.dataset.canvasTool,el.matches('button,summary')?el.textContent:null]);
function restorePanelFocus(){
  const pending=pendingPanelFocus;if(!pending||panelBody.disabled)return;
  if(!pending.expires)pending.expires=Date.now()+3000;
  if(pending.selection!==panelSelectionKey()||Date.now()>pending.expires){pendingPanelFocus=null;return;}
  const candidates=[...panelBody.querySelectorAll('input,select,textarea,button,summary,[tabindex]')].filter(el=>controlIdentity(el)===pending.identity);
  const target=candidates[pending.index];
  if(target&&!target.matches(':disabled')&&target.getClientRects().length){pendingPanelFocus=null;target.focus();}
}
panelBody.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.key!=='Tab'||event.altKey||event.ctrlKey||event.metaKey||!event.target.matches('input:not([type=checkbox]):not([type=radio]),textarea'))return;
  const controls=[...panelBody.querySelectorAll('input,select,textarea,button,summary,[tabindex]')].filter(el=>el.tabIndex>=0&&!el.matches(':disabled')&&el.getClientRects().length);
  const target=controls[controls.indexOf(event.target)+(event.shiftKey?-1:1)];if(!target)return;
  const identity=controlIdentity(target),matches=[...panelBody.querySelectorAll('input,select,textarea,button,summary,[tabindex]')].filter(el=>controlIdentity(el)===identity);
  pendingPanelFocus={selection:panelSelectionKey(),identity,index:matches.indexOf(target),expires:0};
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
}
let lastAppPath = null;
let styleScope = '';
const svgExportNames=new WeakMap();
let svgExportScale=1,svgEmbedImages=true,svgExportFormat='svg',jpegQuality=92,jpegBackground='#ffffff';
function scopedInfo(info) { return {...info,styleScope,anchorInheritedClasses:RetouchResponsive.inherited(info.className,styleScope,doc()),className:RetouchResponsive.project(info.className,styleScope)}; }

let lockStorage;try{lockStorage=sessionStorage;}catch{}
const layerLocks=RetouchLayerLocks.create({route:()=>currentPageRoute()||'',storage:lockStorage,scope:window.__RT_RENDERING?.stateScope});
const historyRoutes = new Map();
function currentPageRoute(){try{const loc=iframe.contentWindow.location;return loc.origin===location.origin?loc.pathname+loc.search+loc.hash:null;}catch{return null;}}
const editorHistory = RetouchHistory.createHistory({apply:restoreHistory,onChange:syncHistoryControls,capture:entry=>({route:historyRoutes.get(entry.undoId)||currentPageRoute()})});
function syncHistoryControls() {
  undoBusy = editorHistory.busy;
  const busy = undoBusy || panelTasks > 0 || sourceRequests > 0;
  if(busy)canvasPan.cancel();
  undoBtn.disabled = busy || !editorHistory.canUndo;
  redoBtn.disabled = busy || !editorHistory.canRedo;
  undoBtn.setAttribute('aria-busy',String(busy));
  redoBtn.setAttribute('aria-busy',String(busy));
  pagePicker.disabled = busy;routeInput.disabled = busy;
  panelBody.disabled = busy;panelBody.inert = busy;
  panelBody.setAttribute('aria-busy',String(busy));
  if(!busy)queueMicrotask(restorePanelFocus);
}
syncHistoryControls();

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

function hookFrame(d, w) {
  w.addEventListener('pointerup',releasePanelPointer,true);
  w.addEventListener('pointercancel',releasePanelPointer,true);
  stopDrawing?.();
  stopMarquee?.();
  stopMarquee=RetouchMarquee.mount({document:d,frame:iframe,surface:canvasSurface,enabled:()=>window.__RT_RENDERING?.selectionStyling===true&&mode==='edit'&&!editing&&!panelTasks&&!undoBusy&&!sourceRequests,
    onChange:rect=>{selectionMarquee=rect?{document:d,rect}:null;},
    selectable:node=>!layerLocks.locked(node),
    onSelect:(nodes,options)=>selectMany(nodes,options),
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
      if (doc() === d && sel && !panelTasks && (viewport?!panelInteractionFocused():!panelBody.contains(document.activeElement))) renderPanel();
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
    if ((e.shiftKey||e.metaKey||e.ctrlKey)&&(sel?.info.cssAuthoring||sel?.info.classSelection)){e.preventDefault();e.stopPropagation();await commitInlineEdit();const target=layerLocks.pick(e.target,e.clientX,e.clientY);if(target)await select(target,{toggle:true});return;}
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
  // Double-click also starts inline text editing (kept as a fallback).
  d.addEventListener('dblclick', (e) => {
    if (mode !== 'edit') return;
    if (editing) {
      if (editing.el.contains(e.target)) return;
      commitInlineEdit(); // moving to another element commits the current one
    }
    e.preventDefault();
    e.stopPropagation();
    const t = layerLocks.pick(e.target,e.clientX,e.clientY);
    if (t&&!layerLocks.locked(t)) startInlineEdit(t, e);
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
  d.addEventListener('keydown', (e) => {
    if(canvasZoomShortcut(e)||lockShortcut(e))return;
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
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopPropagation(); e.shiftKey ? redo() : undo(); }
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
async function classify(node) {
  const serial = ++classificationSerial;
  busyPanel(true);
  try {
    const result = await classifyNode(node);
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
      if(res?.ok && res.element.inlineComponent){inlineComponent=true;continue;}
      if (res && res.ok) return { el, info: res.element, hostId, instanceId:inlineComponent?null:instanceId };
    }
    el = el.parentElement ? el.parentElement.closest('[data-rt], [data-rt-i]') : null;
  }
  return null;
}

async function select(node,{toggle=false}={}) {
  stopDrawing?.();
  const c = await classify(node);
  if (c?.superseded) return;
  if (!c) return clearSelection();
  if(toggle&&(c.info.cssAuthoring&&sel?.info.cssAuthoring||c.info.classSelection&&sel?.info.classSelection)&&c.info.file===sel.info.file&&c.info.hash===sel.info.hash){
    let multiple=sel.multiple||[sel.info];multiple=multiple.some(info=>info.id===c.info.id)?multiple.filter(info=>info.id!==c.info.id):[...multiple,c.info];
    if(!multiple.length)return clearSelection();if(multiple.length>100)return toast('Select up to 100 layers.','err');
    const primary=multiple.find(info=>info.id===c.info.id)||multiple[0];sel={hostId:primary.id,instanceId:null,scope:'host',info:primary,multiple:multiple.length>1?multiple:undefined};renderPanel();return;
  }
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
  await commitInlineEdit();if(serial!==comparisonSelectionSerial)return;
  const sameRoute=()=>{try{const loc=iframe.contentWindow.location;return loc.pathname+loc.search+loc.hash===detail.route;}catch{return false;}};
  if(!sameRoute())return toast('The page changed. Select the layer in the refreshed comparison.','err');
  if(mode!=='edit')modeBtn.click();
  window.RetouchScreens.set({width:detail.width,height:detail.height});
  if(detail.scopeAtWidth){
    if(!sel)return toast('Select a layer before choosing its style scope.','err');
    styleScope=sel.info.cssAuthoring?`min-[${detail.width}px]:`:RetouchResponsive.atWidth(doc(),detail.width).prefix;renderPanel();
  }
  if(!detail.hostId&&!detail.instanceId)return;
  const classification=classificationSerial;
  for(let attempt=0;attempt<60;attempt++){
    await new Promise(resolve=>setTimeout(resolve,50));
    if(serial!==comparisonSelectionSerial||classification!==classificationSerial||!sameRoute())return;
    const matches=[...doc().querySelectorAll('[data-rt],[data-rt-i]')].filter(el=>el.getAttribute('data-rt')===detail.hostId&&el.getAttribute('data-rt-i')===detail.instanceId),target=matches[detail.occurrence];
    if(!target||iframe.contentWindow.innerWidth!==detail.width)continue;
    await select(target);if(serial!==comparisonSelectionSerial||classificationSerial!==classification+1)return;target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});return;
  }
  toast('This layer is not present on the main canvas at this size.','err');
});

async function selectMany(nodes,{active=nodes[0],append=false}={}){
  stopDrawing?.();
  const serial=++classificationSerial;
  const ids=[...new Set([...(append?(sel?.multiple||[sel?.info]).filter(Boolean).map(info=>info.id):[]),...nodes.map(node=>node.getAttribute('data-rt'))])];
  if(!ids.length)return clearSelection();if(ids.length>100)return toast('Select up to 100 layers. Narrow the layer search first.','err');
  busyPanel(true);
  try{
    const results=await Promise.all(ids.map(id=>api('GET',resolveUrl(id))));if(serial!==classificationSerial)return;
    if(nodes.some(node=>!node.isConnected)||results.some(result=>!result?.ok||!(result.element.cssAuthoring||result.element.classSelection)))return toast('These layers cannot be selected together.','err');
    const infos=results.map(result=>result.element),first=infos[0];
    if(infos.some(info=>info.file!==first.file||info.hash!==first.hash))return toast('Select layers from one unchanged source file.','err');
    const primary=infos.find(info=>info.id===active?.getAttribute('data-rt'))||first;
    sel={hostId:primary.id,instanceId:null,scope:'host',info:primary,multiple:infos.length>1?infos:undefined};renderPanel();
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
  stopDrawing?.();
  classificationSerial++;sel = null;renderedPanelSelection=null;
  window.dispatchEvent(new CustomEvent('retouch:selection',{detail:null}));
  panelBody.hidden = true;
  panelEmpty.hidden = false;
}

/* ---------- inline text editing ---------- */
async function startInlineEdit(node, evt, quiet) {
  const c = await classify(node);
  if (c?.superseded) return;
  if (!c) return clearSelection(); // nothing editable here — no error
  const { el, info } = c;
  sel = {
    hostId: c.hostId,
    instanceId: c.instanceId,
    scope: c.instanceId && info.id === c.instanceId ? 'instance' : 'host',
    info,
  };
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
function reloadFrame() {
  stopDrawing?.();
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
      try { iframe.contentWindow.scrollTo({left:0,top:y,behavior:'instant'}); } catch {}
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
        const ready=el&&el.getAttribute(info.renderRevisionAttribute)===info.hash&&matches(el)&&stylesReady;
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
    entry={info:entry?.info || null,pending:true,updated:Date.now()};
    hoverDescriptions.set(el,entry);
    classifyNode(el).then(result=>{
      entry.info=result?.info || {unresolved:true};entry.pending=false;entry.updated=Date.now();
    });
  }
  return entry.info;
}
function outlineKind(el, info) {
  if(info?.kind==='instance' && !info.inlineComponent)return 'instance';
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
    for(const el of matchingInDocument(d,id,sel.info)) {
      if(!inTextScope(el,sel.info))continue;
      const kind=outlineKind(el,sel.info);
      drawBox(el,first?'sel':'co',kind);
      if(first && kind==='instance')badge={el,id:el.getAttribute('data-rt-i') || id};
      first=false;
    }
  }
  if(d&&sel?.multiple&&mode==='edit')for(const info of sel.multiple)if(info.id!==activeId())for(const el of matchingEls(info.id))drawBox(el,'co',outlineKind(el,info));
  if(d && editing?.el.isConnected)drawBox(editing.el,'editing',outlineKind(editing.el,editing.info));
  if(d && hoverEl?.isConnected && mode==='edit' && !editing) {
    const kind=outlineKind(hoverEl,hoverDescription(hoverEl));
    if(kind)drawBox(hoverEl,'hover',kind);
    if(kind==='instance')badge={el:hoverEl,id:hoverEl.getAttribute('data-rt-i')};
  }
  // Keep the badge mounted so pointer/focus events survive animation frames.
  if(componentBadge.matches(':hover') || componentBadge.contains(document.activeElement))badge=badgeTarget;
  if(mode!=='edit' || !badge?.el.isConnected)badge=null;
  badgeTarget=badge;componentBadge.hidden=!badge;
  if(badge){const r=badge.el.getBoundingClientRect();componentBadge.style.left=Math.max(0,r.left)+'px';componentBadge.style.top=Math.max(0,r.top-22)+'px';}
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
  layers.selection(sel ? matchingEls(activeId()).find(el=>inTextScope(el,sel.info)) : null, sel?.info, !!panelTasks || undoBusy || !!sourceRequests,sel?.multiple?.flatMap(info=>matchingEls(info.id))||[]);
}

function inTextScope(el, info) {
  return Object.entries(info.renderScope || {}).every(([name,value])=>el.getAttribute(name)===value);
}
function drawBox(el, cls, kind) {
  const r = el.getBoundingClientRect();
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
  label.textContent = 'Style changes';
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
  for (const item of options) {
    const option = document.createElement('option');
    option.value = item.prefix;
    option.textContent = item.label + (item.condition ? ` · ${item.condition}` : '');
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
  window.dispatchEvent(new CustomEvent('retouch:style-scope',{detail:{prefix:styleScope,label:chosen?.label||styleScope,condition,queries:chosen?.queries}}));
  if (condition && RetouchResponsive.matches({condition,queries:chosen?.queries},iframe.contentWindow)===false) {
    RetouchInspector.note(section, 'This breakpoint does not match the current preview. Its conditions may include width, height or orientation.');
  }
  if (!sel.info.cssAuthoring && styleScope && RetouchResponsive.project(sel.info.className,styleScope)) {
    section.append(RetouchInspector.button('Reset overrides at this size',()=>setClasses('')));
  }
  return section;
}
function panelInteractionFocused(){return panelBody.contains(document.activeElement)&&!document.activeElement.matches('[data-canvas-tool]');}
let viewportRenderPending = false;
window.addEventListener('retouch:viewport',()=>{
  if(viewportRenderPending)return;
  viewportRenderPending=true;
  requestAnimationFrame(()=>{
    viewportRenderPending=false;
    if(sel && !panelTasks && !panelInteractionFocused())renderPanel();
  });
});
let renderedPanelSelection=null,panelPointer=null,panelRenderDeferred=false;
window.addEventListener('pointerdown',event=>{
  if(event.button===0&&panelBody.contains(event.target))panelPointer={id:event.pointerId};
},true);
function releasePanelPointer(event){
  const pointer=panelPointer;if(!pointer||event&&event.pointerId!==pointer.id)return;
  // Keep the existing control through the browser's compatibility click.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(panelPointer!==pointer)return;panelPointer=null;
    if(panelRenderDeferred&&sel){panelRenderDeferred=false;renderPanel();}
  }));
}
window.addEventListener('pointerup',releasePanelPointer,true);
window.addEventListener('pointercancel',releasePanelPointer,true);
window.addEventListener('blur',()=>releasePanelPointer());
function renderPanel() {
  // Selection is part of the completed edit, even before the next paint.
  syncLayerSelection();
  const panel=document.getElementById('panel');
  const key=JSON.stringify([sel.info.file,sel.scope,sel.instanceId,(sel.multiple||[sel.info]).map(info=>info.id).sort()]);
  if(panelPointer&&key===renderedPanelSelection){panelRenderDeferred=true;return;}
  panelRenderDeferred=false;
  const top=key===renderedPanelSelection?panel.scrollTop:0;
  const focusedTool=key===renderedPanelSelection&&panelBody.contains(document.activeElement)?document.activeElement.dataset.canvasTool:null;
  renderedPanelSelection=key;
  // Rebuilding an empty fieldset can clamp its scroll container to zero.
  // Restore synchronously after all sections (including early returns) exist.
  try { renderPanelContents(); } finally { panel.scrollTop=top;if(focusedTool)[...panelBody.querySelectorAll('[data-canvas-tool]')].find(el=>el.dataset.canvasTool===focusedTool)?.focus({preventScroll:true}); }
}
function renderPanelContents() {
  window.dispatchEvent(new CustomEvent('retouch:selection',{detail:activeId()}));
  const info = sel.info;
  const style = scopedInfo(info);
  panelEmpty.hidden = true;
  panelBody.hidden = false;
  panelBody.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'sec';
  const badge = document.createElement('span');
  badge.className = 'kindbadge' + (info.kind === 'instance' ? ' instance' : '');
  badge.textContent = sel.multiple?.length>1?sel.multiple.length+' layers':info.kind === 'instance' ? 'component' : '<' + info.tag + '>';
  head.appendChild(badge);
  const file = document.createElement('div');
  file.className = 'filepath';
  file.textContent = info.file;
  head.appendChild(file);
  head.appendChild(screenScopeSection());
  panelBody.appendChild(head);
  {const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0,scope=info.classColorStyles?styleScope:width;
   RetouchColorStyles.mount(panelBody,sel.multiple?.length>1?selectionColorOptions(scope):info.colorStyles||info.classColorStyles?{width:scope,allLinks:info.colorStyleLinks,links:info.colorStyleLinks?.[scope],overrides:info.colorStyleOverrides?.[scope]||[],inherited:info.classColorStyles?property=>RetouchResponsive.inheritedLink(Object.fromEntries(Object.entries(info.colorStyleLinks||{}).filter(([,group])=>group[property]).map(([key,group])=>[key,group[property]])),styleScope,matchingEls(info.id)[0]?.ownerDocument):undefined,apply:(styleId,libraryRevision,property)=>writeTextStyle('applyColorStyle',width,{scope:styleScope,styleId,libraryRevision,property}),reset:(styleId,libraryRevision,property)=>writeTextStyle('resetColorStyle',width,{scope:styleScope,styleId,libraryRevision,property}),detach:property=>writeTextStyle('detachColorStyle',width,{scope:styleScope,property})}:{});
  }

  if(sel.multiple?.length>1){mountSelectionTextStyles();if(info.classSelection){const elements=sel.multiple.map(item=>matchingEls(item.id)[0]),strategy=RetouchReactSelectionGeometry.strategy(sel.multiple,elements,styleScope,{reason:reactGeometryReason,matches:matchingEls,save:setReactClassesSelection});panelBody.append(RetouchSelectionLayout.mount(sel.multiple,elements,0,null,transformLayerSelection,strategy),RetouchReactSelection.mount(sel.multiple,elements,styleScope,setReactClassesSelection));return;}const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0;const elements=sel.multiple.map(info=>matchingEls(info.id)[0]);panelBody.append(RetouchSelectionLayout.mount(sel.multiple,elements,width,(changes,w)=>setHTMLCSSSelection(null,null,w,changes),transformLayerSelection),RetouchHTMLCSS.mountSelection(sel.multiple,elements,width,setHTMLCSSSelection));return;}

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
    scopes.className = 'scopes sec';
    for (const s of ['instance', 'host']) {
      const b = document.createElement('button');
      b.textContent = s === 'instance' ? 'This instance' : 'Component';
      if (sel.scope === s) b.classList.add('active');
      b.onclick = () => { sel.scope = s; loadScope(); };
      scopes.appendChild(b);
    }
    panelBody.appendChild(scopes);
  }

  const componentTarget = matchingEls(activeId())[0]?.closest('[data-rt-i]');
  const componentId = sel.instanceId || componentTarget?.getAttribute('data-rt-i');
  if (componentId && !info.textLeaf) panelBody.appendChild(componentSection(componentId));
  if (info.kind === 'instance' && !info.canSetSrc) {
    RetouchInspector.note(panelBody, 'Instance props are listed above. Edit the definition for shared styles, or detach this usage for independent styles.');
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
    const pointField=info.svgGeometry.fields.find(field=>['points','d'].includes(field.name));
    if(pointField&&pointField.editable!==false&&(pointField.name==='d'?RetouchSVGPath.parseCompound(pointField.value)?.subpaths[0].nodes:RetouchSVGPoints.parse(pointField.value))?.length>=2){const editPoints=RetouchInspector.button('Edit vector points',()=>editSVGPoints(info));editPoints.dataset.canvasTool='vertices';geometry.append(editPoints);}
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
    const naming=RetouchInspector.section('Layer');
    const input=document.createElement('input');input.id='layerNameInput';input.type='text';input.maxLength=200;input.value=info.layerName||'';input.placeholder='Use the page’s element label';
    RetouchInspector.field(naming,'Layer name',input);input.onchange=()=>renameLayer(input.value);
    RetouchInspector.note(naming,'Names appear in the editor without changing page text or accessibility labels. Clear to use the original label.');panelBody.append(naming);
    const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0;
    const position=target?.namespaceURI!=='http://www.w3.org/2000/svg'?RetouchHTMLPosition.mount(info,target,width,setHTMLCSS,(g,action,opener)=>moveHTMLLayer(info,target,width,g,action,opener)):null;
    panelBody.appendChild(RetouchHTMLCSS.mount(info,target,width,setHTMLCSS,position,writeTextStyle));
    if(target?.tagName==='IMG')panelBody.appendChild(RetouchImageStyle.mount(info,target,null,(property,value)=>setHTMLCSS(property,value,width),info.cssRules?.[width]||{}));
    if(info.canSetTag){const section=RetouchInspector.section('Element');RetouchInspector.select(section,'HTML element',['h1','h2','h3','h4','h5','h6','p','span','div','blockquote','label','a','li'].map(tag=>[tag,tag]),info.tag,setTag);panelBody.appendChild(section);}
    if(info.src!==null)panelBody.appendChild(imageSection(info));
  }else{
  if(target?.namespaceURI==='http://www.w3.org/2000/svg')panelBody.appendChild(RetouchSVGPaint.mount(style,target,setClasses));
  const textLayer=RetouchInspector.isTextLayer(info.tag);
  if(textLayer) panelBody.appendChild(RetouchInspector.typography(style, target, setClasses, setTag,(type,scope,extra)=>writeTextStyle(type,undefined,{scope,...extra})));
  panelBody.appendChild(RetouchInspector.position(style, target, setClasses, message => toast(message, 'err'),info.renderRevisionAttribute&&target?.namespaceURI==='http://www.w3.org/1999/xhtml'?(action,opener)=>transformReactLayer(info,target,action,opener):null,info.renderRevisionAttribute&&target?.namespaceURI==='http://www.w3.org/1999/xhtml'?(classes,g)=>writeReactBounds(info,classes,g):null));
  panelBody.appendChild(RetouchLayout.mount(style, target, setClasses));
  panelBody.appendChild(RetouchInspector.appearance(style, target, setClasses));
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

function componentSection(id) {
  const sec = RetouchInspector.section('Component');
  sec.classList.add('component-section');
  const description = RetouchInspector.note(sec, 'Loading definition…');
  api('GET', componentUrl(id,sel?.info?.context)).then(component => {
    if (!sec.isConnected) return;
    if(component?.inlineComponent){sec.remove();return;}
    if (!component?.ok) { description.textContent = component?.reason || 'Definition unavailable.'; return; }
    description.textContent = component.name + ' · ' + component.file;
    if (component.detached) sec.querySelector('h3').textContent = 'Detached component';
    const actions = document.createElement('div'); actions.className = 'component-actions';
    actions.append(RetouchInspector.button('View component', () => openComponent(id, component)));
    const edit = RetouchInspector.button('Edit definition', () => editDefinition(id, component));
    edit.disabled = !component.definitionId; actions.append(edit);
    const detach = RetouchInspector.button('Detach instance', () => detachInstance(id, component, detach));
    detach.disabled = !component.canDetach; if (!component.detached) actions.append(detach); sec.append(actions);
    const count=matchingInDocument(doc(),id,component).length;
    RetouchInspector.note(sec, `${count} rendered instance${count === 1 ? '' : 's'} at this usage. ${component.detached ? 'This module is independent of the original component.' : 'Definition edits are shared.'}`);
    if(!component.canDetach&&!component.detached&&component.reason)RetouchInspector.note(sec,component.reason);
    if (component.props.length) sec.append(propTable(component.props));
  });
  return sec;
}
function propTable(props) {
  const table = document.createElement('table'); table.className = 'component-props';
  const thead = document.createElement('thead'); const header = document.createElement('tr');
  for (const text of ['Prop', 'This instance', 'Default']) { const th=document.createElement('th');th.textContent=text;header.append(th); }
  thead.append(header); table.append(thead);
  const body=document.createElement('tbody');
  for(const prop of props){const row=document.createElement('tr');for(const value of [prop.name,prop.value,prop.default]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);}
  table.append(body);return table;
}
async function editDefinition(instanceId, component) {
  if (!component.definitionId) return;
  const roots=matchingInDocument(doc(),instanceId,component);
  const target=roots.map(root=>root.getAttribute('data-rt')===component.definitionId?root:root.querySelector(`[data-rt="${component.definitionId}"]`)).find(Boolean);
  const response = await api('GET', resolveUrl(component.definitionId, target?renderContext(target):sel?.info?.context));
  if (!response?.ok) return toast('The definition changed. Re-select the component.', 'err');
  sel = { hostId: component.definitionId, instanceId, scope: 'host', info: response.element };
  renderPanel(); toast(component.detached ? 'Editing detached definition' : 'Editing shared definition', 'ok');
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
      await refreshWrittenElement(usage.element, el => el.getAttribute('data-rt') === detached.definitionId);
      await editDefinition(id, detached);
    }
    toast('Detached to ' + result.detachedFile, 'ok');
  } finally { button.disabled = false; }
}
function openComponent(id, component) {
  const modal = document.createElement('dialog');modal.className = 'component-modal';
  const header = document.createElement('header');
  const title = document.createElement('h2');title.textContent = component.name;
  const close = RetouchInspector.button('Close',()=>modal.close());header.append(title,close);modal.append(header);
  RetouchInspector.note(modal, component.file, 'filepath');
  const content=document.createElement('div');content.className='component-workspace';
  const canvas=document.createElement('div');canvas.className='component-canvas';
  RetouchInspector.note(canvas,'Live preview · current instance props');
  const preview=document.createElement('iframe');preview.title='Component preview';canvas.append(preview);
  const sidebar=document.createElement('div');sidebar.className='component-details';
  const h=document.createElement('h3');h.textContent='Props';sidebar.append(h,propTable(component.props));
  RetouchInspector.note(sidebar,'Values show the usage source. Expressions keep their application context.');
  const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Component definition';
  const code=document.createElement('pre');code.textContent=component.source;details.append(summary,code);sidebar.append(details);
  const edit=RetouchInspector.button('Edit definition',()=>{modal.close();editDefinition(id,component);});edit.disabled=!component.definitionId;sidebar.append(edit);
  content.append(canvas,sidebar);modal.append(content);document.body.append(modal);
  let stop;
  preview.onload=()=>{
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
        const el=matchingInDocument(d,id,component)[0];if(!el)return;
        const rules=[];
        let child=el;
        for(let parent=el.parentElement;parent;parent=parent.parentElement){
          for(const sibling of parent.children)if(sibling!==child&&!['STYLE','LINK','SCRIPT','HEAD'].includes(sibling.tagName))rules.push(selector(sibling)+'{display:none!important}');
          if(parent!==d.documentElement)rules.push(selector(parent)+'{'+Object.entries({display:'block',position:'static',width:'auto',height:'auto','min-height':'0',margin:'0',padding:parent===d.body?'32px':'0',transform:'none',overflow:'visible'}).map(([p,v])=>p+':'+v+'!important').join(';')+'}');
          child=parent;
        }
        rules.push(selector(el)+'{margin:0!important}');sheet.replaceSync(rules.join('\n'));
      };
      isolate(); const observer=new MutationObserver(isolate);observer.observe(d.body,{childList:true,subtree:true});stop=()=>observer.disconnect();
      d.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();},true);
    }catch{RetouchInspector.note(canvas,'Preview could not attach to this page.');}
  };
  preview.src=iframe.contentWindow.location.href;
  modal.addEventListener('close',()=>{stop?.();modal.remove();});
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
  return pal;
}

function palBtn(tokens, current, token, color) {
  const b = document.createElement('button');
  b.className = 'palbtn' + (token === current ? ' cur' : '');
  b.title = token;
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
    const result=await api('POST','/rt/__api/op',{type:'renameElement',id:info.id,fileHash:info.hash,name});
    if(!result?.ok)return toast(result?.reason||result?.error||'Could not name layer','err');
    if(result.undoId)editorHistory.record({type:'renameElement',id:info.id,undoId:result.undoId});
    sel.info=result.element;await reloadFrame();renderPanel();toast('Layer named','ok');
  }finally{busyPanel(false);}
}
function selectionColorOptions(width){
  const selection=sel.multiple;
  if(!selection.every(info=>info.colorStyles||info.classColorStyles))return {};
  async function write(type,property,styleId,libraryRevision){
    const info=sel.info,ids=selection.map(item=>item.id),react=!!info.classColorStyles;busyPanel(true);
    try{
      const result=await api('POST','/rt/__api/op',{type,id:info.id,ids,fileHash:info.hash,width:react?0:width,scope:react?width:undefined,property,styleId,libraryRevision});
      if(!result?.ok)throw Error(result?.reason||result?.error||'Could not update selected colors.');
      if(result.undoId)editorHistory.record({type:react?'setClassesSelection':'setCSSSelection',id:info.id,selectionIds:ids,undoId:result.undoId});
      sel.info=result.element;sel.multiple=result.selection;if(react)await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument));else await reloadFrame();renderPanel();toast('Selected colors updated','ok');
    }finally{busyPanel(false);}
  }
  return {width,selection,apply:(id,revision,property)=>write('applyColorStyleSelection',property,id,revision),resetSelection:(revision,property)=>write('resetColorStyleSelection',property,undefined,revision),detachSelection:property=>write('detachColorStyleSelection',property)};
}
function mountSelectionTextStyles(){
  const selection=sel.multiple,element=matchingEls(sel.info.id)[0];
  if(!element||!selection.every(info=>info.classTextStyles||info.cssAuthoring))return;
  const scope=sel.info.classSelection?styleScope:String(styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0);
  const links=selection.map(info=>info.textStyleLinks?.[scope]).filter(Boolean),overrides=selection.reduce((sum,info)=>sum+(info.textStyleOverrides?.[scope]?.length||0),0);
  async function write(type,styleId,libraryRevision){
    const info=sel.info,ids=selection.map(item=>item.id),react=!!info.classSelection;busyPanel(true);
    try{
      const width=styleScope?Number(/^min-\[(\d+)px\]:$/.exec(styleScope)?.[1]):0;
      const result=await api('POST','/rt/__api/op',{type,id:info.id,ids,fileHash:info.hash,scope:styleScope,width,styleId,libraryRevision});
      if(!result?.ok)throw Error(result?.reason||result?.error||'Could not update text styles in this selection.');
      if(result.undoId)editorHistory.record({type:react?'setClassesSelection':'setCSSSelection',id:info.id,selectionIds:ids,undoId:result.undoId});
      sel.info=result.element;sel.multiple=result.selection;
      if(react)await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument));else await reloadFrame();
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
    const result=await api('POST','/rt/__api/op',{type:'setClassesSelection',id:info.id,ids:selection.map(item=>item.id),fileHash:info.hash,classesById});
    if(!result?.ok){renderPanel();return toast(result?.reason||result?.error||'Could not style selected layers','err');}
    if(result.undoId)editorHistory.record({type:'setClassesSelection',id:info.id,selectionIds:selection.map(item=>item.id),undoId:result.undoId});
    sel.info=result.element;sel.multiple=result.selection;await refreshWrittenElement(result.element,el=>classSelectionMatches(result.selection,el.ownerDocument));
    if(expected){let ready=false;for(let attempt=0;attempt<50;attempt++){ready=Object.entries(expected).every(([id,g])=>{const el=matchingEls(id)[0];if(!el?.isConnected)return false;try{const actual=RetouchInspector.geometry(el);return ['x','y','width','height'].every(key=>Math.abs(actual[key]-g[key])<.6);}catch{return false;}});if(ready)break;await new Promise(resolve=>setTimeout(resolve,100));}if(!ready){renderPanel();toast('Saved selection classes, but the bounds did not settle. Check responsive or inline overrides.','err');return false;}}
    renderPanel();toast('Selected layers updated','ok');return true;
  }catch(error){renderPanel();toast(error.message,'err');return false;}finally{busyPanel(false);}
}
function svgGeometryMatches(el,info){return info.svgGeometry?.fields.every(field=>field.editable===false||el.getAttribute(field.name)===field.value);}
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

window.RetouchColorStyleRequest=async operation=>{
 const info=sel?.info;busyPanel(true);
 try{
  const result=await api('POST','/rt/__api/color-styles',operation);if(!result?.ok)throw Error(result?.reason||result?.error||'Could not save color styles');
  if(result.undoId)editorHistory.record({type:'colorStyleCatalog',id:info?.id,context:info?.context,undoId:result.undoId});
  if(result.updated){const fresh=info?await api('GET',resolveUrl(info.id,info.context)):null;if(fresh?.ok&&sel?.info.id===info.id){sel.info=fresh.element;await refreshTextStyleElement(fresh.element);}else await reloadFrame();if(sel)renderPanel();}
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
  if(info.classTextStyles)await refreshWrittenElement(info,el=>{
    try{return JSON.stringify(JSON.parse(el.getAttribute('data-rt-text-styles')||'{}'))===JSON.stringify(info.textStyleLinks||{})&&JSON.stringify(JSON.parse(el.getAttribute('data-rt-color-styles')||'{}'))===JSON.stringify(info.colorStyleLinks||{})&&(info.className||'').split(/\s+/).filter(Boolean).every(token=>el.classList.contains(token));}catch{return false;}
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
    if(res.element)for(const key of ['colorStyleLinks','colorStyleOverrides','classColorStyles','colorStyleLinkReason'])info[key]=res.element[key];
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
  return matchingInDocument(d,id,sel?.info?.id===id?sel.info:null);
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
    const fresh = await api('GET', resolveUrl(op.id, op.context));
    if (fresh?.ok) { sel = { hostId: op.id, instanceId: null, scope: 'host', info: fresh.element }; renderPanel(); }
    else clearSelection();
    if (fresh?.ok) {
      const info = fresh.element;
      const selectionResult=op.type==='setClassesSelection'?await Promise.all(op.selectionIds.map(id=>api('GET',resolveUrl(id)))):null;
      const component = op.type === 'detachComponent' ? await api('GET', componentUrl(op.id,op.context)) : null;
      await refreshWrittenElement(info, el => {
        if(selectionResult)return selectionResult.every(result=>result?.ok)&&classSelectionMatches(selectionResult.map(result=>result.element),el.ownerDocument);
        if(op.svgCreatedId){const found=matchingInDocument(el.ownerDocument,op.svgCreatedId,null).length>0;return direction==='undo'?!found:found;}
        if (component?.ok) return el.getAttribute('data-rt') === component.definitionId;
        if (op.type === 'setSrc') return imageMatches(el,info.src,info.srcMatch);
        if (op.type === 'setSVGGeometry') return svgGeometryMatches(el,info);
        if (op.type === 'setTag') return el.tagName.toLowerCase() === info.tag;
        if (op.type === 'setClasses' && !info.classNameDynamic) {
          const tokens = value => (value || '').split(/\s+/).filter(Boolean).sort().join(' ');
          return tokens(el.getAttribute('class')) === tokens(info.className);
        }
        return (info.className || '').split(/\s+/).filter(Boolean).every(t => el.classList.contains(t));
      });
    } else await reloadFrame();
    const selectionIds=direction==='undo'?op.selectionBefore||op.selectionIds:op.selectionAfter||op.selectionIds;
    if(sel&&selectionIds)await restoreLayerSelection(selectionIds);
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
  if(canvasZoomShortcut(e)||lockShortcut(e))return;
  if (document.querySelector('dialog[open]')) return;
  if (e.key === 'Alt') measuring = true;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.target.closest?.('input,textarea,[contenteditable="true"]')) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if (e.key === 'Escape') {
    if(stopDrawing){e.preventDefault();stopDrawing();return;}
    clearSelection();
  }
});
window.addEventListener('keyup', (e) => { if (!e.altKey) measuring = false; });
window.addEventListener('blur', () => { measuring = false; });

/* ---------- util ---------- */
async function api(method, url, body) {
  const writes = method === 'POST' && ['/rt/__api/op','/rt/__api/text-styles','/rt/__api/color-styles'].includes(url);
  const route = writes ? currentPageRoute() : null;
  if(writes && editorHistory.busy && !['undo','redo'].includes(body?.type)) return {ok:false,reason:'Wait for history restoration to finish.'};
  if(writes){sourceRequests++;syncHistoryControls();}
  try {
    const res = await fetch(url, {
      method,
      headers: { 'x-retouch-token': TOKEN, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result=await res.json();
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
function canvasZoomShortcut(e){
  if(!e.shiftKey||e.metaKey||e.ctrlKey||e.altKey||!['Digit1','Digit2'].includes(e.code))return false;
  if(mode!=='edit'||editing||e.target.isContentEditable||document.querySelector('dialog[open]')||e.target.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]'))return false;
  e.preventDefault();e.stopImmediatePropagation();
  if(e.repeat||panelTasks||undoBusy||sourceRequests)return true;
  const button=document.getElementById(e.code==='Digit1'?'fitScreen':'zoomSelection');
  if(!button.disabled)button.click();
  return true;
}
function lockShortcut(e){
  if(!(e.metaKey||e.ctrlKey)||!e.shiftKey||e.altKey||e.key.toLowerCase()!=='l')return false;
  if(mode!=='edit'||editing||e.target.isContentEditable||document.querySelector('dialog[open]')||e.target.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]'))return false;
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
  const elements=sel.multiple?sel.multiple.flatMap(info=>matchingEls(info.id)):matchingEls(activeId());
  busyPanel(true);button.setAttribute('aria-busy','true');
  try{
    const result=await window.RetouchZoom.toSelection(elements);
    if(!result.ok)toast(result.reason,'err');else if(result.clipped)toast('Some selected layers extend beyond the current screen viewport.');
  }catch(error){toast(error.message,'err');}finally{button.setAttribute('aria-busy','false');busyPanel(false);}
};

let layerClipboard=null;
const layers = RetouchLayers.mount({
  locks:layerLocks,
  onLock:setLayerLocks,
  getClipboard:()=>layerClipboard,
  dragEnabled:window.__RT_RENDERING?.layerReparenting===true,
  multiSelectEnabled:window.__RT_RENDERING?.selectionStyling===true,
  onMove:async(source,destination,position)=>{
    if(panelTasks||undoBusy||sourceRequests||!source.isConnected||!destination.isConnected)return;
    await commitInlineEdit();if(sel?.multiple?.some(info=>info.id===source.getAttribute('data-rt')))return structureSelection('reparentElement',{destinationId:destination.getAttribute('data-rt'),position});await select(source);
    if(!sel?.info.structure?.canReparent)return toast(sel?.info.structure?.reason||'This layer cannot be moved into another container.','err');
    await moveLayerInto(sel.info,destination.getAttribute('data-rt'),position);
  },
  host:document.getElementById('layersPanel'),
  onSelect:async(el,options)=>{if(panelTasks||undoBusy||sourceRequests)return;await commitInlineEdit();await select(el,options);el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});},
  onSelectMany:async(nodes,options)=>{if(panelTasks||undoBusy||sourceRequests)return;await commitInlineEdit();await selectMany(nodes,options);},
  onAction:action=>structureAction(action),
});
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
    editorHistory.record({type:'structure',id:result.parentId,undoId:result.undoId});await reloadFrame();
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
    onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});
  if(stopDrawing)toast('Drag a box to select points; Shift adds to the selection. Drag points or use arrows to move. Done/Enter saves; Escape cancels.','ok');
}
async function drawVector(info){
  if(panelTasks||undoBusy||sourceRequests||editing)return;
  stopDrawing?.();const targets=matchingEls(info.id);
  if(targets.length!==1)return toast('Select an SVG container rendered once to draw into.','err');
  if(!await prepareVectorCanvas(info,targets[0]))return;
  stopDrawing=RetouchSVGPen.mount({target:targets[0],frame:iframe,canvas:canvasSurface,
    onCommit:(points,closed,nodes)=>insertLayer(nodes?'path':closed?'polygon':'polyline',info,'insertSVG',nodes?{nodes,closed}:{points}),
    onEnd:()=>{stopDrawing=null;},onError:message=>toast(message,'err')});
  if(stopDrawing)toast('Click for corners; drag for curves. Shift constrains direction. Click the first point to close, or Enter to finish a line. Backspace removes the last point; Escape cancels.','ok');
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
  const selected=await Promise.all(ids.map(id=>api('GET',resolveUrl(id))));
  if(!selected.length||selected.some(result=>!result?.ok))return;
  const infos=selected.map(result=>result.element),first=infos[0];sel={hostId:first.id,instanceId:null,scope:'host',info:first,multiple:infos.length>1?infos:undefined};
}
async function structureSelection(action,extra={}){
  if(sel.multiple?.length>1&&!sel.info.cssAuthoring)return toast('React selection structure editing is not available yet.','err');
  const selection=sel.multiple||[sel.info],info=sel.info;busyPanel(true);
  try{
    const type=['frameSelection','removeFrame'].includes(action)?action:action==='duplicateElement'?'duplicateSelection':action==='deleteElement'?'deleteSelection':'reparentSelection';
    const result=await api('POST','/rt/__api/op',{type,id:info.id,ids:selection.map(item=>item.id),fileHash:info.hash,...extra});
    if(!result?.ok)return toast(result?.reason||result?.error||'Could not update selected layers','err');
    editorHistory.record({type:'structureSelection',id:result.parentId,selectionBefore:selection.map(item=>item.id),selectionAfter:result.selectionIds,undoId:result.undoId});
    await reloadFrame();await restoreLayerSelection(result.selectionIds);if(sel)renderPanel();
    toast(result.rootCount+' layer'+(result.rootCount===1?'':'s')+(action==='duplicateElement'?' duplicated':action==='deleteElement'?' deleted':action==='frameSelection'?' framed':action==='removeFrame'?' released from frame':' moved'),'ok');
  }finally{busyPanel(false);}
}
async function structureAction(action) {
  if(!sel || panelTasks || undoBusy || sourceRequests)return;
  if(['frameSelection','removeFrame'].includes(action)){await commitInlineEdit();if(sel)return structureSelection(action);return;}
  if(sel.multiple?.length>1){if(action==='reparentElement')return chooseLayerParent(sel.info);if(['duplicateElement','deleteElement'].includes(action))return structureSelection(action);return toast('Choose one layer for this structural edit.','err');}
  await commitInlineEdit();
  const info=sel?.info;if(!info)return;
  if(action==='deleteElement'&&info.svgDeletion||action==='duplicateElement'&&info.svgDuplication||['before','after','first','last'].includes(action)&&info.svgMovement){
    const deleting=action==='deleteElement',duplicating=action==='duplicateElement';
    busyPanel(true);
    try{
      const result=await api('POST','/rt/__api/op',{type:deleting?'deleteElement':duplicating?'duplicateElement':'moveElement',direction:action,id:info.id,fileHash:info.hash});
      if(!result?.ok)return toast(result?.reason||result?.error||'Could not update SVG layer','err');
      const selectionAfter=[deleting?result.parentId:duplicating?result.createdId:result.movedId];
      editorHistory.record({type:'structureSelection',id:result.parentId,selectionBefore:[info.id],selectionAfter,undoId:result.undoId});
      await restoreLayerSelection(selectionAfter);
      if(sel?.info.renderRevisionAttribute)await refreshWrittenElement(sel.info,()=>true);else await reloadFrame();
      renderPanel();toast(deleting?'Layer deleted':duplicating?'Layer duplicated':'Layer moved','ok');
    }finally{busyPanel(false);}
    return;
  }
  if(action==='reparentElement')return chooseLayerParent(info);
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
  else if(action==='before'||action==='after') {
    const to=at+(action==='before'?-1:1);
    if(to<0||to>=expected.length)return;
    const item=expected.splice(at,1)[0];expected.splice(to,0,item);
  } else return;
  busyPanel(true);
  try {
    const result=await api('POST','/rt/__api/op',{type:action==='before'||action==='after'?'moveElement':action,direction:action,id:info.id,fileHash:info.fileHash||info.hash,context:info.context,...(action==='pasteElement'?{copiedId:layerClipboard.id,copiedHash:layerClipboard.hash}:{})});
    if(!result?.ok){toast(result?.reason||result?.error||'Could not change this layer','err');return;}
    const parentId=result.parentId||info.structure?.parentId;
    editorHistory.record({type:'structure',id:parentId||info.id,undoId:result.undoId,context:info.context});
    const fresh=parentId?await api('GET',resolveUrl(parentId,info.context)):null;
    if(fresh?.ok) {
      await refreshWrittenElement(fresh.element,el=>JSON.stringify([...el.children].map(signature))===JSON.stringify(expected));
      sel={hostId:parentId,instanceId:null,scope:'host',info:fresh.element};renderPanel();
    } else {await reloadFrame();clearSelection();}
    toast('Layer updated','ok');
  } finally {busyPanel(false);}
}
