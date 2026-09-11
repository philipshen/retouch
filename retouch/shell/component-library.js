'use strict';
window.RetouchComponentLibrary={open({read,instances,select,view,insert,insertTarget,swapTarget}){
 const dialog=document.createElement('dialog');dialog.className='component-library';dialog.setAttribute('aria-label','Project components');
 const header=document.createElement('header'),title=document.createElement('h2');title.textContent='Project components';
 const button=(label,action)=>{const result=document.createElement('button');result.type='button';result.className='control-button';result.textContent=label;result.addEventListener('click',action);return result;};
 header.append(title,button('Close',()=>dialog.close()));
 const description=document.createElement('p');description.textContent='Browse exported, created and reused components in your project.';
 if(insert)description.textContent+=' '+(swapTarget?'Swap the selected instance, or select a frame to insert.':insertTarget?'Insert into '+insertTarget.label+'.':'Select a frame on the canvas to insert a component.');
 const tools=document.createElement('div');tools.className='component-library-tools';
 const search=document.createElement('input');search.type='search';search.placeholder='Find component, layer name or file…';search.setAttribute('aria-label','Search project components');
 const refresh=button('Refresh',load);tools.append(search,refresh);
 const status=document.createElement('p');status.setAttribute('role','status');
 const list=document.createElement('ul');list.className='component-library-list';
 const hint=document.createElement('p');hint.className='component-library-keyhint';hint.textContent='↑↓ Browse · ←→ Actions · Esc Search';
 dialog.append(header,description,tools,status,list,hint);document.body.append(dialog);
 let data,serial=0;
 function render(){
  list.replaceChildren();if(!data)return;
  const query=search.value.trim().toLowerCase(),matches=value=>typeof value==='string'&&value.toLowerCase().includes(query),usageMatches=usage=>[usage.layerName,usage.file].some(matches),rows=data.components.filter(item=>[item.file,...item.names].some(matches)||item.usages.some(usageMatches));
  status.textContent=rows.length?rows.length+' component'+(rows.length===1?'':'s')+(query?' match':'')+'.':query?'No components match.':'No reusable components found. Create a component from a selected layer to add one.';
  if(data.truncated)status.textContent+=' Showing the first 2,000 of '+data.total+'.';if(data.unreadableFiles)status.textContent+=' '+data.unreadableFiles+' source files could not be read.';
  for(const item of rows){
   const row=document.createElement('li');row.setAttribute('aria-label',item.name+' · '+item.file);
   const name=document.createElement('h3');name.textContent=item.name;const file=document.createElement('p');file.className='filepath';file.textContent=item.file;
   const allPresent=instances(item),matchingIds=new Set(item.usages.filter(usageMatches).map(usage=>usage.id)),usageSearch=query&&![item.file,...item.names].some(matches),present=usageSearch?allPresent.filter(instance=>matchingIds.has(instance.id)):allPresent,count=document.createElement('p');count.textContent=(item.usageCount?item.usageCount+' source usage'+(item.usageCount===1?'':'s'):'No authored usages')+' · '+(allPresent.length?allPresent.length+' on this page':'Not found on this page')+(usageSearch?' · '+present.length+' matching on this page':'');
   const actions=document.createElement('div');actions.className='component-library-actions';
   const matchedUsage=query?item.usages.find(usageMatches):null,preferred=query?present.findIndex(instance=>matches(instance.label)||instance.id===matchedUsage?.id):0;
   let picker;if(present.length>1){picker=document.createElement('select');picker.setAttribute('aria-label','Instance of '+item.name);present.forEach((instance,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=(instance.complete===false?'Rendered layer ':'Instance ')+(index+1)+' · '+instance.label;picker.append(option);});picker.value=String(Math.max(0,preferred));actions.append(picker);}else if(present[0]?.layerName||!present.length&&matchedUsage?.layerName){const label=document.createElement('p');label.textContent=present[0]?.layerName||matchedUsage.layerName;actions.append(label);}
   const choose=button('Select on canvas',async()=>{choose.disabled=true;try{await select(present[Number(picker?.value||0)],()=>dialog.isConnected);if(dialog.isConnected)dialog.close();}catch(error){status.textContent=error.message;choose.disabled=false;}});choose.disabled=!present.length;actions.append(choose);
   const source=button('View component',async()=>{source.disabled=true;try{const instance=present[Number(picker?.value||0)];await view(instance?.id||matchedUsage?.id||item.usages[0]?.id||item.definitionId,!!instance,()=>dialog.isConnected,instance?.definition===true||!item.usages.length,instance?.element);if(dialog.isConnected)dialog.close();}catch(error){status.textContent=error.message;}finally{source.disabled=false;}});actions.append(source);
   if(insert){const add=button('Insert into frame',async()=>{add.disabled=true;try{const inserted=await insert(item,insertTarget,()=>dialog.isConnected);if(inserted!==false&&dialog.isConnected)dialog.close();}catch(error){status.textContent=error.message;}finally{add.disabled=!insertTarget;}});add.disabled=!insertTarget;actions.append(add);}
   if(insert&&swapTarget){const swap=button('Swap selected instance',async()=>{swap.disabled=true;try{const changed=await insert(item,swapTarget,()=>dialog.isConnected);if(changed!==false&&dialog.isConnected)dialog.close();}catch(error){status.textContent=error.message;}finally{swap.disabled=item.definitionId===swapTarget.definitionId;}});swap.disabled=item.definitionId===swapTarget.definitionId;actions.append(swap);}
   row.append(name,file,count,actions);list.append(row);
  }
 }
 async function load(){const request=++serial;refresh.disabled=true;status.textContent='Loading project components…';try{const result=await read();if(request!==serial||!dialog.isConnected)return;if(!result?.ok)throw Error(result?.reason||'Could not load project components.');data=result;render();}catch(error){if(request===serial&&dialog.isConnected)status.textContent=error.message;}finally{if(request===serial)refresh.disabled=false;}}
 const buttons=row=>[...row.querySelectorAll('button')].filter(button=>!button.disabled&&!button.hidden);
 search.addEventListener('keydown',event=>{if(event.isComposing||!['ArrowDown','ArrowUp'].includes(event.key))return;const rows=[...list.children].filter(row=>buttons(row).length);if(!rows.length)return;event.preventDefault();buttons(event.key==='ArrowDown'?rows[0]:rows.at(-1))[0]?.focus();});
 list.addEventListener('keydown',event=>{
  if(event.isComposing||event.altKey||event.ctrlKey||event.metaKey||!event.target.matches('button'))return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();search.focus();return;}
  if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const rows=[...list.children].filter(row=>buttons(row).length),row=event.target.closest('li'),index=rows.indexOf(row);if(index<0)return;event.preventDefault();
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){const actions=buttons(row),next=Math.max(0,Math.min(actions.length-1,actions.indexOf(event.target)+(event.key==='ArrowRight'?1:-1)));actions[next]?.focus();return;}
  if(event.key==='ArrowUp'&&index===0){search.focus();return;}
  const next=event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(event.key==='ArrowDown'?1:-1))),actions=buttons(rows[next]);(actions.find(button=>button.textContent===event.target.textContent)||actions[0])?.focus();
 });
 search.addEventListener('input',render);search.addEventListener('keydown',event=>{if(event.key==='Escape'&&search.value){event.preventDefault();event.stopPropagation();search.value='';render();}});
 dialog.addEventListener('close',()=>{serial++;dialog.remove();});dialog.showModal();search.focus();load();return dialog;
}};

