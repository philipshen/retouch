(function(){
  'use strict';
  const canvas=document.getElementById('frameWrap'),extent=document.getElementById('canvasExtent'),stage=document.getElementById('siteStage'),frame=document.getElementById('app');
  const endPadding=96; // Screen pixels, independent of zoom.
  let scale=1,width=0,height=0,pinnedHeight=0,gestureBase=null,positioned=false,screen=null;
  const pinned=new Map(),hooked=new WeakSet();
  // Expanding the visible page must not expand 100vh heroes with it. Rebase
  // viewport-height lengths in the preview's CSS only; never write source.
  function restoreUnits(){
    for(const [style,props] of pinned)for(const [name,p] of props) {
      if(style.getPropertyValue(name)===p.after)style.setProperty(name,p.before,p.priority);
    }
    pinned.clear();pinnedHeight=0;
  }
  function pinUnits(){
    if(scale===1 || screen){restoreUnits();return;}
    if(pinnedHeight && pinnedHeight!==height)restoreUnits();
    pinnedHeight=height;
    const d=frame.contentDocument;if(!d)return;
    function patch(style){
      if(!style)return;
      for(const name of Array.from(style)) {
        const before=style.getPropertyValue(name);
        // Leave quoted text and URLs alone.
        const after=before.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|url\([^)]*\)|(-?\d*\.?\d+)(?:s|l|d)?vh\b/gi,(match,n)=>n===undefined?match:(Number(n)*height/100)+'px');
        if(after===before)continue;
        const props=pinned.get(style)||new Map();
        const priority=style.getPropertyPriority(name);
        style.setProperty(name,after,priority);
        props.set(name,{before,after:style.getPropertyValue(name),priority});pinned.set(style,props);
      }
    }
    function scan(rules){for(const rule of rules){patch(rule.style);if(rule.cssRules)scan(rule.cssRules);}}
    for(const sheet of d.styleSheets){try{scan(sheet.cssRules);}catch{}}
    for(const el of d.querySelectorAll('[style]'))patch(el.style);
  }
  function layout(){
    if(!width||!height)return;
    const pad=scale===1?0:24,ew=Math.max(canvas.clientWidth,width*scale+pad*2);
    extent.style.width=ew+'px';extent.style.height=(Math.max(canvas.clientHeight,screen?height*scale:height)+endPadding*2)+'px';
    stage.style.width=width+'px';stage.style.height=(screen?height:height/scale)+'px';
    stage.style.left=(ew-width*scale)/2+'px';stage.style.top=endPadding+'px';
    stage.style.transform=`scale(${scale})`;
    stage.style.setProperty('--canvas-zoom',String(scale));
    if(!positioned){canvas.scrollTop=endPadding;positioned=true;}
  }
  function change(next,x,y){
    next=Math.max(.25,Math.min(2,next));if(Math.abs(next-1)<.00001)next=1;
    if(next===scale)return;
    const bounds=canvas.getBoundingClientRect(),px=x-bounds.left,py=y-bounds.top;
    const siteTop=endPadding-canvas.scrollTop;
    const old=scale,siteX=(canvas.scrollLeft+px-stage.offsetLeft)/old;
    const w=frame.contentWindow,siteY=(w?.scrollY||0)+(py-siteTop)/old;
    scale=next;
    if(scale===1 || pinnedHeight!==height)pinUnits();
    layout();
    canvas.scrollLeft=stage.offsetLeft+siteX*scale-px;
    w?.scrollTo(w.scrollX,Math.max(0,siteY-(py-siteTop)/scale));
  }
  function scrollPage(e,inFrame){
    if(!e.deltaY || e.shiftKey || Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
    const w=frame.contentWindow,d=frame.contentDocument,root=d?.scrollingElement;
    if(!root)return;
    // Leave independent scroll containers (menus, drawers, text areas) native.
    if(inFrame)for(let el=e.target?.nodeType===1?e.target:e.target?.parentElement;el && el!==root;el=el.parentElement){
      const css=w.getComputedStyle(el);
      if(/auto|scroll/.test(css.overflowY) && el.scrollHeight>el.clientHeight &&
        ((e.deltaY<0 && el.scrollTop>0)||(e.deltaY>0 && el.scrollTop+el.clientHeight<el.scrollHeight-1)))return;
      if(/contain|none/.test(css.overscrollBehaviorY))return;
    }
    const max=Math.max(0,root.scrollHeight-root.clientHeight);
    const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);
    const current=w.scrollY*scale+canvas.scrollTop-endPadding;
    const clipped=screen?Math.max(0,height*scale-canvas.clientHeight):0;
    const next=Math.max(-endPadding,Math.min(max*scale+clipped+endPadding,current+delta));
    // Native scrolling within the page; take over only at the canvas boundary.
    if(inFrame && canvas.scrollTop===endPadding && next>=0 && next<=max*scale)return;
    e.preventDefault();e.stopPropagation();
    const pageY=Math.max(0,Math.min(max,next/scale));
    w.scrollTo({left:w.scrollX,top:pageY,behavior:'instant'});
    canvas.scrollTop=endPadding+next-pageY*scale;
  }
  function hooks(target,inFrame){
    function point(e){const r=frame.getBoundingClientRect();return inFrame?{x:r.left+e.clientX*scale,y:r.top+e.clientY*scale}:{x:e.clientX,y:e.clientY};}
    target.addEventListener('wheel',e=>{
      if(!e.ctrlKey){scrollPage(e,inFrame);return;}
      e.preventDefault();e.stopPropagation();if(gestureBase!==null)return;
      const p=point(e),delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);
      change(scale*Math.exp(-delta*.005),p.x,p.y);
    },{capture:true,passive:false});
    target.addEventListener('gesturestart',e=>{e.preventDefault();e.stopPropagation();gestureBase=scale;},{capture:true,passive:false});
    target.addEventListener('gesturechange',e=>{e.preventDefault();e.stopPropagation();const p=point(e);if(gestureBase!==null)change(gestureBase*e.scale,p.x,p.y);},{capture:true,passive:false});
    target.addEventListener('gestureend',e=>{e.preventDefault();e.stopPropagation();gestureBase=null;},{capture:true,passive:false});
  }
  hooks(canvas,false);
  frame.addEventListener('load',()=>{
    restoreUnits();gestureBase=null;
    const d=frame.contentDocument;if(!d || hooked.has(d))return;
    hooked.add(d);hooks(d,true);pinUnits();
    // Stylesheet swaps and inline-style changes from the app still participate.
    let pending=false;
    const refresh=()=>{if(pending||scale===1)return;pending=true;requestAnimationFrame(()=>{pending=false;if(frame.contentDocument===d)pinUnits();});};
    new MutationObserver(refresh).observe(d.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
    d.addEventListener('load',refresh,true);
  });
  function measure(){
    width=screen?screen.width:canvas.clientWidth;
    height=screen?screen.height:canvas.clientHeight;
    pinUnits();layout();
    window.dispatchEvent(new CustomEvent('retouch:viewport',{detail:{width,height,fixed:!!screen}}));
  }
  window.addEventListener('retouch:screen',e=>{
    screen=e.detail;restoreUnits();measure();
    if(!e.preservePan)canvas.scrollLeft=0;
  });
  new ResizeObserver(measure).observe(canvas);
  window.RetouchScreens?.restore();
})();
