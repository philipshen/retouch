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
  function placement(source,target,fraction){
    if(!source||!target||source===target||source.contains(target))return null;
    if(fraction>=.25&&fraction<=.75&&canNest(source,target))return 'inside';
    if(!target.parentElement?.hasAttribute('data-rt')||['HTML','BODY'].includes(target.tagName))return null;
    return fraction<.5?'before':'after';
  }
  function mount({host,onSelect,onAction,getClipboard=()=>null,dragEnabled=false,onMove}) {
    const header=document.createElement('h2');header.textContent='Layers';
    const search=document.createElement('input');search.type='search';search.placeholder='Find a layer…';search.setAttribute('aria-label','Find a layer');
    const tree=document.createElement('div');tree.className='layer-tree';tree.setAttribute('role','tree');tree.setAttribute('aria-label','Site layers');
    const empty=document.createElement('p');empty.className='layer-empty';
    const actions=document.createElement('div');actions.className='layer-actions';
    const actionButtons={};
    for(const [action,name] of [['insertText','Add text'],['insertFrame','Add frame'],['copyElement','Copy layer'],['pasteElement','Paste layer'],['reparentElement','Move into…'],['duplicateElement','Duplicate layer'],['before','Move layer up'],['after','Move layer down'],['deleteElement','Delete layer']]) {
      const b=document.createElement('button');b.textContent=name;b.disabled=true;b.onclick=()=>onAction(action);actions.append(b);actionButtons[action]=b;
    }
    const reason=document.createElement('p');reason.className='layer-reason';
    host.append(header,search,tree,empty,actions,reason);
    let d=null,observer=null,timer=null,selected=null,rows=[],collapsed=new WeakSet(),lastCapabilities=null,isBusy=false,dragged=null,selectedSet=new Set();
    function clearTargets(){for(const row of rows)row.button.classList.remove('drop-target','drop-before','drop-after');}
    function endDrag(){dragged=null;clearTargets();for(const row of rows)row.button.classList.remove('dragging');}
    function render() {
      const focused=rows.find(r=>r.button===document.activeElement)?.item.el;
      tree.replaceChildren();rows=[];
      const query=search.value.trim().toLowerCase();
      const matches=new Map();
      function matched(item){if(!matches.has(item))matches.set(item,item.label.toLowerCase().includes(query)||item.children.some(matched));return matches.get(item);}
      function walk(items,depth) {
        for(const item of items) {
          if(query&&!matched(item))continue;
          const row=document.createElement('div');row.className='layer-row';row.style.paddingLeft=(depth-1)*12+'px';
          const expanded=!!query||!collapsed.has(item.el);
          const toggle=document.createElement('button');toggle.className='layer-toggle';toggle.tabIndex=-1;
          toggle.textContent=item.children.length?(expanded?'▾':'▸'):'';
          toggle.disabled=isBusy||!item.children.length;toggle.setAttribute('aria-label',(expanded?'Collapse ':'Expand ')+item.label);
          toggle.onclick=()=>{if(expanded)collapsed.add(item.el);else collapsed.delete(item.el);render();};
          const b=document.createElement('button');b.className='layer-item';b.textContent=item.label;b.title=item.label;
          b.setAttribute('role','treeitem');b.setAttribute('aria-level',depth);b.setAttribute('aria-selected',String(selectedSet.has(item.el)));
          b.tabIndex=item.el===selected?0:-1;b.disabled=isBusy;
          if(item.children.length)b.setAttribute('aria-expanded',String(expanded));
          b.onclick=e=>onSelect(item.el,{toggle:e.shiftKey||e.metaKey||e.ctrlKey});
          b.draggable=dragEnabled&&!['HTML','BODY'].includes(item.el.tagName);
          b.ondragstart=e=>{if(isBusy||selectedSet.size>1||!b.draggable){e.preventDefault();return;}dragged=item.el;e.dataTransfer.setData('text/plain','retouch-layer:'+item.el.getAttribute('data-rt'));e.dataTransfer.effectAllowed='move';b.classList.add('dragging');};
          const dropPosition=e=>{const box=b.getBoundingClientRect();return isBusy?null:placement(dragged,item.el,(e.clientY-box.top)/box.height);};
          b.ondragover=e=>{clearTargets();const position=dropPosition(e);if(position){e.preventDefault();e.dataTransfer.dropEffect='move';b.classList.add(position==='inside'?'drop-target':'drop-'+position);}};
          b.ondragleave=clearTargets;
          b.ondrop=e=>{const position=dropPosition(e);if(position){e.preventDefault();const source=dragged;endDrag();onMove?.(source,item.el,position);}};
          b.ondragend=endDrag;
          b.onkeydown=async e=>{
            if(e.key==='F2'){e.preventDefault();if(!isBusy){if(!selectedSet.has(item.el))await onSelect(item.el);onAction('renameElement');}return;}
            if((e.metaKey||e.ctrlKey)&&['c','v'].includes(e.key.toLowerCase())){e.preventDefault();if(!isBusy){if(!selectedSet.has(item.el))await onSelect(item.el);onAction(e.key.toLowerCase()==='c'?'copyElement':'pasteElement');}return;}
            if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'){e.preventDefault();if(!isBusy){if(!selectedSet.has(item.el))await onSelect(item.el);onAction('duplicateElement');}return;}
            if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();if(!isBusy){if(!selectedSet.has(item.el))await onSelect(item.el);onAction('deleteElement');}return;}
            const index=rows.findIndex(r=>r.button===b);
            if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
              e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?rows.length-1:index+(e.key==='ArrowDown'?1:-1);
              rows[Math.max(0,Math.min(rows.length-1,next))]?.button.focus();
            } else if(e.key==='ArrowRight') {
              e.preventDefault();if(item.children.length){if(!expanded){collapsed.delete(item.el);render();}else rows[index+1]?.button.focus();}
            } else if(e.key==='ArrowLeft') {
              e.preventDefault();if(item.children.length&&expanded){collapsed.add(item.el);render();}else rows.find(r=>r.item===item.parent)?.button.focus();
            }
          };
          row.append(toggle,b);tree.append(row);rows.push({item,button:b,toggle});
          if(expanded)walk(item.children,depth+1);
        }
      }
      if(d)walk(collect(d),1);
      if(rows.length&&!rows.some(r=>r.button.tabIndex===0))rows[0].button.tabIndex=0;
      empty.textContent=rows.length?'':query?'No matching layers.':'No source-connected layers on this page yet.';
      empty.hidden=!!rows.length;
      if(focused)rows.find(r=>r.item.el===focused)?.button.focus();
    }
    search.oninput=render;
    function attach(next) {
      if(d===next)return;
      observer?.disconnect();clearTimeout(timer);endDrag();d=next;collapsed=new WeakSet();render();
      if(d?.body){observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(render,100);});observer.observe(d.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-rt','data-rt-i','data-rt-name','id','aria-label','alt']});}
    }
    function selection(el,info,busy=false,multiple=[]) {
      const nextSet=new Set(multiple.length?multiple:el?[el]:[]),changed=nextSet.size!==selectedSet.size||[...nextSet].some(item=>!selectedSet.has(item));selectedSet=nextSet;tree.setAttribute('aria-multiselectable',String(!!info?.cssAuthoring));
      if(isBusy!==busy){isBusy=busy;for(const r of rows){r.button.disabled=busy;r.toggle.disabled=busy||!r.item.children.length;}host.setAttribute('aria-busy',String(busy));}
      if(selected!==el||changed){
        selected=el;
        let reveal=false;
        for(let p=el?.parentElement;p;p=p.parentElement)if(collapsed.has(p)){collapsed.delete(p);reveal=true;}
        if(reveal)render();
        for(const r of rows){r.button.setAttribute('aria-selected',String(selectedSet.has(r.item.el)));r.button.tabIndex=r.item.el===el?0:-1;}
        if(!rows.some(r=>r.button.tabIndex===0)&&rows[0])rows[0].button.tabIndex=0;
        rows.find(r=>r.item.el===el)?.button.scrollIntoView({block:'nearest'});
      }
      const s=info?.structure;
      const copied=getClipboard();
      const compatible=!!copied&&copied.file===info?.file&&copied.parentId===s?.parentId&&copied.hash===(info?.fileHash||info?.hash);
      const capabilities=JSON.stringify([!!info,s,busy,copied,compatible,selectedSet.size]);
      if(capabilities===lastCapabilities)return;
      lastCapabilities=capabilities;
      actionButtons.duplicateElement.textContent=selectedSet.size>1?'Duplicate layers':'Duplicate layer';actionButtons.deleteElement.textContent=selectedSet.size>1?'Delete layers':'Delete layer';
      for(const action of ['insertText','insertFrame']){actionButtons[action].hidden=s?.canInsert===undefined;actionButtons[action].disabled=busy||!s?.canInsert;actionButtons[action].title=s?.insertReason||'Insert inside the selected container.';}
      actionButtons.reparentElement.hidden=s?.canReparent===undefined;actionButtons.reparentElement.disabled=busy||!s?.canReparent;
      actionButtons.copyElement.disabled=busy||!s?.canDuplicate;
      actionButtons.pasteElement.disabled=busy||!s?.canPaste||!compatible;
      actionButtons.pasteElement.title=!copied?'Copy a layer first.':!compatible?'Paste requires an unchanged copied sibling in this source parent.':'Paste after the selected layer.';
      actionButtons.duplicateElement.disabled=busy||!s?.canDuplicate;
      actionButtons.deleteElement.disabled=busy||!s?.canDelete;
      actionButtons.before.disabled=busy||!s?.canMoveBefore;
      actionButtons.after.disabled=busy||!s?.canMoveAfter;
      if(selectedSet.size>1){for(const button of Object.values(actionButtons))button.disabled=true;actionButtons.duplicateElement.disabled=busy;actionButtons.deleteElement.disabled=busy;reason.textContent=selectedSet.size+' layers selected. Duplicate and delete apply to the selection.';return;}
      reason.textContent=info?(s?.canInsert&&!s?.canDuplicate?'Add text or a frame inside this container.':s?.reason || (!s?.canDuplicate?'Duplicate is unavailable for a layer with an authored ID, key, or ref.':'')):'Select a layer to organize it.';
    }
    return {attach,selection};
  }
  const api={label,collect,mount,canNest};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchLayers=api;
})(typeof window==='object'?window:globalThis);
