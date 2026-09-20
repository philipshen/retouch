(function(root){
 'use strict';
 root.RetouchComponentDefault={open({name,meta,save,opener}){
  if(document.querySelector('dialog[open]'))return;
  const dialog=document.createElement('dialog');dialog.className='component-library component-insert component-default';dialog.setAttribute('aria-label','Edit component default');
  const title=document.createElement('h2');title.textContent='Default for '+name;
  const note=document.createElement('p');note.textContent='Updates every instance that uses this default. Explicit instance overrides stay unchanged.';
  const form=document.createElement('form'),fields=document.createElement('fieldset'),label=document.createElement('label');label.textContent=name;
  const input=document.createElement(meta.choices?'select':meta.type==='string'?'textarea':'input');input.setAttribute('aria-label','Default value');
  if(meta.choices){for(const [index,value]of meta.choices.entries())input.add(new Option(String(value),String(index)));input.value=String(meta.choices.indexOf(meta.value));input.required=true;}
  else if(meta.type==='boolean'){input.type='checkbox';input.checked=meta.value;}
  else{input.value=String(meta.value);if(meta.type==='number'){input.type='number';input.step='any';input.required=true;}else{input.rows=3;input.maxLength=100000;}}
  label.append(input);fields.append(label);const status=document.createElement('p');status.setAttribute('role','status');
  const actions=document.createElement('div');actions.className='component-library-actions';const cancel=document.createElement('button'),submit=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';submit.type='submit';submit.textContent='Update default';cancel.className=submit.className='control-button';actions.append(cancel,submit);fields.append(actions);form.append(fields,status);dialog.append(title,note,form);document.body.append(dialog);let busy=false;
  cancel.onclick=()=>dialog.close();dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});dialog.addEventListener('close',()=>{dialog.remove();const target=opener?.isConnected?opener:[...document.querySelectorAll('button[aria-label]')].find(button=>button.getAttribute('aria-label')==='Edit default for '+name);target?.focus();});
  form.onsubmit=async event=>{event.preventDefault();if(busy||!form.reportValidity())return;const value=meta.choices?meta.choices[Number(input.value)]:meta.type==='boolean'?input.checked:meta.type==='number'?Number(input.value):input.value;if(meta.type==='number'&&!Number.isFinite(value))return;busy=true;fields.disabled=true;status.textContent='Updating default…';try{await save(value);dialog.close();}catch(error){status.textContent=error.message;}finally{busy=false;fields.disabled=false;}};
  dialog.showModal();input.focus();if(input.localName==='textarea'||input.type==='number')input.select();
 }};
})(window);
