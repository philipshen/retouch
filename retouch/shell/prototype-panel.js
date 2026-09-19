(function(root){
 'use strict';
 const I=RetouchInspector,V=RetouchPrototypeValues,host=root.RetouchPrototypeHost,panel=document.getElementById('panel'),body=document.getElementById('prototypePanel'),design=document.getElementById('designTab'),prototype=document.getElementById('prototypeTab');let active=false,busy=false,serial=0;
 const triggers=[['click','On click'],['mouseenter','Mouse enter'],['mouseleave','Mouse leave']],actions=[['navigate','Navigate to'],['back','Back'],['scroll','Scroll to'],['open-overlay','Open overlay'],['swap-overlay','Swap overlay'],['close-overlay','Close overlay']];
 async function tab(next){if(busy)return;try{await host.prepare();active=next;panel.classList.toggle('prototype-inspector',next);body.hidden=!next;design.classList.toggle('active',!next);prototype.classList.toggle('active',next);design.setAttribute('aria-selected',String(!next));prototype.setAttribute('aria-selected',String(next));design.tabIndex=next?-1:0;prototype.tabIndex=next?0:-1;if(next)render();}catch(error){host.error(error.message);}}
 design.onclick=()=>tab(false);prototype.onclick=()=>tab(true);
 for(const button of [design,prototype]){button.addEventListener('pointerdown',e=>e.preventDefault());button.addEventListener('keydown',async e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='End'||e.key==='ArrowRight';await tab(next);(next?prototype:design).focus();});}
 async function render(){if(!active||busy)return;const ticket=++serial,selection=host.selection();body.replaceChildren();
  const section=I.section('Interactions');body.append(section);const status=I.note(section,'');status.setAttribute('role','status');
  if(!selection?.prototypeEditable){status.textContent=selection?.prototypeReason||'Select a layer to add an interaction.';return;}
  I.note(section,'Play interactions in Present mode. This source layer’s copies share these connections.');
  let items=structuredClone(selection.prototypeInteractions||[]),pages=[];try{pages=await host.pages();}catch{}if(ticket!==serial||!active)return;
  const rows=document.createElement('div');section.append(rows);
  async function save(next){if(busy)return;busy=true;body.inert=true;status.textContent='Saving…';try{await host.save(selection,next);status.textContent='Saved';}catch(error){status.textContent=error.message;return;}finally{busy=false;body.inert=false;}render();}
  for(const [index,item]of items.entries()){
   const card=document.createElement('fieldset');card.className='prototype-interaction';const legend=document.createElement('legend');legend.textContent=triggers.find(([value])=>value===item.trigger)[1]+' → '+actions.find(([value])=>value===item.action)[1];card.append(legend);rows.append(card);
   const draft={...item};
   const modify=()=>{const next=items.map((value,i)=>i===index?draft:value);try{V.validate(next);}catch(error){status.textContent=error.message;return;}save(next);};
   I.select(card,'Trigger '+(index+1),triggers.filter(([value])=>value===item.trigger||!items.some(i=>i.trigger===value)),item.trigger,value=>{draft.trigger=value;modify();});
   I.select(card,'Action '+(index+1),actions,item.action,value=>{const destination=draft.destination;draft.action=value;delete draft.preserveScroll;delete draft.destination;delete draft.overlay;if(!['back','close-overlay'].includes(value))draft.destination=value==='scroll'?'top':(V.route(destination)?destination:pages.find(page=>page.url!==host.route())?.url||'/');if(value==='open-overlay')draft.overlay=V.overlay();modify();});
   if(['navigate','open-overlay','swap-overlay'].includes(item.action)){
    if(pages.length)I.select(card,'Destination page '+(index+1),[['','Custom URL'],...pages.map(page=>[page.url,page.path||page.url])],pages.some(page=>page.url===item.destination)?item.destination:'',value=>{if(value){draft.destination=value;modify();}});
    const input=document.createElement('input');input.value=item.destination;input.placeholder='/page';input.maxLength=2048;I.field(card,'Destination URL '+(index+1),input);input.addEventListener('change',()=>{draft.destination=input.value;modify();});
    if(item.action==='navigate'){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=!!item.preserveScroll;check.setAttribute('aria-label','Preserve scroll position '+(index+1));label.append(check,' Preserve scroll position');card.append(label);check.onchange=()=>{draft.preserveScroll=check.checked;modify();};}
   }else if(item.action==='scroll'){
    const input=document.createElement('input');input.value=item.destination;input.maxLength=256;I.field(card,'Destination element ID '+(index+1),input);input.addEventListener('change',()=>{draft.destination=input.value.replace(/^#/,'');modify();});
   }else I.note(card,item.action==='close-overlay'?'Dismiss the current overlay.':'Return to the previous page or dismiss the current overlay.');
   if(item.action==='open-overlay'){
    draft.overlay={...item.overlay};
    for(const key of ['width','height']){const input=document.createElement('input');input.type='number';input.min='80';input.max='7680';input.step='1';input.value=item.overlay[key];I.field(card,'Overlay '+key+' '+(index+1),input);input.onchange=()=>{draft.overlay[key]=Number(input.value);modify();};}
    I.select(card,'Overlay position '+(index+1),V.positions.map(value=>[value,value.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ')]),item.overlay.position,value=>{draft.overlay.position=value;modify();});
    const color=document.createElement('input');color.type='color';color.value=item.overlay.background.slice(0,7);I.field(card,'Overlay background '+(index+1),color);color.onchange=()=>{draft.overlay.background=color.value+item.overlay.background.slice(7);modify();};
    const opacity=document.createElement('input');opacity.type='number';opacity.min='0';opacity.max='100';opacity.value=String(Math.round(parseInt(item.overlay.background.slice(7),16)/255*100));I.field(card,'Background opacity (%) '+(index+1),opacity);opacity.onchange=()=>{const value=Number(opacity.value);if(!opacity.value||!Number.isFinite(value)||value<0||value>100){status.textContent='Choose a background opacity from 0% to 100%.';return;}draft.overlay.background=item.overlay.background.slice(0,7)+Math.round(value*255/100).toString(16).padStart(2,'0');modify();};
    const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=item.overlay.closeOutside;check.setAttribute('aria-label','Close when clicking outside '+(index+1));label.append(check,' Close when clicking outside');card.append(label);check.onchange=()=>{draft.overlay.closeOutside=check.checked;modify();};
   }else if(item.action==='swap-overlay')I.note(card,'Replace the current overlay, keeping its size, position and background.');
   const remove=I.button('Remove',()=>save(items.filter((_,i)=>i!==index)));remove.setAttribute('aria-label','Remove interaction '+(index+1));card.append(remove);
   for(const label of card.querySelectorAll('.inspector-field > span'))label.textContent=label.textContent.replace(/ \d+$/,'').replace('Destination page','Destination').replace('Destination URL','URL').replace('Destination element ID','Element ID');
  }
  const add=I.button('Add interaction',()=>save([...items,{trigger:triggers.find(([value])=>!items.some(i=>i.trigger===value))[0],action:'navigate',destination:pages.find(page=>page.url!==host.route())?.url||'/'}]));add.disabled=items.length===3;section.append(add);
  if(!items.length)I.note(section,'Connect this layer to another page, go back, or scroll to an element.');
 }
 root.addEventListener('retouch:selection',()=>queueMicrotask(render));root.addEventListener('retouch:prototype',render);
 root.RetouchPrototypePanel={refresh:render};
})(window);
