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
  async function revalidateStyles(d, revision) {
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
  async function sync({ frame, serverRendered = false, select, matches = () => true, revalidate = false, timeout = 8000, fetcher = root.fetch.bind(root) }) {
    const d = frame.contentDocument, href = frame.contentWindow.location.href, started = Date.now();
    const unchanged = () => frame.contentDocument === d && frame.contentWindow.location.href === href;
    while (Date.now() - started < timeout) {
      if (!unchanged()) throw new Error('Preview navigated while synchronizing the saved edit');
      if (!serverRendered) {
        const live = select(d);
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
          const source = select(fresh), live = select(d);
          if (source.length && source.length === live.length && source.every(matches)) {
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
  async function syncCSS({frame,id,rules,texts,entries=[{id,rules,texts}],fetcher=root.fetch.bind(root)}) {
    if(!Array.isArray(entries)||!entries.length||entries.length>100||new Set(entries.map(item=>item.id)).size!==entries.length)throw Error('Choose distinct styled layers.');
    const d=frame.contentDocument,href=frame.contentWindow.location.href,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    const index=(doc,selector,attribute)=>{const map=new Map();for(const el of doc.querySelectorAll(selector)){const key=el.getAttribute(attribute);if(!map.has(key))map.set(key,[]);map.get(key).push(el);}return map;};
    const canonical=value=>JSON.stringify(Object.entries(value).sort(([a],[b])=>Number(a)-Number(b)).map(([width,props])=>[width,Object.entries(props).sort(([a],[b])=>a.localeCompare(b))]));
    try{
      const response=await fetcher(href,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('The saved styles could not be loaded.');
      const fresh=new root.DOMParser().parseFromString(await response.text(),'text/html'),sources=index(fresh,'[data-rt]','data-rt'),live=index(d,'[data-rt]','data-rt'),sourceOwners=index(fresh,'[data-rt-style]','data-rt-style'),liveOwners=index(d,'[data-rt-style]','data-rt-style'),sourceStyles=index(fresh,'style[data-rt-css]','data-rt-css'),liveStyles=index(d,'style[data-rt-css]','data-rt-css'),owners=new Set();
      const plans=entries.map(({id,rules,texts})=>{
        const source=sources.get(id)||[],nodes=live.get(id)||[];if(source.length!==1||nodes.length!==1)throw Error('The styled layer no longer resolves uniquely.');
        const owner=source[0].getAttribute('data-rt-style'),prior=nodes[0].getAttribute('data-rt-style'),styles=sourceStyles.get(owner)||[],actual={};
        if(owner!==null&&(sourceOwners.get(owner)||[]).length!==1||[...(liveOwners.get(owner)||[]),...(liveOwners.get(prior)||[])].some(el=>el!==nodes[0]))throw Error('The styled layer shares a changed style identity.');
        if(owner!==null&&owners.has(owner))throw Error('Selected layers share an ambiguous style identity.');if(owner!==null)owners.add(owner);
        for(const style of styles){const width=style.getAttribute('data-rt-width');if(Object.hasOwn(actual,width))throw Error('The saved screen styles are ambiguous.');actual[width]=JSON.parse(style.getAttribute('data-rt-values'));}
        if(canonical(actual)!==canonical(rules||{}))throw Error('The preview has not received the saved screen styles.');
        if(Object.keys(actual).length!==Object.keys(texts||{}).length||styles.some(style=>style.textContent!==texts?.[style.getAttribute('data-rt-width')]))throw Error('The rendered CSS does not match the saved screen styles.');
        return {node:nodes[0],owner,existing:[...new Set([...(liveStyles.get(owner)||[]),...(liveStyles.get(prior)||[])])],replacements:styles.map(el=>d.importNode(el,true))};
      });
      if(frame.contentDocument!==d||frame.contentWindow.location.href!==href||plans.some(plan=>!plan.node.isConnected))throw Error('Preview navigated while synchronizing styles.');
      // Validate the entire selection before any DOM mutation. One page response
      // supplies all layers; live nodes, scripts and application state stay put.
      for(const {node,owner,existing,replacements}of plans){
        for(const el of existing)el.remove();for(const el of replacements)d.head.append(el);
        if(owner===null)node.removeAttribute('data-rt-style');else node.setAttribute('data-rt-style',owner);
      }
      d.dispatchEvent(new frame.contentWindow.CustomEvent('retouch:render',{detail:{source:'server'}}));return {ok:true,method:'styles',layers:plans.length};
    }finally{clearTimeout(timer);}
  }
  async function syncClasses({frame,entries,revalidate=false,fetcher=root.fetch.bind(root)}) {
    if(!Array.isArray(entries)||!entries.length||entries.length>100||new Set(entries.map(item=>item.id)).size!==entries.length||entries.some(item=>typeof item.before!=='string'||typeof item.classes!=='string'))throw Error('Choose distinct literal class layers.');
    const d=frame.contentDocument,href=frame.contentWindow.location.href,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000),tokens=value=>(value||'').split(/\s+/).filter(Boolean),canonical=value=>[...new Set(tokens(value))].sort().join(' ');
    try{
      const response=await fetcher(href,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('The saved classes could not be loaded.');const fresh=new root.DOMParser().parseFromString(await response.text(),'text/html');
      const plans=entries.map(item=>{const select=doc=>[...doc.querySelectorAll('[data-rt]')].filter(el=>el.getAttribute('data-rt')===item.id),source=select(fresh),live=select(d);if(!source.length||!live.length||source.some(el=>canonical(el.getAttribute('class'))!==canonical(item.classes)))throw Error('The preview has not received the saved literal classes.');
        const next=new Set(tokens(item.classes)),previous=new Set(tokens(item.before)),removed=new Set([...previous].filter(token=>!next.has(token))),added=[...next].filter(token=>!previous.has(token));return {live,removed,added};});
      if(frame.contentDocument!==d||frame.contentWindow.location.href!==href||plans.some(plan=>plan.live.some(el=>!el.isConnected)))throw Error('Preview navigated while synchronizing classes.');
      for(const {live,removed,added}of plans)for(const el of live){const classes=new Set(tokens(el.getAttribute('class')).filter(token=>!removed.has(token)));for(const token of added)classes.add(token);if(classes.size)el.setAttribute('class',[...classes].join(' '));else el.removeAttribute('class');}
      if(revalidate)await revalidateStyles(d,Date.now().toString(36));
      d.dispatchEvent(new frame.contentWindow.CustomEvent('retouch:render',{detail:{source:'server'}}));return {ok:true,method:'classes'};
    }finally{clearTimeout(timer);}
  }
  const api = { capture, restore, reconcile, sync, syncCSS, syncClasses };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RetouchRenderSync = api;
})(typeof window !== 'undefined' ? window : globalThis);
