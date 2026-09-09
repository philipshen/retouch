(function(root){
  'use strict';
  function label(el) {
    const tag=el.tagName.toLowerCase();
    const name=el.getAttribute('aria-label') || el.getAttribute('alt') || el.id ||
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
  function mount({host,onSelect,onAction}) {
    const header=document.createElement('h2');header.textContent='Layers';
    const search=document.createElement('input');search.type='search';search.placeholder='Find a layer…';search.setAttribute('aria-label','Find a layer');
    const tree=document.createElement('div');tree.className='layer-tree';tree.setAttribute('role','tree');tree.setAttribute('aria-label','Site layers');
    const empty=document.createElement('p');empty.className='layer-empty';
    const actions=document.createElement('div');actions.className='layer-actions';
    const actionButtons={};
    for(const [action,name] of [['duplicateElement','Duplicate layer'],['before','Move layer up'],['after','Move layer down'],['deleteElement','Delete layer']]) {
      const b=document.createElement('button');b.textContent=name;b.disabled=true;b.onclick=()=>onAction(action);actions.append(b);actionButtons[action]=b;
    }
    const reason=document.createElement('p');reason.className='layer-reason';
    host.append(header,search,tree,empty,actions,reason);
    let d=null,observer=null,timer=null,selected=null,rows=[],collapsed=new WeakSet(),lastCapabilities=null,isBusy=false;
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
          b.setAttribute('role','treeitem');b.setAttribute('aria-level',depth);b.setAttribute('aria-selected',String(item.el===selected));
          b.tabIndex=item.el===selected?0:-1;b.disabled=isBusy;
          if(item.children.length)b.setAttribute('aria-expanded',String(expanded));
          b.onclick=()=>onSelect(item.el);
          b.onkeydown=async e=>{
            if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'){e.preventDefault();if(!isBusy){await onSelect(item.el);onAction('duplicateElement');}return;}
            if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();if(!isBusy){await onSelect(item.el);onAction('deleteElement');}return;}
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
      observer?.disconnect();clearTimeout(timer);d=next;collapsed=new WeakSet();render();
      if(d?.body){observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(render,100);});observer.observe(d.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-rt','data-rt-i','id','aria-label','alt']});}
    }
    function selection(el,info,busy=false) {
      if(isBusy!==busy){isBusy=busy;for(const r of rows){r.button.disabled=busy;r.toggle.disabled=busy||!r.item.children.length;}host.setAttribute('aria-busy',String(busy));}
      if(selected!==el){
        selected=el;
        let reveal=false;
        for(let p=el?.parentElement;p;p=p.parentElement)if(collapsed.has(p)){collapsed.delete(p);reveal=true;}
        if(reveal)render();
        for(const r of rows){r.button.setAttribute('aria-selected',String(r.item.el===el));r.button.tabIndex=r.item.el===el?0:-1;}
        if(!rows.some(r=>r.button.tabIndex===0)&&rows[0])rows[0].button.tabIndex=0;
        rows.find(r=>r.item.el===el)?.button.scrollIntoView({block:'nearest'});
      }
      const s=info?.structure;
      const capabilities=JSON.stringify([!!info,s,busy]);
      if(capabilities===lastCapabilities)return;
      lastCapabilities=capabilities;
      actionButtons.duplicateElement.disabled=busy||!s?.canDuplicate;
      actionButtons.deleteElement.disabled=busy||!s?.canDelete;
      actionButtons.before.disabled=busy||!s?.canMoveBefore;
      actionButtons.after.disabled=busy||!s?.canMoveAfter;
      reason.textContent=info?(s?.reason || (!s?.canDuplicate?'Duplicate is unavailable for a layer with an authored ID, key, or ref.':'')):'Select a layer to organize it.';
    }
    return {attach,selection};
  }
  const api={label,collect,mount};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchLayers=api;
})(typeof window==='object'?window:globalThis);
