(function(){
 'use strict';
 const I=RetouchInspector,open=document.createElement('button');open.type='button';open.textContent='Variables';document.getElementById('toolbar').append(open);
 const dialog=document.createElement('dialog');dialog.className='variable-library';dialog.setAttribute('aria-label','Variable collections');document.body.append(dialog);
 const heading=document.createElement('h2');heading.textContent='Variable collections';const close=I.button('Close variable collections',()=>dialog.close()),status=document.createElement('p'),body=document.createElement('fieldset');status.setAttribute('role','status');body.style.cssText='border:0;padding:0;min-width:0';dialog.append(heading,close,status,body);
 let library=null,collectionId='',variableId='',newType='color',busy=false,previewOpen=false,previewSerial=0;const previewModes={};
 const clone=value=>JSON.parse(JSON.stringify(value));
 const data=()=>({version:1,collections:clone(library.collections),variables:clone(library.variables)});
 const blank=type=>({color:'#2563eb',number:0,boolean:false,string:''})[type];
 async function run(action,message='Saved in this project.'){if(busy)return;busy=true;body.disabled=true;status.textContent='Working…';try{await action();render();status.textContent=message;}catch(error){status.textContent=error.message;}finally{busy=false;body.disabled=false;}}
 async function load(){await run(async()=>{library=await window.RetouchVariableLibraryRequest();},'Collections loaded.');}
 async function save(next){library=await window.RetouchVariableLibraryRequest({type:'replace',revision:library.revision,library:next});}
 function input(parent,label,value=''){const field=document.createElement('input');field.type='text';field.value=value;field.maxLength=120;I.field(parent,label,field);return field;}
 function modePreview(){
  const panel=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Preview variable modes';panel.append(summary);panel.open=previewOpen;panel.addEventListener('toggle',()=>{previewOpen=panel.open;if(panel.open)resolve();});
  I.note(panel,'Preview resolved values without changing the page or saved defaults. Choose each collection mode independently.');
  const message=I.note(panel,''),results=document.createElement('div');message.setAttribute('role','status');
  const selected={};for(const collection of library.collections){selected[collection.id]=collection.modes.some(mode=>mode.id===previewModes[collection.id])?previewModes[collection.id]:collection.defaultMode;I.select(panel,'Preview mode for '+collection.name,collection.modes.map(mode=>[mode.id,mode.name]),selected[collection.id],value=>{selected[collection.id]=value;previewModes[collection.id]=value;resolve();});}
  panel.append(message,results);
  async function resolve(){const serial=++previewSerial;results.replaceChildren();message.textContent='Resolving modes…';try{const resolved=await window.RetouchVariableModePreview({revision:library.revision,modes:{...selected}});if(serial!==previewSerial||!panel.isConnected)return;
   const table=document.createElement('table');table.className='variable-preview-table';table.setAttribute('aria-label','Resolved variable values');const header=document.createElement('tr');for(const title of ['Variable','Type','Value','Resolution path']){const cell=document.createElement('th');cell.textContent=title;cell.scope='col';header.append(cell);}table.append(header);
   for(const value of resolved.values){const variable=library.variables.find(item=>item.id===value.id),collection=library.collections.find(item=>item.id===variable.collectionId),row=document.createElement('tr');row.setAttribute('aria-label',collection.name+' / '+variable.name);
    const path=value.path.map(item=>{const variable=library.variables.find(v=>v.id===item.variableId),collection=library.collections.find(c=>c.id===item.collectionId);return collection.name+' / '+variable.name+' ('+collection.modes.find(mode=>mode.id===item.modeId).name+')';}).join(' → ');
    for(const text of [collection.name+' / '+variable.name,value.type,String(value.value),path]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}table.append(row);
   }results.append(table);message.textContent=resolved.values.length+' variables resolved.';
  }catch(error){if(serial===previewSerial&&panel.isConnected)message.textContent=error.message;}}
  if(panel.open)queueMicrotask(resolve);return panel;
 }
 function render(){
  previewSerial++;body.replaceChildren();body.append(I.button('Reload collections',load));if(!library)return;
  I.note(body,'Collections share typed variables across named modes. Definitions are saved to the project. In HTML projects, select a layer and open Collection bindings to apply variables and choose modes.');
  if(library.collections.length)body.append(modePreview());
  if(!library.collections.some(item=>item.id===collectionId))collectionId=library.collections[0]?.id||'';
  I.select(body,'Variable collection',[['','Choose a collection…'],...library.collections.map(item=>[item.id,item.name])],collectionId,value=>{collectionId=value;variableId='';render();});
  const create=input(body,'New collection name');body.append(I.button('Create collection',()=>run(async()=>{const next=data(),id=crypto.randomUUID(),mode=crypto.randomUUID();next.collections.push({id,name:create.value,defaultMode:mode,modes:[{id:mode,name:'Default'}]});await save(next);collectionId=id;variableId='';})));
  const collection=library.collections.find(item=>item.id===collectionId);if(!collection)return;
  const name=input(body,'Collection name',collection.name);body.append(I.button('Rename collection',()=>run(async()=>{const next=data();next.collections.find(item=>item.id===collectionId).name=name.value;await save(next);})),I.button('Delete collection',()=>run(async()=>{const next=data();next.collections=next.collections.filter(item=>item.id!==collectionId);next.variables=next.variables.filter(item=>item.collectionId!==collectionId);await save(next);})));
  const modes=document.createElement('details'),modeTitle=document.createElement('summary');modeTitle.textContent='Collection modes';modes.append(modeTitle);body.append(modes);
  for(const mode of collection.modes){const row=document.createElement('div'),label=input(row,'Mode name '+mode.name,mode.name);if(mode.id===collection.defaultMode)I.note(row,'Default mode');row.append(I.button('Rename mode '+mode.name,()=>run(async()=>{const next=data();next.collections.find(item=>item.id===collectionId).modes.find(item=>item.id===mode.id).name=label.value;await save(next);})),I.button('Use '+mode.name+' as default',()=>run(async()=>{const next=data();next.collections.find(item=>item.id===collectionId).defaultMode=mode.id;await save(next);})));
   const remove=I.button('Remove mode '+mode.name,()=>run(async()=>{const next=data(),target=next.collections.find(item=>item.id===collectionId);target.modes=target.modes.filter(item=>item.id!==mode.id);if(target.defaultMode===mode.id)target.defaultMode=target.modes[0].id;for(const variable of next.variables.filter(item=>item.collectionId===collectionId))delete variable.values[mode.id];await save(next);}));remove.disabled=collection.modes.length===1;row.append(remove);modes.append(row);}
  const modeName=input(modes,'New mode name');const addMode=I.button('Add mode',()=>run(async()=>{const next=data(),id=crypto.randomUUID();next.collections.find(item=>item.id===collectionId).modes.push({id,name:modeName.value});for(const variable of next.variables.filter(item=>item.collectionId===collectionId))variable.values[id]=clone(variable.values[collection.defaultMode]);await save(next);}));addMode.disabled=collection.modes.length>=16;modes.append(addMode);I.note(modes,'New modes copy the default values. Aliases keep their links.');
  const variables=library.variables.filter(item=>item.collectionId===collectionId);if(!variables.some(item=>item.id===variableId))variableId='';
  I.select(body,'Collection variable',[['','New variable…'],...variables.map(item=>[item.id,item.name])],variableId,value=>{variableId=value;render();});const variable=variables.find(item=>item.id===variableId),type=variable?.type||newType,variableName=input(body,'Collection variable name',variable?.name||'');
  const typePicker=I.select(body,'Variable type',['color','number','boolean','string'].map(value=>[value,value[0].toUpperCase()+value.slice(1)]),type,value=>{newType=value;render();});typePicker.disabled=!!variable;
  const readers={};
  for(const mode of collection.modes){const row=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=mode.name;row.append(legend);body.append(row);let current=variable?.values[mode.id]??blank(type);const editor=document.createElement('div');
   function valueEditor(kind){editor.replaceChildren();if(kind==='alias'){const options=library.variables.filter(item=>item.type===type&&(item.id!==variableId||typeof current==='object'&&item.id===current.alias)).map(item=>[item.id,library.collections.find(c=>c.id===item.collectionId).name+' / '+item.name]),pick=I.select(editor,mode.name+' alias',[['','Choose a variable…'],...options],typeof current==='object'?current.alias:'',()=>{});readers[mode.id]=()=>({alias:pick.value});}
    else if(type==='boolean'){const pick=I.select(editor,mode.name+' value',[['false','False'],['true','True']],String(typeof current==='boolean'?current:false),()=>{});readers[mode.id]=()=>pick.value==='true';}
    else{const field=input(editor,mode.name+' value',typeof current==='object'?blank(type):current);field.maxLength=type==='string'?4096:150;if(type==='number'){field.type='number';field.step='any';}readers[mode.id]=()=>{if(type==='number'&&field.value.trim()==='')throw Error('Enter a number for '+mode.name+'.');return type==='number'?Number(field.value):field.value;};}}
   I.select(row,mode.name+' value source',[['literal','Value'],['alias','Alias']],typeof current==='object'?'alias':'literal',valueEditor);row.append(editor);valueEditor(typeof current==='object'?'alias':'literal');
  }
  body.append(I.button('Save collection variable',()=>run(async()=>{const next=data(),id=variable?.id||crypto.randomUUID(),entry={id,collectionId,name:variableName.value,type,values:Object.fromEntries(collection.modes.map(mode=>[mode.id,readers[mode.id]()]))},index=next.variables.findIndex(item=>item.id===id);if(index<0)next.variables.push(entry);else next.variables[index]=entry;await save(next);variableId=id;})));
  if(variable)body.append(I.button('Delete collection variable',()=>run(async()=>{const next=data();next.variables=next.variables.filter(item=>item.id!==variable.id);await save(next);variableId='';})));
 }
 open.addEventListener('click',()=>{dialog.showModal();load();});
})();
