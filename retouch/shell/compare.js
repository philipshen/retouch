(function(){
  'use strict';
  const toggle=document.getElementById('compareScreens'),rail=document.getElementById('screenComparisons'),main=document.getElementById('app');
  const sizes=[['Phone',390,844],['Tablet',768,1024],['Desktop',1440,900]];
  let cards=[],selected=null,route=null,open=false,timer=null;
  function path(){try{const loc=main.contentWindow.location;return loc.origin===location.origin?loc.pathname+loc.search+loc.hash:null;}catch{return null;}}
  function sync(force=false){
    if(!open)return;
    const next=path();if(!next)return;
    if(!force&&next===route)return;route=next;
    for(const card of cards){card.message.textContent='Loading…';card.frame.src=next;}
  }
  function paint(){
    if(!open)return;
    for(const card of cards){
      const {frame,overlay,message,width,height}=card;
      const scale=card.viewport.clientWidth/width;
      frame.style.transform=`scale(${scale})`;card.viewport.style.height=height*scale+'px';
      overlay.replaceChildren();
      try{
        const d=frame.contentDocument;if(!d?.body||d.URL==='about:blank')continue;
        const nodes=selected?[...d.querySelectorAll('[data-rt],[data-rt-i]')].filter(el=>el.getAttribute('data-rt')===selected||el.getAttribute('data-rt-i')===selected):[];
        let visible=0;
        for(const el of nodes){
          const rect=el.getBoundingClientRect();if(!rect.width||!rect.height)continue;visible++;
          const box=document.createElement('div');box.className='compare-selection';
          Object.assign(box.style,{left:rect.left*scale+'px',top:rect.top*scale+'px',width:rect.width*scale+'px',height:rect.height*scale+'px'});overlay.append(box);
        }
        message.textContent=selected?(visible?'Selected layer · '+visible+(visible===1?' instance':' instances'):'Selected layer is hidden or absent'):'Same page · independent viewport';
      }catch{message.textContent='Preview unavailable for this page';}
    }
    timer=setTimeout(paint,100);
  }
  function mount(){
    rail.replaceChildren();cards=[];
    const heading=document.createElement('h2');heading.textContent='Compare screens';rail.append(heading);
    for(const [name,width,height] of sizes){
      const card=document.createElement('section');card.className='compare-card';card.setAttribute('aria-label',name+' comparison');
      const header=document.createElement('div');header.className='compare-header';
      const label=document.createElement('span');label.textContent=`${name} · ${width} × ${height}`;header.append(label);
      const edit=document.createElement('button');edit.className='control-button';edit.textContent='Edit';edit.setAttribute('aria-label','Edit '+name.toLowerCase()+' size');
      edit.onclick=()=>window.RetouchScreens.set({width,height});header.append(edit);
      const viewport=document.createElement('div');viewport.className='compare-viewport';
      const frame=document.createElement('iframe');frame.title=name+' comparison preview';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.style.width=width+'px';frame.style.height=height+'px';
      const overlay=document.createElement('div');overlay.className='compare-overlay';
      const message=document.createElement('p');message.className='hint';
      viewport.append(frame,overlay);card.append(header,viewport,message);rail.append(card);
      viewport.addEventListener('wheel',e=>{e.preventDefault();try{frame.contentWindow.scrollBy({top:e.deltaY/(viewport.clientWidth/width),left:e.deltaX,behavior:'instant'});}catch{}},{passive:false});
      cards.push({frame,overlay,message,viewport,width,height,edit});
    }
  }
  async function dispose(){
    // Unload each browsing context before detaching it, including frames whose
    // framework bootstrap is still awaiting scripts or network responses.
    await Promise.all(cards.map(({frame})=>new Promise(resolve=>{
      let timeout;
      const done=()=>{clearTimeout(timeout);frame.removeEventListener('load',done);frame.remove();resolve();};
      frame.addEventListener('load',done);timeout=setTimeout(done,1000);
      try{frame.contentWindow.stop();frame.src='about:blank';}catch{done();}
    })));
    rail.replaceChildren();cards=[];route=null;
  }
  toggle.onclick=async()=>{
    clearTimeout(timer);open=!open;toggle.setAttribute('aria-pressed',String(open));rail.hidden=!open;
    if(open){mount();sync(true);paint();}else{toggle.disabled=true;try{await dispose();}finally{toggle.disabled=false;}}
  };
  window.addEventListener('retouch:selection',e=>{selected=e.detail;});
  window.addEventListener('retouch:route',()=>sync());
  main.addEventListener('load',()=>sync(true));
  window.addEventListener('retouch:screen',e=>{for(const card of cards)card.edit.setAttribute('aria-pressed',String(e.detail?.width===card.width&&e.detail?.height===card.height));});
})();
