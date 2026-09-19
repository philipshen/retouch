(function(root){
 'use strict';
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 function speed(value,start,end){const band=Math.min(36,(end-start)/3);if(band<=0||value<start||value>end)return 0;return value<start+band?-(1-(value-start)/band):value>end-band?1-(end-value)/band:0;}
 function step(frame,wrap,x,y,elapsed){
  const d=frame.contentDocument,w=d?.defaultView,scroller=d?.scrollingElement,f=frame.getBoundingClientRect(),v=wrap.getBoundingClientRect();if(!w||!scroller||!f.width||!f.height)return;
  const sx=f.width/frame.clientWidth,sy=f.height/frame.clientHeight,view={left:Math.max(f.left,v.left),right:Math.min(f.right,v.right),top:Math.max(f.top,v.top),bottom:Math.min(f.bottom,v.bottom)},inside=x>=view.left&&x<=view.right&&y>=view.top&&y<=view.bottom,amount=clamp(elapsed,0,40)*.7;
  const hit=inside?d.elementFromPoint((x-f.left)/sx,(y-f.top)/sy):null;
  for(const axis of ['X','Y']){
   const horizontal=axis==='X',position=horizontal?'scrollLeft':'scrollTop',size=horizontal?'clientWidth':'clientHeight',extent=horizontal?'scrollWidth':'scrollHeight',low=horizontal?'left':'top',high=horizontal?'right':'bottom',value=horizontal?x:y,scale=horizontal?sx:sy;let consumed=false;
   for(let el=hit;el;el=el.parentElement){
    if(el===scroller||el===d.documentElement)break;const css=w.getComputedStyle(el);if(!/auto|scroll/.test(css['overflow'+axis]))continue;
    const bounds=el.getBoundingClientRect(),edge={...view};edge[low]=Math.max(edge[low],(horizontal?f.left:f.top)+bounds[low]*scale);edge[high]=Math.min(edge[high],(horizontal?f.left:f.top)+bounds[high]*scale);
    for(let parent=el.parentElement;parent&&parent!==scroller;parent=parent.parentElement){if(w.getComputedStyle(parent)['overflow'+axis]==='visible')continue;const r=parent.getBoundingClientRect();edge[low]=Math.max(edge[low],(horizontal?f.left:f.top)+r[low]*scale);edge[high]=Math.min(edge[high],(horizontal?f.left:f.top)+r[high]*scale);}
    const rate=speed(value,edge[low],edge[high]);if(!rate)continue;const before=el[position];if(el[extent]>el[size])el.scrollTo({[horizontal?'left':'top']:before+rate*amount/scale,behavior:'instant'});if(el[position]!==before||/contain|none/.test(css['overscrollBehavior'+axis])){consumed=true;break;}
   }
   if(consumed)continue;
   const rate=inside?speed(value,view[low],view[high]):0,html=w.getComputedStyle(d.documentElement),body=d.body&&w.getComputedStyle(d.body),overflow=html['overflow'+axis]==='visible'?(body?.['overflow'+axis]||'visible'):html['overflow'+axis];
   if(rate&&!/hidden|clip/.test(overflow)){const before=scroller[position];scroller.scrollTo({[horizontal?'left':'top']:before+rate*amount/scale,behavior:'instant'});if(scroller[position]!==before||/contain|none/.test(html['overscrollBehavior'+axis]))continue;}
   if(x<v.left||x>v.right||y<v.top||y>v.bottom)continue;const canvasRate=speed(value,v[low],v[high]);if(canvasRate)wrap.scrollTo({[horizontal?'left':'top']:wrap[position]+canvasRate*amount,behavior:'instant'});
  }
 }
 root.RetouchPrototypeEdgeScroll={step};
})(window);
