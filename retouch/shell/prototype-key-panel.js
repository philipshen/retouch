(function(root){
 'use strict';
 const K=root.RetouchPrototypeKeys,I=root.RetouchInspector;
 function mount(parent,{value,index,change}){
  let draft={...value},recording=false;
  const box=document.createElement('div');box.className='prototype-shortcut';parent.append(box);
  I.select(box,'Key '+index,K.codes.map(code=>[code,K.keyName(code)]),value.code,code=>change({...draft,code}));
  const row=document.createElement('div');row.className='prototype-key-modifiers';box.append(row);
  for(const key of K.modifiers){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=value[key];input.setAttribute('aria-label',key+' modifier '+index);label.append(input,({ctrl:'Ctrl',alt:'Alt',shift:'Shift',meta:'⌘ / Meta'})[key]);row.append(label);input.onchange=()=>change({...draft,[key]:input.checked});}
  const record=I.button(K.label(value),()=>{recording=true;record.textContent='Press a shortcut…';record.setAttribute('aria-pressed','true');record.focus();});record.setAttribute('aria-label','Record shortcut '+index);record.setAttribute('aria-pressed','false');record.addEventListener('pointerdown',event=>{event.preventDefault();record.focus();});box.append(record);
  const cancel=()=>{recording=false;record.textContent=K.label(value);record.setAttribute('aria-pressed','false');};record.addEventListener('blur',cancel);
  record.addEventListener('keydown',event=>{if(!recording)return;event.preventDefault();event.stopImmediatePropagation();if(event.key==='Escape'){cancel();return;}if(event.isComposing||event.repeat||!K.codes.includes(event.code))return;draft=K.validate({code:event.code,...Object.fromEntries(K.modifiers.map(key=>[key,!!event[key+'Key']]))});cancel();void change(draft);});
  I.note(box,'Click to record; Escape cancels. Shortcuts run in the active preview and leave text fields alone.');
 }
 root.RetouchPrototypeKeyPanel={mount};
})(window);
