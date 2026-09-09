'use strict';
/* Retouch shell: selection, co-highlight, class/text/spacing edits, undo.
   Same-origin iframe; direct DOM access per RFC-0001 rev 6 (OQ-B4). */

const TOKEN = window.__RT_TOKEN;
const iframe = document.getElementById('app');
const overlayLayer = document.getElementById('overlayLayer');
const modeBtn = document.getElementById('modeBtn');
const routeInput = document.getElementById('routeInput');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const statusEl = document.getElementById('status');
const panelEmpty = document.getElementById('panelEmpty');
const panelBody = document.getElementById('panelBody');

const SPACING_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32];

let mode = 'edit'; // 'edit' | 'interact'
let sel = null; // { hostId, instanceId, scope: 'host'|'instance', info }
let editing = null; // { el, id, info, original, originalHTML, snapshot, originalTree } during inline text editing
let hoverEl = null;
let measuring = false;
let sourceRequests = 0;
let undoBusy = false;
let classificationSerial = 0;
let panelTasks = 0;
function busyPanel(start) {
  panelTasks += start ? 1 : -1;
  syncHistoryControls();
}
let lastAppPath = null;
let styleScope = '';
function scopedInfo(info) { return {...info,styleScope,className:RetouchResponsive.project(info.className,styleScope)}; }

const editorHistory = RetouchHistory.createHistory({apply:restoreHistory,onChange:syncHistoryControls});
function syncHistoryControls() {
  undoBusy = editorHistory.busy;
  const busy = undoBusy || panelTasks > 0 || sourceRequests > 0;
  undoBtn.disabled = busy || !editorHistory.canUndo;
  redoBtn.disabled = busy || !editorHistory.canRedo;
  undoBtn.setAttribute('aria-busy',String(busy));
  redoBtn.setAttribute('aria-busy',String(busy));
  panelBody.disabled = busy;panelBody.inert = busy;
  panelBody.setAttribute('aria-busy',String(busy));
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
  // The compiler may deliver CSS after the source-write response. Refresh
  // computed inspector values when that CSS lands, without interrupting input.
  let styleRefresh;
  const refreshStyles = () => {
    clearTimeout(styleRefresh);
    styleRefresh = setTimeout(() => {
      if (doc() === d && sel && !panelTasks && !panelBody.contains(document.activeElement)) renderPanel();
    }, 100);
  };
  if (d.head) new MutationObserver(refreshStyles).observe(d.head,{childList:true,subtree:true,characterData:true});
  d.addEventListener('load',e=>{if(e.target.tagName==='LINK')refreshStyles();},true);
  const suppress = (e) => {
    if (mode !== 'edit') return;
    if (editing && editing.el.contains(e.target)) return; // let the text being edited behave
    e.stopPropagation();
  };
  // Selection: capture-phase click; prevent the app from reacting (OQ-E4).
  d.addEventListener('click', (e) => {
    if (mode !== 'edit') return;
    if (panelTasks > 0 || undoBusy || sourceRequests) { e.preventDefault(); e.stopPropagation(); return; }
    if (editing) {
      if (editing.el.contains(e.target)) return;
      commitInlineEdit(); // clicking away commits (R-5)
    }
    e.preventDefault();
    e.stopPropagation();
    const t = e.target.closest && e.target.closest('[data-rt], [data-rt-i]');
    // Single click selects AND, when the element has editable literal text,
    // enters in-place editing directly (user decision, 2026-09-02).
    if (t) startInlineEdit(t, e, true);
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
    const t = e.target.closest && e.target.closest('[data-rt], [data-rt-i]');
    if (t) startInlineEdit(t, e);
  }, true);
  d.addEventListener('mousemove', (e) => {
    if (mode !== 'edit') { hoverEl = null; return; }
    measuring = e.altKey;
    hoverEl = (e.target.closest && e.target.closest('[data-rt], [data-rt-i]')) || null;
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
    lastAppPath = p;
    window.dispatchEvent(new CustomEvent('retouch:route'));
    routeInput.value = p;
    history.replaceState(null, '', '/rt' + (p === '/' ? '' : p));
  } catch {}
}

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

async function select(node) {
  const c = await classify(node);
  if (c?.superseded) return;
  if (!c) return clearSelection();
  sel = {
    hostId: c.hostId,
    instanceId: c.instanceId,
    scope: c.instanceId && c.info.id === c.instanceId ? 'instance' : 'host',
    info: c.info,
  };
  renderPanel();
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
  sel = null;
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
      try { iframe.contentWindow.scrollTo(0, y); } catch {}
      resolve();
    };
    iframe.addEventListener('load', done);
    timeout = setTimeout(done, 8000);
    try { iframe.contentWindow.location.reload(); } catch { iframe.src = iframe.src; }
  });
}

