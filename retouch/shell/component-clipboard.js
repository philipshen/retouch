(function(root){
 'use strict';
 const format='retouch/component-properties@1';
 function validate(input){
  if(typeof input==='string'){if(input.length>1000000)throw Error('Copied properties are too large.');try{input=JSON.parse(input);}catch{throw Error('Copy component properties before pasting.');}}
  if(!input||input.format!==format||!Array.isArray(input.properties)||!input.properties.length||input.properties.length>100)throw Error('Copy component properties before pasting.');
  const seen=new Set(),properties=input.properties.map(p=>{
   if(!p||typeof p.name!=='string'||!/^[$A-Z_a-z][$\w]*$/.test(p.name)||['key','ref','children','__proto__','__self','__source'].includes(p.name)||p.name.startsWith('data-rt')||seen.has(p.name))throw Error('Invalid copied property.');seen.add(p.name);
   if(p.unset===true&&!Object.hasOwn(p,'value'))return {name:p.name,unset:true};
   if(p.unset!==undefined||!['string','number','boolean'].includes(typeof p.value)||typeof p.value==='number'&&!Number.isFinite(p.value)||typeof p.value==='string'&&p.value.length>100000)throw Error('Invalid copied property value.');return {name:p.name,value:p.value};
  });const payload={format,properties};if(JSON.stringify(payload).length>1000000)throw Error('Copied properties are too large.');return payload;
 }
 function snapshot(component){return validate({format,properties:component.props.filter(p=>p.editor?.editable&&(p.editor.unset?p.editor.allowUnset:['string','number','boolean'].includes(typeof p.editor.value))).map(p=>p.editor.unset?{name:p.name,unset:true}:{name:p.name,value:p.editor.value})});}
 function match(component,payload){
  const accepted=[],skipped=[];
  for(const property of payload.properties){const info=component.props.find(p=>p.name===property.name)?.editor;
   if(!info?.editable||(property.unset?!info.allowUnset:typeof property.value!==info.type||info.choices&&!info.choices.includes(property.value))){skipped.push(property.name);continue;}
   accepted.push({...property,...(info.definitionHash===undefined?{}:{definitionHash:info.definitionHash})});
  }return {accepted,skipped};
 }
 async function clipboardCall(operation){let timer;try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Clipboard permission is still pending.')),1500);})]);}finally{clearTimeout(timer);}}
 function createTransport(validate){let copied=null,localOnly=false;return {
  async copy(input){const payload=validate(input),text=JSON.stringify(payload);copied=payload;localOnly=true;try{await clipboardCall(()=>navigator.clipboard.writeText(text));localOnly=false;return {count:payload.properties.length,system:true};}catch{return {count:payload.properties.length,system:false};}},
  async read(){if(localOnly&&copied)return copied;let text;try{text=await clipboardCall(()=>navigator.clipboard.readText());}catch{if(copied)return copied;throw Error('Clipboard access is unavailable. Copy values in this editor first.');}return validate(text);}
 };}
 const transport=createTransport(validate),copy=component=>transport.copy(snapshot(component)),read=()=>transport.read();
 async function open({components,infos,save,opener,readClipboard=read,dialogLabel="Paste component properties",actionLabel="Paste properties",hintText="Only checked properties are pasted. Copied values become instance overrides; expression bindings stay unchanged.",scopeLabel="",initialProperties=null,labels={},targetLabel="instance",hideExcluded=false}){
  if(document.querySelector('dialog[open]'))return;
  const payload=await readClipboard();if(document.querySelector('dialog[open]'))return;
  const matches=components.map(component=>match(component,payload)),available=new Set(matches.flatMap(result=>result.accepted.map(property=>property.name))),chosen=new Set([...available].filter(name=>!initialProperties||initialProperties.includes(name))),previewRows=[];
  const selectedTargets=()=>matches.flatMap((result,i)=>{const properties=result.accepted.filter(property=>chosen.has(property.name));return properties.length?[{id:infos[i].id,properties}]:[];});
  const dialog=document.createElement('dialog');dialog.className='component-library component-insert component-property-paste';dialog.setAttribute('aria-label',dialogLabel);
  const title=document.createElement('h2');title.textContent=actionLabel;const note=document.createElement('p');note.setAttribute('aria-live','polite');
  const choices=document.createElement('fieldset');choices.className='paste-property-choices';const legend=document.createElement('legend');legend.textContent='Properties to paste';choices.append(legend);
  for(const property of payload.properties){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=available.has(property.name);input.disabled=!input.checked;input.dataset.propertyName=property.name;input.setAttribute('aria-label','Paste '+(labels[property.name]||property.name));input.onchange=()=>{if(input.checked)chosen.add(property.name);else chosen.delete(property.name);update();};label.append(input,document.createTextNode(labels[property.name]||property.name));choices.append(label);}
  const chooseAll=document.createElement('button');chooseAll.type='button';chooseAll.className='control-button';chooseAll.textContent='Select all';chooseAll.onclick=()=>{for(const name of available)chosen.add(name);update();};const chooseNone=document.createElement('button');chooseNone.type='button';chooseNone.className='control-button';chooseNone.textContent='Clear selection';chooseNone.onclick=()=>{chosen.clear();update();};choices.append(chooseAll,chooseNone);
  const list=document.createElement('ul');list.setAttribute('aria-label','Property paste preview');components.forEach((component,i)=>{
   const item=document.createElement('li'),result=matches[i],name=document.createElement('strong');name.textContent=component.name+(components.length>1?' '+(i+1):'');item.append(name);
   if(result.accepted.length){const values=document.createElement('dl');for(const property of result.accepted){const label=document.createElement('dt'),value=document.createElement('dd');label.textContent=labels[property.name]||property.name;const text=property.unset?'Not set':typeof property.value==='boolean'?(property.value?'On':'Off'):property.value===''?'Empty text':String(property.value);value.textContent=text.length>120?text.slice(0,117)+'…':text;values.append(label,value);previewRows.push({name:property.name,label,value});}item.append(values);}
   else{const empty=document.createElement('p');empty.textContent='No compatible properties';item.append(empty);}
   if(result.skipped.length){const skipped=document.createElement('p');skipped.textContent='Skipped: '+result.skipped.join(', ');item.append(skipped);}list.append(item);
  });
  const hint=document.createElement('p');hint.textContent=hintText+(scopeLabel?' '+scopeLabel:'');
  const actions=document.createElement('div');actions.className='component-library-actions';const cancel=document.createElement('button'),apply=document.createElement('button'),status=document.createElement('p');cancel.textContent='Cancel';apply.textContent=actionLabel;cancel.className=apply.className='control-button';apply.disabled=!available.size;status.setAttribute('role','status');actions.append(cancel,apply);dialog.append(title,note,choices,list,hint,status,actions);document.body.append(dialog);let busy=false;
  function update(){
   const targets=selectedTargets(),count=targets.reduce((sum,target)=>sum+target.properties.length,0);note.textContent=count?'Apply '+count+' property values across '+targets.length+' selected '+targetLabel+(targets.length===1?'':'s')+'.':available.size?'Choose at least one property to paste.':'No copied properties are compatible with this selection.';
   for(const input of choices.querySelectorAll('input'))input.checked=chosen.has(input.dataset.propertyName);
   for(const row of previewRows){row.label.hidden=row.value.hidden=hideExcluded&&!chosen.has(row.name);row.label.classList.toggle('paste-property-excluded',!chosen.has(row.name));row.value.classList.toggle('paste-property-excluded',!chosen.has(row.name));}
   apply.disabled=busy||!count;chooseAll.disabled=chosen.size===available.size;chooseNone.disabled=!chosen.size;
  }
  update();cancel.onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{dialog.remove();const target=opener?.isConnected?opener:[...document.querySelectorAll('#panelBody button')].find(button=>button.textContent===actionLabel);target?.focus();});apply.onclick=async()=>{const targets=selectedTargets();if(busy||!targets.length)return;busy=true;choices.disabled=true;cancel.disabled=apply.disabled=true;status.textContent='Pasting properties…';try{await save(targets);dialog.close();}catch(error){status.textContent=error.message;}finally{busy=false;choices.disabled=false;cancel.disabled=false;update();}};dialog.showModal();(available.size?apply:cancel).focus();
 }
 root.RetouchComponentClipboard={validate,snapshot,match,copy,read,open,createTransport};
})(typeof window==='undefined'?globalThis:window);
