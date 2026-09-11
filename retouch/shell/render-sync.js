'use strict';
/* Source-backed preview synchronization. React owns its DOM: never patch a
   fetched React page into the running tree. Server-rendered adapters opt in
   to reconciling authoritative HTML at the edited element only. */
(function (root) {
  function capture(node) {
    return { node, value: node.nodeValue, attrs: node.attributes ? Array.from(node.attributes, a => [a.name, a.value]) : null,
      children: Array.from(node.childNodes || [], capture) };
  }
  function restore(snapshot) {
    const { node, attrs, children } = snapshot;
    if (attrs) {
      const wanted = new Map(attrs);
      for (const attr of Array.from(node.attributes)) if (!wanted.has(attr.name)) node.removeAttribute(attr.name);
      for (const [name, value] of attrs) if (node.getAttribute(name) !== value) node.setAttribute(name, value);
    } else if (node.nodeValue !== snapshot.value) node.nodeValue = snapshot.value;
    for (const child of children) restore(child);
    // Reattach the actual nodes retained by React, not innerHTML clones.
    for (let i = 0; i < children.length; i++) if (node.childNodes[i] !== children[i].node) node.insertBefore(children[i].node, node.childNodes[i] || null);
    const wanted = new Set(children.map(child => child.node));
    for (const child of Array.from(node.childNodes || [])) if (!wanted.has(child)) node.removeChild(child);
    return node;
  }
  function key(node) { return node.nodeType === 1 ? node.getAttribute('data-rt-i') || node.getAttribute('data-rt') || node.id || null : null; }
  function compatible(a, b) { return a.nodeType === b.nodeType && (a.nodeType !== 1 || a.tagName === b.tagName) && key(a) === key(b); }
  function reconcile(current, fresh) {
    if (!compatible(current, fresh)) { const replacement = current.ownerDocument.importNode(fresh, true); current.replaceWith(replacement); return replacement; }
    if (current.nodeType !== 1) { if (current.nodeValue !== fresh.nodeValue) current.nodeValue = fresh.nodeValue; return current; }
    // Executing replacement scripts cannot safely reconstruct an app runtime.
    if (current.tagName === 'SCRIPT') return current;
    for (const attr of Array.from(current.attributes)) if (!fresh.hasAttribute(attr.name)) current.removeAttribute(attr.name);
    for (const attr of Array.from(fresh.attributes)) if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
    const old = Array.from(current.childNodes), used = new Set();
    Array.from(fresh.childNodes).forEach((child, i) => {
      const candidate = old.find(node => !used.has(node) && compatible(node, child));
      const next = candidate ? reconcile(candidate, child) : current.ownerDocument.importNode(child, true);
      if (candidate) used.add(candidate);
      if (current.childNodes[i] !== next) current.insertBefore(next, current.childNodes[i] || null);
    });
    for (const child of old) if (!used.has(child) && child.parentNode === current) current.removeChild(child);
    return current;
  }
  function scriptSignature(node) { return Array.from(node.querySelectorAll('script'), el => el.outerHTML).join('\n'); }
  const styleJobs = new WeakMap();
  function revalidateStyles(d, revision) {
    // Source-write synchronization and stylesheet revision polling can overlap.
    // Serialize swaps so neither leaves a duplicate or stale sibling sheet.
    const previous = styleJobs.get(d) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => replaceStyles(d, revision));
    styleJobs.set(d, next);
    next.finally(() => { if (styleJobs.get(d) === next) styleJobs.delete(d); }).catch(() => {});
    return next;
  }
  async function replaceStyles(d, revision) {
    for (const link of d.querySelectorAll('link[rel="stylesheet"]')) {
      const url = new URL(link.href, d.location.href);
      if (url.origin !== d.location.origin) continue;
      url.searchParams.set('__rt_revision', revision);
      await new Promise((resolve, reject) => {
        const next = link.cloneNode();
        const timer = setTimeout(() => { next.remove(); reject(new Error('Stylesheet refresh timed out')); }, 8000);
        next.onload = () => { clearTimeout(timer); link.remove(); resolve(); };
        next.onerror = () => { clearTimeout(timer); next.remove(); reject(new Error('Stylesheet refresh failed')); };
        next.href = url.href; link.after(next);
      });
    }
  }
  async function sync({ frame, serverRendered = false, select, verifySelect = select, matches = () => true, revalidate = false, timeout = 8000, fetcher = root.fetch.bind(root) }) {
    const d = frame.contentDocument, href = frame.contentWindow.location.href, started = Date.now();
    const unchanged = () => frame.contentDocument === d && frame.contentWindow.location.href === href;
    while (Date.now() - started < timeout) {
      if (!unchanged()) throw new Error('Preview navigated while synchronizing the saved edit');
      if (!serverRendered) {
        const live = verifySelect(d);
        if (live.length && live.every(matches)) return { ok: true, method: 'hmr' };
      } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.max(1, timeout - (Date.now() - started)));
        let response, html;
        try {
          response = await fetcher(href, { cache: 'no-store', signal: controller.signal });
          if (response.ok) html = await response.text();
        } finally { clearTimeout(timer); }

        if (response.ok) {
          const fresh = new root.DOMParser().parseFromString(html, 'text/html');
          const source = select(fresh), live = select(d), verified = verifySelect(fresh);
          if (source.length && source.length === live.length && verified.length && verified.every(matches)) {
            if (!unchanged()) throw new Error('Preview navigated while synchronizing the saved edit');
            if (source.some((node, i) => scriptSignature(node) !== scriptSignature(live[i]))) throw new Error('Saved source changes scripts; live preview cannot safely reconcile this edit');
            source.forEach((node, i) => reconcile(live[i], node));
            if (revalidate) await revalidateStyles(d, Date.now().toString(36));
            d.dispatchEvent(new frame.contentWindow.CustomEvent('retouch:render', { detail: { source: 'server' } }));
            return { ok: true, method: 'server' };
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Source saved, but the preview did not update. Check the app dev server / HMR connection.');
  }
  const api = { capture, restore, reconcile, revalidateStyles, sync };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RetouchRenderSync = api;
})(typeof window !== 'undefined' ? window : globalThis);
