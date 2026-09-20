(function(root){
 'use strict';
 const format='retouch/component-properties@1';let copied=null,localOnly=false;
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
 async function copy(component){const payload=snapshot(component),text=JSON.stringify(payload);copied=payload;localOnly=true;try{await clipboardCall(()=>navigator.clipboard.writeText(text));localOnly=false;return {count:payload.properties.length,system:true};}catch{return {count:payload.properties.length,system:false};}}
 async function read(){if(localOnly&&copied)return copied;let text;try{text=await clipboardCall(()=>navigator.clipboard.readText());}catch{if(copied)return copied;throw Error('Clipboard access is unavailable. Copy properties in this editor first.');}return validate(text);}
 async function open({components,infos,save,opener}){
  if(document.querySelector('dialog[open]'))return;
  const payload=await read();if(document.querySelector('dialog[open]'))return;
  const matches=components.map(component=>match(component,payload)),targets=matches.flatMap((result,i)=>result.accepted.length?[{id:infos[i].id,properties:result.accepted}]:[]),count=targets.reduce((sum,t)=>sum+t.properties.length,0);
  const dialog=document.createElement('dialog');dialog.className='component-library component-insert component-property-paste';dialog.setAttribute('aria-label','Paste component properties');
  const title=document.createElement('h2');title.textContent='Paste properties';const note=document.createElement('p');note.textContent=count?'Apply '+count+' property values across '+targets.length+' selected instance'+(targets.length===1?'':'s')+'.':'No copied properties are compatible with this selection.';
  const list=document.createElement('ul');list.setAttribute('aria-label','Property paste preview');components.forEach((component,i)=>{
   const item=document.createElement('li'),result=matches[i],name=document.createElement('strong');name.textContent=component.name+(components.length>1?' '+(i+1):'');item.append(name);
   if(result.accepted.length){const values=document.createElement('dl');for(const property of result.accepted){const label=document.createElement('dt'),value=document.createElement('dd');label.textContent=property.name;const text=property.unset?'Not set':typeof property.value==='boolean'?(property.value?'On':'Off'):property.value===''?'Empty text':String(property.value);value.textContent=text.length>120?text.slice(0,117)+'…':text;values.append(label,value);}item.append(values);}
   else{const empty=document.createElement('p');empty.textContent='No compatible properties';item.append(empty);}
   if(result.skipped.length){const skipped=document.createElement('p');skipped.textContent='Skipped: '+result.skipped.join(', ');item.append(skipped);}list.append(item);
  });
  const hint=document.createElement('p');hint.textContent='Copied values become instance overrides. Unlisted properties and expression bindings stay unchanged.';
  const actions=document.createElement('div');actions.className='component-library-actions';const cancel=document.createElement('button'),apply=document.createElement('button'),status=document.createElement('p');cancel.textContent='Cancel';apply.textContent='Paste properties';cancel.className=apply.className='control-button';apply.disabled=!count;status.setAttribute('role','status');actions.append(cancel,apply);dialog.append(title,note,list,hint,status,actions);document.body.append(dialog);let busy=false;
  cancel.onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{dialog.remove();const target=opener?.isConnected?opener:[...document.querySelectorAll('#panelBody button')].find(button=>button.textContent==='Paste properties');target?.focus();});apply.onclick=async()=>{if(busy||!count)return;busy=true;cancel.disabled=apply.disabled=true;status.textContent='Pasting properties…';try{await save(targets);dialog.close();}catch(error){status.textContent=error.message;}finally{busy=false;cancel.disabled=false;apply.disabled=!count;}};dialog.showModal();(count?apply:cancel).focus();
 }
 root.RetouchComponentClipboard={validate,snapshot,match,copy,read,open};
})(typeof window==='undefined'?globalThis:window);
