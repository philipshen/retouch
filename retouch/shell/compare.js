(function(){
  'use strict';
  const toggle=document.getElementById('compareScreens'),rail=document.getElementById('screenComparisons'),main=document.getElementById('app');
  const project=window.__RT_RENDERING?.stateScope?.project;
  const storageKey='retouch.comparisons.v1'+(typeof project==='string'&&/^[a-f0-9]{64}$/.test(project)?':'+project:'');
  let focusPreviews=true;try{focusPreviews=localStorage.getItem(storageKey+'.focus')!=='false';}catch{}
  let sizes=[['Phone',390,844],['Tablet',768,1024],['Desktop',1440,900]],pin,restore,allPreviews,revealAll,emptyState,emptyAdd;
  const collapsedScreens=new WeakSet(),sizeHistories=new WeakMap(),nameHistories=new WeakMap(),lockedRatios=new WeakSet();let previewSerial=0;
  const marqueeCleanup=new WeakMap();
  let activeName=null,activeDimensionScrub=null,draggedScreen=null;
  const clearScreenDrag=()=>{draggedScreen=null;rail.querySelectorAll('[data-screen-drop]').forEach(card=>delete card.dataset.screenDrop);};
  window.addEventListener('blur',clearScreenDrag);
  for(const type of ['blur','pagehide'])window.addEventListener(type,()=>activeDimensionScrub?.cancel());
  document.addEventListener('keydown',event=>{if(activeDimensionScrub&&event.key==='Escape'&&!event.isComposing){event.preventDefault();event.stopImmediatePropagation();activeDimensionScrub.cancel();}},true);
  document.addEventListener('pointerdown',event=>{if(activeDimensionScrub&&!activeDimensionScrub.field.contains(event.target))activeDimensionScrub.cancel();},true);
  document.addEventListener('pointerdown',event=>{if(activeName&&!activeName.input.contains(event.target))activeName.finish();},true);
  const removed=[],orderUndo=[],orderRedo=[];let removals=0,undoOrder,redoOrder;
  function clearOrderHistory(){orderUndo.length=0;orderRedo.length=0;}
  const valid=v=>Number.isInteger(v)&&v>=240&&v<=7680;
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(Array.isArray(saved)&&saved.length<=8&&saved.every(s=>Array.isArray(s)&&s.length===3&&typeof s[0]==='string'&&s[0].length<=80&&valid(s[1])&&valid(s[2])))sizes=saved;}catch{}
  try{const saved=JSON.parse(localStorage.getItem(storageKey+'.collapsed'));if(Array.isArray(saved)&&saved.length<=8)for(const size of sizes)if(saved.includes(size[0]))collapsedScreens.add(size);}catch{}
  try{const names=JSON.parse(localStorage.getItem(storageKey+'.aspect'));if(Array.isArray(names)&&names.length<=8)for(const size of sizes)if(names.includes(size[0]))lockedRatios.add(size);}catch{}
  const ratioOf=size=>sizeHistories.get(size)?.ratio||[size[1],size[2]];
  try{const anchors=JSON.parse(localStorage.getItem(storageKey+'.aspectBases'));if(Array.isArray(anchors)&&anchors.length<=8)for(const size of sizes){const entry=anchors.find(entry=>Array.isArray(entry)&&entry.length===3&&entry[0]===size[0]&&valid(entry[1])&&valid(entry[2]));if(entry)sizeHistories.set(size,{undo:[],redo:[],ratio:entry.slice(1)});}}catch{}
  function remember(){try{localStorage.setItem(storageKey+'.aspectBases',JSON.stringify(sizes.filter(size=>lockedRatios.has(size)).map(size=>[size[0],...ratioOf(size)])));localStorage.setItem(storageKey+'.aspect',JSON.stringify(sizes.filter(size=>lockedRatios.has(size)).map(size=>size[0])));localStorage.setItem(storageKey,JSON.stringify(sizes));localStorage.setItem(storageKey+'.collapsed',JSON.stringify(sizes.filter(size=>collapsedScreens.has(size)).map(size=>size[0])));}catch{}window.RetouchScreens?.setSaved(sizes);}
  function snapshotSize(size){
    const copy=[...size],history=sizeHistories.get(size);if(lockedRatios.has(size))lockedRatios.add(copy);if(collapsedScreens.has(size))collapsedScreens.add(copy);
    if(history){const clone=entry=>({...entry,before:[...entry.before],after:[...entry.after],ratioBefore:[...entry.ratioBefore],ratioAfter:[...entry.ratioAfter]});sizeHistories.set(copy,{ratio:[...history.ratio],undo:history.undo.map(clone),redo:history.redo.map(clone)});}
    const names=nameHistories.get(size);if(names)nameHistories.set(copy,{undo:names.undo.map(entry=>({...entry})),redo:names.redo.map(entry=>({...entry}))});
    return copy;
  }
  function current(){return {width:Number(document.getElementById('screenWidth').value),height:Number(document.getElementById('screenHeight').value)};}
  function layoutPreviews(){
    const railBounds=rail.getBoundingClientRect();
    for(const item of cards){item.surface.hidden=item.previewBody.hidden;if(item.previewBody.hidden)continue;const scale=item.viewport.clientWidth/item.width;item.frame.style.transform=`scale(${scale})`;item.viewport.style.height=item.height*scale+'px';}
    for(const item of cards){if(item.previewBody.hidden)continue;const bounds=item.viewport.getBoundingClientRect();Object.assign(item.surface.style,{left:bounds.left-railBounds.left+rail.scrollLeft-rail.clientLeft+'px',top:bounds.top-railBounds.top+rail.scrollTop-rail.clientTop+'px',width:bounds.width+'px',height:bounds.height+'px'});}
  }
  function updateControls(){
    window.dispatchEvent(new Event('retouch:comparisons'));
    if(revealAll)revealAll.disabled=!selected||!cards.length;
    if(allPreviews){allPreviews.disabled=!cards.length;allPreviews.textContent=cards.some(card=>!card.previewBody.hidden)?'Hide all previews':'Show all previews';allPreviews.setAttribute('aria-controls',cards.map(card=>card.previewBody.id).join(' '));}
    const size=current();
    if(undoOrder)undoOrder.disabled=!orderUndo.length||removals>0||loadingSet;
    if(redoOrder)redoOrder.disabled=!orderRedo.length||removals>0||loadingSet;
    if(undoOrder)undoOrder.parentElement.hidden=!orderUndo.length&&!orderRedo.length;
    if(pin){
      const exists=sizes.some(s=>s[1]===size.width&&s[2]===size.height);
      pin.disabled=!valid(size.width)||!valid(size.height)||(!exists&&sizes.length>=8)||loadingSet||removals>0;
      pin.setAttribute('aria-label',exists?'Show current size':'Pin current size');
      pin.textContent=exists?'↗':'+';
      pin.title=exists?'Reveal the existing preview at the current canvas size':sizes.length>=8?'Remove a comparison to add another':'Add the current canvas dimensions';
    }
    if(emptyState){emptyState.hidden=cards.length>0;emptyAdd.disabled=!!pin?.disabled;}
    if(restore){
      const last=removed.at(-1);restore.hidden=!last;restore.disabled=!last||removals>0||sizes.length>=8||sizes.some(size=>size[1]===last.size[1]&&size[2]===last.size[2]||size[0].toLowerCase()===last.size[0].toLowerCase());
      restore.textContent=last?'Undo remove: '+last.size[0]:'Undo remove';restore.title=restore.disabled?'Finish removing views, or free the name and dimensions before restoring.':'Restore the last removed comparison in its original position.';
    }
    for(const [index,card] of cards.entries()){card.up.disabled=index===0||removals>0;card.down.disabled=index===cards.length-1||removals>0;card.edit.setAttribute('aria-pressed',String(size.width===card.width&&size.height===card.height));card.scopeButton.disabled=!selected;}
    layoutPreviews();
  }
  let cards=[],selected=null,selectedIds=[],selectionDetails=new Map(),route=null,open=false,timer=null,scope={prefix:'',label:'All sizes · base',condition:null},scopeSummary;
  function path(){try{const loc=main.contentWindow.location;return loc.origin===location.origin?loc.pathname+loc.search+loc.hash:null;}catch{return null;}}
  function scrollViewport(w,dx,dy){
    const d=w.document,html=w.getComputedStyle(d.documentElement),body=d.body&&w.getComputedStyle(d.body);
    // The root's visible overflow can be supplied by the body, including in
    // quirks-mode pages where scrollingElement itself is the body.
    const overflow=axis=>html['overflow'+axis]==='visible'?(body?.['overflow'+axis]||'visible'):html['overflow'+axis];
    w.scrollBy({left:/hidden|clip/.test(overflow('X'))?0:dx,top:/hidden|clip/.test(overflow('Y'))?0:dy,behavior:'instant'});
  }
  const scrollParent=node=>node.assignedSlot||node.parentElement||node.getRootNode()?.host;
  function scrollFrom(w,node,dx,dy){
    const root=w.document.scrollingElement;
    while(node&&node!==root&&(dx||dy)){
      const style=w.getComputedStyle(node),x=/auto|scroll/.test(style.overflowX),y=/auto|scroll/.test(style.overflowY),beforeX=node.scrollLeft,beforeY=node.scrollTop;
      node.scrollBy({left:x?dx:0,top:y?dy:0,behavior:'instant'});
      dx-=node.scrollLeft-beforeX;dy-=node.scrollTop-beforeY;
      if(Math.abs(dx)<1)dx=0;if(Math.abs(dy)<1)dy=0;
      if(x&&/contain|none/.test(style.overscrollBehaviorX))dx=0;
      if(y&&/contain|none/.test(style.overscrollBehaviorY))dy=0;
      node=scrollParent(node);
    }
    if(root)scrollViewport(w,dx,dy);
  }
  function sync(force=false){
    if(!open)return;
    const next=path();if(!next)return;
    if(!force&&next===route)return;route=next;
    for(const card of cards){card.imageSyncToken=null;card.retryImage=null;card.imageSyncError=null;card.retryImageControl.hidden=true;card.message.textContent='Loading…';card.frame.src=next;}
  }
  function syncColdText(info){
    const {id,text,hash,renderRevisionAttribute}=info;
    for(const card of cards){
      card.cancelColdText?.();delete card.cancelColdText;card.textSyncError=null;
      const frame=card.frame,initial=frame.contentDocument,href=new URL(path()||'/',location.href).href;
      if(initial?.readyState==='complete'&&window.RetouchClientMount.ready(initial))continue;
      if(!renderRevisionAttribute)continue;
      let cancelled=false,running=false;
      const controller=new AbortController();
      const cancel=()=>{cancelled=true;frame.removeEventListener('load',run);controller.abort();};
      card.cancelColdText=cancel;
      const current=()=>{try{return !cancelled&&open&&cards.includes(card)&&new URL(path()||'/',location.href).href===href&&frame.contentWindow.location.href===href;}catch{return false;}};
      const select=d=>[...d.querySelectorAll('[data-rt]')].find(el=>el.getAttribute('data-rt')===id);
      const matches=el=>el&&el.getAttribute(renderRevisionAttribute)===hash&&el.textContent===text;
      async function run(){
        if(running||!current()||frame.contentDocument?.readyState!=='complete')return;
        running=true;frame.removeEventListener('load',run);
        let timeout;
        try{
          const d=frame.contentDocument;
          for(let attempt=0;attempt<80&&!window.RetouchClientMount.ready(d);attempt++){
            if(!current()||frame.contentDocument!==d)return;
            await new Promise(resolve=>setTimeout(resolve,50));
          }
          if(!current()||frame.contentDocument!==d)return;
          if(!window.RetouchClientMount.ready(d))throw Error('Preview is still mounting.');
          if(matches(select(d)))return;
          timeout=setTimeout(()=>controller.abort(new Error('The saved source revision did not finish rendering.')),8000);
          while(current()&&frame.contentDocument===d){
            if(matches(select(d)))return;
            const response=await fetch(href,{cache:'no-store',signal:controller.signal});
            if(!response.ok)throw Error('Could not render the saved page.');
            const fresh=new DOMParser().parseFromString(await response.text(),'text/html');
            if(!current()||frame.contentDocument!==d)return;
            // A successful HTTP response can still contain the previous compiled
            // revision. Keep waiting for the saved revision before reloading.
            if(matches(select(fresh))){
              if(!matches(select(d)))frame.contentWindow.location.reload();
              return;
            }
            await new Promise(resolve=>setTimeout(resolve,150));
          }
        }catch(error){if(current())card.textSyncError='Text saved; comparison refresh failed: '+error.message;}
        finally{clearTimeout(timeout);if(card.cancelColdText===cancel)delete card.cancelColdText;}
      }
      frame.addEventListener('load',run);void run();
    }
  }
  function selectedNodes(d){const ids=new Set(selectedIds);return ids.size?[...d.querySelectorAll('[data-rt],[data-rt-i]')].filter(el=>ids.has(el.getAttribute('data-rt'))||ids.has(el.getAttribute('data-rt-i'))):[];}
  function selectedGroups(d){
    const nodes=selectedNodes(d),groups=[];
    for(const id of selectedIds){
      const info=selectionDetails.get(id),matches=nodes.filter(el=>(info?.kind==='instance'?el.getAttribute('data-rt-i')===id:el.getAttribute('data-rt')===id||el.getAttribute('data-rt-i')===id)&&Object.entries(info?.renderScope||{}).every(([name,value])=>el.getAttribute(name)===value));
      groups.push(...(info?.kind==='instance'?RetouchComponentInstances.group(matches,info.rootGroups):matches.map(el=>({element:el,elements:[el]}))));
    }
    return groups;
  }
  function rendered(el){const rect=RetouchComponentInstances.bounds([el]),css=el.ownerDocument.defaultView.getComputedStyle(el);return !!rect&&rect.width>0&&rect.height>0&&!['hidden','collapse'].includes(css.visibility);}
  function visibleBounds(el,width,height){
    const w=el.ownerDocument.defaultView;
    if(w.getComputedStyle(el).display==='contents'){
      const boxes=[...el.children].filter(rendered).map(child=>visibleBounds(child,width,height)).filter(Boolean);if(!boxes.length)return null;
      const left=Math.min(...boxes.map(b=>b.left)),top=Math.min(...boxes.map(b=>b.top));return {left,top,width:Math.max(...boxes.map(b=>b.left+b.width))-left,height:Math.max(...boxes.map(b=>b.top+b.height))-top};
    }
    const raw=el.getBoundingClientRect();
    let left=Math.max(0,raw.left),top=Math.max(0,raw.top),right=Math.min(width,raw.right),bottom=Math.min(height,raw.bottom);
    const positioned=[];
    for(let node=el;node;node=node.parentElement){
      const style=w.getComputedStyle(node);if(style.display==='contents')continue;
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
  function updateOutlines(card,boxes){
    const key=JSON.stringify(boxes);if(card.outlineKey===key)return;card.outlineKey=key;
    card.overlay.replaceChildren(...boxes.map(bounds=>{const box=document.createElement('div');box.className='compare-selection';for(const [axis,value]of Object.entries(bounds))box.style[axis]=value+'px';return box;}));
  }
  function updateProperty(node,key,value){if(node[key]!==value)node[key]=value;}
  function updateScope(node,state,text){if(node.dataset.scopeApplies!==state)node.dataset.scopeApplies=state;updateProperty(node,'textContent',text);}
  function paint(){
    if(!open)return;
    layoutPreviews();
    for(const card of cards){
      if(card.previewBody.hidden)continue;
      const {frame,message,scopeMessage,width,height,reveal}=card;
      const scale=card.viewport.clientWidth/width;
      const boxes=[];
      try{
        const d=frame.contentDocument;card.attachMarquee?.();if(!d?.body||d.URL==='about:blank'){updateProperty(reveal,'disabled',true);updateScope(scopeMessage,'unknown','Checking style scope…');continue;}
        const applies=!scope.prefix?true:window.RetouchResponsive.matches(scope,d.defaultView);
        updateScope(scopeMessage,applies===null?'unknown':String(applies),!scope.prefix?'Base styles apply here; breakpoint overrides may take precedence.':applies===null?'Scope coverage is unavailable for this breakpoint.':applies?'Current breakpoint applies here; other overrides may take precedence.':'Current breakpoint does not apply in this preview.');
        const groups=selectedGroups(d),nodes=groups.flatMap(group=>group.elements);
        const count=groups.filter(group=>group.elements.some(rendered)).length;updateProperty(reveal,'disabled',!count);updateProperty(reveal,'textContent',count>1?'Show next instance':'Show selection');updateProperty(reveal,'title',count>1?'Reveal the next rendered instance of this layer.':'Scroll this comparison to the selected layer.');
        let visible=0,offscreen=0;
        for(const group of groups){
          const roots=group.elements.filter(rendered);if(!roots.length)continue;
          const rects=roots.map(el=>visibleBounds(el,width,height)).filter(Boolean);
          if(!rects.length){offscreen++;continue;}visible++;
          const left=Math.min(...rects.map(rect=>rect.left)),top=Math.min(...rects.map(rect=>rect.top));
          boxes.push({left:left*scale,top:top*scale,width:(Math.max(...rects.map(rect=>rect.left+rect.width))-left)*scale,height:(Math.max(...rects.map(rect=>rect.top+rect.height))-top)*scale});
        }
        updateProperty(message,'textContent',card.styleSyncError||card.imageSyncError||card.textSyncError|| (selected?(visible?(selectedIds.length>1?'Selection · ':'Selected layer · ')+visible+(visible===1?' instance':' instances'):offscreen?'Selected layer is outside this viewport':nodes.length?'Selected layer is hidden':'Selected layer is absent on this screen'):'Same page · independent viewport'));
      }catch{boxes.length=0;updateProperty(reveal,'disabled',true);updateScope(scopeMessage,'unknown','Scope coverage is unavailable for this page.');updateProperty(message,'textContent','Preview unavailable for this page');}finally{updateOutlines(card,boxes);}
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
      if(screen.lockAspectRatio!==undefined&&typeof screen.lockAspectRatio!=='boolean')throw Error('Screen aspect-ratio locks must be true or false.');
      if(screen.previewCollapsed!==undefined&&typeof screen.previewCollapsed!=='boolean')throw Error('Preview collapsed states must be true or false.');
      if(screen.aspectRatio!==undefined&&(!screen.aspectRatio||!valid(screen.aspectRatio.width)||!valid(screen.aspectRatio.height)))throw Error('Screen aspect ratios need whole-number reference dimensions from 240 to 7680.');
      const key=screen.width+'x'+screen.height;
      if(names.has(name.toLowerCase())||dimensions.has(key))throw Error('Screen names and dimensions must be unique.');
      names.add(name.toLowerCase());dimensions.add(key);const size=[name,screen.width,screen.height];if(screen.previewCollapsed)collapsedScreens.add(size);if(screen.lockAspectRatio)lockedRatios.add(size);if(screen.aspectRatio)sizeHistories.set(size,{undo:[],redo:[],ratio:[screen.aspectRatio.width,screen.aspectRatio.height]});return size;
    });
  }
  async function replaceSet(next,history,undo,message){
    if(loadingSet)return;loadingSet=true;toggle.disabled=true;rail.inert=true;clearTimeout(timer);updateControls();
    try{
      await dispose();sizes=next;removed.splice(0,removed.length,...history);previousSet=undo;setMessage=message;
      remember();mount();sync(true);paint();
    }finally{loadingSet=false;toggle.disabled=false;rail.inert=false;updateControls();}
  }
  function mount(){
    rail.replaceChildren();cards=[];
    rail.classList.toggle('focus-previews',focusPreviews);
    const toolbar=document.createElement('div');toolbar.className='compare-toolbar';const heading=document.createElement('h2');heading.textContent='Screens';toolbar.append(heading);rail.append(toolbar);
    const focus=document.createElement('button');focus.id='comparisonFocus';focus.type='button';focus.className='control-button';focus.setAttribute('aria-label','Screen controls');focus.textContent='Controls';focus.setAttribute('aria-expanded',String(!focusPreviews));focus.title=focusPreviews?'Show screen controls':'Hide screen controls and focus previews';
    focus.onclick=()=>{focusPreviews=!focusPreviews;rail.classList.toggle('focus-previews',focusPreviews);focus.setAttribute('aria-expanded',String(!focusPreviews));focus.title=focusPreviews?'Show screen controls':'Hide screen controls and focus previews';try{localStorage.setItem(storageKey+'.focus',String(focusPreviews));}catch{}layoutPreviews();};toolbar.append(focus);
    const hint=document.createElement('p');hint.className='hint';hint.id='comparisonNavigationHint';hint.hidden=true;hint.textContent='Click a layer to select it on the main canvas; double-click text to type. F2 edits the selected text layer. Shift-click adds or removes layers. Drag from empty space to select a group. Style scope stays unchanged. Right-click a layer, or press Shift+F10 on a focused preview, to open its editing menu. Focus a preview and use arrow keys, Page Up/Down, or Home/End to scroll the panel at its center. Enter opens its size.';rail.append(hint);
    const help=document.createElement('button');help.type='button';help.className='control-button';help.textContent='?';help.setAttribute('aria-label','Comparison help');help.setAttribute('aria-controls',hint.id);help.setAttribute('aria-expanded','false');help.title='Selection and keyboard help';help.onclick=()=>{hint.hidden=!hint.hidden;help.setAttribute('aria-expanded',String(!hint.hidden));layoutPreviews();};help.onkeydown=e=>{if(e.key==='Escape'&&!hint.hidden){e.preventDefault();e.stopPropagation();hint.hidden=true;help.setAttribute('aria-expanded','false');layoutPreviews();}};toolbar.append(help);
    scopeSummary=document.createElement('p');scopeSummary.className='hint compare-scope';scopeSummary.setAttribute('aria-label','Comparison style scope');scopeSummary.textContent='Style scope: '+scope.label;rail.append(scopeSummary);
    const files=document.createElement('div');files.className='compare-files';
    allPreviews=document.createElement('button');allPreviews.id='comparisonVisibility';allPreviews.type='button';allPreviews.className='control-button';allPreviews.title='Collapse previews to manage screen sizes, or expand them again. Keeps each page loaded.';
    allPreviews.onclick=()=>{const hide=cards.some(card=>!card.previewBody.hidden);for(const card of cards)card.setCollapsed(hide);remember();updateControls();};files.append(allPreviews);
    revealAll=document.createElement('button');revealAll.id='comparisonRevealAll';revealAll.type='button';revealAll.className='control-button';revealAll.textContent='Show selection';revealAll.setAttribute('aria-label','Show selection in all previews');revealAll.title='Expand comparisons and scroll each page to the selected layer. Repeat to cycle repeated instances.';
    revealAll.onclick=()=>{if(!selected)return;for(const card of cards)card.setCollapsed(false);remember();updateControls();clearTimeout(timer);paint();for(const card of cards)card.reveal.click();};files.append(revealAll);
    const saveSet=document.createElement('button');saveSet.type='button';saveSet.className='control-button';saveSet.textContent='Save screen set';
    saveSet.onclick=()=>{
      const text=JSON.stringify({version:1,screens:sizes.map(size=>({name:size[0],width:size[1],height:size[2],lockAspectRatio:lockedRatios.has(size),...(collapsedScreens.has(size)?{previewCollapsed:true}:{}),...(lockedRatios.has(size)?{aspectRatio:{width:ratioOf(size)[0],height:ratioOf(size)[1]}}:{})}))},null,2)+'\n';
      const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='retouch-screens.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    };
    const loadSet=document.createElement('button');loadSet.type='button';loadSet.className='control-button';loadSet.textContent='Load screen set';loadSet.title='Replace these comparison views with a saved screen set. You can undo the load.';
    const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.setAttribute('aria-label','Screen set file');loadSet.onclick=()=>file.click();
    file.onchange=async()=>{
      const selectedFile=file.files[0],revision=++loadRevision;file.value='';if(!selectedFile||loadingSet)return;
      try{
        if(selectedFile.size>65536)throw Error('Screen-set files must be 64 KB or smaller.');
        const next=parseSet(await selectedFile.text());if(revision!==loadRevision||!open)return;
        const undo={sizes:sizes.map(snapshotSize),removed:removed.map(entry=>({size:snapshotSize(entry.size),index:entry.index}))};
        await replaceSet(next,[],undo,'Loaded '+next.length+' comparison views.');
      }catch(error){if(revision===loadRevision){setMessage=error.message;setStatus.textContent=setMessage;}}
    };
    const undoLoad=document.createElement('button');undoLoad.type='button';undoLoad.className='control-button';undoLoad.textContent='Undo load screen set';undoLoad.hidden=!previousSet;
    undoLoad.onclick=()=>{if(previousSet&&!loadingSet)replaceSet(previousSet.sizes,previousSet.removed,null,'Restored previous screen set.');};
    setStatus=document.createElement('p');setStatus.className='hint';setStatus.setAttribute('role','status');setStatus.setAttribute('aria-label','Screen set status');setStatus.textContent=setMessage;
    files.append(saveSet,loadSet,undoLoad,file);rail.append(files,setStatus);
    pin=document.createElement('button');pin.id='comparisonPin';pin.className='control-button comparison-pin';pin.type='button';pin.textContent='+';pin.setAttribute('aria-label','Pin current size');
    pin.onclick=()=>{if(!pin.disabled)window.RetouchComparisons.showSize(current());};toolbar.insertBefore(pin,focus);
    restore=document.createElement('button');restore.id='comparisonRestore';restore.className='control-button';restore.type='button';
    restore.onclick=()=>{
      updateControls();if(restore.disabled)return;
      const last=removed.pop(),index=Math.min(last.index,sizes.length),next=cards[index]?.card;
      sizes.splice(index,0,last.size);addCard(last.size,next);const item=cards.pop();cards.splice(index,0,item);
      item.frame.src=path()||'/';remember();updateControls();item.card.scrollIntoView({block:'nearest'});(item.previewBody.hidden?item.edit:item.viewport).focus({preventScroll:true});
    };rail.append(restore);
    emptyState=document.createElement('div');emptyState.className='compare-empty';
    const emptyTitle=document.createElement('h3');emptyTitle.textContent='No comparison screens';
    const emptyDescription=document.createElement('p');emptyDescription.textContent='Add the current canvas size to compare this page across screens.';
    emptyAdd=document.createElement('button');emptyAdd.type='button';emptyAdd.className='control-button';emptyAdd.textContent='Add current screen';emptyAdd.onclick=()=>pin.click();
    emptyState.append(emptyTitle,emptyDescription,emptyAdd);rail.append(emptyState);
    const orderHistory=document.createElement('div');orderHistory.className='compare-header compare-order-history';
    undoOrder=document.createElement('button');redoOrder=document.createElement('button');
    for(const button of [undoOrder,redoOrder]){button.type='button';button.className='control-button';}
    undoOrder.textContent='Undo screen order';redoOrder.textContent='Redo screen order';
    function replay(from,to,reverse){if(removals||loadingSet||!from.length)return;const entry=from.at(-1);if(entry.move(reverse?-entry.delta:entry.delta,false)){from.pop();to.push(entry);updateControls();const button=reverse?undoOrder:redoOrder;(button.disabled?(reverse?redoOrder:undoOrder):button).focus();}}
    undoOrder.onclick=()=>replay(orderUndo,orderRedo,true);redoOrder.onclick=()=>replay(orderRedo,orderUndo,false);
    orderHistory.append(undoOrder,redoOrder);rail.append(orderHistory);
    for(const size of sizes)addCard(size);
    updateControls();
  }
  function addCard(size,before=null){
      clearOrderHistory();
      let name=size[0],width=size[1],height=size[2];
      const card=document.createElement('section');card.className='compare-card';card.setAttribute('aria-label',name+' comparison');
      const header=document.createElement('div');header.className='compare-header';
      const reorder=document.createElement('button');reorder.type='button';reorder.className='control-button compare-reorder';reorder.draggable=true;reorder.title='Drag to reorder. Arrow Up/Down moves one screen; Home/End moves to the start/end.';reorder.innerHTML='<svg viewBox="0 0 16 20" aria-hidden="true"><path d="M5 5h.01 M11 5h.01 M5 10h.01 M11 10h.01 M5 15h.01 M11 15h.01"/></svg>';header.append(reorder);
      const label=document.createElement('button');label.type='button';label.className='control-button';label.style.cssText='flex:1;text-align:left;min-width:0;overflow-wrap:anywhere';label.title='Rename this comparison';
      const nameInput=document.createElement('input');nameInput.type='text';nameInput.maxLength=80;nameInput.hidden=true;nameInput.style.cssText='min-width:0;width:100%;box-sizing:border-box';
      const names=nameHistories.get(size)||{undo:[],redo:[]};nameHistories.set(size,names);
      const nameHistory=document.createElement('div');nameHistory.className='compare-header';
      const undoName=document.createElement('button'),redoName=document.createElement('button');
      for(const button of [undoName,redoName]){button.type='button';button.className='control-button';}
      undoName.textContent='Undo name';redoName.textContent='Redo name';nameHistory.append(undoName,redoName);
      function updateNameHistory(){undoName.disabled=!names.undo.length;redoName.disabled=!names.redo.length;nameHistory.hidden=!names.undo.length&&!names.redo.length;undoName.setAttribute('aria-label','Undo '+name+' comparison name');redoName.setAttribute('aria-label','Redo '+name+' comparison name');}
      function replayName(redo){
        const from=redo?names.redo:names.undo,to=redo?names.undo:names.redo,entry=from.at(-1);if(!entry)return;
        const next=redo?entry.after:entry.before;
        if(sizes.some(other=>other!==size&&other[0].toLowerCase()===next.toLowerCase())){dimensionError.textContent='Another comparison already has this name.';dimensionError.hidden=false;return;}
        name=next;size[0]=name;nameInput.value=name;from.pop();to.push(entry);dimensionError.hidden=true;remember();updateLabels();updateControls();label.focus();
      }
      undoName.onclick=()=>replayName(false);redoName.onclick=()=>replayName(true);
      for(const target of [label,nameInput,nameHistory])target.addEventListener('keydown',event=>{
        if(event.defaultPrevented||event.isComposing||event.altKey||!(event.metaKey||event.ctrlKey))return;
        const key=event.key.toLowerCase();if(key!=='z'&&key!=='y'||event.target===nameInput&&nameInput.value!==name)return;
        event.preventDefault();event.stopPropagation();replayName(key==='y'||event.shiftKey);
      });
      label.title='Rename this comparison. Command/Ctrl+Z undoes its name; Command/Ctrl+Shift+Z redoes it.';
      label.onclick=()=>{if(activeName&&activeName.input!==nameInput){activeName.finish();if(activeName){activeName.input.focus();return;}}activeName={input:nameInput,finish:finishName};nameInput.value=name;nameInput.hidden=false;label.hidden=true;nameInput.focus();nameInput.select();};
      function finishName(cancel=false){
        if(nameInput.hidden)return;
        const next=nameInput.value.trim().replace(/\s+/g,' ');
        if(!cancel&&(!next||sizes.some(other=>other!==size&&other[0].toLowerCase()===next.toLowerCase()))){nameInput.setAttribute('aria-invalid','true');dimensionError.textContent=next?'Another comparison already has this name.':'Enter a comparison name.';dimensionError.hidden=false;return;}
        if(!cancel&&next!==name){names.undo.push({before:name,after:next});if(names.undo.length>50)names.undo.shift();names.redo.length=0;name=next;size[0]=name;remember();}
        nameInput.removeAttribute('aria-invalid');dimensionError.hidden=true;nameInput.hidden=true;label.hidden=false;if(activeName?.input===nameInput)activeName=null;updateLabels();updateControls();
      }
      // A window/iframe focus loss may have no related target. Preserve the
      // draft until an explicit commit or deliberate focus change in this UI.
      nameInput.onblur=event=>{if(event.relatedTarget&&event.relatedTarget.tagName!=='IFRAME')finishName();};
      nameInput.onkeydown=event=>{if(event.isComposing)return;if(event.key==='Enter'||event.key==='Escape'){event.preventDefault();event.stopPropagation();finishName(event.key==='Escape');if(nameInput.hidden)label.focus();}};
      header.append(label,nameInput);
      const edit=document.createElement('button');edit.className='control-button';edit.textContent='Edit';edit.setAttribute('aria-label','Edit '+name.toLowerCase()+' size');
      edit.onclick=()=>window.RetouchScreens.set({width,height});header.append(edit);
      const remove=document.createElement('button');remove.className='control-button';remove.textContent='×';remove.setAttribute('aria-label','Remove '+name+' comparison');header.append(remove);
      remove.onclick=async()=>{
        const restoreFocus=card.contains(document.activeElement);
        activeDimensionScrub?.cancel();if(activeName?.input===nameInput)activeName=null;
        remove.disabled=true;const index=sizes.indexOf(size);if(index<0)return;
        card.inert=true;clearOrderHistory();removals++;removed.push({size,index});
        if(removed.length>8)removed.shift();sizes.splice(index,1);remember();
        const item=cards.find(c=>c.frame===frame);item?.cancelColdText?.();
        cards=cards.filter(c=>c!==item);updateControls();
        await unload(frame);surface.remove();card.remove();removals--;updateControls();
        // Do not take focus back if the user moved elsewhere during unload.
        if(restoreFocus&&document.activeElement===document.body){
          const next=cards[Math.min(index,cards.length-1)];
          const target=next?(next.previewBody.hidden?next.edit:next.viewport):pin.disabled?focus:pin;
          target.focus({preventScroll:true});target.scrollIntoView({block:'nearest',inline:'nearest'});
        }
      };
      const viewport=document.createElement('div');viewport.className='compare-viewport';viewport.tabIndex=0;viewport.setAttribute('role','button');viewport.setAttribute('aria-label','Edit from '+name+' comparison');viewport.title='Click a layer to select it on the main canvas at this size. Style scope stays unchanged.';viewport.setAttribute('aria-describedby','comparisonNavigationHint');viewport.setAttribute('aria-keyshortcuts','ArrowUp ArrowDown ArrowLeft ArrowRight PageUp PageDown Home End Enter Space Shift+F10');
      const frame=document.createElement('iframe');frame.title=name+' comparison preview';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.style.width=width+'px';frame.style.height=height+'px';
      const surface=document.createElement('div');surface.className='compare-surface';surface.setAttribute('aria-hidden','true');surface.append(frame);rail.append(surface);
      const overlay=document.createElement('div');overlay.className='compare-overlay';
      const message=document.createElement('p');message.className='hint';const retryImageControl=document.createElement('button');retryImageControl.type='button';retryImageControl.className='control-button';retryImageControl.textContent='Retry image';retryImageControl.hidden=true;retryImageControl.onclick=()=>{const item=cards.find(item=>item.frame===frame);void item?.retryImage?.();};header.append(retryImageControl);
      const marquee=document.createElement('div');marquee.className='selection-marquee';marquee.hidden=true;viewport.append(marquee);let stopMarquee=null,marqueeDocument=null,marqueeRequest=0;
      function attachMarquee(){
        try{
          const d=frame.contentDocument;if(d===marqueeDocument&&stopMarquee)return;
          stopMarquee?.();stopMarquee=null;marqueeDocument=null;
          if(!d?.body||d.URL==='about:blank')return;
          const ready=()=>{try{const loc=frame.contentWindow.location;return open&&!card.inert&&!previewBody.hidden&&frame.contentDocument===d&&loc.origin===location.origin&&loc.pathname+loc.search+loc.hash===path()&&window.RetouchCanvasSelection?.canMarquee();}catch{return false;}};
          stopMarquee=window.RetouchMarquee.mount({document:d,frame,surface:viewport,
            enabled:ready,
            selectable:node=>window.RetouchCanvasSelection.selectable(node),
            outerBackground:(event,point)=>{const node=d.elementFromPoint(point.x,point.y);return window.RetouchMarquee.background(node)||node&&!window.RetouchCanvasSelection.selectable(node);},
            onChange:rect=>{marquee.hidden=!rect;if(rect){const scale=viewport.clientWidth/width;for(const key of ['left','top','width','height'])marquee.style[key]=rect[key]*scale+'px';}},
            onSelect:async(nodes,options)=>{
              const request=++marqueeRequest;if(!ready())return;
              try{
              const picked=await window.RetouchCanvasSelection.marqueeTargets(d,nodes,options.rect);
              if(!picked||request!==marqueeRequest||!ready())return;nodes=picked.nodes;
              if(nodes.length>100){message.textContent='Select up to 100 layers. Draw a smaller selection.';return;}
              const all=[...d.querySelectorAll('[data-rt],[data-rt-i]')],selection=nodes.map(node=>{const hostId=node.getAttribute('data-rt'),instanceId=node.getAttribute('data-rt-i');return {hostId,instanceId,occurrence:all.filter(el=>el.getAttribute('data-rt')===hostId&&el.getAttribute('data-rt-i')===instanceId).indexOf(node)};});
              window.dispatchEvent(new CustomEvent('retouch:comparison-edit',{detail:{width,height,selection,component:picked.component,append:options.append,occurrence:0,route:path()}}));
              }catch(error){if(request===marqueeRequest&&ready())message.textContent=error.message||'Could not select components in this preview.';}
            }
          });marqueeDocument=d;
        }catch{}
      }
      frame.addEventListener('load',attachMarquee);marqueeCleanup.set(frame,()=>{stopMarquee?.();frame.removeEventListener('load',attachMarquee);});

      const scopeMessage=document.createElement('p');scopeMessage.className='compare-scope-message';scopeMessage.setAttribute('aria-label',name+' scope coverage');
      const reveal=document.createElement('button');reveal.type='button';reveal.className='control-button';reveal.textContent='Show selection';reveal.setAttribute('aria-label','Show selection in '+name+' comparison');reveal.disabled=true;
      let revealSelection=null,revealIndex=-1;
      reveal.onclick=()=>{
        try{
          const d=frame.contentDocument,loc=frame.contentWindow.location;
          if(!selected||!d?.body||loc.origin!==location.origin||loc.pathname+loc.search+loc.hash!==path())return;
          const nodes=selectedGroups(d).map(group=>group.elements.find(rendered)).filter(Boolean);if(!nodes.length)return;
          if(revealSelection!==selected){revealSelection=selected;revealIndex=-1;}
          revealIndex=(revealIndex+1)%nodes.length;
          // Native scrolling reveals the layer through nested scroll containers.
          const node=nodes[revealIndex],target=d.defaultView.getComputedStyle(node).display==='contents'?[...node.querySelectorAll('*')].find(el=>rendered(el)&&d.defaultView.getComputedStyle(el).display!=='contents'):node;
          target?.scrollIntoView({block:'center',inline:'center',behavior:'instant'});
        }catch{message.textContent='Could not reveal the selected layer in this preview.';}
      };
      const scopeButton=document.createElement('button');scopeButton.className='control-button';scopeButton.textContent='Edit styles: '+width+' px and larger';scopeButton.setAttribute('aria-label','Edit styles from '+width+' px');scopeButton.title='Use this preview size and set the selected layer’s style scope to this width and larger. Does not change source until you edit a style.';scopeButton.disabled=!selected;
      scopeButton.onclick=()=>{if(!selected)return;window.dispatchEvent(new CustomEvent('retouch:comparison-edit',{detail:{width,height,occurrence:0,scopeAtWidth:true,route:path()}}));};
      const dimensions=document.createElement('div');dimensions.className='compare-dimensions';
      const inputs={},dimensionError=document.createElement('p');dimensionError.className='compare-dimension-error';dimensionError.setAttribute('role','status');dimensionError.id='comparison-name-error-'+(++previewSerial);nameInput.setAttribute('aria-describedby',dimensionError.id);dimensionError.hidden=true;
      let history=sizeHistories.get(size);if(!history){history={undo:[],redo:[],ratio:[width,height]};sizeHistories.set(size,history);}
      const sizeUndo=history.undo,sizeRedo=history.redo,sizeHistory=document.createElement('div');sizeHistory.className='compare-header';
      const undoSize=document.createElement('button'),redoSize=document.createElement('button');
      for(const button of [undoSize,redoSize]){button.type='button';button.className='control-button';button.disabled=true;}
      undoSize.textContent='Undo size';redoSize.textContent='Redo size';sizeHistory.append(undoSize,redoSize);
      const updateSizeHistory=()=>{undoSize.disabled=!sizeUndo.length;redoSize.disabled=!sizeRedo.length;sizeHistory.hidden=!sizeUndo.length&&!sizeRedo.length;};
      let dimensionScrub=null;
      const applyDimensions=(nextWidth,nextHeight,record=true,axis,preview=false)=>{
        if(dimensionScrub&&!preview)finishDimensionScrub(true);
        if(axis&&lockedRatios.has(size)){const next=window.RetouchScreens.constrain({width:nextWidth,height:nextHeight},axis,{width:history.ratio[0],height:history.ratio[1]},true);nextWidth=next.width;nextHeight=next.height;}
        if(!valid(nextWidth)||!valid(nextHeight))return;
        if(sizes.some(other=>other!==size&&other[1]===nextWidth&&other[2]===nextHeight)){
          dimensionError.textContent='This size is already pinned.';dimensionError.hidden=false;inputs.width.value=width;inputs.height.value=height;return;
        }
        dimensionError.hidden=true;dimensionError.textContent='';
        if(nextWidth===width&&nextHeight===height)return true;
        const ratioBefore=[...history.ratio],ratioAfter=axis&&lockedRatios.has(size)?ratioBefore:[nextWidth,nextHeight];
        if(record){sizeUndo.push({before:[width,height],after:[nextWidth,nextHeight],ratioBefore,ratioAfter});if(sizeUndo.length>50)sizeUndo.shift();sizeRedo.length=0;}history.ratio=[...ratioAfter];
        const automatic=name===`Custom ${width} × ${height}`;
        width=nextWidth;height=nextHeight;size[1]=width;size[2]=height;
        if(automatic){name=`Custom ${width} × ${height}`;size[0]=name;}
        updateLabels();
        const item=cards.find(c=>c.frame===frame);if(item)Object.assign(item,{width,height});
        frame.style.width=width+'px';frame.style.height=height+'px';
        inputs.width.value=width;inputs.height.value=height;
        scopeButton.textContent='Edit styles: '+width+' px and larger';scopeButton.setAttribute('aria-label','Edit styles from '+width+' px');
        if(!preview)remember();updateControls();updateSizeHistory();return true;
      };
      const replaySize=(from,to,undo,moveFocus=true)=>{const entry=from.at(-1);if(!entry)return;const target=undo?entry.before:entry.after;if(applyDimensions(...target,false)){history.ratio=[...(undo?entry.ratioBefore:entry.ratioAfter)];from.pop();to.push(entry);updateSizeHistory();const button=undo?undoSize:redoSize;if(moveFocus)(button.disabled?(undo?redoSize:undoSize):button).focus();}};
      undoSize.onclick=()=>replaySize(sizeUndo,sizeRedo,true);redoSize.onclick=()=>replaySize(sizeRedo,sizeUndo,false);
      for(const target of [dimensions,sizeHistory])target.addEventListener('keydown',event=>{
        if(event.defaultPrevented||event.isComposing||event.altKey||!(event.metaKey||event.ctrlKey))return;
        const key=event.key.toLowerCase(),redo=key==='y'||key==='z'&&event.shiftKey;if(key!=='z'&&key!=='y')return;
        const input=event.target===inputs.width?inputs.width:event.target===inputs.height?inputs.height:null;
        // An uncommitted number draft keeps the browser's native text history.
        if(input&&input.value!==String(input===inputs.width?width:height))return;
        event.preventDefault();event.stopPropagation();replaySize(redo?sizeRedo:sizeUndo,redo?sizeUndo:sizeRedo,!redo,!input);
      });
      undoSize.title='Undo this screen size: Command/Ctrl+Z in the size controls.';redoSize.title='Redo this screen size: Command/Ctrl+Shift+Z or Ctrl+Y in the size controls.';
      let dimensionGesture=null;
      for(const axis of ['width','height']){
        const field=document.createElement('label');field.textContent=axis==='width'?'W':'H';
        const input=document.createElement('input');input.type='number';input.min=240;input.max=7680;input.step=1;input.value=axis==='width'?width:height;input.setAttribute('aria-label',name+' comparison '+axis);inputs[axis]=input;
        input.onchange=()=>{if(input.value!==''&&input.checkValidity())applyDimensions(axis==='width'?Number(input.value):width,axis==='height'?Number(input.value):height,true,axis);};
        input.title='Pixels. Shift+Up/Down steps 10 pixels; Enter applies; Escape discards typed changes; Command/Ctrl+Z undoes a committed size.';
        input.onkeyup=event=>{if(['ArrowUp','ArrowDown'].includes(event.key))dimensionGesture=null;};
        input.onblur=()=>{dimensionGesture=null;};
        input.onkeydown=event=>{
          if(event.isComposing)return;
          if(event.key==='Escape'){input.value=axis==='width'?width:height;event.preventDefault();event.stopPropagation();input.select();}
          else if(event.key==='Enter'){event.preventDefault();input.blur();}
          else if(!event.altKey&&!event.metaKey&&!event.ctrlKey&&['ArrowUp','ArrowDown'].includes(event.key)){
            event.preventDefault();const value=Number(input.value);
            if(input.value!==''&&Number.isFinite(value)){
              const repeat=event.repeat&&dimensionGesture?.input===input&&dimensionGesture.key===event.key&&dimensionGesture.entry===sizeUndo.at(-1),previous=sizeUndo.at(-1);
              const next=Math.max(240,Math.min(7680,Math.round(value)+(event.key==='ArrowUp'?1:-1)*(event.shiftKey?10:1)));
              const applied=applyDimensions(axis==='width'?next:width,axis==='height'?next:height,!repeat,axis);
              if(repeat&&applied){dimensionGesture.entry.after=[width,height];dimensionGesture.entry.ratioAfter=[...history.ratio];}
              else if(!repeat)dimensionGesture=sizeUndo.at(-1)!==previous?{input,key:event.key,entry:sizeUndo.at(-1)}:null;
            }
          }
        };
        field.dataset.comparisonScrub=axis;field.style.cursor='ew-resize';field.style.touchAction='none';field.style.userSelect='none';field.title='Drag to resize. Shift: 10 pixels; Option/Alt: 0.1 pixels. Escape cancels.';
        field.addEventListener('pointerdown',event=>{
          if(event.button!==0||event.target===input||dimensionScrub||loadingSet||removals)return;
          event.preventDefault();activeDimensionScrub?.cancel();input.focus({preventScroll:true});dimensionGesture=null;
          dimensionScrub={id:event.pointerId,field,axis,lastX:event.clientX,value:axis==='width'?width:height,before:[width,height],ratio:[...history.ratio]};activeDimensionScrub={field,cancel:()=>finishDimensionScrub(true)};input.value=String(dimensionScrub.value);field.setPointerCapture(event.pointerId);
        });
        field.addEventListener('pointermove',event=>{
          if(!dimensionScrub||dimensionScrub.id!==event.pointerId)return;event.preventDefault();const saved=dimensionScrub,delta=event.clientX-saved.lastX;saved.lastX=event.clientX;if(!delta)return;
          saved.value=Math.max(240,Math.min(7680,saved.value+delta*(event.altKey?0.1:event.shiftKey?10:1)));const next=Math.round(saved.value);
          applyDimensions(axis==='width'?next:width,axis==='height'?next:height,false,axis,true);
        });
        field.addEventListener('pointerup',event=>{if(dimensionScrub?.id===event.pointerId){event.preventDefault();finishDimensionScrub(false);}});
        for(const type of ['pointercancel','lostpointercapture'])field.addEventListener(type,event=>{if(dimensionScrub?.id===event.pointerId)finishDimensionScrub(true);});
        field.append(input);dimensions.append(field);
      }
      function finishDimensionScrub(cancelled){
        if(!dimensionScrub)return;const saved=dimensionScrub;dimensionScrub=null;activeDimensionScrub=null;
        if(cancelled){applyDimensions(...saved.before,false,undefined,true);history.ratio=[...saved.ratio];dimensionError.hidden=true;dimensionError.textContent='';}
        else if(width!==saved.before[0]||height!==saved.before[1]){sizeUndo.push({before:saved.before,after:[width,height],ratioBefore:saved.ratio,ratioAfter:[...history.ratio]});if(sizeUndo.length>50)sizeUndo.shift();sizeRedo.length=0;}
        remember();updateSizeHistory();if(saved.field.hasPointerCapture(saved.id))saved.field.releasePointerCapture(saved.id);
      }
      const order=document.createElement('div');order.className='compare-header';
      const up=document.createElement('button'),down=document.createElement('button');
      up.type=down.type='button';up.className=down.className='control-button';up.textContent='Move up';down.textContent='Move down';order.append(up,down);
      function move(delta,record=true){
        const index=sizes.indexOf(size),next=index+delta;if(index<0||next<0||next>=sizes.length||loadingSet||removals)return;
        const item=cards[index],anchor=delta<0?cards[next].card:cards[next].card.nextSibling;
        // Only move the controls and hit target. The iframe stays mounted in
        // its stable surface, without detaching its browsing context.
        rail.insertBefore(card,anchor);
        sizes.splice(index,1);sizes.splice(next,0,size);cards.splice(index,1);cards.splice(next,0,item);if(record){orderUndo.push({move,delta});if(orderUndo.length>50)orderUndo.shift();orderRedo.length=0;}remember();updateControls();
        const control=delta<0?up:down;if(control.disabled)(delta<0?down:up).focus();else control.focus();return true;
      }
      up.onclick=()=>move(-1);down.onclick=()=>move(1);
      reorder.onkeydown=event=>{
        if(!event.isComposing&&!event.altKey&&(event.metaKey||event.ctrlKey)&&['z','y'].includes(event.key.toLowerCase())){event.preventDefault();event.stopPropagation();const redo=event.key.toLowerCase()==='y'||event.shiftKey;(redo?redoOrder:undoOrder)?.click();reorder.focus({preventScroll:true});card.scrollIntoView({block:'nearest'});return;}
        if(event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
        event.preventDefault();event.stopPropagation();if(activeName||activeDimensionScrub)return;
        const index=sizes.indexOf(size),delta=event.key==='Home'?-index:event.key==='End'?sizes.length-1-index:event.key==='ArrowUp'?-1:1;
        if(delta&&move(delta)){reorder.focus({preventScroll:true});card.scrollIntoView({block:'nearest'});}
      };
      reorder.ondragstart=event=>{
        if(loadingSet||removals||activeName||activeDimensionScrub){event.preventDefault();return;}
        draggedScreen={size,card,move,reorder};event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-retouch-screen','reorder');
      };
      reorder.ondragend=clearScreenDrag;
      header.ondragover=event=>{
        if(!draggedScreen||draggedScreen.card===card||loadingSet||removals)return;
        event.preventDefault();event.dataTransfer.dropEffect='move';rail.querySelectorAll('[data-screen-drop]').forEach(item=>delete item.dataset.screenDrop);
        const rect=header.getBoundingClientRect();card.dataset.screenDrop=event.clientY<rect.y+rect.height/2?'before':'after';
      };
      header.ondragleave=event=>{if(!header.contains(event.relatedTarget))delete card.dataset.screenDrop;};
      header.ondrop=event=>{
        const source=draggedScreen,edge=card.dataset.screenDrop;clearScreenDrag();if(!source||!edge||loadingSet||removals)return;
        event.preventDefault();event.stopPropagation();const from=sizes.indexOf(source.size),to=sizes.indexOf(size);if(from<0||to<0||from===to)return;
        const destination=to+(edge==='after'?1:0)-(from<to?1:0),delta=destination-from;
        if(delta&&source.move(delta)){source.reorder.focus({preventScroll:true});source.card.scrollIntoView({block:'nearest'});}
      };

      const aspect=document.createElement('button');aspect.type='button';aspect.className='control-button';aspect.title='Keep width and height proportional. Rotate establishes a new ratio.';
      const updateAspect=()=>{aspect.setAttribute('aria-label','Lock '+name+' comparison aspect ratio');aspect.setAttribute('aria-pressed',String(lockedRatios.has(size)));aspect.textContent=lockedRatios.has(size)?'Ratio locked':'Lock ratio';};
      aspect.onclick=()=>{if(lockedRatios.has(size))lockedRatios.delete(size);else lockedRatios.add(size);history.ratio=[width,height];updateAspect();remember();};updateAspect();dimensions.append(aspect);
      const rotate=document.createElement('button');rotate.type='button';rotate.className='control-button';rotate.textContent='Rotate';rotate.setAttribute('aria-label','Rotate '+name+' comparison');rotate.onclick=()=>applyDimensions(height,width);dimensions.append(rotate);
      const previewBody=document.createElement('div');previewBody.className='compare-preview-body';previewBody.id='comparison-preview-'+(++previewSerial);previewBody.hidden=collapsedScreens.has(size);surface.hidden=previewBody.hidden;
      const disclosure=document.createElement('button');disclosure.type='button';disclosure.className='control-button';disclosure.setAttribute('aria-controls',previewBody.id);
      function updateDisclosure(){disclosure.textContent=previewBody.hidden?'Show preview':'Hide preview';disclosure.setAttribute('aria-label',(previewBody.hidden?'Show ':'Hide ')+name+' preview');disclosure.setAttribute('aria-expanded',String(!previewBody.hidden));}
      function setCollapsed(hidden){previewBody.hidden=hidden;if(hidden)collapsedScreens.add(size);else collapsedScreens.delete(size);updateDisclosure();}
      disclosure.onclick=()=>{setCollapsed(!previewBody.hidden);remember();updateControls();};
      function updateLabels(){
        updateNameHistory();
        updateAspect();
        updateDisclosure();
        label.textContent=name===`Custom ${width} × ${height}`?name:`${name} · ${width} × ${height}`;
        reorder.setAttribute('aria-label','Reorder '+name+' comparison');label.setAttribute('aria-label','Rename '+name+' comparison');nameInput.setAttribute('aria-label','Comparison name');
        card.setAttribute('aria-label',name+' comparison');edit.setAttribute('aria-label','Edit '+name.toLowerCase()+' size');remove.setAttribute('aria-label','Remove '+name+' comparison');viewport.setAttribute('aria-label','Edit from '+name+' comparison');frame.title=name+' comparison preview';scopeMessage.setAttribute('aria-label',name+' scope coverage');
        for(const axis of ['width','height'])inputs[axis].setAttribute('aria-label',name+' comparison '+axis);
        up.setAttribute('aria-label','Move '+name+' comparison up');down.setAttribute('aria-label','Move '+name+' comparison down');
        undoSize.setAttribute('aria-label','Undo '+name+' comparison size');redoSize.setAttribute('aria-label','Redo '+name+' comparison size');
        rotate.setAttribute('aria-label','Rotate '+name+' comparison');reveal.setAttribute('aria-label','Show selection in '+name+' comparison');
      }
      for(const [control,action]of [[label,'rename'],[edit,'edit'],[reveal,'reveal'],[disclosure,'visibility']]){control.dataset.comparisonAction=action;control.dataset.comparisonCommand=previewBody.id+'-'+action;}
      updateLabels();updateSizeHistory();
      viewport.append(overlay);previewBody.append(viewport,message,reveal,scopeMessage,scopeButton);card.append(header,nameHistory,dimensions,dimensionError,sizeHistory,order,disclosure,previewBody);rail.insertBefore(card,before);
      function activate(event,context=false,textEdit=false){
        try{
          const d=frame.contentDocument,loc=frame.contentWindow.location;
          if(!d?.body||loc.origin!==location.origin||loc.pathname+loc.search+loc.hash!==path()){message.textContent='Wait for this comparison to finish loading.';return;}
          const bounds=viewport.getBoundingClientRect(),scale=viewport.clientWidth/width;
          const x=event?(event.clientX-bounds.left)/scale:0,y=event?(event.clientY-bounds.top)/scale:0;
          if(textEdit&&!event&&selectedIds.length!==1){message.textContent='Select one text layer before pressing F2.';return;}
          const node=event?window.RetouchCanvasSelection?.pick(d.elementFromPoint(x,y),x,y,{enter:textEdit}):context||textEdit?selectedGroups(d).find(group=>rendered(group.element))?.element:null;
          if((event||context||textEdit)&&!node){message.textContent='No unlocked editable layer here. Select locked layers in Layers.';return;}
          const hostId=node?.getAttribute('data-rt'),instanceId=node?.getAttribute('data-rt-i');
          const peers=node?[...d.querySelectorAll('[data-rt],[data-rt-i]')].filter(el=>el.getAttribute('data-rt')===hostId&&el.getAttribute('data-rt-i')===instanceId):[];
          const box=node?.getBoundingClientRect(),textPoint=textEdit&&event&&box?.width&&box?.height?{x:Math.max(0,Math.min(1,(x-box.left)/box.width)),y:Math.max(0,Math.min(1,(y-box.top)/box.height))}:undefined;
          window.dispatchEvent(new CustomEvent('retouch:comparison-edit',{detail:{width,height,hostId,instanceId,occurrence:node?peers.indexOf(node):0,toggle:!context&&!textEdit&&!!event?.shiftKey,route:path(),...(textEdit?{textEdit:true,textPoint}:{}),...(context?{contextMenu:{x:event?.clientX??bounds.left,y:event?.clientY??bounds.top}}:{})}}));
        }catch{message.textContent='Preview unavailable for this page';}
      }
      viewport.addEventListener('click',event=>{if(event.button===0)activate(event);});
      viewport.addEventListener('dblclick',event=>{if(event.button!==0||event.shiftKey||event.altKey||event.ctrlKey||event.metaKey)return;event.preventDefault();event.stopPropagation();activate(event,false,true);});
      viewport.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();viewport.focus({preventScroll:true});activate(event,true);});
      viewport.addEventListener('keydown',event=>{
        if(!event.defaultPrevented&&!event.isComposing&&(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey)){event.preventDefault();event.stopPropagation();activate(undefined,true);return;}
        if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
        if(event.key==='F2'){event.preventDefault();event.stopPropagation();activate(undefined,false,true);return;}
        if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();activate();return;}
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Home','End'].includes(event.key))return;
        event.preventDefault();event.stopPropagation();
        try{
          const d=frame.contentDocument,w=frame.contentWindow,loc=w.location,root=d?.scrollingElement;
          if(!root||loc.origin!==location.origin||loc.pathname+loc.search+loc.hash!==path())return;
          const node=d.elementFromPoint(width/2,height/2)||d.body;
          let target=node;
          while(target&&target!==root){
            const style=w.getComputedStyle(target);
            if(/auto|scroll/.test(style.overflowY)&&(target.scrollHeight>target.clientHeight||/contain|none/.test(style.overscrollBehaviorY)))break;
            target=scrollParent(target);
          }
          const nested=target&&target!==root,page=Math.floor((nested?target.clientHeight:height)*.9),top=nested?target.scrollTop:w.scrollY;
          const dx=event.key==='ArrowLeft'?-40:event.key==='ArrowRight'?40:0;
          const dy=({ArrowUp:-40,ArrowDown:40,PageUp:-page,PageDown:page,Home:-top,End:nested?target.scrollHeight-target.clientHeight-top:root.scrollHeight-height-top})[event.key]||0;
          scrollFrom(w,node,dx,dy);
        }catch{}
      });
      viewport.addEventListener('wheel',e=>{
        if(e.ctrlKey)return;
        e.preventDefault();
        try{
          const d=frame.contentDocument,w=frame.contentWindow,bounds=viewport.getBoundingClientRect(),scale=viewport.clientWidth/width;
          if(!d?.body||!Number.isFinite(scale)||scale<=0)return;
          let node=d.elementFromPoint((e.clientX-bounds.left)/scale,(e.clientY-bounds.top)/scale)||d.body;
          const css=w.getComputedStyle(node),line=parseFloat(css.lineHeight)||16;
          let dx=e.deltaX*(e.deltaMode===1?line:e.deltaMode===2?width:1/scale),dy=e.deltaY*(e.deltaMode===1?line:e.deltaMode===2?height:1/scale);
          scrollFrom(w,node,dx,dy);
        }catch{}
      },{passive:false});
      cards.push({card,frame,surface,retryImageControl,previewBody,setCollapsed,attachMarquee,overlay,message,scopeMessage,scopeButton,viewport,width,height,edit,reveal,up,down,move});
  }
  function unload(frame){cards.find(card=>card.frame===frame)?.cancelColdText?.();marqueeCleanup.get(frame)?.();marqueeCleanup.delete(frame);return new Promise(resolve=>{
    let timeout;
    const done=()=>{clearTimeout(timeout);frame.removeEventListener('load',done);frame.remove();resolve();};
    frame.addEventListener('load',done);timeout=setTimeout(done,1000);
    try{frame.contentWindow.stop();frame.src='about:blank';}catch{done();}
  });}
  async function dispose(){
    activeDimensionScrub?.cancel();clearOrderHistory();
    // Unload each browsing context before detaching it, including frames whose
    // framework bootstrap is still awaiting scripts or network responses.
    await Promise.all(cards.map(({frame})=>unload(frame)));
    activeName=null;rail.replaceChildren();cards=[];route=null;
  }
  toggle.onclick=async()=>{
    loadRevision++;
    clearTimeout(timer);open=!open;toggle.setAttribute('aria-pressed',String(open));rail.hidden=!open;
    if(open){mount();sync(true);paint();}else{toggle.disabled=true;updateControls();try{await dispose();}finally{toggle.disabled=false;updateControls();}}
  };
  window.addEventListener('retouch:selection',e=>{selected=e.detail;selectedIds=selected?[selected]:[];selectionDetails.clear();updateControls();});
  window.addEventListener('retouch:selection-set',e=>{selectedIds=e.detail;});
  window.addEventListener('retouch:selection-details',e=>{selectionDetails=new Map(e.detail.map(info=>[info.id,info]));});
  window.addEventListener('retouch:style-scope',e=>{scope=e.detail;if(scopeSummary)scopeSummary.textContent='Style scope: '+scope.label;});
  window.addEventListener('retouch:route',()=>sync());
  let mainLoadRevision=0;
  main.addEventListener('load',async()=>{
    const revision=++mainLoadRevision,next=path();
    if(!open)return;
    if(next!==route||window.__RT_RENDERING?.reloadAfterWrite||!selectedIds.length)return sync(true);
    const expected=selectedIds.map(id=>{
      const instance=selectionDetails.get(id)?.kind==='instance',attribute=instance?'data-rt-i':'data-rt',revisionAttribute=attribute+'-revision',selector='['+attribute+'="'+id+'"]';
      return {selector,revisionAttribute,hash:main.contentDocument?.querySelector(selector)?.getAttribute(revisionAttribute)};
    });
    if(expected.some(item=>!item.hash))return sync(true);
    // Let host or component HMR finish before replacing comparison documents. Reloading
    // while their hot-update fetch is in flight can abort WebKit's update.
    for(let attempt=0,stable=0;attempt<40;attempt++){
      if(revision!==mainLoadRevision||!open||path()!==next)return;
      const ready=window.RetouchClientMount.ready(main.contentDocument)&&cards.every(card=>window.RetouchClientMount.ready(card.frame.contentDocument)&&expected.every(({selector,revisionAttribute,hash})=>[...card.frame.contentDocument?.querySelectorAll(selector)||[]].some(el=>el.getAttribute(revisionAttribute)===hash)));
      stable=ready?stable+1:0;if(stable>=3)return;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    if(revision===mainLoadRevision&&open&&path()===next)sync(true);
  });
  window.addEventListener('retouch:viewport',updateControls);
  window.addEventListener('retouch:screen',updateControls);
  new ResizeObserver(()=>{if(open)layoutPreviews();}).observe(rail);
  const developmentRuntimes=new WeakMap();
  async function refreshClientClasses(frame){
    const win=frame.contentWindow,d=frame.contentDocument;
    // Next's server-component refresh does not replace stale client modules.
    // Use its webpack HMR runtime only for the development version we verify.
    if(!/^16\.2\./.test(win.next?.version||'')||!Array.isArray(win.webpackChunk_N_E))return;
    let runtime=developmentRuntimes.get(d);
    if(!runtime){win.webpackChunk_N_E.push([['__retouch_source_refresh__'],{},require=>{runtime=require;}]);if(runtime)developmentRuntimes.set(d,runtime);}
    const hot=Object.values(runtime?.c||{}).find(module=>module.hot)?.hot;
    if(hot?.status()==='idle')await hot.check(true);
  }
  window.RetouchComparisons={
    outlineViews:()=>open?cards.filter(card=>!card.previewBody.hidden&&!card.card.inert).map(card=>({frame:card.frame,canvas:card.viewport,clip:rail})):[],
    async syncClasses(entries){
      if(!open)return;const expectedRoute=path(),failures=[];
      await Promise.all([...cards].map(async card=>{
        card.styleSyncError=null;try{
          for(let attempt=0;attempt<80;attempt++){if(!open||!cards.includes(card)||path()!==expectedRoute)return;const d=card.frame.contentDocument;if(d?.body&&d.URL!=='about:blank')break;await new Promise(resolve=>setTimeout(resolve,50));}
          const d=card.frame.contentDocument;if(!d?.body||d.URL==='about:blank')throw Error('Preview is still loading.');const url=new URL(d.URL);if(url.pathname+url.search+url.hash!==expectedRoute)return;
          const ids=new Set([...d.querySelectorAll('[data-rt]')].map(el=>el.getAttribute('data-rt'))),present=entries.filter(item=>ids.has(item.id));if(present.length)await RetouchRenderSync.syncClasses({frame:card.frame,entries:present,revalidate:!!window.__RT_RENDERING?.revalidateStyles});
        }catch(error){if(open&&cards.includes(card)){card.styleSyncError='Classes saved; comparison refresh failed: '+error.message;failures.push(card.frame.title||'Comparison');}}
      }));
      if(failures.length)throw Error('Could not refresh '+failures.join(', ')+'.');
    },
    async syncCSS(info){
      const infos=Array.isArray(info)?info:[info];if(!open||!infos.length||infos.some(item=>!item.cssAuthoring))return;
      const expectedRoute=path();
      await Promise.all([...cards].map(async card=>{
        card.styleSyncError=null;
        try{
          for(let attempt=0;attempt<80;attempt++){
            if(!open||!cards.includes(card)||path()!==expectedRoute)return;
            const d=card.frame.contentDocument;if(d?.body&&d.URL!=='about:blank')break;
            await new Promise(resolve=>setTimeout(resolve,50));
          }
          const d=card.frame.contentDocument;if(!d?.body||d.URL==='about:blank')throw Error('Preview is still loading.');
          const url=new URL(d.URL);if(url.pathname+url.search+url.hash!==expectedRoute)return;
          const ids=new Set([...d.querySelectorAll('[data-rt]')].map(el=>el.getAttribute('data-rt'))),entries=infos.filter(item=>ids.has(item.id)).map(item=>({id:item.id,rules:item.cssRules,texts:item.cssRuleTexts}));if(!entries.length)return;
          await RetouchRenderSync.syncCSS({frame:card.frame,entries});
        }catch(error){if(open&&cards.includes(card))card.styleSyncError='Styles saved; comparison refresh failed: '+error.message;}
      }));
    },
    syncImage(options){return this.syncRendered(options);},
    syncSource(options){return this.syncRendered({...options,kind:'Classes',serverRendered:false});},
    async syncRendered({select,matches,serverRendered=true,revisionAttribute,hash,onlyFrame,kind='Image',afterSync}){
      if(!open)return;const expectedRoute=path(),failures=[];
      await Promise.all(cards.filter(card=>!onlyFrame||card.frame===onlyFrame).map(async card=>{
        const token=Symbol();card.imageSyncToken=token;card.retryImage=null;card.imageSyncError=null;card.retryImageControl.disabled=true;if(!onlyFrame)card.retryImageControl.hidden=true;
        try{
          for(let attempt=0;attempt<80;attempt++){if(!open||!cards.includes(card)||path()!==expectedRoute)return;const d=card.frame.contentDocument;if(d?.body&&d.URL!=='about:blank')break;await new Promise(resolve=>setTimeout(resolve,50));}
          const d=card.frame.contentDocument;if(!d?.body||d.URL==='about:blank')throw Error('Preview is still loading.');const url=new URL(d.URL);if(url.pathname+url.search+url.hash!==expectedRoute)return;
          if(!select(d).length){card.retryImageControl.hidden=true;return;}
          const ready=el=>matches(el)&&(!revisionAttribute||el.getAttribute(revisionAttribute)===hash);
          if(!serverRendered){
            for(let attempt=0;attempt<80&&!window.RetouchClientMount.ready(d);attempt++){if(!open||!cards.includes(card)||card.frame.contentDocument!==d||path()!==expectedRoute)return;await new Promise(resolve=>setTimeout(resolve,50));}
            if(!window.RetouchClientMount.ready(d))throw Error('Preview is still mounting.');
            // A comparison can mount after the source-change broadcast. Request fresh
            // server components through the verified development router, retaining React state.
            if(['Classes','Scale'].includes(kind)&&!select(d).every(ready))await refreshClientClasses(card.frame);
            const next=card.frame.contentWindow.next;
            if(!select(d).every(ready)&&/^16\.2\./.test(next?.version||'')){if(kind==='Scale'&&typeof next.router?.refresh==='function')next.router.refresh();else if(typeof next.router?.hmrRefresh==='function')next.router.hmrRefresh();}
          }
          await RetouchRenderSync.sync({frame:card.frame,serverRendered,select,matches:ready,current:()=>card.imageSyncToken===token&&open&&cards.includes(card)&&path()===expectedRoute});
          if(kind==='Classes'&&card.imageSyncToken===token&&card.frame.contentDocument===d)await RetouchRenderSync.refreshStyles(d,hash||Date.now().toString(36));
          if(afterSync&&card.imageSyncToken===token&&card.frame.contentDocument===d)await afterSync(card.frame);
          if(card.imageSyncToken===token)card.retryImageControl.hidden=true;
        }catch(error){if(open&&cards.includes(card)&&card.imageSyncToken===token&&path()===expectedRoute){card.imageSyncError=kind+' saved; comparison refresh failed: '+error.message;failures.push(card.frame.title||'Comparison');card.retryImageControl.hidden=false;card.retryImageControl.textContent='Retry '+kind.toLowerCase();card.retryImageControl.setAttribute('aria-label','Retry '+kind.toLowerCase()+' in '+card.frame.title.replace(/ preview$/,''));card.retryImage=()=>{if(card.imageSyncToken!==token||path()!==expectedRoute||!open)return;return window.RetouchComparisons.syncRendered({select,matches,serverRendered,revisionAttribute,hash,onlyFrame:card.frame,kind,afterSync});};}}
        finally{if(card.imageSyncToken===token)card.retryImageControl.disabled=false;}
      }));
      if(open){clearTimeout(timer);paint();}
      return {ok:!failures.length,failures};
    },
    async syncText(info){
      if(!open||info.kind!=='host'||info.textSource)return;
      if(!window.__RT_RENDERING?.reloadAfterWrite){syncColdText(info);return;}
      const targets=[...cards];
      await Promise.all(targets.map(async card=>{
        const select=d=>[...d.querySelectorAll('[data-rt]')].filter(el=>el.getAttribute('data-rt')===info.id);
        card.textSyncError=null;
        try{
          for(let attempt=0;attempt<80;attempt++){
            if(!open||!cards.includes(card))return;
            const d=card.frame.contentDocument;
            if(d?.body&&d.URL!=='about:blank')break;
            await new Promise(resolve=>setTimeout(resolve,50));
          }
          const d=card.frame.contentDocument;
          if(!d?.body||d.URL==='about:blank')throw Error('Preview is still loading.');
          if(!select(d).length)return;
          await RetouchRenderSync.sync({frame:card.frame,serverRendered:true,select,matches:el=>el.textContent===info.text});
        }catch(error){if(open&&cards.includes(card))card.textSyncError='Text saved; comparison refresh failed: '+error.message;}
      }));
    },
    canShowSizes(requested){return Array.isArray(requested)&&requested.length>0&&requested.every(size=>this.canShowSize(size))&&sizes.length+new Set(requested.filter(size=>!sizes.some(existing=>existing[1]===size.width&&existing[2]===size.height)).map(size=>size.width+'x'+size.height)).size<=8;},
    showSizes(requested){
      if(!this.canShowSizes(requested))return false;for(const size of requested)this.showSize(size);
      const group=[...new Set(requested.map(size=>cards.find(card=>card.width===size.width&&card.height===size.height)))],start=Math.min(...group.map(card=>cards.indexOf(card))),moves=[];
      for(const [offset,item]of group.entries()){const delta=start+offset-cards.indexOf(item);if(delta&&item.move(delta,false))moves.push({move:item.move,delta});}
      if(moves.length){orderUndo.push({delta:1,move:direction=>{for(const item of direction<0?[...moves].reverse():moves)if(!item.move(direction*item.delta,false))return false;return true;}});if(orderUndo.length>50)orderUndo.shift();orderRedo.length=0;updateControls();}
      group[0].card.scrollIntoView({block:'nearest',inline:'nearest'});group[0].viewport.focus({preventScroll:true});return true;
    },
    canShowSize:({width,height})=>valid(width)&&valid(height)&&!toggle.disabled&&!loadingSet&&!removals&&(sizes.length<8||sizes.some(size=>size[1]===width&&size[2]===height)),
    showSize(size){
      if(!this.canShowSize(size))return false;
      if(!open)toggle.click();
      let index=sizes.findIndex(item=>item[1]===size.width&&item[2]===size.height);
      if(index<0){
        const base=(size.label||`Custom ${size.width} × ${size.height}`).trim().slice(0,70)||'Breakpoint';let name=base,suffix=2;
        while(sizes.some(item=>item[0].toLowerCase()===name.toLowerCase()))name=base+' '+suffix++;
        const entry=[name,size.width,size.height];sizes.push(entry);index=sizes.length-1;addCard(entry);cards[index].frame.src=path()||'/';
      }
      const item=cards[index];item.setCollapsed(false);remember();updateControls();item.card.scrollIntoView({block:'nearest',inline:'nearest'});item.viewport.focus({preventScroll:true});return true;
    }
  };
  window.RetouchScreens?.setSaved(sizes);
})();
