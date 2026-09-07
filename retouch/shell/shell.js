'use strict';
/* Retouch shell: selection, co-highlight, class/text/spacing edits, undo.
   Same-origin iframe; direct DOM access per RFC-0001 rev 6 (OQ-B4). */

const TOKEN = window.__RT_TOKEN;
const iframe = document.getElementById('app');
const overlayLayer = document.getElementById('overlayLayer');
const modeBtn = document.getElementById('modeBtn');
const routeInput = document.getElementById('routeInput');
const undoBtn = document.getElementById('undoBtn');
const statusEl = document.getElementById('status');
const panelEmpty = document.getElementById('panelEmpty');
const panelBody = document.getElementById('panelBody');

const SPACING_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32];

let mode = 'edit'; // 'edit' | 'interact'
let sel = null; // { hostId, instanceId, scope: 'host'|'instance', info }
let editing = null; // { el, id, info, original, originalHTML, snapshot, originalTree } during inline text editing
let hoverEl = null;
let undoStack = [];
let lastAppPath = null;

/* ---------- boot ---------- */
const appPath = (location.pathname.replace(/^\/rt\/?/, '/') || '/') + location.search + location.hash;
iframe.src = appPath;
routeInput.value = appPath;

iframe.addEventListener('load', () => {
  try {
    if (!iframe.contentDocument || iframe.contentWindow.location.origin !== location.origin) return;
    hookFrame(iframe.contentDocument, iframe.contentWindow);
    onNavigated();
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
  const suppress = (e) => {
    if (mode !== 'edit') return;
    if (editing && editing.el.contains(e.target)) return; // let the text being edited behave
    e.stopPropagation();
  };
  // Selection: capture-phase click; prevent the app from reacting (OQ-E4).
  d.addEventListener('click', (e) => {
    if (mode !== 'edit') return;
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
    hoverEl = (e.target.closest && e.target.closest('[data-rt], [data-rt-i]')) || null;
  }, true);
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
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); e.stopPropagation(); undo(); }
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
    routeInput.value = p;
    history.replaceState(null, '', '/rt' + (p === '/' ? '' : p));
  } catch {}
}

/* ---------- selection ---------- */
function idsOf(el) {
  return { hostId: el.getAttribute('data-rt'), instanceId: el.getAttribute('data-rt-i') };
}

function renderContext(el) {
  if (!el.hasAttribute('data-rt-template')) return null;
  const blocks = [];
  for (let node = el; node; node = node.parentElement) {
    const block = node.getAttribute('data-rt-block');
    if (block && !blocks.includes(block)) blocks.unshift(block);
  }
  return { section: el.dataset.rtSection, block: el.dataset.rtBlock, blocks,
    template: el.dataset.rtTemplate, locale: el.dataset.rtLocale,
    origin: el.dataset.rtOrigin, tag: el.tagName.toLowerCase() };
}
function resolveUrl(id, context) {
  return '/rt/__api/resolve?id=' + id + (context ? '&context=' + encodeURIComponent(JSON.stringify(context)) : '');
}
function sourcePayload(info) {
  return { context: info.context, sourceId: info.textSource?.id, sourceHash: info.textSource?.hash };
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
  let el = node && node.closest ? node.closest('[data-rt], [data-rt-i]') : null;
  while (el) {
    const { hostId, instanceId } = idsOf(el);
    for (const id of [instanceId, hostId]) {
      if (!id || !/^[0-9a-f]{10}$/.test(id)) continue;
      const res = await api('GET', resolveUrl(id, renderContext(el)));
      if (res && res.ok) return { el, info: res.element, hostId, instanceId };
    }
    el = el.parentElement ? el.parentElement.closest('[data-rt], [data-rt-i]') : null;
  }
  return null;
}

async function select(node) {
  const c = await classify(node);
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
  panelBody.hidden = true;
  panelEmpty.hidden = false;
}

