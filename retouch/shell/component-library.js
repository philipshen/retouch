'use strict';
window.RetouchComponentLibrary={open({read,instances,select,view}){
 const dialog=document.createElement('dialog');dialog.className='component-library';dialog.setAttribute('aria-label','Project components');
 const header=document.createElement('header'),title=document.createElement('h2');title.textContent='Project components';
 const button=(label,action)=>{const result=document.createElement('button');result.type='button';result.className='control-button';result.textContent=label;result.addEventListener('click',action);return result;};
 header.append(title,button('Close',()=>dialog.close()));
 const description=document.createElement('p');description.textContent='Browse exported, created and reused components in your project.';
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
   row.append(name,file,count,actions);list.append(row);
  }
 }
 async function load(){const request=++serial;refresh.disabled=true;status.textContent='Loading project components…';try{const result=await read();if(request!==serial||!dialog.isConnected)return;if(!result?.ok)throw Error(result?.reason||'Could not load project components.');data=result;render();}catch(error){if(request===serial&&dialog.isConnected)status.textContent=error.message;}finally{if(request===serial)refresh.disabled=false;}}
 search.addEventListener('input',render);search.addEventListener('keydown',event=>{if(event.key==='Escape'&&search.value){event.preventDefault();event.stopPropagation();search.value='';render();}});
 dialog.addEventListener('close',()=>{serial++;dialog.remove();});dialog.showModal();search.focus();load();return dialog;
}};
