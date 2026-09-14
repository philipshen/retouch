(function(root){
 'use strict';
 function targets(target,excluded=[]){
  const w=target.ownerDocument.defaultView,result=[],svg=target.ownerSVGElement;
  if(svg){const r=svg.getBoundingClientRect();result.push({left:r.left,top:r.top,width:r.width,height:r.height,container:true});}
  for(const el of target.parentElement?.children||[]){
   if(el===target||el.contains(target)||excluded.some(node=>node===el||node.contains(el)||el.contains(node))||!['g','rect','circle','ellipse','line','path','polygon','polyline','text','image','use'].includes(el.localName))continue;
   const css=w.getComputedStyle(el),r=el.getBoundingClientRect();if(css.display==='none'||css.visibility!=='visible'||r.width<0||r.height<0||!r.width&&!r.height||r.right<0||r.bottom<0||r.left>w.innerWidth||r.top>w.innerHeight)continue;
   result.push({left:r.left,top:r.top,width:r.width,height:r.height});
  }
  result.push(...(root.RetouchGuides?.targets(target.ownerDocument)||[]));
  return result;
 }
 function movement(m,x,y,constrain){const result={x:m[0]*x+m[2]*y,y:m[1]*x+m[3]*y};if(constrain){result.lock=Math.abs(result.x)>=Math.abs(result.y)?'x':'y';result[result.lock==='x'?'y':'x']=0;}return result;}
 function mount(surface,clip){
  const guides=root.document.createElement('div');guides.className='svg-snap-guides';guides.setAttribute('aria-hidden','true');guides.style.pointerEvents='none';surface.append(guides);
  return result=>{guides.replaceChildren();const items=[...(result.guides||[]),...(result.spacing||[]).map(item=>({axis:item.axis==='x'?'y':'x',value:item.cross,start:item.start,end:item.end,gap:item.gap}))];for(const item of items){const line=root.document.createElement('div'),spacing=item.gap!==undefined;line.dataset[spacing?'spacingAxis':'snapAxis']=spacing?(item.axis==='x'?'y':'x'):item.axis;Object.assign(line.style,{position:'absolute',background:spacing?'#a21caf':'#e11d48',left:(clip.f.left+(item.axis==='x'?item.value:item.start)*clip.scale-clip.left)+'px',top:(clip.f.top+(item.axis==='y'?item.value:item.start)*clip.scale-clip.top)+'px',width:item.axis==='x'?'1px':Math.max(1,(item.end-item.start)*clip.scale)+'px',height:item.axis==='y'?'1px':Math.max(1,(item.end-item.start)*clip.scale)+'px'});if(spacing){const label=root.document.createElement('span');label.textContent=Math.round(item.gap*100)/100+' px';Object.assign(label.style,{position:'absolute',whiteSpace:'nowrap',fontSize:'11px',color:'#a21caf',background:'var(--panel)',left:'4px',top:'-16px'});line.append(label);}guides.append(line);}};
 }
 const api={targets,movement,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGSnapping=api;
})(typeof window==='object'?window:globalThis);