// A source write can finish before the framework invalidates its rendered
// module. Reloading immediately can miss HMR and strand an old render.
async function refreshWrittenElement(info, matches) {
  const location = iframe.contentWindow.location.href;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (iframe.contentWindow.location.href !== location) return;
    try {
      const response = await fetch(location, { cache: 'no-store' });
      if (response.ok) {
        const html = new DOMParser().parseFromString(await response.text(), 'text/html');
        const el = matchingInDocument(html,info.id,info)[0];
        if (el && matches(el)) { await reloadFrame(); return; }
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
  layers.selection(sel ? matchingEls(activeId()).find(el=>inTextScope(el,sel.info)) : null, sel?.info, !!panelTasks || undoBusy || !!sourceRequests);
  requestAnimationFrame(paintLoop);
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
  if (doc()) options.push(...RetouchResponsive.discover(doc()));
  const width = iframe.contentWindow?.innerWidth;
  if (Number.isInteger(width) && width >= 240) {
    const atWidth = RetouchResponsive.atWidth(doc(),width,options.slice(1));
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
  picker.onchange = () => { styleScope = picker.value; renderPanel(); };
  label.append(picker);section.append(label);
  RetouchInspector.note(section, styleScope
    ? 'Style changes apply to this breakpoint. Computed values reflect the preview; text and image content stay shared across sizes.'
    : 'Base styles apply at every size unless a breakpoint or state overrides them.');
  const chosen = options.find(o=>o.prefix===styleScope);
  const arbitrary = /^(min|max)-\[([\d.]+(?:px|rem|em))\]:$/.exec(styleScope);
  const condition = chosen?.condition || (arbitrary ? `(${arbitrary[1]}-width: ${arbitrary[2]})` : null);
  if (condition && !iframe.contentWindow.matchMedia(condition).matches) {
    RetouchInspector.note(section, 'This breakpoint is outside the current preview size. Resize the screen to see its styles.');
  }
  if (styleScope && RetouchResponsive.project(sel.info.className,styleScope)) {
    section.append(RetouchInspector.button('Reset overrides at this size',()=>setClasses('')));
  }
  return section;
}
let viewportRenderPending = false;
window.addEventListener('retouch:viewport',()=>{
  if(viewportRenderPending)return;
  viewportRenderPending=true;
  requestAnimationFrame(()=>{
    viewportRenderPending=false;
    if(sel && !panelTasks && !panelBody.contains(document.activeElement))renderPanel();
  });
});
function renderPanel() {
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
  badge.textContent = info.kind === 'instance' ? 'component' : '<' + info.tag + '>';
  head.appendChild(badge);
  const file = document.createElement('div');
  file.className = 'filepath';
  file.textContent = info.file;
  head.appendChild(file);
  head.appendChild(screenScopeSection());
  panelBody.appendChild(head);

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
  const textLayer=/^(h[1-6]|p|span|a|label|blockquote|li|button)$/.test(info.tag);
  if(textLayer) panelBody.appendChild(RetouchInspector.typography(style, target, setClasses, setTag));
  panelBody.appendChild(RetouchInspector.position(style, target, setClasses, message => toast(message, 'err')));
  panelBody.appendChild(RetouchLayout.mount(style, target, setClasses));
  panelBody.appendChild(RetouchInspector.appearance(style, target, setClasses));
  if (info.src !== null || info.srcDynamic) {
    if(target?.tagName==='IMG')panelBody.appendChild(RetouchImageStyle.mount(style,target,setClasses));
    panelBody.appendChild(imageSection(info));
  }
  if (!textLayer && (info.canSetTag || target?.textContent?.trim())) panelBody.appendChild(RetouchInspector.typography(style, target, setClasses, setTag));
  panelBody.appendChild(colorSection('Fill', 'bg', style));
  panelBody.appendChild(colorSection('Text color', 'text', style));
  panelBody.appendChild(RetouchInspector.effects(style, target, setClasses, message => toast(message, 'err')));

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
    if (!result?.ok) return toast(result?.error || 'Could not list images', 'err');
    for (const asset of result.images) {
      const b = RetouchInspector.button(asset.name, () => setSrc(asset.src, false, info)); b.title = asset.src; assets.append(b);
    }
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
  optimisticClasses(classes);
  const res = await api('POST', '/rt/__api/op', {
    type: 'setClasses', id: info.id, classes, fileHash: info.fileHash || info.hash, context: info.context,
  });
  if (res && res.ok) {
    if (!isUndo) editorHistory.record({ type: 'setClasses', id: info.id, classes: prev, undoId: res.undoId, context: info.context });
    info.className = res.element?.className ?? classes;
    info.hash = res.hash;
    if (window.__RT_RENDERING?.reloadAfterWrite) await refreshWrittenElement(info, el => info.className.split(/\s+/).filter(Boolean).every(token => el.classList.contains(token)));
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
  if(undoBusy || panelTasks || sourceRequests)return;
  await commitInlineEdit();
  if(undoBusy || panelTasks || sourceRequests)return;
  try {
    const result=await editorHistory[direction]();
    if(result?.empty)toast('Nothing to '+direction);
    else if(!result?.ok&&!result?.busy)toast(result?.reason||result?.error||'History restore failed','err');
  } catch(error){toast(error.message,'err');}
}
async function restoreHistory(direction,op) {
  const result=await api('POST','/rt/__api/op',{type:direction,undoId:op.undoId});
  if(!result?.ok)return result;
  // Source history has already moved. A renderer failure must not leave the
  // client stack on the old side of a successful transaction.
  try {
    const fresh = await api('GET', resolveUrl(op.id, op.context));
    if (fresh?.ok) { sel = { hostId: op.id, instanceId: null, scope: 'host', info: fresh.element }; renderPanel(); }
    else clearSelection();
    if (fresh?.ok) {
      const info = fresh.element;
      const component = op.type === 'detachComponent' ? await api('GET', componentUrl(op.id,op.context)) : null;
      await refreshWrittenElement(info, el => {
        if (component?.ok) return el.getAttribute('data-rt') === component.definitionId;
        if (op.type === 'setSrc') return imageMatches(el,info.src,info.srcMatch);
        if (op.type === 'setTag') return el.tagName.toLowerCase() === info.tag;
        if (op.type === 'setClasses' && !info.classNameDynamic) {
          const tokens = value => (value || '').split(/\s+/).filter(Boolean).sort().join(' ');
          return tokens(el.getAttribute('class')) === tokens(info.className);
        }
        return (info.className || '').split(/\s+/).filter(Boolean).every(t => el.classList.contains(t));
      });
    } else await reloadFrame();
    if (sel) renderPanel();

  } catch(error){toast('Source restored; preview refresh failed: '+error.message,'err');}
  toast(direction==='undo'?'Undone':'Redone','ok');
  return result;
}

/* ---------- chrome ---------- */
modeBtn.onclick = () => {
  mode = mode === 'edit' ? 'interact' : 'edit';
  modeBtn.textContent = mode === 'edit' ? 'Edit mode' : 'Interact mode';
  modeBtn.classList.toggle('mode-edit', mode === 'edit');
  if (mode === 'interact') { hoverEl = null; }
};
undoBtn.onclick = () => undo();
redoBtn.onclick = () => redo();
routeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') iframe.src = routeInput.value || '/';
});
window.addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]')) return;
  if (e.key === 'Alt') measuring = true;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.target.closest?.('input,textarea,[contenteditable="true"]')) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if (e.key === 'Escape') clearSelection();
});
window.addEventListener('keyup', (e) => { if (!e.altKey) measuring = false; });
window.addEventListener('blur', () => { measuring = false; });

