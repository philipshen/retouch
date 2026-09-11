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
const retryBtn = document.getElementById('retryPreview');
const statusEl = document.getElementById('status');
const panelEmpty = document.getElementById('panelEmpty');
const panelBody = document.getElementById('panelBody');

const SPACING_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32];

let mode = 'edit'; // 'edit' | 'interact'
let sel = null; // { hostId, instanceId, scope: 'host'|'instance', info }
let editing = null; // Original DOM nodes and source metadata retained during inline editing
let hoverEl = null;
let measuring = false;
let previewStale = false;
let staleEpoch = 0;
let retryPreview = null;
let clipboard = null;
let menuComponent = null;
let nudgeState = null;
let frameCleanup = null;
let sourceRevision = null;
let styleRevision = null;
let revisionPoll = null;
let restoringControlFocus = false;
const gestures = RetouchHistory.createGestureGroups();
const editHistory = RetouchHistory.createHistory({apply: restoreHistory, onChange: updateHistoryButtons});
function updateHistoryButtons() {
  undoBtn.disabled = editHistory.busy || previewStale || panelTasks > 0 || !editHistory.canUndo;
  redoBtn.disabled = editHistory.busy || previewStale || panelTasks > 0 || !editHistory.canRedo;
}
function recordEdit(result, info, type, before, after, syncInfo = info) {
  editHistory.record({undoId: result.undoId, id: info.id, context: info.context, type, before, after, syncInfo});
}
function textValue(value) { return (value || '').replace(/\s+/g, ' ').trim(); }
function fingerprint(el) {
  return JSON.stringify([el.tagName, textValue(el.textContent), [...el.attributes].filter(a => !a.name.startsWith('data-rt') && a.name !== 'contenteditable').map(a => [a.name,a.value]).sort(), [...el.children].filter(child => !child.hasAttribute('data-rt-token')).map(child => JSON.parse(fingerprint(child)))]);
}
function storedTextMatch(info, value) {
  const html = info.textSource?.format === 'html' ? new DOMParser().parseFromString(value || '', 'text/html').body : null;
  const rendered = html ? html.textContent : value;
  // Translation interpolation remains renderer-owned. Validate the literal
  // spans around preserved placeholders rather than comparing raw HTML or
  // interpolation syntax to the rendered text.
  const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tokens = info.textSource ? [...String(info.text || '').matchAll(/\{\{[^]*?\}\}/g)].map(match=>match[0]) : [];
  let pattern = escape(textValue(rendered));
  for (const token of tokens) pattern = pattern.split(escape(token)).join('[\\s\\S]*?');
  const expected = new RegExp('^'+pattern+'$');
  const shape = node => JSON.stringify([...node.children].map(child => [child.tagName, [...child.attributes].filter(a=>!a.name.startsWith('data-rt')).map(a=>[a.name,a.value]).sort(), shape(child)]));
  const expectedShape = html ? shape(html) : null;
  return el => expected.test(textValue(el.textContent)) && (!html || shape(el) === expectedShape);
}
function allContexts(info) { return {...info, renderScope: {}, verifyContext: info.context?.attributes || {}}; }
function classMatch(value) {
  const normalize = s => (s || '').split(/\s+/).filter(Boolean).sort().join(' ');
  return el => normalize(el.getAttribute('class')) === normalize(value);
}
function inputKey(el) { return (sel?.info?.id || '') + ':' + (el?.getAttribute?.('aria-label') || el?.id || el?.name || el?.type || 'control'); }
// Focus and pointer/key gestures are explicit boundaries, never a timer that
// accidentally joins two distinct actions.
document.addEventListener('focusin', e => {
  if (panelBody.contains(e.target) && !restoringControlFocus) gestures.begin('focus', inputKey(e.target));
}, true);
document.addEventListener('pointerdown', e => {
  if (panelBody.contains(e.target)) gestures.begin('pointer', inputKey(e.target));
  else gestures.end();
}, true);
document.addEventListener('pointerup', () => { setTimeout(() => gestures.end('pointer'), 0); }, true);
document.addEventListener('keydown', e => {
  if (panelBody.contains(e.target) && !e.metaKey && !e.ctrlKey && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) gestures.begin('key', inputKey(e.target));
}, true);
document.addEventListener('keyup', () => { setTimeout(() => gestures.end('key'), 0); }, true);
document.addEventListener('focusout', e => {
  if (e.relatedTarget && e.relatedTarget !== e.target) gestures.end('focus');
}, true);
let classificationSerial = 0;
let panelTasks = 0;
function busyPanel(start) {
  panelTasks += start ? 1 : -1;
  panelBody.disabled = panelTasks > 0 || previewStale;
  panelBody.inert = panelTasks > 0 || previewStale;
  panelBody.setAttribute('aria-busy', String(panelTasks > 0));
  updateHistoryButtons();
}
let lastAppPath = null;

