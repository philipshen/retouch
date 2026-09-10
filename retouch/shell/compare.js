(function(){
  'use strict';
  const toggle=document.getElementById('compareScreens'),rail=document.getElementById('screenComparisons'),main=document.getElementById('app');
  const project=window.__RT_RENDERING?.stateScope?.project;
  const storageKey='retouch.comparisons.v1'+(typeof project==='string'&&/^[a-f0-9]{64}$/.test(project)?':'+project:'');
  let sizes=[['Phone',390,844],['Tablet',768,1024],['Desktop',1440,900]],pin,restore;
  const removed=[];let removals=0;
  const valid=v=>Number.isInteger(v)&&v>=240&&v<=7680;
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(Array.isArray(saved)&&saved.length<=8&&saved.every(s=>Array.isArray(s)&&s.length===3&&typeof s[0]==='string'&&s[0].length<=80&&valid(s[1])&&valid(s[2])))sizes=saved;}catch{}
  function remember(){try{localStorage.setItem(storageKey,JSON.stringify(sizes));}catch{}window.RetouchScreens?.setSaved(sizes);}
  function current(){return {width:Number(document.getElementById('screenWidth').value),height:Number(document.getElementById('screenHeight').value)};}
  function updateControls(){
    const size=current();
    if(pin){pin.disabled=sizes.length>=8||!valid(size.width)||!valid(size.height)||sizes.some(s=>s[1]===size.width&&s[2]===size.height);pin.title=sizes.length>=8?'Remove a comparison to add another':'Add the current canvas dimensions';}
    if(restore){
      const last=removed.at(-1);restore.hidden=!last;restore.disabled=!last||removals>0||sizes.length>=8||sizes.some(size=>size[1]===last.size[1]&&size[2]===last.size[2]||size[0].toLowerCase()===last.size[0].toLowerCase());
      restore.textContent=last?'Undo remove: '+last.size[0]:'Undo remove';restore.title=restore.disabled?'Finish removing views, or free the name and dimensions before restoring.':'Restore the last removed comparison in its original position.';
    }
    for(const [index,card] of cards.entries()){card.up.disabled=index===0||removals>0;card.down.disabled=index===cards.length-1||removals>0;card.edit.setAttribute('aria-pressed',String(size.width===card.width&&size.height===card.height));card.scopeButton.disabled=!selected;}
  }
  let cards=[],selected=null,route=null,open=false,timer=null,scope={prefix:'',label:'All sizes · base',condition:null},scopeSummary;
  function path(){try{const loc=main.contentWindow.location;return loc.origin===location.origin?loc.pathname+loc.search+loc.hash:null;}catch{return null;}}
  function sync(force=false){
    if(!open)return;
    const next=path();if(!next)return;
    if(!force&&next===route)return;route=next;
    for(const card of cards){card.message.textContent='Loading…';card.frame.src=next;}
  }
  function selectedNodes(d){return selected?[...d.querySelectorAll('[data-rt],[data-rt-i]')].filter(el=>el.getAttribute('data-rt')===selected||el.getAttribute('data-rt-i')===selected):[];}
  function rendered(el){const rect=el.getBoundingClientRect(),css=el.ownerDocument.defaultView.getComputedStyle(el);return rect.width>0&&rect.height>0&&!['hidden','collapse'].includes(css.visibility);}
  function visibleBounds(el,width,height){
    const w=el.ownerDocument.defaultView,raw=el.getBoundingClientRect();
    let left=Math.max(0,raw.left),top=Math.max(0,raw.top),right=Math.min(width,raw.right),bottom=Math.min(height,raw.bottom);
    const positioned=[];
    for(let node=el;node;node=node.parentElement){
      const style=w.getComputedStyle(node);
      if(node!==el){
        // Out-of-flow descendants can escape an intermediate overflow container.
        const escapes=positioned.some(item=>!item.parent||!node.contains(item.parent));
        if(!escapes){
          const clipX=/hidden|clip|auto|scroll/.test(style.overflowX),clipY=/hidden|clip|auto|scroll/.test(style.overflowY);
          if(clipX||clipY){
            const rect=node.getBoundingClientRect(),sx=node.offsetWidth?rect.width/node.offsetWidth:1,sy=node.offsetHeight?rect.height/node.offsetHeight:1;
            const x=rect.left+node.clientLeft*sx,y=rect.top+node.clientTop*sy;
            if(clipX){left=Math.max(left,x);right=Math.min(right,x+node.clientWidth*sx);}
            if(clipY){top=Math.max(top,y);bottom=Math.min(bottom,y+node.clientHeight*sy);}
          }
        }
      }
      if(style.position==='absolute'||style.position==='fixed')positioned.push({parent:node.offsetParent});
    }
    return right>left&&bottom>top?{left,top,width:right-left,height:bottom-top}:null;
  }
  function paint(){
    if(!open)return;
    for(const card of cards){
      const {frame,overlay,message,scopeMessage,width,height,reveal}=card;
      scopeMessage.textContent='Checking style scope…';scopeMessage.dataset.scopeApplies='unknown';
      const scale=card.viewport.clientWidth/width;
      frame.style.transform=`scale(${scale})`;card.viewport.style.height=height*scale+'px';
      overlay.replaceChildren();
      try{
        const d=frame.contentDocument;if(!d?.body||d.URL==='about:blank'){reveal.disabled=true;continue;}
        const applies=!scope.prefix?true:window.RetouchResponsive.matches(scope,d.defaultView);
        scopeMessage.dataset.scopeApplies=applies===null?'unknown':String(applies);
        scopeMessage.textContent=!scope.prefix?'Base styles apply here; breakpoint overrides may take precedence.':applies===null?'Scope coverage is unavailable for this breakpoint.':applies?'Current breakpoint applies here; other overrides may take precedence.':'Current breakpoint does not apply in this preview.';
        const nodes=selectedNodes(d);
        const count=nodes.filter(rendered).length;reveal.disabled=!count;reveal.textContent=count>1?'Show next instance':'Show selection';reveal.title=count>1?'Reveal the next rendered instance of this layer.':'Scroll this comparison to the selected layer.';
        let visible=0,offscreen=0;
        for(const el of nodes){
          const rect=el.getBoundingClientRect(),css=d.defaultView.getComputedStyle(el);
          if(!rect.width||!rect.height||['hidden','collapse'].includes(css.visibility))continue;
          const bounds=visibleBounds(el,width,height);
          if(!bounds){offscreen++;continue;}visible++;
          const box=document.createElement('div');box.className='compare-selection';
          Object.assign(box.style,{left:bounds.left*scale+'px',top:bounds.top*scale+'px',width:bounds.width*scale+'px',height:bounds.height*scale+'px'});overlay.append(box);
        }
        message.textContent=selected?(visible?'Selected layer · '+visible+(visible===1?' instance':' instances'):offscreen?'Selected layer is outside this viewport':nodes.length?'Selected layer is hidden':'Selected layer is absent on this screen'):'Same page · independent viewport';
      }catch{reveal.disabled=true;message.textContent='Preview unavailable for this page';}
    }
    timer=setTimeout(paint,100);
  }
  let previousSet=null,setStatus,setMessage='',loadingSet=false,loadRevision=0;
  function parseSet(text){
    let value;try{value=JSON.parse(text);}catch{throw Error('Choose a valid screen-set JSON file.');}
    if(value?.version!==1||!Array.isArray(value.screens)||value.screens.length>8)throw Error('A screen set must have version 1 and up to eight screens.');
    const names=new Set(),dimensions=new Set();
    return value.screens.map(screen=>{
      const name=typeof screen?.name==='string'?screen.name.trim().replace(/\s+/g,' '):'';
      if(!name||name.length>80||!valid(screen.width)||!valid(screen.height))throw Error('Each screen needs a name and whole-number dimensions from 240 to 7680.');
      const key=screen.width+'x'+screen.height;
      if(names.has(name.toLowerCase())||dimensions.has(key))throw Error('Screen names and dimensions must be unique.');
      names.add(name.toLowerCase());dimensions.add(key);return [name,screen.width,screen.height];
    });
  }
  async function replaceSet(next,history,undo,message){
    if(loadingSet)return;loadingSet=true;toggle.disabled=true;rail.inert=true;clearTimeout(timer);
    try{
      await dispose();sizes=next;removed.splice(0,removed.length,...history);previousSet=undo;setMessage=message;
      remember();mount();sync(true);paint();
    }finally{loadingSet=false;toggle.disabled=false;rail.inert=false;}
  }
  function mount(){
    rail.replaceChildren();cards=[];
    const heading=document.createElement('h2');heading.textContent='Compare screens';rail.append(heading);
    const hint=document.createElement('p');hint.className='hint';hint.textContent='Click a layer to edit on the main canvas. Style scope stays unchanged.';rail.append(hint);
    scopeSummary=document.createElement('p');scopeSummary.className='hint';scopeSummary.setAttribute('aria-label','Comparison style scope');scopeSummary.textContent='Style scope: '+scope.label;rail.append(scopeSummary);
    const files=document.createElement('div');files.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px';
    const saveSet=document.createElement('button');saveSet.type='button';saveSet.className='control-button';saveSet.textContent='Save screen set';
    saveSet.onclick=()=>{
      const text=JSON.stringify({version:1,screens:sizes.map(([name,width,height])=>({name,width,height}))},null,2)+'\n';
      const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='retouch-screens.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    };
    const loadSet=document.createElement('button');loadSet.type='button';loadSet.className='control-button';loadSet.textContent='Load screen set';loadSet.title='Replace these comparison views with a saved screen set. You can undo the load.';
    const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.setAttribute('aria-label','Screen set file');loadSet.onclick=()=>file.click();
    file.onchange=async()=>{
      const selectedFile=file.files[0],revision=++loadRevision;file.value='';if(!selectedFile||loadingSet)return;
      try{
        if(selectedFile.size>65536)throw Error('Screen-set files must be 64 KB or smaller.');
        const next=parseSet(await selectedFile.text());if(revision!==loadRevision||!open)return;
        const undo={sizes:sizes.map(size=>[...size]),removed:removed.map(entry=>({size:[...entry.size],index:entry.index}))};
        await replaceSet(next,[],undo,'Loaded '+next.length+' comparison views.');
      }catch(error){if(revision===loadRevision){setMessage=error.message;setStatus.textContent=setMessage;}}
    };
    const undoLoad=document.createElement('button');undoLoad.type='button';undoLoad.className='control-button';undoLoad.textContent='Undo load screen set';undoLoad.hidden=!previousSet;
    undoLoad.onclick=()=>{if(previousSet&&!loadingSet)replaceSet(previousSet.sizes,previousSet.removed,null,'Restored previous screen set.');};
    setStatus=document.createElement('p');setStatus.className='hint';setStatus.setAttribute('role','status');setStatus.setAttribute('aria-label','Screen set status');setStatus.textContent=setMessage;
    files.append(saveSet,loadSet,undoLoad,file);rail.append(files,setStatus);
    pin=document.createElement('button');pin.className='control-button';pin.textContent='Pin current size';
    pin.onclick=()=>{const {width,height}=current();if(pin.disabled)return;const size=[`Custom ${width} × ${height}`,width,height];sizes.push(size);remember();addCard(size);cards.at(-1).frame.src=path()||'/';updateControls();};rail.append(pin);
    restore=document.createElement('button');restore.className='control-button';restore.type='button';
    restore.onclick=()=>{
      if(restore.disabled)return;
      const last=removed.pop(),index=Math.min(last.index,sizes.length),next=cards[index]?.card;
      sizes.splice(index,0,last.size);addCard(last.size,next);const item=cards.pop();cards.splice(index,0,item);
      item.frame.src=path()||'/';remember();updateControls();item.card.scrollIntoView({block:'nearest'});
    };rail.append(restore);
    for(const size of sizes)addCard(size);
    updateControls();
  }
  function addCard(size,before=null){
      let name=size[0],width=size[1],height=size[2];
      const card=document.createElement('section');card.className='compare-card';card.setAttribute('aria-label',name+' comparison');
      const header=document.createElement('div');header.className='compare-header';
      const label=document.createElement('button');label.type='button';label.className='control-button';label.style.cssText='flex:1;text-align:left;min-width:0;overflow-wrap:anywhere';label.title='Rename this comparison';
      const nameInput=document.createElement('input');nameInput.type='text';nameInput.maxLength=80;nameInput.hidden=true;nameInput.style.cssText='min-width:0;width:100%;box-sizing:border-box';
      label.onclick=()=>{nameInput.value=name;nameInput.hidden=false;label.hidden=true;nameInput.focus();nameInput.select();};
      function finishName(cancel=false){
        if(nameInput.hidden)return;
        const next=nameInput.value.trim().replace(/\s+/g,' ');
        if(!cancel&&(!next||sizes.some(other=>other!==size&&other[0].toLowerCase()===next.toLowerCase()))){dimensionError.textContent=next?'Another comparison already has this name.':'Enter a comparison name.';dimensionError.hidden=false;return;}
        if(!cancel){name=next;size[0]=name;remember();}
        dimensionError.hidden=true;nameInput.hidden=true;label.hidden=false;updateLabels();
      }
      nameInput.onblur=()=>finishName();
      nameInput.onkeydown=event=>{if(event.key==='Enter'||event.key==='Escape'){event.preventDefault();event.stopPropagation();finishName(event.key==='Escape');if(nameInput.hidden)label.focus();}};
      header.append(label,nameInput);
      const edit=document.createElement('button');edit.className='control-button';edit.textContent='Edit';edit.setAttribute('aria-label','Edit '+name.toLowerCase()+' size');
      edit.onclick=()=>window.RetouchScreens.set({width,height});header.append(edit);
      const remove=document.createElement('button');remove.className='control-button';remove.textContent='×';remove.setAttribute('aria-label','Remove '+name+' comparison');header.append(remove);
      remove.onclick=async()=>{remove.disabled=true;const index=sizes.indexOf(size);if(index<0)return;card.inert=true;removals++;removed.push({size:[...size],index});if(removed.length>8)removed.shift();sizes.splice(index,1);remember();const item=cards.find(c=>c.frame===frame);cards=cards.filter(c=>c!==item);updateControls();await unload(frame);card.remove();removals--;updateControls();};
      const viewport=document.createElement('div');viewport.className='compare-viewport';viewport.tabIndex=0;viewport.setAttribute('role','button');viewport.setAttribute('aria-label','Edit from '+name+' comparison');viewport.title='Click a layer to select it on the main canvas at this size. Style scope stays unchanged.';
      const frame=document.createElement('iframe');frame.title=name+' comparison preview';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.style.width=width+'px';frame.style.height=height+'px';
      const overlay=document.createElement('div');overlay.className='compare-overlay';
      const message=document.createElement('p');message.className='hint';
      const scopeMessage=document.createElement('p');scopeMessage.className='compare-scope-message';scopeMessage.style.cssText='font:11px/1.4 system-ui;color:#aeb3bd;margin:8px 0;';scopeMessage.setAttribute('aria-label',name+' scope coverage');
      const reveal=document.createElement('button');reveal.type='button';reveal.className='control-button';reveal.textContent='Show selection';reveal.setAttribute('aria-label','Show selection in '+name+' comparison');reveal.disabled=true;
      let revealSelection=null,revealIndex=-1;
      reveal.onclick=()=>{
        try{
          const d=frame.contentDocument,loc=frame.contentWindow.location;
          if(!selected||!d?.body||loc.origin!==location.origin||loc.pathname+loc.search+loc.hash!==path())return;
          const nodes=selectedNodes(d).filter(rendered);if(!nodes.length)return;
          if(revealSelection!==selected){revealSelection=selected;revealIndex=-1;}
          revealIndex=(revealIndex+1)%nodes.length;
          // Native scrolling reveals the layer through nested scroll containers.
          nodes[revealIndex].scrollIntoView({block:'center',inline:'center',behavior:'instant'});
        }catch{message.textContent='Could not reveal the selected layer in this preview.';}
      };
      const scopeButton=document.createElement('button');scopeButton.className='control-button';scopeButton.textContent='Edit styles: '+width+' px and larger';scopeButton.setAttribute('aria-label','Edit styles from '+width+' px');scopeButton.title='Use this preview size and set the selected layer’s style scope to this width and larger. Does not change source until you edit a style.';scopeButton.disabled=!selected;
      scopeButton.onclick=()=>{if(!selected)return;window.dispatchEvent(new CustomEvent('retouch:comparison-edit',{detail:{width,height,occurrence:0,scopeAtWidth:true,route:path()}}));};
      const dimensions=document.createElement('div');dimensions.className='compare-dimensions';
      const inputs={},dimensionError=document.createElement('p');dimensionError.className='compare-dimension-error';dimensionError.setAttribute('role','status');dimensionError.hidden=true;
      const applyDimensions=(nextWidth,nextHeight)=>{
        if(!valid(nextWidth)||!valid(nextHeight))return;
        if(sizes.some(other=>other!==size&&other[1]===nextWidth&&other[2]===nextHeight)){
          dimensionError.textContent='This size is already pinned.';dimensionError.hidden=false;inputs.width.value=width;inputs.height.value=height;return;
        }
        dimensionError.hidden=true;dimensionError.textContent='';
        const automatic=name===`Custom ${width} × ${height}`;
        width=nextWidth;height=nextHeight;size[1]=width;size[2]=height;
        if(automatic){name=`Custom ${width} × ${height}`;size[0]=name;}
        updateLabels();
        const item=cards.find(c=>c.frame===frame);if(item)Object.assign(item,{width,height});
        frame.style.width=width+'px';frame.style.height=height+'px';
        inputs.width.value=width;inputs.height.value=height;
        scopeButton.textContent='Edit styles: '+width+' px and larger';scopeButton.setAttribute('aria-label','Edit styles from '+width+' px');
        remember();updateControls();
      };
      for(const axis of ['width','height']){
        const field=document.createElement('label');field.textContent=axis==='width'?'W':'H';
        const input=document.createElement('input');input.type='number';input.min=240;input.max=7680;input.step=1;input.value=axis==='width'?width:height;input.setAttribute('aria-label',name+' comparison '+axis);inputs[axis]=input;
        input.onchange=()=>{if(input.value!==''&&input.checkValidity())applyDimensions(axis==='width'?Number(input.value):width,axis==='height'?Number(input.value):height);};
        input.onkeydown=event=>{if(event.key==='Escape'){input.value=axis==='width'?width:height;event.preventDefault();event.stopPropagation();}};
        field.append(input);dimensions.append(field);
      }
      const order=document.createElement('div');order.className='compare-header';
      const up=document.createElement('button'),down=document.createElement('button');
      up.type=down.type='button';up.className=down.className='control-button';up.textContent='Move up';down.textContent='Move down';order.append(up,down);
      function move(delta){
        const index=sizes.indexOf(size),next=index+delta;if(index<0||next<0||next>=sizes.length||loadingSet||removals)return;
        const item=cards[index],anchor=delta<0?cards[next].card:cards[next].card.nextSibling;
        // moveBefore retains the iframe's browsing context. Older engines reload
        // moved frames, so restore the document scroll after that load.
        if(typeof rail.moveBefore==='function')rail.moveBefore(card,anchor);
        else{let scroll;try{scroll={x:frame.contentWindow.scrollX,y:frame.contentWindow.scrollY};}catch{}if(scroll)frame.addEventListener('load',()=>{try{frame.contentWindow.scrollTo({left:scroll.x,top:scroll.y,behavior:'instant'});}catch{}},{once:true});rail.insertBefore(card,anchor);}
        sizes.splice(index,1);sizes.splice(next,0,size);cards.splice(index,1);cards.splice(next,0,item);remember();updateControls();
        const control=delta<0?up:down;if(control.disabled)(delta<0?down:up).focus();else control.focus();
      }
      up.onclick=()=>move(-1);down.onclick=()=>move(1);
      const rotate=document.createElement('button');rotate.type='button';rotate.className='control-button';rotate.textContent='Rotate';rotate.setAttribute('aria-label','Rotate '+name+' comparison');rotate.onclick=()=>applyDimensions(height,width);dimensions.append(rotate);
      function updateLabels(){
        label.textContent=name===`Custom ${width} × ${height}`?name:`${name} · ${width} × ${height}`;
        label.setAttribute('aria-label','Rename '+name+' comparison');nameInput.setAttribute('aria-label','Comparison name');
        card.setAttribute('aria-label',name+' comparison');edit.setAttribute('aria-label','Edit '+name.toLowerCase()+' size');remove.setAttribute('aria-label','Remove '+name+' comparison');viewport.setAttribute('aria-label','Edit from '+name+' comparison');frame.title=name+' comparison preview';scopeMessage.setAttribute('aria-label',name+' scope coverage');
        for(const axis of ['width','height'])inputs[axis].setAttribute('aria-label',name+' comparison '+axis);
        up.setAttribute('aria-label','Move '+name+' comparison up');down.setAttribute('aria-label','Move '+name+' comparison down');
        rotate.setAttribute('aria-label','Rotate '+name+' comparison');reveal.setAttribute('aria-label','Show selection in '+name+' comparison');
      }
      updateLabels();
      viewport.append(frame,overlay);card.append(header,dimensions,dimensionError,order,viewport,message,reveal,scopeMessage,scopeButton);rail.insertBefore(card,before);
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
      viewport.addEventListener('wheel',e=>{
        if(e.ctrlKey)return;
        e.preventDefault();
        try{
          const d=frame.contentDocument,w=frame.contentWindow,bounds=viewport.getBoundingClientRect(),scale=viewport.clientWidth/width;
          if(!d?.body||!Number.isFinite(scale)||scale<=0)return;
          let node=d.elementFromPoint((e.clientX-bounds.left)/scale,(e.clientY-bounds.top)/scale)||d.body;
          const css=w.getComputedStyle(node),line=parseFloat(css.lineHeight)||16;
          let dx=e.deltaX*(e.deltaMode===1?line:e.deltaMode===2?width:1/scale),dy=e.deltaY*(e.deltaMode===1?line:e.deltaMode===2?height:1/scale);
          const root=d.scrollingElement;
          while(node&&node!==root&&(dx||dy)){
            const style=w.getComputedStyle(node),x=/auto|scroll/.test(style.overflowX),y=/auto|scroll/.test(style.overflowY),beforeX=node.scrollLeft,beforeY=node.scrollTop;
            node.scrollBy({left:x?dx:0,top:y?dy:0,behavior:'instant'});
            dx-=node.scrollLeft-beforeX;dy-=node.scrollTop-beforeY;
            if(Math.abs(dx)<1)dx=0;if(Math.abs(dy)<1)dy=0;
            if(x&&/contain|none/.test(style.overscrollBehaviorX))dx=0;
            if(y&&/contain|none/.test(style.overscrollBehaviorY))dy=0;
            node=node.assignedSlot||node.parentElement||node.getRootNode()?.host;
          }
          if(root){const style=w.getComputedStyle(root);w.scrollBy({left:/hidden|clip/.test(style.overflowX)?0:dx,top:/hidden|clip/.test(style.overflowY)?0:dy,behavior:'instant'});}
        }catch{}
      },{passive:false});
      cards.push({card,frame,overlay,message,scopeMessage,scopeButton,viewport,width,height,edit,reveal,up,down});
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
    loadRevision++;
    clearTimeout(timer);open=!open;toggle.setAttribute('aria-pressed',String(open));rail.hidden=!open;
    if(open){mount();sync(true);paint();}else{toggle.disabled=true;try{await dispose();}finally{toggle.disabled=false;}}
  };
  window.addEventListener('retouch:selection',e=>{selected=e.detail;updateControls();});
  window.addEventListener('retouch:style-scope',e=>{scope=e.detail;if(scopeSummary)scopeSummary.textContent='Style scope: '+scope.label;});
  window.addEventListener('retouch:route',()=>sync());
  main.addEventListener('load',()=>sync(true));
  window.addEventListener('retouch:viewport',updateControls);
  window.addEventListener('retouch:screen',updateControls);
  window.RetouchScreens?.setSaved(sizes);
})();