/* ---------- util ---------- */
async function api(method, url, body) {
  const writes = method === 'POST' && url === '/rt/__api/op';
  if(writes && editorHistory.busy && !['undo','redo'].includes(body?.type)) return {ok:false,reason:'Wait for history restoration to finish.'};
  if(writes){sourceRequests++;syncHistoryControls();}
  try {
    const res = await fetch(url, {
      method,
      headers: { 'x-retouch-token': TOKEN, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await res.json();
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
}


RetouchMaxWidth.mount({
  container: overlayLayer.parentElement,
  getTarget() {
    if (mode !== 'edit' || undoBusy || sourceRequests || !sel || sel.info.classNameDynamic || sel.info.kind === 'instance') return null;
    const el = editing?.el || matchingEls(activeId()).find(el => inTextScope(el, sel.info));
    return el ? { el, info: scopedInfo(sel.info) } : null;
  },
  beforeDrag: commitInlineEdit,
  save: classes => setClasses(classes),
  notify: message => toast(message, 'err'),
});


const layers = RetouchLayers.mount({
  host:document.getElementById('layersPanel'),
  onSelect:async el=>{if(panelTasks||undoBusy||sourceRequests)return;await commitInlineEdit();await select(el);el.scrollIntoView({block:'nearest',inline:'nearest'});},
  onAction:action=>structureAction(action),
});
async function structureAction(action) {
  if(!sel || panelTasks || undoBusy)return;
  await commitInlineEdit();
  const info=sel?.info;if(!info)return;
  const target=matchingEls(info.id).find(el=>inTextScope(el,info));
  if(!target?.parentElement)return;
  const siblings=[...target.parentElement.children];
  const signature=el=>el.tagName+'|'+el.textContent.trim();
  const expected=siblings.map(signature),at=siblings.indexOf(target);
  if(action==='duplicateElement')expected.splice(at+1,0,expected[at]);
  else if(action==='deleteElement')expected.splice(at,1);
  else if(action==='before'||action==='after') {
    const to=at+(action==='before'?-1:1);
    if(to<0||to>=expected.length)return;
    const item=expected.splice(at,1)[0];expected.splice(to,0,item);
  } else return;
  busyPanel(true);
  try {
    const result=await api('POST','/rt/__api/op',{type:action==='before'||action==='after'?'moveElement':action,direction:action,id:info.id,fileHash:info.fileHash||info.hash,context:info.context});
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
