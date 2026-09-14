(function(root){
 'use strict';
 function ticks(length,origin,scale){
  if(!Number.isFinite(length)||length<=0||!Number.isFinite(origin)||!Number.isFinite(scale)||scale<=0)return [];
  const raw=60/scale,power=10**Math.floor(Math.log10(raw)),major=[1,2,5,10].map(n=>n*power).find(n=>n>=raw),step=major/5,first=Math.ceil(-origin/(step*scale)),last=Math.floor((length-origin)/(step*scale));
  if(last-first>1000)return [];
  const out=[];for(let i=first;i<=last;i++){const value=Number((i*step).toPrecision(12));out.push({value,position:origin+value*scale,major:i%5===0});}return out;
 }
 if(typeof module==='object'&&module.exports){module.exports={ticks};return;}
 const canvas=document.getElementById('frameWrap'),frame=document.getElementById('app'),main=document.getElementById('main'),host=document.getElementById('panelEmpty'),ns='http://www.w3.org/2000/svg',key='retouch.canvas.rulers.v1';
 let visible=false,scheduled=false;try{visible=localStorage.getItem(key)==='true';}catch{}
 const make=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const [name,value]of Object.entries(attrs))el.setAttribute(name,String(value));return el;};
 const horizontal=make('svg',{'aria-hidden':'true',class:'canvas-ruler canvas-ruler-horizontal'}),vertical=make('svg',{'aria-hidden':'true',class:'canvas-ruler canvas-ruler-vertical'});main.append(horizontal,vertical);
 const toggle=root.RetouchInspector.button('Rulers',()=>{visible=!visible;try{localStorage.setItem(key,String(visible));}catch{}update();});toggle.id='toggleRulers';toggle.setAttribute('aria-label','Toggle rulers');toggle.title='Show document coordinates along the canvas edges';host.querySelector('.inspector-section').append(toggle);
 function draw(svg,length,origin,scale,verticalAxis){
  svg.replaceChildren();for(const tick of ticks(length,origin,scale)){
   const p=Math.round(tick.position)+.5,line=verticalAxis?{x1:tick.major?11:16,y1:p,x2:20,y2:p}:{x1:p,y1:tick.major?11:16,x2:p,y2:20};svg.append(make('line',line));
   if(tick.major){const label=make('text',verticalAxis?{x:10,y:p+3,transform:'rotate(-90 10 '+(p+3)+')'}:{x:p+3,y:9});label.textContent=String(tick.value);label.dataset.rulerValue=tick.value;svg.append(label);}
  }
 }
 function update(){
  toggle.setAttribute('aria-pressed',String(visible));horizontal.style.display=vertical.style.display=visible?'block':'none';if(!visible){root.dispatchEvent(new Event('retouch:rulers'));return;}
  const bounds=canvas.getBoundingClientRect(),parent=main.getBoundingClientRect(),preview=frame.getBoundingClientRect(),scale=preview.width/frame.clientWidth;if(!Number.isFinite(scale)||scale<=0)return;
  let x=0,y=0;try{x=frame.contentWindow.scrollX;y=frame.contentWindow.scrollY;}catch{}
  Object.assign(horizontal.style,{left:(bounds.left-parent.left+20)+'px',top:(bounds.top-parent.top)+'px',width:Math.max(0,canvas.clientWidth-20)+'px',height:'20px'});
  Object.assign(vertical.style,{left:(bounds.left-parent.left)+'px',top:(bounds.top-parent.top+20)+'px',width:'20px',height:Math.max(0,canvas.clientHeight-20)+'px'});
  draw(horizontal,Math.max(0,canvas.clientWidth-20),preview.left-bounds.left-20-x*scale,scale,false);draw(vertical,Math.max(0,canvas.clientHeight-20),preview.top-bounds.top-20-y*scale,scale,true);root.dispatchEvent(new Event('retouch:rulers'));
 }
 const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;update();});};
 canvas.addEventListener('scroll',schedule,{passive:true});for(const event of ['retouch:zoom','retouch:viewport','retouch:workspace-layout'])root.addEventListener(event,schedule);
 const observed=new WeakSet();function hook(){try{const w=frame.contentWindow,d=frame.contentDocument;if(d&&!observed.has(d)){observed.add(d);w.addEventListener('scroll',schedule,{passive:true});}}catch{}schedule();}frame.addEventListener('load',hook);new ResizeObserver(schedule).observe(canvas);new ResizeObserver(schedule).observe(frame);hook();update();
 root.RetouchRulers={ticks,get visible(){return visible;},horizontal,vertical};
})(typeof window==='object'?window:globalThis);
