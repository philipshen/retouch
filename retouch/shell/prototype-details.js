(function(root){
 'use strict';
 let current=null;const dialogs=new Set();
 function place(){if(!current?.dialog.matches(':popover-open'))return;const {dialog,row}=current,anchor=row.getBoundingClientRect(),width=Math.min(320,innerWidth-24),minTop=Math.max(12,Math.max(...['toolbar','screenToolbar'].map(id=>document.getElementById(id).getBoundingClientRect().bottom))+8),dock=document.querySelector('.design-tool-dock')?.getBoundingClientRect(),bottom=dock?.height?Math.min(innerHeight-12,dock.top-8):innerHeight-12,maxHeight=Math.max(80,bottom-minTop),left=anchor.left-width-12;
  Object.assign(dialog.style,{width:width+'px',maxHeight:maxHeight+'px',left:Math.max(12,left>=12?left:innerWidth-width-12)+'px'});const height=Math.min(dialog.scrollHeight,maxHeight);dialog.style.top=Math.max(minTop,Math.min(anchor.top,bottom-height))+'px';
 }
 function dismiss(focus=false,notify=false){if(!current)return;const old=current;current=null;old.dialog.hidePopover();old.row.setAttribute('aria-expanded','false');if(notify)old.close();if(focus&&old.row.isConnected)old.row.focus({preventScroll:true});}
 function open(dialog,row,close,focus=false){dismiss();current={dialog,row,close};dialog.showPopover();row.setAttribute('aria-expanded','true');place();if(focus)dialog.querySelector('select,input,button')?.focus({preventScroll:true});}
 function create(row,content,close){const dialog=document.createElement('div');dialog.className='prototype-details';dialog.setAttribute('popover','manual');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','Interaction details '+row.dataset.index);dialog.id='prototype-details-'+row.dataset.index;
  row.setAttribute('aria-haspopup','dialog');row.setAttribute('aria-controls',dialog.id);row.setAttribute('aria-expanded','false');
  const header=document.createElement('header'),title=document.createElement('strong'),button=document.createElement('button');title.textContent='Interaction details';button.type='button';button.textContent='×';button.setAttribute('aria-label','Close interaction details');button.onclick=()=>dismiss(true,true);header.append(title,button);dialog.append(header,content);
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();event.stopPropagation();dismiss(true,true);}});
  document.body.append(dialog);dialogs.add(dialog);return {dialog,open:focus=>open(dialog,row,close,focus)};
 }
 root.addEventListener('resize',place);new ResizeObserver(place).observe(document.getElementById('panel'));
 let presenting=false;new MutationObserver(()=>{const next=document.body.classList.contains('presenting');if(next)dismiss();else if(presenting)root.RetouchPrototypePanel?.refresh();presenting=next;}).observe(document.body,{attributes:true,attributeFilter:['class']});
 root.RetouchPrototypeDetails={create,dismiss,place,reset(){dismiss();for(const dialog of dialogs)dialog.remove();dialogs.clear();},setBusy(value){for(const dialog of dialogs)dialog.inert=value;},snapshot:()=>current?{index:current.row.dataset.index,scroll:current.dialog.scrollTop}:null,restore(state){if(state&&current?.row.dataset.index===state.index)current.dialog.scrollTop=state.scroll;}};
})(window);
