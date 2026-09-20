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
  const linkedStyles=new WeakMap();
  const styleLinks=d=>[...d.querySelectorAll('link[rel]')].filter(link=>{const rel=link.rel.toLowerCase().split(/\s+/);return link.hasAttribute('href')&&(rel.includes('stylesheet')||rel.includes('preload')&&link.getAttribute('as')?.toLowerCase()==='style');});
  function stylesheetPlans(d,fresh){
    const source=styleLinks(fresh),plans=[];
    for(const link of styleLinks(d)){
      const id=link.getAttribute('data-rt');if(!id)continue;
      const matches=source.filter(node=>node.getAttribute('data-rt')===id);if(matches.length!==1)throw Error('The stylesheet link no longer resolves uniquely.');
      const prior=linkedStyles.get(link);if(!prior||link.getAttribute('href')!==prior.href||link.getAttribute('integrity')!==prior.integrity)throw Error('A runtime stylesheet link changed. Reload the preview to apply saved styles.');
      plans.push({link,href:matches[0].getAttribute('href'),integrity:matches[0].getAttribute('integrity'),prior});
    }
    return plans;
  }
  async function revalidateStyles(d, revision, plans=null) {
    for (const plan of plans||styleLinks(d).filter(link=>link.rel.toLowerCase().split(/\s+/).includes('stylesheet')).map(link=>({link,href:link.getAttribute('href'),integrity:link.getAttribute('integrity')}))) {
      const {link,href,integrity,prior}=plan;
      if(!link.isConnected)throw Error('The stylesheet link was removed during refresh.');
      if(prior&&![prior.href,href].includes(link.getAttribute('href'))||prior&&![prior.integrity,integrity].includes(link.getAttribute('integrity')))throw Error('A runtime stylesheet link changed during refresh.');
      const url = new URL(href, d.baseURI);
      if (url.origin !== d.location.origin) continue;
      url.searchParams.set('__rt_revision', revision);
      const previous=linkedStyles.get(link),owned=prior||previous&&previous.href===link.getAttribute('href')&&previous.integrity===link.getAttribute('integrity');
      if(link.disabled){if(integrity===null)link.removeAttribute('integrity');else link.setAttribute('integrity',integrity);link.href=url.href;if(owned)linkedStyles.set(link,{href:link.getAttribute('href'),integrity});continue;}
      await new Promise((resolve, reject) => {
        const next = link.cloneNode();next.disabled=link.disabled;
        if(integrity===null)next.removeAttribute('integrity');else next.setAttribute('integrity',integrity);
        const cleanup=()=>{clearTimeout(timer);next.removeEventListener('load',loaded);next.removeEventListener('error',failed);};
        const fail=message=>{cleanup();next.remove();reject(new Error(message));};
        const loaded=()=>{if(next.getAttribute('href')!==url.href||next.getAttribute('integrity')!==integrity){fail('A runtime stylesheet link changed during refresh.');return;}cleanup();link.remove();if(owned)linkedStyles.set(next,{href:url.href,integrity});resolve();};
        const failed=()=>fail('Stylesheet refresh failed');
        const timer=setTimeout(()=>fail('Stylesheet refresh timed out'),8000);
        next.addEventListener('load',loaded);next.addEventListener('error',failed);
        next.href = url.href; link.after(next);
      });
    }
  }
  async function sync({ frame, serverRendered = false, select, matches = () => true, current = () => true, revalidate = false, authorStyles = false, timeout = 8000, fetcher = root.fetch.bind(root) }) {
    const d = frame.contentDocument, href = frame.contentWindow.location.href, started = Date.now();
    const unchanged = () => current() && frame.contentDocument === d && frame.contentWindow.location.href === href;
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
            if(revalidate){const state=inlineStyles.get(d);if(state)await state.ready;}
            const stylePlans=authorStyles?await inlineStylePlans(d,fresh,true):[],linkPlans=revalidate?stylesheetPlans(d,fresh):null;
            if (!unchanged()) throw new Error('Preview navigated while synchronizing the saved edit');
            if (source.some((node, i) => scriptSignature(node) !== scriptSignature(live[i]))) throw new Error('Saved source changes scripts; live preview cannot safely reconcile this edit');
            source.forEach((node, i) => reconcile(live[i], node));
            await applyInlineStyles(stylePlans);
            if (revalidate) await revalidateStyles(d, Date.now().toString(36),linkPlans);
            if (!unchanged()) throw new Error('Preview navigated while synchronizing the saved edit');
            d.dispatchEvent(new frame.contentWindow.CustomEvent('retouch:render', { detail: { source: 'server' } }));
            return { ok: true, method: 'server' };
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Source saved, but the preview did not update. Check the app dev server / HMR connection.');
  }
  async function syncCSS({frame,id,rules,texts,rendering,entries=[{id,rules,texts,rendering}],fetcher=root.fetch.bind(root)}) {
    if(!Array.isArray(entries)||!entries.length||entries.length>100||new Set(entries.map(item=>item.id)).size!==entries.length)throw Error('Choose distinct styled layers.');
    if(entries.some(entry=>entry.rendering)){
      if(entries.some(entry=>!entry.rendering||entry.rendering.attribute!=='data-rt-revision'||!/^\[data-rt-(?:vue|svelte)-css="[a-f0-9]{10}"\]$/.test(entry.rendering.selector)||entry.rendering.property!=='--retouch-css-revision'||![entry.rendering.hash,entry.rendering.value].every(value=>/^[a-f0-9]{40}$/.test(value))))throw Error('The compiled style revision is invalid.');
      const document=frame.contentDocument,href=frame.contentWindow.location.href;
      const sheetMatches=rendering=>[...document.styleSheets].some(sheet=>{try{if(sheet.disabled||sheet.media?.mediaText&&!frame.contentWindow.matchMedia(sheet.media.mediaText).matches)return false;return [...sheet.cssRules].some(rule=>rule.selectorText===rendering.selector&&rule.style?.getPropertyValue(rendering.property).trim()===rendering.value);}catch{return false;}});
      for(let attempt=0,stable=0;attempt<160;attempt++){
        if(frame.contentDocument!==document||frame.contentWindow.location.href!==href)throw Error('Preview navigated while waiting for the compiled styles.');
        const ready=entries.every(({id,rendering})=>{const nodes=[...document.querySelectorAll('[data-rt]')].filter(node=>node.getAttribute('data-rt')===id);return nodes.length>0&&nodes.every(node=>node.getAttribute(rendering.attribute)===rendering.hash)&&sheetMatches(rendering);});
        stable=ready?stable+1:0;if(stable>=3)return {ok:true,method:'compiled-styles',layers:entries.length};
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      throw Error('The preview has not received the compiled style revision.');
    }
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
      await ensureGroupScaleRuntime(frame,fresh.querySelector('script[data-rt-scale-runtime]')?.getAttribute('data-rt-scale-revision'));
      d.dispatchEvent(new frame.contentWindow.CustomEvent('retouch:render',{detail:{source:'server'}}));return {ok:true,method:'styles',layers:plans.length};
    }finally{clearTimeout(timer);}
  }
  const inlineStyles=new WeakMap();
  const styleAttributes=node=>JSON.stringify([...node.attributes].filter(attr=>attr.name!=='nonce').map(attr=>[attr.name,attr.value]).sort());
  const styleRules=node=>{try{return JSON.stringify([...node.sheet.cssRules].map(rule=>rule.cssText));}catch{return null;}};
  function parsedStyleRules(text){try{const d=root.document.implementation.createHTMLDocument(''),style=d.createElement('style');style.textContent=text;d.head.append(style);return styleRules(style);}catch{return null;}}
  async function applyInlineStyles(plans){
    await Promise.all(plans.map(({entry,text})=>new Promise((resolve,reject)=>{
      const node=entry.node;let timer;
      const finish=error=>{clearTimeout(timer);node.removeEventListener('load',loaded);node.removeEventListener('error',failed);entry.rules=styleRules(node);error?reject(error):resolve();};
      const loaded=()=>finish(),failed=()=>finish(Error('Inline stylesheet import refresh failed.'));
      node.addEventListener('load',loaded);node.addEventListener('error',failed);
      timer=setTimeout(()=>finish(Error('Inline stylesheet import refresh timed out.')),8000);
      node.textContent=text;entry.text=text;entry.rules=styleRules(node);
      try{if(![...node.sheet.cssRules].some(rule=>rule.type===3))finish();}catch{finish(Error('The refreshed inline stylesheet is unavailable.'));}
    })));
  }
  function captureInlineStyles(d){
    if(!d||inlineStyles.has(d)||!/^https?:/.test(d.URL))return;
    const live=[...d.querySelectorAll('style')].map(node=>({node,head:!!node.closest('head'),text:node.textContent,attrs:styleAttributes(node),rules:styleRules(node)})),state={entries:null,error:null},controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);inlineStyles.set(d,state);
    // A non-executing response gives us the server's CSS, independently of
    // startup scripts that ran before the iframe load event.
    state.ready=(async()=>{try{
      const response=await root.fetch(d.URL,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Could not identify the preview stylesheets.');
      const fresh=new root.DOMParser().parseFromString(await response.text(),'text/html');
      const captured=new Map();const entries=selector=>[...fresh.querySelectorAll(selector)].map(source=>{if(captured.has(source))return captured.get(source);const text=source.textContent,attrs=styleAttributes(source),rules=parsedStyleRules(text),matches=live.filter(item=>item.head===!!source.closest('head')&&item.text===text&&item.attrs===attrs&&rules!==null&&item.rules===rules);const entry=matches.length===1?{...matches[0],serverText:text}:{node:null,text,serverText:text,attrs,rules};captured.set(source,entry);return entry;});
      state.entries=entries('head style');state.authorEntries=entries('style:not([data-rt-css])');
      const links=styleLinks(d);for(const source of styleLinks(fresh)){const id=source.getAttribute('data-rt'),matches=links.filter(link=>id&&link.getAttribute('data-rt')===id&&link.getAttribute('href')===source.getAttribute('href')&&link.getAttribute('integrity')===source.getAttribute('integrity'));if(matches.length===1)linkedStyles.set(matches[0],{href:source.getAttribute('href'),integrity:source.getAttribute('integrity')});}
    }catch(error){state.error=error;}finally{clearTimeout(timer);}})();
  }
  root.document?.addEventListener('load',event=>{if(root.__RT_RENDERING?.reloadAfterWrite&&event.target?.tagName==='IFRAME')try{captureInlineStyles(event.target.contentDocument);}catch{}},true);
  async function inlineStylePlans(d,fresh,author=false){
    const source=[...fresh.querySelectorAll(author?'style:not([data-rt-css])':'head style')],state=inlineStyles.get(d);if(state)await state.ready;const baseline=author?state?.authorEntries:state?.entries;
    if(state?.error)throw state.error;
    if(!source.length&&!baseline?.length)return [];
    if(!baseline||source.length!==baseline.length)throw Error('The inline stylesheet structure changed. Reload the preview before applying these styles.');
    return baseline.flatMap((entry,i)=>{const next=source[i];if(entry.attrs!==styleAttributes(next))throw Error('The inline stylesheet structure changed. Reload the preview before applying these styles.');
      if(!entry.node){if(next.textContent!==entry.serverText)throw Error('Startup scripts own a changed stylesheet. Reload the preview to apply the saved styles.');return [];}
      if(!entry.node.isConnected||entry.node.ownerDocument!==d||entry.text!==entry.node.textContent||entry.attrs!==styleAttributes(entry.node)||entry.rules!==styleRules(entry.node))throw Error('A runtime stylesheet changed. Reload the preview before applying these styles.');return [{entry,text:next.textContent}];});
  }
  // A saved source write can outlive a failed preview fetch. Base the next
  // token delta on the last source classes this document actually received.
  const appliedClassSources = new WeakMap();
  async function syncClasses({frame,entries,revalidate=false,fetcher=root.fetch.bind(root)}) {
    if(!Array.isArray(entries)||!entries.length||entries.length>100||new Set(entries.map(item=>item.id)).size!==entries.length||entries.some(item=>typeof item.before!=='string'||typeof item.classes!=='string'))throw Error('Choose distinct literal class layers.');
    const d=frame.contentDocument,href=frame.contentWindow.location.href,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000),tokens=value=>(value||'').split(/\s+/).filter(Boolean),canonical=value=>[...new Set(tokens(value))].sort().join(' ');
    let applied=appliedClassSources.get(d);
    if(!applied){applied=new Map();appliedClassSources.set(d,applied);}
    for(const item of entries)if(!applied.has(item.id))applied.set(item.id,item.before);
    try{
      const response=await fetcher(href,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('The saved classes could not be loaded.');const fresh=new root.DOMParser().parseFromString(await response.text(),'text/html');
      const plans=entries.map(item=>{const select=doc=>[...doc.querySelectorAll('[data-rt]')].filter(el=>el.getAttribute('data-rt')===item.id),source=select(fresh),live=select(d);if(!source.length||!live.length||source.some(el=>canonical(el.getAttribute('class'))!==canonical(item.classes)))throw Error('The preview has not received the saved literal classes.');
        const next=new Set(tokens(item.classes)),previous=new Set(tokens(applied.get(item.id))),removed=new Set([...previous].filter(token=>!next.has(token))),added=[...next].filter(token=>!previous.has(token));return {live,removed,added};});
      const stylePlans=await inlineStylePlans(d,fresh);
      if(frame.contentDocument!==d||frame.contentWindow.location.href!==href||plans.some(plan=>plan.live.some(el=>!el.isConnected)))throw Error('Preview navigated while synchronizing classes.');
      for(const {live,removed,added}of plans)for(const el of live){const classes=new Set(tokens(el.getAttribute('class')).filter(token=>!removed.has(token)));for(const token of added)classes.add(token);if(classes.size)el.setAttribute('class',[...classes].join(' '));else el.removeAttribute('class');}
      // Reapply even identical CSS: WebKit can retain stale nested-media
      // declarations after a class-only undo following a stylesheet update.
      await applyInlineStyles(stylePlans);
      for(const item of entries)applied.set(item.id,item.classes);
      if(revalidate)await revalidateStyles(d,Date.now().toString(36));
      d.dispatchEvent(new frame.contentWindow.CustomEvent('retouch:render',{detail:{source:'server'}}));return {ok:true,method:'classes'};
    }finally{clearTimeout(timer);}
  }
  async function ensureGroupScaleRuntime(frame,revision){
    const d=frame.contentDocument;if(!d?.querySelector('[data-rt-scale]')){d?.[Symbol.for('retouch.group-scale.runtime')]?.refresh();return;}
    if(!d[Symbol.for('retouch.group-scale.runtime')]||revision&&d[Symbol.for('retouch.group-scale.runtime')].revision!==revision)await new Promise((resolve,reject)=>{
      const script=d.createElement('script'),timer=setTimeout(()=>finish(Error('Scale runtime did not load.')),8000);
      function finish(error){clearTimeout(timer);script.remove();if(error)reject(error);else resolve();}
      script.src=new URL('/rt/__group-scale-runtime.js',frame.contentWindow.location.href).href;
      script.onload=()=>finish(d[Symbol.for('retouch.group-scale.runtime')]&&(!revision||d[Symbol.for('retouch.group-scale.runtime')].revision===revision)?null:Error('Scale runtime could not start.'));script.onerror=()=>finish(Error('Scale runtime could not load.'));d.body.append(script);
    });
    d[Symbol.for('retouch.group-scale.runtime')]?.refresh();
    if(frame.contentDocument!==d)throw Error('Preview navigated while synchronizing group scale.');
  }
  const api = { capture, restore, reconcile, sync, syncCSS, syncClasses, ensureGroupScaleRuntime, refreshStyles: revalidateStyles };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RetouchRenderSync = api;
})(typeof window !== 'undefined' ? window : globalThis);