/* ---------- boot ---------- */
const appPath = (location.pathname.replace(/^\/rt\/?/, '/') || '/') + location.search + location.hash;
iframe.src = mirrorPath(appPath);
routeInput.value = appPath;

iframe.addEventListener('load', () => {
  try {
    if (!iframe.contentDocument || iframe.contentWindow.location.origin !== location.origin) return;
    classificationSerial++;
    staleEpoch++;previewStale=false;retryPreview=null;retryBtn.hidden=true;
    document.getElementById('previewStatus').hidden=true;
    panelBody.disabled=panelTasks>0;panelBody.inert=panelTasks>0;updateHistoryButtons();
    if (window.__RT_RENDERING?.reloadAfterWrite) {
      const url = new URL(iframe.contentWindow.location.href); url.searchParams.set('__rt_mirror','1');
      iframe.contentWindow.history.replaceState(iframe.contentWindow.history.state, '', url);
    }
    if (editing?.el.ownerDocument !== iframe.contentDocument) editing = null;
    hoverEl = null;
    hookFrame(iframe.contentDocument, iframe.contentWindow);
    onNavigated();
    if (window.__RT_RENDERING?.reloadAfterWrite) void pollSourceRevision(true);
  } catch (err) {
    toast('Could not attach to the app frame: ' + err.message, 'err');
  }
});

window.addEventListener('pagehide', () => {});
requestAnimationFrame(paintLoop);
setInterval(pollNavigation, 300);
setInterval(() => pollSourceRevision(), 1000);
function mirrorPath(value) {
  if (!window.__RT_RENDERING?.reloadAfterWrite) return value;
  const url = new URL(value, location.origin);url.searchParams.set('__rt_mirror','1');return url.pathname+url.search+url.hash;
}
function cleanAppPath(loc) {
  const url = new URL(loc.href);url.searchParams.delete('__rt_mirror');return url.pathname+url.search+url.hash;
}
function pollSourceRevision(baseline = false) {
  if (!window.__RT_RENDERING?.reloadAfterWrite) return Promise.resolve();
  if (revisionPoll) return revisionPoll;
  revisionPoll = (async () => {
    const result = await api('GET', '/rt/__api/source-revision');
    if (!result?.ok || !result.available) {markPreviewStale('Preview monitoring is unavailable. Check the Retouch server.');return;}
    if (baseline || sourceRevision === null) {sourceRevision=result.revision;styleRevision=result.styleRevision;return;}
    if (sourceRevision !== result.revision) {
      sourceRevision=result.revision;
      markPreviewStale('Source files changed outside Retouch. The preview is paused to avoid editing stale content.');
    }
    if (styleRevision !== result.styleRevision) {
      styleRevision=result.styleRevision;
      try {await RetouchRenderSync.revalidateStyles(doc(),String(Date.now()));}
      catch (err) {
        // A stylesheet retry cannot recover an unrelated runtime/code change.
        if (previewStale && !retryPreview) return;
        markPreviewStale('Styles changed; preview is out of date. '+err.message, async () => {
          const epoch=staleEpoch;
          try {
            await RetouchRenderSync.revalidateStyles(doc(),String(Date.now()));
            await pollSourceRevision();
            if (epoch!==staleEpoch) return;
            previewStale=false;retryPreview=null;retryBtn.hidden=true;
            document.getElementById('previewStatus').hidden=true;
            panelBody.disabled=panelTasks>0;panelBody.inert=panelTasks>0;updateHistoryButtons();
          } catch (error) {toast(error.message,'err');}
        });
      }
    }
  })().finally(() => {revisionPoll=null;});
  return revisionPoll;
}

