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
let editing = null; // { el, id, info, original } during inline text editing
let hoverEl = null;
let undoStack = [];
let lastAppPath = null;

/* ---------- boot ---------- */
const appPath = (location.pathname.replace(/^\/rt\/?/, '/') || '/') + location.search + location.hash;
iframe.src = appPath;
routeInput.value = appPath;

iframe.addEventListener('load', () => {
  try {
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
    if (t) select(t);
    else clearSelection();
  }, true);
  // Double-click starts inline text editing in place (R-5: plaintext-only).
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
  d.addEventListener('keydown', (e) => {
    if (editing) {
      e.stopPropagation(); // typing stays native; app shortcuts stay out
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
    const p = loc.pathname + loc.search + loc.hash;
    if (p !== lastAppPath) onNavigated();
  } catch {}
}

function onNavigated() {
  try {
    const loc = iframe.contentWindow.location;
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

async function select(el) {
  const { hostId, instanceId } = idsOf(el);
  const scope = instanceId ? 'instance' : 'host';
  sel = { hostId, instanceId, scope, info: null };
  await loadScope();
}

function activeId() {
  if (!sel) return null;
  return sel.scope === 'instance' ? (sel.instanceId || sel.hostId) : (sel.hostId || sel.instanceId);
}

async function loadScope() {
  const id = activeId();
  if (!id) return clearSelection();
  const res = await api('GET', '/rt/__api/resolve?id=' + id);
  if (!res || !res.ok) {
    renderPanelError(res && res.error ? res.error : 'This element could not be resolved to source.');
    return;
  }
  sel.info = res.element;
  renderPanel();
}

function clearSelection() {
  sel = null;
  panelBody.hidden = true;
  panelEmpty.hidden = false;
}

/* ---------- inline text editing ---------- */
async function startInlineEdit(el, evt) {
  const { hostId, instanceId } = idsOf(el);
  let editId = null;
  let info = null;
  let reason = null;
  // Try the host stamp first, then the instance (text through {children}
  // lives at the usage site — R-12 / OQ-E3).
  for (const id of [hostId, instanceId].filter(Boolean)) {
    const res = await api('GET', '/rt/__api/resolve?id=' + id);
    if (res && res.ok) {
      if (res.element.text !== null) { editId = id; info = res.element; break; }
      if (!reason && res.element.textDynamic) {
        reason = 'The text of this element is dynamic; it cannot be edited in place (R-6).';
      }
    }
  }
  sel = { hostId, instanceId, scope: editId && editId === instanceId ? 'instance' : 'host', info };
  if (!editId) {
    await loadScope();
    toast(reason || 'No editable text here.', 'err');
    return;
  }
  renderPanel();
  editing = { el, id: editId, info, original: el.textContent };
  el.setAttribute('contenteditable', 'plaintext-only');
  if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
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
  const { el, id, info, original } = editing;
  editing = null;
  el.removeAttribute('contenteditable');
  const text = el.textContent;
  if (text === original) return;
  const res = await api('POST', '/rt/__api/op', { type: 'setText', id, text, fileHash: info.hash });
  if (res && res.ok) {
    undoStack.push({ type: 'setText', id, text: original });
    info.text = text;
    info.hash = res.hash;
    for (const m of matchingEls(id)) if (m !== el) m.textContent = text;
    if (sel && sel.info && sel.info.id === id) {
      sel.info.text = text;
      sel.info.hash = res.hash;
      renderPanel();
    }
    toast('Saved', 'ok');
  } else {
    el.textContent = original;
    toast((res && res.reason) || (res && res.error) || 'Write failed', 'err');
  }
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
      drawBox(el, first ? 'sel' : 'co', sel.scope === 'instance', first ? labelFor() : null);
      first = false;
    }
  }
  if (d && editing && editing.el.isConnected) drawBox(editing.el, 'editing', false, 'text ⏎');
  if (d && hoverEl && hoverEl.isConnected && mode === 'edit' && !editing) drawBox(hoverEl, 'hover', !!hoverEl.getAttribute('data-rt-i'), null);
  requestAnimationFrame(paintLoop);
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
function renderPanelError(msg) {
  panelEmpty.hidden = true;
  panelBody.hidden = false;
  panelBody.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'refused';
  p.textContent = msg;
  panelBody.appendChild(p);
}

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

  // Classes
  const csec = document.createElement('div');
  csec.className = 'sec';
  csec.innerHTML = '<h3>Classes</h3>';
  if (info.classNameDynamic) {
    const p = document.createElement('p');
    p.className = 'refused';
    p.textContent = 'className here is a dynamic expression; Retouch edits literal class strings only (R-6).';
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
  panelBody.appendChild(csec);

  // Text
  const tsec = document.createElement('div');
  tsec.className = 'sec';
  tsec.innerHTML = '<h3>Text</h3>';
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
  } else if (info.textDynamic) {
    const p = document.createElement('p');
    p.className = 'refused';
    p.textContent = sel.scope === 'host' && sel.instanceId
      ? 'Text here is dynamic (it may come from the component instance — switch scope).'
      : 'The text of this element is dynamic or mixed with other elements (R-6).';
    tsec.appendChild(p);
  } else {
    const p = document.createElement('p');
    p.style.color = 'var(--muted)';
    p.textContent = 'No text content.';
    tsec.appendChild(p);
  }
  panelBody.appendChild(tsec);
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
}

async function setText(text, isUndo) {
  if (!sel || !sel.info) return;
  const info = sel.info;
  const prev = info.text;
  optimisticText(text);
  const res = await api('POST', '/rt/__api/op', {
    type: 'setText', id: info.id, text, fileHash: info.fileHash || info.hash,
  });
  if (res && res.ok) {
    if (!isUndo) undoStack.push({ type: 'setText', id: info.id, text: prev });
    info.text = text;
    info.hash = res.hash;
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
  for (const el of matchingEls(sel.info.id)) el.textContent = text;
}

async function undo() {
  const op = undoStack.pop();
  if (!op) return toast('Nothing to undo');
  if (!sel || !sel.info || sel.info.id !== op.id) {
    // Re-resolve the op's element so the write path stays identical.
    const res = await api('GET', '/rt/__api/resolve?id=' + op.id);
    if (!res || !res.ok) return toast('Undo target no longer resolves', 'err');
    sel = { hostId: op.id, instanceId: null, scope: 'host', info: res.element };
  }
  if (op.type === 'setClasses') await setClasses(op.classes, true);
  else if (op.type === 'setText') await setText(op.text, true);
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
