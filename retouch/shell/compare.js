(function(){
  'use strict';
  const toggle=document.getElementById('compareScreens'),rail=document.getElementById('screenComparisons'),main=document.getElementById('app');
  const storageKey='retouch.comparisons.v1';
  let sizes=[['Phone',390,844],['Tablet',768,1024],['Desktop',1440,900]],pin;
  const valid=v=>Number.isInteger(v)&&v>=240&&v<=7680;
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(Array.isArray(saved)&&saved.length<=8&&saved.every(s=>Array.isArray(s)&&s.length===3&&typeof s[0]==='string'&&s[0].length<=80&&valid(s[1])&&valid(s[2])))sizes=saved;}catch{}
  function remember(){try{localStorage.setItem(storageKey,JSON.stringify(sizes));}catch{}}
  function current(){return {width:Number(document.getElementById('screenWidth').value),height:Number(document.getElementById('screenHeight').value)};}
  function updateControls(){
    const size=current();
    if(pin){pin.disabled=sizes.length>=8||!valid(size.width)||!valid(size.height)||sizes.some(s=>s[1]===size.width&&s[2]===size.height);pin.title=sizes.length>=8?'Remove a comparison to add another':'Add the current canvas dimensions';}
    for(const card of cards){card.edit.setAttribute('aria-pressed',String(size.width===card.width&&size.height===card.height));card.scopeButton.disabled=!selected;}
  }
  let cards=[],selected=null,route=null,open=false,timer=null,scope={prefix:'',label:'All sizes · base',condition:null},scopeSummary;
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
      const {frame,overlay,message,scopeMessage,width,height}=card;
      scopeMessage.textContent='Checking style scope…';scopeMessage.dataset.scopeApplies='unknown';
      const scale=card.viewport.clientWidth/width;
      frame.style.transform=`scale(${scale})`;card.viewport.style.height=height*scale+'px';
      overlay.replaceChildren();
      try{
        const d=frame.contentDocument;if(!d?.body||d.URL==='about:blank')continue;
        const applies=!scope.prefix?true:window.RetouchResponsive.matches(scope,d.defaultView);
        scopeMessage.dataset.scopeApplies=applies===null?'unknown':String(applies);
        scopeMessage.textContent=!scope.prefix?'Base styles apply here; breakpoint overrides may take precedence.':applies===null?'Scope coverage is unavailable for this breakpoint.':applies?'Current breakpoint applies here; other overrides may take precedence.':'Current breakpoint does not apply in this preview.';
        const nodes=selected?[...d.querySelectorAll('[data-rt],[data-rt-i]')].filter(el=>el.getAttribute('data-rt')===selected||el.getAttribute('data-rt-i')===selected):[];
        let visible=0,offscreen=0;
        for(const el of nodes){
          const rect=el.getBoundingClientRect(),css=d.defaultView.getComputedStyle(el);
          if(!rect.width||!rect.height||['hidden','collapse'].includes(css.visibility))continue;
          if(rect.bottom<=0||rect.right<=0||rect.top>=height||rect.left>=width){offscreen++;continue;}visible++;
          const box=document.createElement('div');box.className='compare-selection';
          Object.assign(box.style,{left:rect.left*scale+'px',top:rect.top*scale+'px',width:rect.width*scale+'px',height:rect.height*scale+'px'});overlay.append(box);
        }
        message.textContent=selected?(visible?'Selected layer · '+visible+(visible===1?' instance':' instances'):offscreen?'Selected layer is outside this viewport':nodes.length?'Selected layer is hidden':'Selected layer is absent on this screen'):'Same page · independent viewport';
      }catch{message.textContent='Preview unavailable for this page';}
    }
    timer=setTimeout(paint,100);
  }
  function mount(){
    rail.replaceChildren();cards=[];
    const heading=document.createElement('h2');heading.textContent='Compare screens';rail.append(heading);
    const hint=document.createElement('p');hint.className='hint';hint.textContent='Click a layer to edit on the main canvas. Style scope stays unchanged.';rail.append(hint);
    scopeSummary=document.createElement('p');scopeSummary.className='hint';scopeSummary.setAttribute('aria-label','Comparison style scope');scopeSummary.textContent='Style scope: '+scope.label;rail.append(scopeSummary);
    pin=document.createElement('button');pin.className='control-button';pin.textContent='Pin current size';
    pin.onclick=()=>{const {width,height}=current();if(pin.disabled)return;const size=[`Custom ${width} × ${height}`,width,height];sizes.push(size);remember();addCard(size);cards.at(-1).frame.src=path()||'/';updateControls();};rail.append(pin);
    for(const size of sizes)addCard(size);
    updateControls();
  }
  function addCard(size){
      const [name,width,height]=size;
      const card=document.createElement('section');card.className='compare-card';card.setAttribute('aria-label',name+' comparison');
      const header=document.createElement('div');header.className='compare-header';
      const label=document.createElement('span');label.textContent=name.startsWith('Custom ')?name:`${name} · ${width} × ${height}`;header.append(label);
      const edit=document.createElement('button');edit.className='control-button';edit.textContent='Edit';edit.setAttribute('aria-label','Edit '+name.toLowerCase()+' size');
      edit.onclick=()=>window.RetouchScreens.set({width,height});header.append(edit);
      const remove=document.createElement('button');remove.className='control-button';remove.textContent='×';remove.setAttribute('aria-label','Remove '+name+' comparison');header.append(remove);
      remove.onclick=async()=>{remove.disabled=true;const index=sizes.indexOf(size);if(index<0)return;sizes.splice(index,1);remember();const item=cards.find(c=>c.frame===frame);cards=cards.filter(c=>c!==item);await unload(frame);card.remove();updateControls();};
      const viewport=document.createElement('div');viewport.className='compare-viewport';viewport.tabIndex=0;viewport.setAttribute('role','button');viewport.setAttribute('aria-label','Edit from '+name+' comparison');viewport.title='Click a layer to select it on the main canvas at this size. Style scope stays unchanged.';
      const frame=document.createElement('iframe');frame.title=name+' comparison preview';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.style.width=width+'px';frame.style.height=height+'px';
      const overlay=document.createElement('div');overlay.className='compare-overlay';
      const message=document.createElement('p');message.className='hint';
      const scopeMessage=document.createElement('p');scopeMessage.className='compare-scope-message';scopeMessage.style.cssText='font:11px/1.4 system-ui;color:#aeb3bd;margin:8px 0;';scopeMessage.setAttribute('aria-label',name+' scope coverage');
      const scopeButton=document.createElement('button');scopeButton.className='control-button';scopeButton.textContent='Edit styles: '+width+' px and larger';scopeButton.setAttribute('aria-label','Edit styles from '+width+' px');scopeButton.title='Use this preview size and set the selected layer’s style scope to this width and larger. Does not change source until you edit a style.';scopeButton.disabled=!selected;
      scopeButton.onclick=()=>{if(!selected)return;window.dispatchEvent(new CustomEvent('retouch:comparison-edit',{detail:{width,height,occurrence:0,scopeAtWidth:true,route:path()}}));};
      viewport.append(frame,overlay);card.append(header,viewport,message,scopeMessage,scopeButton);rail.append(card);
      function activate(event){
        try{
          const d=frame.contentDocument,loc=frame.contentWindow.location;
          if(!d?.body||loc.origin!==location.origin||loc.pathname+loc.search+loc.hash!==path()){message.textContent='Wait for this comparison to finish loading.';return;}
          const bounds=viewport.getBoundingClientRect(),scale=viewport.clientWidth/width;
          const node=event?d.elementFromPoint((event.clientX-bounds.left)/scale,(event.clientY-bounds.top)/scale)?.closest('[data-rt],[data-rt-i]'):null;
          if(event&&!node){message.textContent='This layer is not editable yet.';return;}
          const hostId=node?.getAttribute('data-rt'),instanceId=node?.getAttribute('data-rt-i');
          const peers=node?[...d.querySelectorAll('[data-rt],[data-rt-i]')].filter(el=>el.getAttribute('data-rt')===hostId&&el.getAttribute('data-rt-i')===instanceId):[];
          window.dispatchEvent(new CustomEvent('retouch:comparison-edit',{detail:{width,height,hostId,instanceId,occurrence:node?peers.indexOf(node):0,route:path()}}));
        }catch{message.textContent='Preview unavailable for this page';}
      }
      viewport.addEventListener('click',event=>{if(event.button===0)activate(event);});
      viewport.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}});
      viewport.addEventListener('wheel',e=>{e.preventDefault();try{frame.contentWindow.scrollBy({top:e.deltaY/(viewport.clientWidth/width),left:e.deltaX,behavior:'instant'});}catch{}},{passive:false});
      cards.push({frame,overlay,message,scopeMessage,scopeButton,viewport,width,height,edit});
  }
  function unload(frame){return new Promise(resolve=>{
    let timeout;
    const done=()=>{clearTimeout(timeout);frame.removeEventListener('load',done);frame.remove();resolve();};
    frame.addEventListener('load',done);timeout=setTimeout(done,1000);
    try{frame.contentWindow.stop();frame.src='about:blank';}catch{done();}
  });}
  async function dispose(){
    // Unload each browsing context before detaching it, including frames whose
    // framework bootstrap is still awaiting scripts or network responses.
    await Promise.all(cards.map(({frame})=>unload(frame)));
    rail.replaceChildren();cards=[];route=null;
  }
  toggle.onclick=async()=>{
    clearTimeout(timer);open=!open;toggle.setAttribute('aria-pressed',String(open));rail.hidden=!open;
    if(open){mount();sync(true);paint();}else{toggle.disabled=true;try{await dispose();}finally{toggle.disabled=false;}}
  };
  window.addEventListener('retouch:selection',e=>{selected=e.detail;updateControls();});
  window.addEventListener('retouch:style-scope',e=>{scope=e.detail;if(scopeSummary)scopeSummary.textContent='Style scope: '+scope.label;});
  window.addEventListener('retouch:route',()=>sync());
  main.addEventListener('load',()=>sync(true));
  window.addEventListener('retouch:viewport',updateControls);
  window.addEventListener('retouch:screen',updateControls);
})();
