(function(root){
  'use strict';
  function label(el) {
    const tag=el.tagName.toLowerCase();
    const name=el.getAttribute('data-rt-name') || el.getAttribute('aria-label') || el.getAttribute('alt') || el.id ||
      [...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim().replace(/\s+/g,' ');
    return tag+(name?' · '+name.slice(0,70):'');
  }
  function collect(d) {
    const roots=[],map=new Map();
    for(const el of d.querySelectorAll('[data-rt], [data-rt-i]')) {
      if(['SCRIPT','STYLE','TEMPLATE','HEAD','META','LINK'].includes(el.tagName))continue;
      let parent=el.parentElement;while(parent&&!map.has(parent))parent=parent.parentElement;
      const item={el,label:label(el),children:[],parent:parent?map.get(parent):null};
      (item.parent?item.parent.children:roots).push(item);map.set(el,item);
    }
    return roots;
  }
  function canNest(source,target){return !!source&&!!target&&source!==target&&source.parentElement!==target&&!source.contains(target)&&['BODY','DIV','MAIN','SECTION','ARTICLE','ASIDE','HEADER','FOOTER','NAV','FORM','LI','TD','TH','BLOCKQUOTE'].includes(target.tagName);}
  function canNestMany(sources,target){return !!target&&sources.length>0&&sources.every(source=>source&&!source.contains(target))&&sources.some(source=>canNest(source,target));}
  function placement(sources,target,fraction){
    if(!target||sources.some(source=>!source||source.contains(target)))return null;
    if(fraction>=.25&&fraction<=.75&&canNestMany(sources,target))return 'inside';
    if(!target.parentElement?.hasAttribute('data-rt')||['HTML','BODY'].includes(target.tagName))return null;
    return fraction<.5?'before':'after';
  }
  function mount({host,onSelect,onAction,getClipboard=()=>null,dragEnabled=false,multiSelectEnabled=dragEnabled,onMove,onSelectMany,locks,onLock}) {
    const header=document.createElement('h2');header.textContent='Layers';
    const search=document.createElement('input');search.type='search';search.placeholder='Find a layer…';search.setAttribute('aria-label','Find a layer');
    const tree=document.createElement('div');tree.className='layer-tree';tree.setAttribute('role','tree');tree.setAttribute('aria-label','Site layers');
    const empty=document.createElement('p');empty.className='layer-empty';
    const actions=document.createElement('div');actions.className='layer-actions';
    const actionButtons={};
    for(const [action,name] of [['insertText','Add text'],['insertFrame','Add frame'],['copyElement','Copy layer'],['pasteElement','Paste layer'],['reparentElement','Move into…'],['frameSelection','Frame selection'],['removeFrame','Remove frame'],['duplicateElement','Duplicate layer'],['before','Move layer up'],['after','Move layer down'],['first','Send to back'],['last','Bring to front'],['deleteElement','Delete layer']]) {
      const b=document.createElement('button');b.textContent=name;b.disabled=true;b.onclick=()=>onAction(action);actions.append(b);actionButtons[action]=b;
    }
    const lockSelection=document.createElement('button'),unlockSelection=document.createElement('button');
    lockSelection.textContent='Lock selection';unlockSelection.textContent='Unlock selection';
    lockSelection.hidden=unlockSelection.hidden=!locks||!onLock;
    lockSelection.disabled=unlockSelection.disabled=true;
    lockSelection.onclick=()=>onLock([...selectedSet],true);unlockSelection.onclick=()=>onLock([...selectedSet],false);
    unlockSelection.title='Remove direct locks from selected layers. Inherited locks must be removed from their parent.';
    actions.append(lockSelection,unlockSelection);
    const reason=document.createElement('p');reason.className='layer-reason';
    const multiEnabled=multiSelectEnabled&&typeof onSelectMany==='function',selectAll=document.createElement('button');selectAll.textContent='Select visible layers';selectAll.className='layer-select-all';selectAll.hidden=!multiEnabled;
    host.append(header,search,selectAll,tree,empty,actions,reason);
    let d=null,observer=null,timer=null,selected=null,rows=[],collapsed=new WeakSet(),lastCapabilities=null,isBusy=false,dragged=null,selectedSet=new Set(),rangeAnchor=null;
    function clearTargets(){for(const row of rows)row.button.classList.remove('drop-target','drop-before','drop-after');}
    function endDrag(){dragged=null;clearTargets();for(const row of rows)row.button.classList.remove('dragging');}
    function selectionRows(){const query=search.value.trim().toLowerCase();return rows.filter(row=>!['HTML','BODY'].includes(row.item.el.tagName)&&!locks?.locked(row.item.el)&&(!query||row.item.label.toLowerCase().includes(query)));}
    async function selectRange(target,append=false){
      if(isBusy)return;const candidates=selectionRows(),end=candidates.findIndex(row=>row.item.el===target);
      if(end<0)return onSelect(target);
      const anchor=rangeAnchor?.isConnected?rangeAnchor:selected;let start=candidates.findIndex(row=>row.item.el===anchor);if(start<0)start=end;
      if(!rangeAnchor?.isConnected)rangeAnchor=candidates[start].item.el;
      await onSelectMany(candidates.slice(Math.min(start,end),Math.max(start,end)+1).map(row=>row.item.el),{active:target,append});
    }
    async function selectVisible(){if(!multiEnabled||isBusy)return;const candidates=selectionRows();if(candidates.length){rangeAnchor=candidates[0].item.el;await onSelectMany(candidates.map(row=>row.item.el),{active:candidates[0].item.el});}}
    selectAll.onclick=selectVisible;
    function render() {
      const focused=rows.find(r=>r.button===document.activeElement)?.item.el;
      const previous=new Map(rows.map(row=>[row.item.el,row]));rows=[];
      const query=search.value.trim().toLowerCase();
      const matches=new Map();
      function matched(item){if(!matches.has(item))matches.set(item,item.label.toLowerCase().includes(query)||item.children.some(matched));return matches.get(item);}
      function walk(items,depth) {
        for(const item of items) {
          if(query&&!matched(item))continue;
          const prior=previous.get(item.el),row=prior?.row||document.createElement('div');row.className='layer-row';row.style.paddingLeft=(depth-1)*12+'px';
          const expanded=!!query||!collapsed.has(item.el);
          const toggle=prior?.toggle||document.createElement('button');toggle.className='layer-toggle';toggle.tabIndex=-1;
          toggle.textContent=item.children.length?(expanded?'▾':'▸'):'';
          toggle.disabled=isBusy||!item.children.length;toggle.setAttribute('aria-label',(expanded?'Collapse ':'Expand ')+item.label);
          toggle.onclick=()=>{if(expanded)collapsed.add(item.el);else collapsed.delete(item.el);render();};
          const b=prior?.button||document.createElement('button');b.className='layer-item';if(b.textContent!==item.label)b.textContent=item.label;b.title=item.label;
          b.setAttribute('role','treeitem');b.setAttribute('aria-level',depth);b.setAttribute('aria-selected',String(selectedSet.has(item.el)));
          b.tabIndex=item.el===selected?0:-1;b.disabled=isBusy;
          if(item.children.length)b.setAttribute('aria-expanded',String(expanded));else b.removeAttribute('aria-expanded');
          b.onclick=e=>{if(multiEnabled&&e.shiftKey)return selectRange(item.el,e.metaKey||e.ctrlKey);rangeAnchor=item.el;return onSelect(item.el,{toggle:e.metaKey||e.ctrlKey});};
          b.draggable=dragEnabled&&item.el.namespaceURI==='http://www.w3.org/1999/xhtml'&&!['HTML','BODY'].includes(item.el.tagName);
          b.ondragstart=e=>{if(isBusy||!b.draggable){e.preventDefault();return;}dragged=item.el;e.dataTransfer.setData('text/plain','retouch-layer:'+item.el.getAttribute('data-rt'));e.dataTransfer.effectAllowed='move';for(const row of rows)if(row.item.el===dragged||selectedSet.has(dragged)&&selectedSet.has(row.item.el))row.button.classList.add('dragging');};
          const dropPosition=e=>{const box=b.getBoundingClientRect();return isBusy?null:placement(selectedSet.has(dragged)?[...selectedSet]:[dragged],item.el,(e.clientY-box.top)/box.height);};
          b.ondragover=e=>{clearTargets();const position=dropPosition(e);if(position){e.preventDefault();e.dataTransfer.dropEffect='move';b.classList.add(position==='inside'?'drop-target':'drop-'+position);}};
          b.ondragleave=clearTargets;
          b.ondrop=e=>{const position=dropPosition(e);if(position){e.preventDefault();const source=dragged;endDrag();onMove?.(source,item.el,position);}};
          b.ondragend=endDrag;
          b.onkeydown=async e=>{
            if(multiEnabled&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'){e.preventDefault();e.stopPropagation();await selectVisible();return;}
            if(e.key==='F2'){e.preventDefault();if(!isBusy){if(!selectedSet.has(item.el))await onSelect(item.el);onAction('renameElement');}return;}
            if((e.metaKey||e.ctrlKey)&&['c','v'].includes(e.key.toLowerCase())){e.preventDefault();if(!isBusy){if(!selectedSet.has(item.el))await onSelect(item.el);onAction(e.key.toLowerCase()==='c'?'copyElement':'pasteElement');}return;}
            if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'){e.preventDefault();if(!isBusy){if(!selectedSet.has(item.el))await onSelect(item.el);onAction('duplicateElement');}return;}
            if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();if(!isBusy){if(!selectedSet.has(item.el))await onSelect(item.el);onAction('deleteElement');}return;}
            const index=rows.findIndex(r=>r.button===b);
            if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
              e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?rows.length-1:index+(e.key==='ArrowDown'?1:-1);
              const destination=rows[Math.max(0,Math.min(rows.length-1,next))];if(multiEnabled&&e.shiftKey&&destination)await selectRange(destination.item.el,e.metaKey||e.ctrlKey);destination?.button.focus();
            } else if(e.key==='ArrowRight') {
              e.preventDefault();if(item.children.length){if(!expanded){collapsed.delete(item.el);render();}else rows[index+1]?.button.focus();}
            } else if(e.key==='ArrowLeft') {
              e.preventDefault();if(item.children.length&&expanded){collapsed.add(item.el);render();}else rows.find(r=>r.item===item.parent)?.button.focus();
            }
          };
          let lock=prior?.lock;
          if(locks&&onLock){
            lock ||= document.createElement('button');lock.className='layer-lock';
            const direct=locks.direct(item.el),inherited=!direct&&locks.locked(item.el);
            lock.textContent=direct||inherited?'🔒':'🔓';lock.setAttribute('aria-label',(direct?'Unlock ':inherited?'Locked by parent: ':'Lock ')+item.label);
            lock.title=inherited?'Unlock the parent layer first.':direct?'Unlock canvas selection':'Lock canvas selection for this editor session; select from Layers to edit';
            lock.setAttribute('aria-pressed',String(direct||inherited));lock.disabled=isBusy||inherited;
            lock.onclick=async()=>{await onLock(item.el,!locks.direct(item.el));render();};
          }
          if(!prior)row.append(toggle,b);if(lock&&!lock.parentElement)row.append(lock);rows.push({item,row,button:b,toggle,lock});
          if(expanded)walk(item.children,depth+1);
        }
      }
      if(d)walk(collect(d),1);
      // Keep existing layer buttons attached while source updates arrive. Replacing
      // them between pointerdown and pointerup loses the browser's click target.
      const retained=new Set(rows.map(entry=>entry.row));
      for(const child of [...tree.children])if(!retained.has(child))child.remove();
      for(let i=0;i<rows.length;i++)if(tree.children[i]!==rows[i].row)tree.insertBefore(rows[i].row,tree.children[i]||null);
      if(rows.length&&!rows.some(r=>r.button.tabIndex===0))rows[0].button.tabIndex=0;
      empty.textContent=rows.length?'':query?'No matching layers.':'No source-connected layers on this page yet.';
      empty.hidden=!!rows.length;
      selectAll.disabled=isBusy||!selectionRows().length;
      if(focused)rows.find(r=>r.item.el===focused)?.button.focus();
    }
    search.oninput=render;
    function attach(next) {
      if(d===next)return;
      observer?.disconnect();clearTimeout(timer);endDrag();rangeAnchor=null;d=next;collapsed=new WeakSet();render();
      if(d?.body){observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(render,100);});observer.observe(d.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-rt','data-rt-i','data-rt-name','id','aria-label','alt']});}
    }
    function selection(el,info,busy=false,multiple=[]) {
      const nextSet=new Set(multiple.length?multiple:el?[el]:[]),changed=nextSet.size!==selectedSet.size||[...nextSet].some(item=>!selectedSet.has(item));selectedSet=nextSet;tree.setAttribute('aria-multiselectable',String(!!(info?.cssAuthoring||info?.classSelection)));
      if(!el)rangeAnchor=null;
      if(isBusy!==busy){isBusy=busy;selectAll.disabled=busy||!selectionRows().length;for(const r of rows){r.button.disabled=busy;r.toggle.disabled=busy||!r.item.children.length;if(r.lock)r.lock.disabled=busy||!locks.direct(r.item.el)&&locks.locked(r.item.el);}host.setAttribute('aria-busy',String(busy));}
      if(selected!==el||changed){
        selected=el;
        let reveal=false;
        for(let p=el?.parentElement;p;p=p.parentElement)if(collapsed.has(p)){collapsed.delete(p);reveal=true;}
        if(reveal)render();
        for(const r of rows){r.button.setAttribute('aria-selected',String(selectedSet.has(r.item.el)));r.button.tabIndex=r.item.el===el?0:-1;}
        if(!rows.some(r=>r.button.tabIndex===0)&&rows[0])rows[0].button.tabIndex=0;
        rows.find(r=>r.item.el===el)?.button.scrollIntoView({block:'nearest'});
      }
      lockSelection.disabled=busy||![...selectedSet].some(el=>!locks?.direct(el));
      unlockSelection.disabled=busy||![...selectedSet].some(el=>locks?.direct(el));
      const s=info?.structure;
      const copied=getClipboard();
      const compatible=!!copied&&copied.file===info?.file&&copied.parentId===s?.parentId&&copied.hash===(info?.fileHash||info?.hash);
      const capabilities=JSON.stringify([!!info,!!info?.svgMovement,s,busy,copied,compatible,selectedSet.size]);
      if(capabilities===lastCapabilities)return;
      lastCapabilities=capabilities;
      actionButtons.duplicateElement.textContent=selectedSet.size>1?'Duplicate layers':'Duplicate layer';actionButtons.deleteElement.textContent=selectedSet.size>1?'Delete layers':'Delete layer';
      for(const action of ['insertText','insertFrame']){actionButtons[action].hidden=s?.canInsert===undefined;actionButtons[action].disabled=busy||!s?.canInsert;actionButtons[action].title=s?.insertReason||'Insert inside the selected container.';}
      actionButtons.reparentElement.hidden=s?.canReparent===undefined;actionButtons.reparentElement.disabled=busy||!s?.canReparent;
      actionButtons.frameSelection.hidden=s?.canFrame===undefined;actionButtons.frameSelection.disabled=busy||!s?.canFrame;actionButtons.frameSelection.title='Wrap consecutive sibling layers in a new layout container.';
      actionButtons.removeFrame.hidden=s?.canRemoveFrame===undefined;actionButtons.removeFrame.disabled=busy||!s?.canRemoveFrame;actionButtons.removeFrame.title='Remove the frame container and its styling; keep its children.';
      actionButtons.copyElement.disabled=busy||!(s?.canCopy??s?.canDuplicate);
      actionButtons.pasteElement.disabled=busy||!s?.canPaste||!compatible;
      actionButtons.pasteElement.title=!copied?'Copy a layer first.':!compatible?'Paste requires an unchanged copied sibling in this source parent.':'Paste after the selected layer.';
      actionButtons.duplicateElement.disabled=busy||!s?.canDuplicate;
      actionButtons.deleteElement.disabled=busy||!s?.canDelete;
      actionButtons.before.textContent=info?.svgMovement?'Send backward':'Move layer up';actionButtons.after.textContent=info?.svgMovement?'Bring forward':'Move layer down';
      for(const [action,cap] of [['first','canMoveFirst'],['last','canMoveLast']]){actionButtons[action].hidden=!info?.svgMovement;actionButtons[action].disabled=busy||!s?.[cap];}
      actionButtons.before.disabled=busy||!s?.canMoveBefore;
      actionButtons.after.disabled=busy||!s?.canMoveAfter;
      if(selectedSet.size>1){for(const button of Object.values(actionButtons))button.disabled=true;if(!info?.cssAuthoring){reason.textContent=selectedSet.size+' source layers selected. Shared styles apply together.';return;}actionButtons.duplicateElement.disabled=busy;actionButtons.deleteElement.disabled=busy;actionButtons.reparentElement.disabled=busy;actionButtons.frameSelection.disabled=busy||!s?.canFrame;reason.textContent=selectedSet.size+' layers selected. Frame, move, duplicate and delete apply to the selection.';return;}
      reason.textContent=info?.svgMovement?'Send backward or bring forward changes which SVG shape appears on top.':info?.svgDeletion?'Delete removes this SVG layer and its contents. Undo restores it.':info?(s?.canInsert&&!s?.canDuplicate?'Add text or a frame inside this container.':s?.reason || (!s?.canDuplicate?'Duplicate is unavailable for a layer with an authored ID, key, or ref.':'')):'Select a layer to organize it.';
    }
    return {attach,selection,refresh:render};
  }
  const api={label,collect,mount,canNest,canNestMany};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchLayers=api;
})(typeof window==='object'?window:globalThis);
