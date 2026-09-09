(function(){
  'use strict';
  const canvas=document.getElementById('frameWrap'),extent=document.getElementById('canvasExtent'),stage=document.getElementById('siteStage'),frame=document.getElementById('app');
  const zoomInput=document.getElementById('canvasZoom'),fitButton=document.getElementById('fitScreen');
  const maxScale=64;
  const endPadding=96; // Screen pixels, independent of zoom.
  let scale=1,width=0,height=0,gestureBase=null,positioned=false,screen=null;
  const hooked=new WeakSet();
  function layout(){
    if(!width||!height)return;
    const pad=scale===1?0:24,ew=Math.max(canvas.clientWidth,width*scale+pad*2);
    extent.style.width=ew+'px';extent.style.height=(Math.max(canvas.clientHeight,height*scale)+endPadding*2)+'px';
    stage.style.width=width+'px';stage.style.height=height+'px';
    stage.style.left=(ew-width*scale)/2+'px';stage.style.top=endPadding+'px';
    stage.style.transform=`scale(${scale})`;
    stage.style.setProperty('--canvas-zoom',String(scale));
    if(!positioned){canvas.scrollTop=endPadding;positioned=true;}
    zoomInput.setCustomValidity('');zoomInput.min=screen?'1':'25';zoomInput.value=String(Math.round(scale*10000)/100);
    window.dispatchEvent(new CustomEvent('retouch:zoom',{detail:{scale}}));
  }
  function change(next,x,y){
    next=Math.max(screen ? .01 : .25,Math.min(maxScale,next));if(Math.abs(next-1)<.00001)next=1;
    if(next===scale)return;
    window.dispatchEvent(new Event('retouch:before-zoom'));
    const bounds=canvas.getBoundingClientRect(),px=x-bounds.left,py=y-bounds.top;
    const siteTop=endPadding-canvas.scrollTop;
    const old=scale,siteX=(canvas.scrollLeft+px-stage.offsetLeft)/old;
    const w=frame.contentWindow,siteY=(w?.scrollY||0)+(py-siteTop)/old;
    scale=next;
    layout();
    canvas.scrollLeft=stage.offsetLeft+siteX*scale-px;
    // Pan the magnified viewport first so fixed/sticky content and the page's
    // scroll position stay stable. Only use page scrolling for residual travel
    // when the finite canvas cannot keep the pointer's document point anchored.
    canvas.scrollTop=endPadding+(siteY-(w?.scrollY||0))*scale-py;
    w?.scrollTo({left:w.scrollX,top:Math.max(0,siteY-(py+canvas.scrollTop-endPadding)/scale),behavior:'instant'});
  }
  const center=()=>{const r=canvas.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};};
  zoomInput.addEventListener('input',()=>zoomInput.setCustomValidity(''));
  zoomInput.addEventListener('change',()=>{
    const value=Number(zoomInput.value),min=screen?1:25;
    if(!zoomInput.value||!Number.isFinite(value)||value<min||value>maxScale*100){zoomInput.setCustomValidity('Choose a zoom from '+min+'% to '+maxScale*100+'%.');zoomInput.reportValidity();return;}
    const p=center();change(value/100,p.x,p.y);
  });
  zoomInput.addEventListener('keydown',e=>{if(e.key==='Enter')zoomInput.blur();});
  fitButton.addEventListener('click',()=>{
    window.dispatchEvent(new Event('retouch:before-zoom'));
    const p=center(),w=frame.contentWindow,scroll={x:w?.scrollX||0,y:w?.scrollY||0};
    const fit=screen?Math.min((canvas.clientWidth-48)/width,(canvas.clientHeight-48)/height,1):1;
    change(fit,p.x,p.y);layout();canvas.scrollLeft=0;canvas.scrollTop=endPadding-(screen?24:0);w?.scrollTo({left:scroll.x,top:scroll.y,behavior:'instant'});
  });
  async function toSelection(elements){
    const w=frame.contentWindow,d=frame.contentDocument;
    const visible=elements.filter(el=>el?.isConnected&&el.ownerDocument===d&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0&&!['hidden','collapse'].includes(w.getComputedStyle(el).visibility));
    if(!visible.length)return {ok:false,reason:'The selection has no visible bounds.'};
    window.dispatchEvent(new Event('retouch:before-zoom'));
    if(!screen){
      const viewport={width:w.innerWidth,height:w.innerHeight};
      if(![viewport.width,viewport.height].every(value=>value>=240&&value<=7680))return {ok:false,reason:'Choose a screen size before zooming to this selection.'};
      window.RetouchScreens.set(viewport);
    }
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(visible.some(el=>!el.isConnected)||frame.contentDocument!==d)return {ok:false,reason:'The page changed before the selection could be revealed.'};
    visible[0].scrollIntoView({block:'center',inline:'center',behavior:'instant'});
    const bounds=()=>{const rects=visible.map(el=>el.getBoundingClientRect()),left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top));return {left,top,width:Math.max(...rects.map(r=>r.right))-left,height:Math.max(...rects.map(r=>r.bottom))-top};};
    let rect=bounds();const p=center();change(Math.min((canvas.clientWidth-64)/rect.width,(canvas.clientHeight-64)/rect.height,maxScale),p.x,p.y);layout();
    rect=bounds();w.scrollTo({left:w.scrollX+rect.left+rect.width/2-w.innerWidth/2,top:w.scrollY+rect.top+rect.height/2-w.innerHeight/2,behavior:'instant'});
    rect=bounds();canvas.scrollLeft=stage.offsetLeft+(rect.left+rect.width/2)*scale-canvas.clientWidth/2;canvas.scrollTop=endPadding+(rect.top+rect.height/2)*scale-canvas.clientHeight/2;
    // Let scroll events settle before enabling tools that cancel on viewport movement.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(visible.some(el=>!el.isConnected)||frame.contentDocument!==d)return {ok:false,reason:'The page changed while revealing the selection.'};
    rect=bounds();
    return {ok:true,clipped:rect.left<0||rect.top<0||rect.left+rect.width>w.innerWidth||rect.top+rect.height>w.innerHeight};
  }
  window.RetouchZoom={toSelection};
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
    const clipped=Math.max(0,height*scale-canvas.clientHeight);
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
    gestureBase=null;
    const d=frame.contentDocument;if(!d || hooked.has(d))return;
    hooked.add(d);hooks(d,true);
  });
  function measure(){
    width=screen?screen.width:canvas.clientWidth;
    height=screen?screen.height:canvas.clientHeight;
    if(!screen&&scale<.25)scale=.25;
    layout();
    window.dispatchEvent(new CustomEvent('retouch:viewport',{detail:{width,height,fixed:!!screen}}));
  }
  window.addEventListener('retouch:screen',e=>{
    screen=e.detail;measure();
    if(!e.preservePan)canvas.scrollLeft=0;
  });
  new ResizeObserver(measure).observe(canvas);
  window.RetouchScreens?.restore();
})();
