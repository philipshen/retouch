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
async function startInlineEdit(el, evt, quiet) {
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
    if (!quiet) toast(reason || 'No editable text here.', 'err');
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

  // Figma-style pickers: Fill, Text color; image swap where applicable.
  panelBody.appendChild(colorSection('Fill', 'bg', info));
  panelBody.appendChild(colorSection('Text color', 'text', info));
  if (info.src !== null || info.srcDynamic) panelBody.appendChild(imageSection(info));

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
    p.textContent = 'className is dynamic (R-6).';
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
  else if (op.type === 'setSrc') await setSrc(op.src, true);
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
