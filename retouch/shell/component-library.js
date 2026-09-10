'use strict';
window.RetouchComponentLibrary={open({read,instances,select,view,insert,insertTarget}){
 const dialog=document.createElement('dialog');dialog.className='component-library';dialog.setAttribute('aria-label','Project components');
 const header=document.createElement('header'),title=document.createElement('h2');title.textContent='Project components';
 const button=(label,action)=>{const result=document.createElement('button');result.type='button';result.className='control-button';result.textContent=label;result.addEventListener('click',action);return result;};
 header.append(title,button('Close',()=>dialog.close()));
 const description=document.createElement('p');description.textContent='Browse exported, created and reused components in your project.';
 if(insert)description.textContent+=' '+(insertTarget?'Insert into '+insertTarget.label+'.':'Select a frame on the canvas to insert a component.');
 const tools=document.createElement('div');tools.className='component-library-tools';
 const search=document.createElement('input');search.type='search';search.placeholder='Find by name or file…';search.setAttribute('aria-label','Search project components');
 const refresh=button('Refresh',load);tools.append(search,refresh);
 const status=document.createElement('p');status.setAttribute('role','status');
 const list=document.createElement('ul');list.className='component-library-list';
 dialog.append(header,description,tools,status,list);document.body.append(dialog);
 let data,serial=0;
 function render(){
  list.replaceChildren();if(!data)return;
  const query=search.value.trim().toLowerCase(),rows=data.components.filter(item=>[item.file,...item.names].some(value=>value.toLowerCase().includes(query)));
  status.textContent=rows.length?rows.length+' component'+(rows.length===1?'':'s')+(query?' match':'')+'.':query?'No components match.':'No reusable components found. Create a component from a selected layer to add one.';
  if(data.truncated)status.textContent+=' Showing the first 2,000 of '+data.total+'.';if(data.unreadableFiles)status.textContent+=' '+data.unreadableFiles+' source files could not be read.';
  for(const item of rows){
   const row=document.createElement('li');row.setAttribute('aria-label',item.name+' · '+item.file);
   const name=document.createElement('h3');name.textContent=item.name;const file=document.createElement('p');file.className='filepath';file.textContent=item.file;
   const present=instances(item),count=document.createElement('p');count.textContent=(item.usageCount?item.usageCount+' source usage'+(item.usageCount===1?'':'s'):'No authored usages')+' · '+(present.length?present.length+' on this page':'Not found on this page');
   const actions=document.createElement('div');actions.className='component-library-actions';
   let picker;if(present.length>1){picker=document.createElement('select');picker.setAttribute('aria-label','Instance of '+item.name);present.forEach((instance,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent='Instance '+(index+1)+' · '+instance.label;picker.append(option);});actions.append(picker);}
   const choose=button('Select on canvas',async()=>{choose.disabled=true;try{await select(present[Number(picker?.value||0)],()=>dialog.isConnected);if(dialog.isConnected)dialog.close();}catch(error){status.textContent=error.message;choose.disabled=false;}});choose.disabled=!present.length;actions.append(choose);
   const source=button('View component',async()=>{source.disabled=true;try{const instance=present[Number(picker?.value||0)];await view(instance?.id||item.usages[0]?.id||item.definitionId,!!instance,()=>dialog.isConnected,instance?.definition===true||!item.usages.length);if(dialog.isConnected)dialog.close();}catch(error){status.textContent=error.message;}finally{source.disabled=false;}});actions.append(source);
   if(insert){const add=button('Insert into frame',async()=>{add.disabled=true;try{const inserted=await insert(item,insertTarget,()=>dialog.isConnected);if(inserted!==false&&dialog.isConnected)dialog.close();}catch(error){status.textContent=error.message;}finally{add.disabled=!insertTarget;}});add.disabled=!insertTarget;actions.append(add);}
   row.append(name,file,count,actions);list.append(row);
  }
 }
 async function load(){const request=++serial;refresh.disabled=true;status.textContent='Loading project components…';try{const result=await read();if(request!==serial||!dialog.isConnected)return;if(!result?.ok)throw Error(result?.reason||'Could not load project components.');data=result;render();}catch(error){if(request===serial&&dialog.isConnected)status.textContent=error.message;}finally{if(request===serial)refresh.disabled=false;}}
 search.addEventListener('input',render);search.addEventListener('keydown',event=>{if(event.key==='Escape'&&search.value){event.preventDefault();event.stopPropagation();search.value='';render();}});
 dialog.addEventListener('close',()=>{serial++;dialog.remove();});dialog.showModal();search.focus();load();return dialog;
}};

// Ask only for required values; optional properties retain the component defaults.
window.RetouchComponentLibrary.configure=({component,target,submit})=>new Promise(resolve=>{
 const dialog=document.createElement('dialog');dialog.className='component-library component-insert';dialog.setAttribute('aria-label','Insert '+component.name);
 const heading=document.createElement('h2');heading.textContent='Insert '+component.name;
 const note=document.createElement('p');note.textContent='Set the required properties. Optional properties keep their defaults.';
 const form=document.createElement('form'),fields=document.createElement('fieldset'),status=document.createElement('p');status.setAttribute('role','alert');
 const controls=[],required=component.insertion.properties.filter(prop=>prop.required);let busy=false,complete=false;
 for(const prop of required){
  const label=document.createElement('label'),title=document.createElement('span');title.textContent=prop.name;label.append(title);
  if(!prop.supported){const reason=document.createElement('small');reason.textContent='This property needs a value this editor cannot create yet.';label.append(reason);fields.append(label);continue;}
  const choices=prop.choices||(prop.type==='boolean'?[true,false]:null),input=document.createElement(choices?'select':prop.type==='string'?'textarea':'input');input.setAttribute('aria-label','Initial property '+prop.name);
  if(choices){const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose…';placeholder.disabled=true;placeholder.selected=true;input.append(placeholder);choices.forEach((value,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=String(value);input.append(option);});input.required=true;}
  else if(prop.type==='number'){input.type='number';input.step='any';input.required=true;}else input.rows=2;
  label.append(input);fields.append(label);controls.push({prop,input,choices});
 }
 const actions=document.createElement('div');actions.className='component-library-actions';const cancel=document.createElement('button'),save=document.createElement('button');cancel.type='button';cancel.className=save.className='control-button';cancel.textContent='Cancel';save.type='submit';save.textContent='Insert component';save.disabled=required.some(prop=>!prop.supported);cancel.onclick=()=>dialog.close();actions.append(cancel,save);fields.append(actions);form.append(fields,status);dialog.append(heading,note,form);document.body.append(dialog);
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy||save.disabled)return;const props={};for(const {prop,input,choices} of controls){const value=choices?choices[Number(input.value)]:prop.type==='number'?Number(input.value):input.value;if(prop.type==='number'&&!Number.isFinite(value)){status.textContent='Enter a finite number for '+prop.name+'.';return;}Object.defineProperty(props,prop.name,{value,enumerable:true});}
  busy=true;fields.disabled=true;status.textContent='Inserting…';try{const result=await submit(props);if(result!==false){complete=true;dialog.close();}}catch(error){status.textContent=error.message;}finally{busy=false;fields.disabled=false;}
 });
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});dialog.addEventListener('close',()=>{dialog.remove();resolve(complete);});dialog.showModal();controls[0]?.input.focus();
});