// Ask only for required values; optional properties retain the component defaults.
window.RetouchComponentLibrary.configure=({component,target,submit,initial={},removed=[],mode='insert'})=>new Promise(resolve=>{
 const swapping=mode==='swap',title=(swapping?'Swap to ':'Insert ')+component.name;
 const dialog=document.createElement('dialog');dialog.className='component-library component-insert';dialog.setAttribute('aria-label',title);
 const heading=document.createElement('h2');heading.textContent=title;
 const note=document.createElement('p');note.textContent=swapping?'Compatible overrides are kept. Other properties use the new component defaults.'+(Object.keys(initial).length?' Kept: '+Object.keys(initial).join(', ')+'.':'')+(removed.length?' Removed overrides: '+removed.join(', ')+'.':''):'Set the required properties. Optional properties keep their defaults.';
 const form=document.createElement('form'),fields=document.createElement('fieldset'),status=document.createElement('p');status.setAttribute('role','alert');
 const controls=[],required=component.insertion.properties.filter(prop=>prop.required&&!Object.hasOwn(initial,prop.name));let busy=false,complete=false;
 for(const prop of required){
  const label=document.createElement('label'),title=document.createElement('span');title.textContent=prop.name;label.append(title);
  if(!prop.supported){const reason=document.createElement('small');reason.textContent='This property needs a value this editor cannot create yet.';label.append(reason);fields.append(label);continue;}
  const choices=prop.choices||(prop.type==='boolean'?[true,false]:null),input=document.createElement(choices?'select':prop.type==='string'?'textarea':'input');input.setAttribute('aria-label','Initial property '+prop.name);
  if(choices){const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose…';placeholder.disabled=true;placeholder.selected=true;input.append(placeholder);choices.forEach((value,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=String(value);input.append(option);});input.required=true;}
  else if(prop.type==='number'){input.type='number';input.step='any';input.required=true;}else input.rows=2;
  label.append(input);fields.append(label);controls.push({prop,input,choices});
 }
 const actions=document.createElement('div');actions.className='component-library-actions';const cancel=document.createElement('button'),save=document.createElement('button');cancel.type='button';cancel.className=save.className='control-button';cancel.textContent='Cancel';save.type='submit';save.textContent=swapping?'Swap component':'Insert component';save.disabled=required.some(prop=>!prop.supported);cancel.onclick=()=>dialog.close();actions.append(cancel,save);fields.append(actions);form.append(fields,status);dialog.append(heading,note,form);document.body.append(dialog);
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy||save.disabled)return;const props={...initial};for(const {prop,input,choices} of controls){const value=choices?choices[Number(input.value)]:prop.type==='number'?Number(input.value):input.value;if(prop.type==='number'&&!Number.isFinite(value)){status.textContent='Enter a finite number for '+prop.name+'.';return;}Object.defineProperty(props,prop.name,{value,enumerable:true});}
  busy=true;fields.disabled=true;status.textContent=swapping?'Swapping…':'Inserting…';try{const result=await submit(props);if(result!==false){complete=true;dialog.close();}}catch(error){status.textContent=error.message;}finally{busy=false;fields.disabled=false;}
 });
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});dialog.addEventListener('close',()=>{dialog.remove();resolve(complete);});dialog.showModal();controls[0]?.input.focus();
});
