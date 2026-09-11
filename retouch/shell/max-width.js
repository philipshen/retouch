(function (root) {
  'use strict';
  const sizes = { '3xs':16, '2xs':18, xs:20, sm:24, md:28, lg:32, xl:36, '2xl':42, '3xl':48, '4xl':56, '5xl':64, '6xl':72, '7xl':80 };
  function nearest(points, px) {
    return points.reduce((best, p) => Math.abs(p.px-px) < Math.abs(best.px-px) ? p : best);
  }
  function replace(classes, token, prefix = '') {
    return classes.split(/\s+/).filter(Boolean).filter(t => {
      const i = t.lastIndexOf('max-w-');
      return i < 0 || t.slice(0, i) !== prefix;
    }).concat(token).join(' ');
  }
  function points(el) {
    const d = el.ownerDocument, w = d.defaultView, css = w.getComputedStyle(el);
    const names = new Set(Object.keys(sizes));
    // Tailwind v4 theme values, including project-defined container sizes.
    for (let i=0; i<css.length; i++) if (css[i].startsWith('--container-')) names.add(css[i].slice(12));
    function scan(rules) {
      for (const rule of rules) {
        if (rule.selectorText) {
          for (const match of rule.selectorText.matchAll(/\.max-w-([a-zA-Z0-9-]+)(?=[\s,:.{#>+~]|$)/g)) names.add(match[1]);
        }
        if (rule.cssRules) scan(rule.cssRules);
      }
    }
    for (const sheet of d.styleSheets) { try { scan(sheet.cssRules); } catch {} }
    const probe = d.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;';
    el.parentElement.appendChild(probe);
    const result = [];
    for (const name of names) {
      const value = css.getPropertyValue('--container-'+name).trim() || (sizes[name] ? sizes[name]+'rem' : '');
      probe.className = 'max-w-'+name;
      probe.style.maxWidth = '';
      if (w.getComputedStyle(probe).maxWidth === 'none' && value) probe.style.maxWidth = value;
      const px = parseFloat(w.getComputedStyle(probe).maxWidth);
      if (Number.isFinite(px) && px > 0) result.push({token:'max-w-'+name, px});
    }
    probe.remove();
    return result.sort((a,b)=>a.px-b.px);
  }
  function scope(el, classes) {
    const d=el.ownerDocument, w=d.defaultView, current=w.getComputedStyle(el).maxWidth;
    const probe=d.createElement('div');
    probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;';
    el.parentElement.appendChild(probe);
    let prefix='';
    for (const token of classes.split(/\s+/)) {
      const i=token.lastIndexOf('max-w-');
      if(i<0) continue;
      probe.className=token;
      if(w.getComputedStyle(probe).maxWidth === current && current !== 'none') prefix=token.slice(0,i);
    }
    probe.remove();
    return prefix;
  }
  function mount({container, getTarget, beforeDrag, save, notify}) {
    const handle=document.createElement('div');
    handle.className='max-width-handle';
    handle.tabIndex=-1;
    for(const edge of ['left','right','top','bottom']) {
      const hit=document.createElement('button');
      hit.className='max-width-edge '+edge;
      hit.dataset.edge=edge;
      hit.setAttribute('aria-label',`Drag ${edge} edge to change max width`);
      handle.appendChild(hit);
    }
    const popup=document.createElement('div');
    popup.className='max-width-popup';
    popup.setAttribute('role','status');
    const shield=document.createElement('div');shield.className='max-width-shield';shield.hidden=true;
    container.append(shield,handle,popup);
    let drag=null, target=null;
    const restore=ed=>{if(ed.style===null || (ed.style==='' && ed.initialStyle===null))ed.el.removeAttribute('style');else ed.el.setAttribute('style',ed.style);};
    function label(point, prefix='', suffix='') {
      popup.textContent=point ? `Max width · ${Math.round(point.px*100)/100}px · ${prefix}${point.token}${suffix}` : 'Max width · drag to snap to Tailwind sizes';
    }
    async function finish(cancel=false) {
      const ed=drag;if(!ed)return;drag=null;
      if(cancel || !ed.point || !ed.moved){shield.hidden=true;restore(ed);return;}
      handle.inert=true;
      try {
        if(await save(replace(ed.classes,ed.prefix+ed.point.token+ed.suffix,ed.prefix))) {
          // Keep the local preview until the compiler produces the utility.
          // Shopify can update Liquid before its CSS asset has refreshed.
          for(let attempt=0;attempt<16;attempt++) {
            const live=getTarget();
            if(!live || live.info.id!==ed.id)break;
            if(live.el!==ed.el) {
              restore(ed);ed.el=live.el;ed.style=live.el.getAttribute('style');
              ed.el.style.setProperty('max-width',ed.point.px+'px','important');
            }
            const d=ed.el.ownerDocument;
            const probe=d.createElement('div');
            probe.className=ed.prefix+ed.point.token+ed.suffix;
            probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;';
            ed.el.parentElement.appendChild(probe);
            const value=parseFloat(d.defaultView.getComputedStyle(probe).maxWidth);probe.remove();
            if(Math.abs(value-ed.point.px)<0.1)break;
            if([1,4,9].includes(attempt)) {
              for(const link of d.querySelectorAll('link[rel="stylesheet"][href]')) {
                const url=new URL(link.href);if(url.origin!==d.location.origin)continue;
                url.searchParams.set('__rt_css',Date.now());
                const fresh=link.cloneNode();fresh.href=url.href;
                fresh.onload=()=>link.remove();fresh.onerror=()=>fresh.remove();
                link.after(fresh);
              }
            }
            if(attempt===15)notify('Max-width class saved; waiting for the app’s CSS compiler.');
            else await new Promise(resolve=>setTimeout(resolve,500));
          }
        }
      } finally {restore(ed);shield.hidden=true;handle.inert=false;}
    }
    handle.onpointerdown=async e=>{
      if(e.button!==0 || drag || !target)return;
      e.preventDefault();e.stopPropagation();
      const edge=e.target.closest('[data-edge]')?.dataset.edge;
      if(!edge)return;
      shield.style.cursor=handle.style.cursor=(edge==='top'||edge==='bottom')?'ns-resize':'ew-resize';
      const initial=target;
      handle.setPointerCapture(e.pointerId);
      shield.hidden=false;
      await beforeDrag();
      if(!handle.hasPointerCapture(e.pointerId)){shield.hidden=true;return;}
      handle.focus();
      const el=initial.el;
      if(!el.isConnected){shield.hidden=true;return;}
      const scale=points(el);
      if(!scale.length){shield.hidden=true;notify('No Tailwind max-width sizes found');return;}
      const rect=el.getBoundingClientRect(), css=el.ownerDocument.defaultView.getComputedStyle(el);
      const localZoom=el.offsetWidth ? rect.width/el.offsetWidth : 1;
      const zoom=localZoom*(container.offsetWidth ? container.getBoundingClientRect().width/container.offsetWidth : 1);
      const extra=css.boxSizing==='content-box' ? ['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'].reduce((n,k)=>n+(parseFloat(css[k])||0),0) : 0;
      const prefix=scope(el,initial.info.className||'');
      const suffix=(initial.info.className||'').split(/\s+/).some(t=>t.startsWith(prefix+'max-w-')&&t.endsWith('!')) ? '!' : '';
      drag={el,direction:edge==='left'?-1:1,id:initial.info.id,initialStyle:el.getAttribute('style'),classes:initial.info.className||'',style:el.getAttribute('style'),start:e.clientX,width:rect.width/localZoom-extra,zoom,scale,prefix,suffix,moved:false};
    };
    handle.onpointermove=e=>{
      if(!drag)return;
      if(Math.abs(e.clientX-drag.start)<3 && !drag.moved)return;
      drag.moved=true;
      drag.point=nearest(drag.scale,drag.width+drag.direction*(e.clientX-drag.start)/drag.zoom);
      drag.el.style.setProperty('max-width',drag.point.px+'px','important');
      label(drag.point,drag.prefix,drag.suffix);
    };
    handle.onpointerup=()=>finish();
    handle.onpointercancel=()=>finish(true);
    handle.onlostpointercapture=()=>finish(true);
    document.addEventListener('keydown',e=>{if(drag && e.key==='Escape'){e.preventDefault();finish(true);}},true);
    function paint() {
      target=getTarget();
      if(drag && (!drag.el.isConnected || !target || target.el!==drag.el))finish(true);
      handle.hidden=!target;popup.hidden=!target || !drag;
      if(target){
        const r=target.el.getBoundingClientRect();
        handle.style.left=r.left+'px';
        handle.style.top=r.top+'px';
        handle.style.width=r.width+'px';
        handle.style.height=r.height+'px';
        popup.style.left=Math.max(8,Math.min(container.clientWidth-350,r.right-340))+'px';
        popup.style.top=Math.max(6,r.top+r.height/2-54)+'px';
        if(!drag)label();
      }
      requestAnimationFrame(paint);
    }
    paint();
  }
  const api={nearest,replace,points,scope,mount};
  if(typeof module!=='undefined')module.exports=api;
  if(root)root.RetouchMaxWidth=api;
})(typeof window!=='undefined'?window:null);