/* ---------- inline text editing ---------- */
async function startInlineEdit(node, evt, quiet) {
  const c = await classify(node);
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
  if (info.textSource && info.textSource.format !== 'text') { renderPanel(); return; }
  const editId = info.id;
  renderPanel();
  editing = {
    el,
    id: editId,
    info,
    original: el.textContent,
    originalHTML: el.innerHTML,
    snapshot: new Map(),
    originalTree: null,
  };
  for (const c of el.querySelectorAll('[data-rt], [data-rt-i]')) {
    const cid = c.getAttribute('data-rt') || c.getAttribute('data-rt-i');
    if (cid) editing.snapshot.set(cid, c.textContent);
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
  if (JSON.stringify(children) === JSON.stringify(ed.originalTree)) return;

  // A pure-text element with a pure-text result uses setText (smaller diff).
  // An element whose SOURCE has mixed children must use setChildren even when
  // the edited result is now all text (e.g. the user deleted a styled span),
  // because setText only rewrites a literal-text-only children range.
  let op;
  if (!ed.info.mixedText && children.every((c) => c.t === 'text')) {
    op = { type: 'setText', id: ed.id, text: children.map((c) => c.value).join(''), fileHash: ed.info.hash };
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
    undoStack.push(op.type === 'setText'
      ? { type: 'setText', id: ed.id, text: ed.info.textSource ? ed.info.text : ed.original, context: ed.info.context, sourceId: ed.info.textSource?.id }
      : { type: 'setChildren', id: ed.id, children: ed.originalTree });
    updateSource(ed.info, res);
    if (op.type === 'setText') {
      ed.info.text = op.text;
      for (const m of (ed.info.textSource ? [] : matchingEls(ed.id))) if (m !== ed.el) m.textContent = op.text;
    }
    if (structural) reloadFrame();
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
  try {
    const w = iframe.contentWindow;
    const y = w.scrollY;
    const done = () => {
      iframe.removeEventListener('load', done);
      try { iframe.contentWindow.scrollTo(0, y); } catch {}
    };
    iframe.addEventListener('load', done);
    w.location.reload();
  } catch {
    iframe.src = iframe.src;
  }
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
  if (editing.info.canSetChildren === false) return toast('Rich text formatting is not supported for Liquid yet.', 'err');
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
function paintLoop() {
  overlayLayer.textContent = '';
  const d = doc();
  if (d && sel) {
    const id = activeId();
    const attr = sel.scope === 'instance' && sel.instanceId ? 'data-rt-i' : 'data-rt';
    const els = d.querySelectorAll(`[${attr}="${id}"]`);
    let first = true;
    for (const el of els) {
      if (!inTextScope(el, sel.info)) continue;
      drawBox(el, first ? 'sel' : 'co', sel.scope === 'instance', first ? labelFor() : null);
      first = false;
    }
  }
  if (d && editing && editing.el.isConnected) drawBox(editing.el, 'editing', false, 'text ⏎');
  if (d && hoverEl && hoverEl.isConnected && mode === 'edit' && !editing) drawBox(hoverEl, 'hover', !!hoverEl.getAttribute('data-rt-i'), null);
  requestAnimationFrame(paintLoop);
}

function inTextScope(el, info) {
  const source = info.textSource;
  const context = info.context;
  if (!source || !context) return true;
  if (source.kind === 'locale') return el.dataset.rtLocale === context.locale;
  if (source.kind !== 'setting' || source.scope === 'theme') return true;
  return el.dataset.rtSection === context.section && el.dataset.rtTemplate === context.template &&
    (source.scope !== 'block' || el.dataset.rtBlock === context.block);
}

function labelFor() {
  if (!sel || !sel.info) return null;
  return (sel.scope === 'instance' ? '⟐ ' : '') + sel.info.tag;
}

function drawBox(el, cls, isInstance, label) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return;
  const b = document.createElement('div');
  b.className = 'box ' + cls + (isInstance ? ' instance' : '');
  b.style.left = r.left + 'px';
  b.style.top = r.top + 'px';
  b.style.width = r.width + 'px';
  b.style.height = r.height + 'px';
  if (label) {
    const chip = document.createElement('span');
    chip.className = 'tagchip';
    chip.textContent = label;
    b.appendChild(chip);
  }
  overlayLayer.appendChild(b);
}

/* ---------- panel ---------- */
function renderPanel() {
  const info = sel.info;
  panelEmpty.hidden = true;
  panelBody.hidden = false;
  panelBody.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'sec';
  const badge = document.createElement('span');
  badge.className = 'kindbadge' + (info.kind === 'instance' ? ' instance' : '');
  badge.textContent = info.kind === 'instance' ? 'instance' : '<' + info.tag + '>';
  head.appendChild(badge);
  const file = document.createElement('div');
  file.className = 'filepath';
  file.textContent = info.file;
  head.appendChild(file);
  panelBody.appendChild(head);

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

  // First-class, Figma-like sections: Typography, Fill, Text color, Image.
  if (info.canSetTag) panelBody.appendChild(typographySection(info));
  panelBody.appendChild(colorSection('Fill', 'bg', info));
  panelBody.appendChild(colorSection('Text color', 'text', info));
  if (info.src !== null || info.srcDynamic) panelBody.appendChild(imageSection(info));

  // Text
  const tsec = document.createElement('div');
  tsec.className = 'sec';
  tsec.innerHTML = '<h3>Text</h3>';
  if (info.textSource) {
    const provenance = document.createElement('p');
    provenance.className = 'filepath';
    provenance.textContent = (info.textSource.kind === 'locale' ? 'Shared translation: ' : 'Text source: ') + info.textSource.file + ' · ' + info.textSource.path;
    tsec.appendChild(provenance);
    if (info.textSource.format !== 'text') {
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
    p.textContent = info.classNameReason || 'className here is a dynamic expression; Retouch edits literal class strings only (R-6).';
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
    : 'Drag the right-edge ↔ handle to snap the maximum width to a Tailwind size. The popup shows the exact class being changed.';
  sizing.append(title, hint);panelBody.appendChild(sizing);

}

// Typography: Figma-like text-role presets that rewrite the element's tag.
const TYPE_PRESETS = [
  ['H1', 'h1'], ['H2', 'h2'], ['H3', 'h3'], ['H4', 'h4'], ['Body', 'p'],
];
function typographySection(info) {
  const sec = document.createElement('div');
  sec.className = 'sec';
  sec.innerHTML = '<h3>Typography</h3>';
  const row = document.createElement('div');
  row.className = 'typerow';
  for (const [label, tag] of TYPE_PRESETS) {
    const b = document.createElement('button');
    b.className = 'typebtn' + (info.tag === tag ? ' active' : '');
    b.textContent = label;
    b.onclick = () => setTag(tag);
    row.appendChild(b);
  }
  sec.appendChild(row);
  if (!TYPE_PRESETS.some(([, t]) => t === info.tag)) {
    const cur = document.createElement('div');
    cur.className = 'filepath';
    cur.textContent = 'Current: <' + info.tag + '>';
    sec.appendChild(cur);
  }
  return sec;
}

async function setTag(tag) {
  if (!sel || !sel.info || sel.info.tag === tag) return;
  const info = sel.info;
  const prev = info.tag;
  const res = await api('POST', '/rt/__api/op', { type: 'setTag', id: info.id, tag, fileHash: info.hash });
  if (res && res.ok) {
    undoStack.push({ type: 'setTag', id: info.id, tag: prev });
    info.tag = tag;
    info.hash = res.hash;
    toast('Saved', 'ok');
    reloadFrame(); // a tag change is structural; remount clean
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
    ')|white|black|transparent|current|inherit|\\[[^\\]]+\\])(?:/\\d{1,3})?$'
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

  const row = document.createElement('div');
  row.className = 'colorrow';
  const sw = document.createElement('button');
  sw.className = 'swatch' + (current ? '' : ' empty');
  if (current) sw.style.background = swatchColor(current);
  const label = document.createElement('span');
  label.className = 'colorlabel';
  label.textContent = current || 'default';
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
  hex.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const v = hex.value.trim().replace(/^#?/, '#');
      if (/^#[0-9a-fA-F]{3,8}$/.test(v)) applyColor(tokens, current, `${kind}-[${v.toLowerCase()}]`);
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
  if (info.srcDynamic) {
    const p = document.createElement('p');
    p.className = 'refused';
    p.textContent = 'src here is an imported image or an expression; it cannot be swapped deterministically (R-6).';
    sec.appendChild(p);
    return sec;
  }
  const img = document.createElement('img');
  img.className = 'imgthumb';
  img.src = info.src;
  sec.appendChild(img);
  const pathEl = document.createElement('div');
  pathEl.className = 'filepath';
  pathEl.textContent = info.src;
  sec.appendChild(pathEl);
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
    setSrc(res.src);
  };
  sec.appendChild(pick);
  sec.appendChild(fileIn);
  return sec;
}

async function setSrc(src, isUndo) {
  if (!sel || !sel.info) return;
  const info = sel.info;
  const prev = info.src;
  for (const el of matchingEls(info.id)) {
    if (el.tagName === 'IMG') { el.removeAttribute('srcset'); el.src = src; }
  }
  const res = await api('POST', '/rt/__api/op', { type: 'setSrc', id: info.id, src, fileHash: info.hash });
  if (res && res.ok) {
    if (!isUndo) undoStack.push({ type: 'setSrc', id: info.id, src: prev });
    info.src = src;
    info.hash = res.hash;
    toast('Saved', 'ok');
    renderPanel();
  } else {
    for (const el of matchingEls(info.id)) {
      if (el.tagName === 'IMG') el.src = prev;
    }
    toast((res && res.reason) || (res && res.error) || 'Write failed', 'err');
    loadScope();
  }
}

/* ---------- ops ---------- */
async function setClasses(classes, isUndo) {
  if (!sel || !sel.info) return;
  const info = sel.info;
  const prev = info.className || '';
  optimisticClasses(classes);
  const res = await api('POST', '/rt/__api/op', {
    type: 'setClasses', id: info.id, classes, fileHash: info.fileHash || info.hash,
  });
  if (res && res.ok) {
    if (!isUndo) undoStack.push({ type: 'setClasses', id: info.id, classes: prev });
    info.className = classes;
    info.hash = res.hash;
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
    if (!isUndo) undoStack.push({ type: 'setText', id: info.id, text: prev, context: info.context, sourceId: info.textSource?.id });
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
  return [...d.querySelectorAll(`[data-rt="${id}"], [data-rt-i="${id}"]`)];
}

function optimisticClasses(classes) {
  for (const el of matchingEls(sel.info.id)) el.setAttribute('class', classes);
}

function optimisticText(text) {
  if (sel.info.textSource) return;
  for (const el of matchingEls(sel.info.id)) el.textContent = text;
}

async function undo() {
  const op = undoStack.pop();
  if (!op) return toast('Nothing to undo');
  if (op.type === 'setText' || !sel || !sel.info || sel.info.id !== op.id) {
    // Re-resolve the op's element so the write path stays identical.
    const res = await api('GET', resolveUrl(op.id, op.context));
    if (!res || !res.ok) return toast('Undo target no longer resolves', 'err');
    if (op.sourceId && res.element.textSource?.id !== op.sourceId) return toast('The original string source changed; undo was not applied.', 'err');
    sel = { hostId: op.id, instanceId: null, scope: 'host', info: res.element };
  }
  if (op.type === 'setClasses') await setClasses(op.classes, true);
  else if (op.type === 'setText') await setText(op.text, true);
  else if (op.type === 'setSrc') await setSrc(op.src, true);
  else if (op.type === 'setChildren') await applyChildren(op.id, op.children);
  else if (op.type === 'setTag') await applyTag(op.id, op.tag);
  renderPanel();
}

/* ---------- chrome ---------- */
modeBtn.onclick = () => {
  mode = mode === 'edit' ? 'interact' : 'edit';
  modeBtn.textContent = mode === 'edit' ? 'Edit mode' : 'Interact mode';
  modeBtn.classList.toggle('mode-edit', mode === 'edit');
  if (mode === 'interact') { hoverEl = null; }
};
undoBtn.onclick = () => undo();
routeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') iframe.src = routeInput.value || '/';
});
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.key === 'Escape') clearSelection();
});

/* ---------- util ---------- */
async function api(method, url, body) {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'x-retouch-token': TOKEN, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
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
    if (mode !== 'edit' || !sel || sel.info.classNameDynamic) return null;
    const el = editing?.el || matchingEls(activeId()).find(el => inTextScope(el, sel.info));
    return el ? { el, info: sel.info } : null;
  },
  beforeDrag: commitInlineEdit,
  save: classes => setClasses(classes),
  notify: message => toast(message, 'err'),
});