/* ---------- frame hooks ---------- */
function doc() { return iframe.contentDocument; }

function hookFrame(d, w) {
  frameCleanup?.();frameCleanup = interactions.bindDocument(d, {canvas: true, toShellPoint: framePoint});
  const suppress = (e) => {
    if (mode !== 'edit') return;
    if (editing && editing.el.contains(e.target)) return; // let the text being edited behave
    e.stopPropagation();
  };
  // Selection: capture-phase click; prevent the app from reacting (OQ-E4).
  d.addEventListener('click', (e) => {
    if (mode !== 'edit') return;
    if (panelTasks > 0 || previewStale || editHistory.busy) { e.preventDefault(); e.stopPropagation(); return; }
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
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'i')) {
        e.preventDefault(); // never let the browser's own rich-edit commands run (R-5)
        toggleWrap(e.key.toLowerCase() === 'b' ? 'strong' : 'em');
        return;
      }
      if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        commitInlineEdit();
      }
      return;
    }
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
    const p = cleanAppPath(loc);
    if (p !== lastAppPath) onNavigated();
  } catch {}
}

function onNavigated() {
  try {
    const loc = iframe.contentWindow.location;
    if (loc.origin !== location.origin) return;
    const p = cleanAppPath(loc);
    lastAppPath = p;
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
  gestures.end();menuComponent=null;
  const c = await classify(node);
  if (c?.superseded) return;
  if (!c) return clearSelection();
  sel = {
    hostId: c.hostId,
    instanceId: c.instanceId,
    scope: c.instanceId && c.info.id === c.instanceId ? 'instance' : 'host',
    info: c.info,
  };
  const componentId = c.instanceId || c.el.closest('[data-rt-i]')?.getAttribute('data-rt-i');
  if (componentId) {
    const selectedInfo = sel.info;
    const response = await api('GET', componentUrl(componentId, renderContext(c.el)));
    if (sel?.info !== selectedInfo) return;
    if (response?.ok && !response.inlineComponent) menuComponent = response;
  }
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
  gestures.end();menuComponent=null;
  sel = null;
  panelBody.hidden = true;
  panelEmpty.hidden = false;
}

/* ---------- inline text editing ---------- */
async function startInlineEdit(node, evt, quiet) {
  if (previewStale || editHistory.busy || panelTasks) return;
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
  const originalDOM = RetouchRenderSync.capture(el);
  const originalFingerprint = fingerprint(el);
  if (info.richText) {
    try { RetouchRichTextSource.prepare(el,info.richText); }
    catch(err) { RetouchRenderSync.restore(originalDOM);toast(err.message,'err');return; }
  }
  editing = {
    el,
    id: editId,
    info,
    original: el.textContent,
    originalDOM,
    originalFingerprint,
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
  if (previewStale) {if(editing)RetouchRenderSync.restore(editing.originalDOM);editing=null;return;}
  if (!editing) return;
  const ed = editing;
  editing = null;
  ed.el.removeAttribute('contenteditable');
  const children = serializeChildren(ed.el, ed.snapshot);
  if (JSON.stringify(children) === JSON.stringify(ed.originalTree)) { RetouchRenderSync.restore(ed.originalDOM);return; }

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
  const afterFingerprint = fingerprint(ed.el);
  const beforeFingerprint = ed.originalFingerprint;
  // Return the precise original nodes to React before source/HMR changes its
  // children. innerHTML restoration would clone nodes and break reconciliation.
  RetouchRenderSync.restore(ed.originalDOM);
  Object.assign(op, sourcePayload(ed.info));
  busyPanel(true);
  try {
    const res = await api('POST', '/rt/__api/op', op);
    if (res?.ok) {
      recordEdit(res, ed.info, op.type, el => fingerprint(el) === beforeFingerprint, el => fingerprint(el) === afterFingerprint);
      updateSource(ed.info, res);
      if (op.type === 'setText') ed.info.text = op.text;
      const synced = await refreshWrittenElement(ed.info, el => fingerprint(el) === afterFingerprint);
      if (sel?.info?.id === ed.id) { sel.info = res.element || ed.info; renderPanel(); }
      if (synced) toast('Saved', 'ok');
    } else toast(res?.reason || res?.error || 'Write failed', 'err');
  } finally { busyPanel(false); }
}

// Source remains authoritative. A failed renderer is visibly out of date and
// cannot accept more edits until synchronization succeeds. No reload fallback.
function markPreviewStale(message, retry) {
  if (previewStale && document.getElementById('previewStatus').textContent === message) return;
  staleEpoch++;
  if (editing) {RetouchRenderSync.restore(editing.originalDOM);editing = null;}
  if (nudgeState) {const ed=nudgeState;nudgeState=null;if(ed.style===null)ed.el.removeAttribute('style');else ed.el.setAttribute('style',ed.style);}
  previewStale = true; retryPreview = retry;updateHistoryButtons();
  panelBody.disabled = true; panelBody.inert = true;
  retryBtn.hidden = !retry;
  document.getElementById('previewStatus').hidden = false;
  document.getElementById('previewStatus').textContent = message;
  toast(message, 'err');
}
async function refreshWrittenElement(info, matches) {
  const epoch = staleEpoch;
  const attempt = () => RetouchRenderSync.sync({
    frame: iframe, serverRendered: !!window.__RT_RENDERING?.reloadAfterWrite,
    select: d => matchingInDocument(d, info.id, info).filter(el => inTextScope(el,info)),
    verifySelect: info.verifyContext ? d => matchingInDocument(d,info.id,info).filter(el => Object.entries(info.verifyContext).every(([name,value])=>el.getAttribute(name)===value)) : undefined,
    matches,
    revalidate: !!window.__RT_RENDERING?.revalidateStyles,
  });
  try {
    await attempt();
    if (window.__RT_RENDERING?.reloadAfterWrite) await pollSourceRevision();
    if (epoch !== staleEpoch) return false;
    previewStale = false; retryPreview = null; retryBtn.hidden = true;updateHistoryButtons();
    document.getElementById('previewStatus').hidden = true;
    panelBody.disabled = panelTasks > 0; panelBody.inert = panelTasks > 0;
    return true;
  } catch (err) {
    if (epoch !== staleEpoch) return false;
    markPreviewStale('Source saved; preview is out of date. ' + err.message, async () => refreshWrittenElement(info, matches));
    return false;
  }
}

// DOM -> op children tree. Implemented in serialize.js (loaded first) so it
// can be unit-tested in Node against a fake DOM.
const serializeChildren = window.RetouchSerialize.serializeChildren;

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
function renderPanel() {
  if (!sel?.info) return;
  const focused = panelBody.contains(document.activeElement) ? document.activeElement : null;
  const focusId = focused?.id, focusLabel = focused?.getAttribute('aria-label');
  const openDetails = [...panelBody.querySelectorAll('details')].map(d => d.open);
  const restoreFocus = () => {
    [...panelBody.querySelectorAll('details')].forEach((d,i) => {if (openDetails[i]) d.open = true;});
    const target = focusId ? document.getElementById(focusId) : focusLabel ? [...panelBody.querySelectorAll('[aria-label]')].find(el => el.getAttribute('aria-label') === focusLabel) : null;
    if (target && !previewStale) requestAnimationFrame(() => {if (target.isConnected && !editing) {restoringControlFocus = true;target.focus({preventScroll:true});restoringControlFocus = false;}});
  };
  const info = sel.info;
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
  if ((info.className || '').split(/\s+/).some(t => RetouchInspector.base(t) === null)) {
    RetouchInspector.note(head, 'Editing base styles. Existing breakpoint and state styles may override them.');
  }
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
    restoreFocus();return;
  }

  const target = (editing?.el.ownerDocument === doc() ? editing.el : null) || matchingEls(activeId()).find(el => inTextScope(el, info));
  panelBody.appendChild(RetouchInspector.position(info, target, setClasses, message => toast(message, 'err')));
  panelBody.appendChild(RetouchInspector.appearance(info, target, setClasses));
  if (info.src !== null || info.srcDynamic) panelBody.appendChild(imageSection(info));
  if (info.canSetTag || target?.textContent?.trim()) panelBody.appendChild(RetouchInspector.typography(info, target, setClasses, setTag));
  panelBody.appendChild(colorSection('Fill', 'bg', info));
  panelBody.appendChild(colorSection('Text color', 'text', info));
  panelBody.appendChild(RetouchInspector.effects(info, target, setClasses, message => toast(message, 'err')));

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
    ta.onchange = () => { if (ta.value !== info.text) setText(ta.value); };
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
    const tokens = (info.className || '').split(/\s+/).filter(Boolean);
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
        setClasses(((info.className || '') + ' ' + add.value.trim()).trim());
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
  restoreFocus();

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
  if (previewStale || editHistory.busy || panelTasks) return;
  gestures.end();busyPanel(true);
  button.disabled = true;
  try {
    const usage = await api('GET', resolveUrl(id,context));
    if (!usage?.ok) return toast('The usage no longer resolves.', 'err');
    const result = await api('POST', '/rt/__api/op', { type: 'detachComponent', id, fileHash: usage.element.hash, definitionHash: component.hash, context:usage.element.context });
    if (!result?.ok) return toast(result?.reason || result?.error || 'Detach failed', 'err');
    recordEdit(result, usage.element, 'detachComponent', el => el.getAttribute('data-rt') === component.definitionId, el => el.getAttribute('data-rt') === result.definitionId);
    const detached = await api('GET', componentUrl(id,usage.element.context));
    if (detached?.ok) {
      const entryMatch = el => el.getAttribute('data-rt') === detached.definitionId;
      recordEdit(result, usage.element, 'detachComponent', el => el.getAttribute('data-rt') === component.definitionId, entryMatch);
      await refreshWrittenElement(usage.element, entryMatch);
      await editDefinition(id, detached);
    }
    toast('Detached to ' + result.detachedFile, 'ok');
  } finally { button.disabled = false;busyPanel(false); }
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
  if (previewStale || editHistory.busy) return;
  busyPanel(true);
  try { return await writeTag(tag); } finally { busyPanel(false); }
}
async function writeTag(tag) {
  if (!sel || !sel.info || sel.info.tag === tag) return;
  const info = sel.info;
  const prev = info.tag;
  const res = await api('POST', '/rt/__api/op', { type: 'setTag', id: info.id, tag, fileHash: info.hash, ...sourcePayload(info,info.tagSource) });
  if (res && res.ok) {
    recordEdit(res, info, 'setTag', el => el.tagName.toLowerCase() === prev, el => el.tagName.toLowerCase() === tag);
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
  if (previewStale || editHistory.busy) return;
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
  const previousSrcMatch = info.srcMatch;
  const target = matchingEls(info.id)[0];
  const dimensions = target ? { width: Number(target.getAttribute('width')) || target.naturalWidth, height: Number(target.getAttribute('height')) || target.naturalHeight } : undefined;
  const res = await api('POST', '/rt/__api/op', { type: 'setSrc', id: info.id, src, fileHash: info.hash, dimensions, context:info.context });
  if (res && res.ok) {
    recordEdit(res, info, 'setSrc', el => imageMatches(el, prev, previousSrcMatch), el => imageMatches(el, src, res.element?.srcMatch));
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
  if (previewStale || editHistory.busy) return false;
  busyPanel(true);
  try { return await writeClasses(classes, isUndo); } finally { busyPanel(false); }
}
async function writeClasses(classes, isUndo) {
  if (!sel || !sel.info) return;
  const info = sel.info;
  const prev = info.className || '';
  const res = await api('POST', '/rt/__api/op', {
    type: 'setClasses', id: info.id, classes, fileHash: info.fileHash || info.hash, context: info.context,
  });
  if (res && res.ok) {
    recordEdit(res, info, 'setClasses', classMatch(prev), classMatch(res.element?.className ?? classes), allContexts(info));
    info.className = res.element?.className ?? classes;
    info.hash = res.hash;
    if (await refreshWrittenElement(allContexts(info), classMatch(info.className))) toast('Saved', 'ok');
    renderPanel();
  } else {
    toast((res && res.reason) || (res && res.error) || 'Write failed', 'err');
    loadScope();
  }
  return !!res?.ok;
}

async function setText(text, isUndo) {
  if (previewStale || editHistory.busy) return;
  busyPanel(true);
  try {return await writeText(text, isUndo);} finally {busyPanel(false);}
}
async function writeText(text, isUndo) {
  if (!sel || !sel.info) return;
  const info = sel.info;
  const prev = info.text;
  const res = await api('POST', '/rt/__api/op', {
    type: 'setText', id: info.id, text, fileHash: info.fileHash || info.hash, ...sourcePayload(info),
  });
  if (res && res.ok) {
    recordEdit(res, info, 'setText', storedTextMatch(info, prev), storedTextMatch(info, text));
    const matches = storedTextMatch(info, text);
    info.text = text;
    updateSource(info, res);
    if (await refreshWrittenElement(info, matches)) toast('Saved', 'ok');
  } else {
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

async function restoreHistory(type, entry) {
  busyPanel(true);
  try {return await restoreHistorySource(type, entry);} finally {busyPanel(false);}
}
async function restoreHistorySource(type, entry) {
  const result = await api('POST', '/rt/__api/op', {type, undoId: entry.undoId});
  if (!result?.ok) { toast(result?.reason || result?.error || 'History could not be restored', 'err'); return result; }
  // Source already changed: always advance history even if the renderer fails.
  try {
    const syncInfo = entry.syncInfo;
    const synced = await refreshWrittenElement(syncInfo, type === 'undo' ? entry.before : entry.after);
    const fresh = await api('GET', resolveUrl(syncInfo.id, syncInfo.context));
    if (fresh?.ok) { sel = {hostId: syncInfo.id, instanceId: null, scope: 'host', info: fresh.element}; renderPanel(); }
    else clearSelection();
    if (synced) toast(type === 'undo' ? 'Undone' : 'Redone', 'ok');
  } catch (err) { markPreviewStale('Source restored; preview is out of date. ' + err.message); }
  return result;
}
async function undo() {
  if (panelTasks || editHistory.busy || previewStale) return;
  await commitInlineEdit(); gestures.end();
  const result = await editHistory.undo();
  if (result?.empty) toast('Nothing to undo');
}
async function redo() {
  if (panelTasks || editHistory.busy || previewStale) return;
  await commitInlineEdit(); gestures.end();
  const result = await editHistory.redo();
  if (result?.empty) toast('Nothing to redo');
}
function selectedElement() { return sel && matchingEls(activeId()).find(el => inTextScope(el, sel.info)); }
function framePoint(x, y) {
  const rect = iframe.getBoundingClientRect();
  return {x: rect.left + x * rect.width / iframe.offsetWidth, y: rect.top + y * rect.height / iframe.offsetHeight};
}
async function selectedComponent(action) {
  await commitInlineEdit();
  const el = selectedElement();
  const id = sel?.instanceId || el?.closest('[data-rt-i]')?.getAttribute('data-rt-i');
  if (!id) return;
  const component = await api('GET', componentUrl(id, renderContext(el)));
  if (!component?.ok) return toast(component?.reason || 'Component unavailable', 'err');
  if (action === 'edit') return editDefinition(id, component);
  return detachInstance(id, component, {disabled: false}, renderContext(el));
}
async function structureEdit(type, direction) {
  if (!sel?.info || previewStale || editHistory.busy || panelTasks) return;
  const info = sel.info, el = selectedElement(), parentId = info.structure?.parentId;
  if (!parentId || !el?.parentElement) return toast('Select a literal element with an editable parent.', 'err');
  gestures.end();busyPanel(true);
  try {
  const parentResult = await api('GET', resolveUrl(parentId, renderContext(el.parentElement)));
  if (!parentResult?.ok) return toast('The parent no longer resolves.', 'err');
  const parentInfo = parentResult.element;
  const parent = matchingInDocument(doc(), parentId, parentInfo).find(node => node.contains(el));
  if (!parent || el.parentElement !== parent) return toast('The rendered sibling relationship differs from source.', 'err');
  const beforeValue = fingerprint(parent), copy = parent.cloneNode(true);
  const index = [...parent.children].indexOf(el), child = copy.children[index];
  if (type === 'duplicateElement') child.after(child.cloneNode(true));
  if (type === 'deleteElement') child.remove();
  if (type === 'moveElement') {
    const other = direction === 'before' ? child.previousElementSibling : child.nextElementSibling;
    if (!other) return;
    if (direction === 'before') other.before(child); else other.after(child);
  }
  if (type === 'pasteElement') {
    const copied = clipboard && matchingInDocument(doc(), clipboard.id, info)[0];
    if (!copied || copied.parentElement !== parent) return toast('Copy a sibling from this container first.', 'err');
    child.after(copied.cloneNode(true));
  }
  const afterValue = fingerprint(copy);
    const res = await api('POST', '/rt/__api/op', {type, id: info.id, fileHash: info.hash, context: info.context, direction,
      ...(type === 'pasteElement' ? {copiedId: clipboard.id, copiedHash: clipboard.hash} : {})});
    if (!res?.ok) return toast(res?.reason || res?.error || 'Edit refused', 'err');
    recordEdit(res, info, type, node => fingerprint(node) === beforeValue, node => fingerprint(node) === afterValue, parentInfo);
    if (await refreshWrittenElement(parentInfo, node => fingerprint(node) === afterValue)) {
      await select(parent); toast('Saved', 'ok');
    }
  } finally { busyPanel(false); }
}
function canNudge() {
  const el = selectedElement();
  return !!el && !sel.info.classNameDynamic && ['relative','absolute','fixed'].includes(el.ownerDocument.defaultView.getComputedStyle(el).position);
}
function nudge(dx, dy, {gestureKey}) {
  if (!canNudge()) return;
  const el = selectedElement();
  if (nudgeState && nudgeState.key !== gestureKey) finishNudge();
  if (!nudgeState) {
    const css = el.ownerDocument.defaultView.getComputedStyle(el);
    nudgeState = {key: gestureKey, el, info: sel.info, style: el.getAttribute('style'), classes: sel.info.className,
      x: css.left !== 'auto' ? 'left' : css.right !== 'auto' ? 'right' : 'left',
      y: css.top !== 'auto' ? 'top' : css.bottom !== 'auto' ? 'bottom' : 'top', values: {}};
    for (const side of ['left','right','top','bottom']) nudgeState.values[side] = parseFloat(css[side]) || 0;
  }
  const ed = nudgeState, side = dx ? ed.x : ed.y;
  ed.values[side] += (dx || dy) * (side === 'right' || side === 'bottom' ? -1 : 1);
  const value = Math.round(ed.values[side] * 100) / 100;
  ed.classes = RetouchInspector.replace(ed.classes, token => token.replace(/^-/, '').startsWith(side+'-'), `${side}-[${value}px]`);
  el.style.setProperty(side, value + 'px', 'important');
}
async function finishNudge() {
  const ed = nudgeState;if (!ed) return;nudgeState = null;
  if (ed.style === null) ed.el.removeAttribute('style');else ed.el.setAttribute('style', ed.style);
  gestures.begin('nudge', ed.key);
  try {await setClasses(ed.classes);} finally {gestures.end('nudge');}
}
const interactions = RetouchInteractions.create({document, getState: () => {
  const selected = selectedElement(), structure = sel?.info?.structure;
  return {mode, selected, editing: !!editing, busy: panelTasks > 0 || previewStale || editHistory.busy,
    canUndo: editHistory.canUndo, canRedo: editHistory.canRedo, canNudge: canNudge(),
    canEditText: sel?.info?.text != null || !!sel?.info?.mixedText,
    structure: {...structure, canPaste: !!clipboard && !!structure?.canPaste},
    component: selected?.closest('[data-rt-i]') ? menuComponent : null};
}, actions: {
  undo, redo, select, clearSelection, nudge, endNudgeGesture: finishNudge,
  editText: () => {const el = selectedElement(); if (el) {const r = el.getBoundingClientRect(); return startInlineEdit(el, {clientX:r.left+4, clientY:r.top+4});}},
  editDefinition: () => selectedComponent('edit'), detachComponent: () => selectedComponent('detach'),
  duplicate: () => structureEdit('duplicateElement'), delete: () => structureEdit('deleteElement'),
  moveBackward: () => structureEdit('moveElement', 'before'), moveForward: () => structureEdit('moveElement', 'after'),
  copy: () => {if (sel?.info?.structure?.canDuplicate) {clipboard = {id: sel.info.id, hash: sel.info.hash}; toast('Copied');}},
  paste: () => structureEdit('pasteElement'),
}, onError: err => toast(err.message, 'err')});
interactions.bindDocument(document);

/* ---------- chrome ---------- */
modeBtn.onclick = () => {
  mode = mode === 'edit' ? 'interact' : 'edit';
  modeBtn.textContent = mode === 'edit' ? 'Edit mode' : 'Interact mode';
  modeBtn.classList.toggle('mode-edit', mode === 'edit');
  if (mode === 'interact') { hoverEl = null; }
};
undoBtn.onclick = () => undo();
redoBtn.onclick = () => redo();
retryBtn.onclick = async () => { retryBtn.disabled = true; try { await retryPreview?.(); } finally { retryBtn.disabled = false; } };
updateHistoryButtons();
routeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') iframe.src = mirrorPath(routeInput.value || '/');
});
window.addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]')) return;
  if (e.key === 'Alt') measuring = true;
});
window.addEventListener('keyup', (e) => { if (!e.altKey) measuring = false; });
window.addEventListener('blur', () => { measuring = false; });

/* ---------- util ---------- */
async function api(method, url, body) {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'x-retouch-token': TOKEN, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(url === '/rt/__api/op' && !['undo','redo'].includes(body.type) ? {historyGroup: gestures.current(), ...body} : body) : undefined,
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function toast(msg, cls) {
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
    if (mode !== 'edit' || !sel || sel.info.classNameDynamic || sel.info.kind === 'instance') return null;
    const el = editing?.el || matchingEls(activeId()).find(el => inTextScope(el, sel.info));
    return el ? { el, info: sel.info } : null;
  },
  beforeDrag: commitInlineEdit,
  save: classes => setClasses(classes),
  notify: message => toast(message, 'err'),
});
