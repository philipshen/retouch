(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./html-css-values.js'),require('./responsive.js'),require('./inspector.js'));else root.RetouchCollectionBindings=factory(root.RetouchHTMLCSSValues,root.RetouchResponsive,root.RetouchInspector);})(typeof globalThis!=='undefined'?globalThis:this,function(V,R,I){
 'use strict';
 let expanded=false,target='color',draft=null;
 const controllers=new WeakMap();
 const paints=['color','background-color','border-color','fill','stroke'],numbers=['width','height','min-width','max-width','min-height','max-height','gap','padding','margin','font-size','letter-spacing','border-width','border-radius','opacity','font-weight','line-height','flex-grow','flex-shrink',...['top','right','bottom','left'].flatMap(side=>['padding-'+side,'margin-'+side]),...['top-left','top-right','bottom-left','bottom-right'].map(corner=>'border-'+corner+'-radius')];
 const unitless=['opacity','font-weight','line-height','flex-grow','flex-shrink'];
 // Track the nearest contributing managed screen scope, not just the nearest link.
 function inherited(info,width,property,ignoreOwn=false){
  if(!Number.isInteger(width)||width<=0)return null;
  const links=info.variableLinks||{},rules=info.cssRules||{},scopes=[...new Set([...Object.keys(links),...Object.keys(rules)])].map(Number).filter(w=>Number.isInteger(w)&&w>=0&&w<=width).sort((a,b)=>b-a);
  for(const scope of scopes){
   const keys=Object.keys(rules[scope]||{}).filter(key=>!(ignoreOwn&&scope===width&&key===property)),current=scope===width&&ignoreOwn?null:links[scope]?.[property];
   if(scope<width&&current)return {link:current,width:scope,label:scope?scope+'px and larger':'All sizes',override:!!(info.variableOverrides?.[scope]?.includes(property)||keys.some(key=>key!==property&&V.overlaps(key,property)))};
   if(current||keys.some(key=>V.overlaps(key,property)))return null;
  }
  return null;
 }
 function classInherited(info,scope,property,document,ignoreOwn=false,choices=null){
  const candidates={};
  for(const [key,group]of Object.entries(info.variableLinks||{})){if(group[property]&&!(ignoreOwn&&key===scope))candidates[key]={binding:group[property],override:!!info.variableOverrides?.[key]?.includes(property)};}
  for(const token of (info.className||'').split(/\s+/).filter(Boolean)){
   const part=R.split(token);if(!/^!|!$/.test(part.value))continue;
   const declaration=/^\[([a-z-]+|--[a-zA-Z0-9_-]+):/.exec(I.base(part.value)||'')?.[1];
   if(ignoreOwn&&part.prefix===scope&&declaration===property)continue;
   if(declaration&&(declaration.startsWith('--')||!V.overlaps(declaration,property)))continue;
   if(candidates[part.prefix]?.binding){if(declaration!==property)candidates[part.prefix].override=true;}
   else candidates[part.prefix]={blocked:true};
  }
  const result=R.inheritedLink(candidates,scope,document,choices);return result&&!result.link.blocked?{scope:result.scope,label:result.label,link:result.link.binding,override:result.link.override}:null;
 }
 function mount(parent,input,width,write,options={}){
  const selection=Array.isArray(input)?input:[input],info=selection[0],multiple=selection.length>1;
  const I=RetouchInspector,details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Collection bindings';details.append(summary);parent.append(details);details.open=expanded;
  const status=I.note(details,''),controls=document.createElement('fieldset');status.setAttribute('role','status');controls.style.cssText='border:0;padding:0;margin:0;min-width:0';details.append(controls);
  let library=null,values=[],selected='',modes={},unit='',busy=false,loadPromise=null;
  const inherit=(property,ignoreOwn=false)=>options.inherited?options.inherited(property,ignoreOwn):inherited(info,width,property,ignoreOwn);
  const ownLinks=()=>selection.map(item=>item.variableLinks?.[width]?.[target]);
  const link=()=>{const links=ownLinks();return links[0]&&links.every(item=>JSON.stringify(item)===JSON.stringify(links[0]))?links[0]:null;};
  const draftKey=()=>JSON.stringify([width,target,selection.map(item=>[item.id,item.file,item.hash,item.context||null])]);
  const remember=()=>{draft={key:draftKey(),selected,modes:{...modes},unit};};
  const writeBinding=async(...args)=>{await write(...args);draft=null;};
  const init=()=>{const current=link()||(!multiple&&inherit(target)?.link);selected=current?.id||'';modes={...current?.modes};unit=current?.unit??(unitless.includes(target)?'':'px');if(draft?.key===draftKey()){selected=draft.selected;modes={...draft.modes};unit=draft.unit;}};init();
  async function run(action){if(busy)return;busy=true;controls.disabled=true;status.textContent='Working…';try{await action();if(details.isConnected){render();status.textContent='';}}catch(error){values=[];if(details.isConnected){render();status.textContent=error.message;}}finally{busy=false;controls.disabled=false;}}
  const preview=async()=>{values=[];if(selected)values=(await RetouchVariableModePreview({revision:library.revision,modes,variableId:selected})).values;};
  const load=()=>loadPromise||(loadPromise=run(async()=>{library=await RetouchVariableLibraryRequest();await preview();}).finally(()=>{loadPromise=null;}));
  function browse(choices,type,trigger){
   const pickerModes={...modes},context=draftKey(),current=()=>[...document.querySelectorAll('[data-variable-picker-context]')].some(node=>node.dataset.variablePickerContext===context);
   const dialog=document.createElement('dialog');dialog.className='variable-picker';dialog.setAttribute('aria-label','Apply variable');
   const header=document.createElement('header'),title=document.createElement('h2');title.textContent='Apply variable';const close=I.button('Close variable picker',()=>dialog.close());close.textContent='×';close.setAttribute('aria-label','Close variable picker');header.append(title,close);
   const search=document.createElement('input');search.type='search';search.placeholder='Search variables';search.setAttribute('aria-label','Search variables');
   const scope=I.note(dialog,(new Map(V.fields).get(target)||target)+' · '+(options.scopeLabel||(width?width+'px and larger':'All sizes'))),results=document.createElement('div'),message=I.note(dialog,'');results.className='variable-picker-results';message.setAttribute('role','status');
   const modeControls=document.createElement('fieldset');modeControls.className='variable-picker-modes';const legend=document.createElement('legend');legend.textContent='Variable modes';modeControls.append(legend);
   for(const collection of library.collections){if(collection.modes.length<2)continue;const mode=I.select(modeControls,'Picker mode for '+collection.name,[['','Default · '+collection.modes.find(item=>item.id===collection.defaultMode).name],...collection.modes.map(item=>[item.id,item.name])],pickerModes[collection.id]||'',value=>{if(value)pickerModes[collection.id]=value;else delete pickerModes[collection.id];message.textContent='';list();});mode.closest('label').querySelector('span').textContent=collection.name;}
   modeControls.hidden=modeControls.children.length===1;
   const bindingActions=document.createElement('fieldset');bindingActions.className='variable-picker-binding';const bindingTitle=document.createElement('legend');bindingTitle.textContent='Current binding';bindingActions.append(bindingTitle);
   const bound=ownLinks().filter(Boolean).length,from=multiple?null:inherit(target),currentLink=link()||from?.link,variable=library.variables.find(item=>item.id===currentLink?.id),collection=library.collections.find(item=>item.id===variable?.collectionId);
   const state=I.note(bindingActions,multiple?bound+' of '+selection.length+' layers bound in this scope'+(bound&&!link()?' · Mixed bindings':''):currentLink?(collection?collection.name+' / ':'')+(variable?.name||'Missing variable')+(from?' · Inherited from '+from.label:'')+(info.variableOverrides?.[width]?.includes(target)||from?.override?' · Local override':''):'No variable bound in this scope');state.className='variable-picker-binding-state';
   async function bindingAction(type){if(applying)return;if(!dialog.open||!current()){dialog.close();return;}applying=true;search.disabled=true;modeControls.disabled=bindingActions.disabled=true;for(const row of results.querySelectorAll('button'))row.disabled=true;message.textContent='Updating binding…';try{await writeBinding(type,width,{property:target,...(type==='resetVariable'?{libraryRevision:library.revision}:{})});dialog.close();}catch(error){message.textContent=error.message;}finally{applying=false;search.disabled=false;modeControls.disabled=bindingActions.disabled=false;for(const row of results.querySelectorAll('button'))row.disabled=false;}}
   if(bound){const actions=document.createElement('div');actions.className='variable-picker-binding-actions';const reset=I.button('Reset binding',()=>bindingAction('resetVariable'));reset.title='Restore each layer’s existing variable and mode values.';const detach=I.button('Detach binding',()=>bindingAction('detachVariable'));detach.title='Keep the current appearance and remove the variable link in this scope.';actions.append(reset,detach);if(!multiple&&inherit(target,true)){const fallback=I.button('Use smaller-screen binding',()=>bindingAction('removeVariable'));fallback.title='Remove this scope’s binding and override to reveal the smaller-screen value.';actions.append(fallback);}bindingActions.append(actions);}
   bindingActions.hidden=!bound&&!from;
   dialog.replaceChildren(header,search,scope,bindingActions,modeControls,results,message);document.body.append(dialog);let applying=false,previewTimer=null,previewSerial=0;
   function list(){
    results.replaceChildren();clearTimeout(previewTimer);const serial=++previewSerial,previewRows=new Map(),query=search.value.trim().toLocaleLowerCase();let count=0,total=0;
    for(const collection of library.collections){const matches=choices.filter(variable=>variable.collectionId===collection.id&&(collection.name+' / '+variable.name).toLocaleLowerCase().includes(query));total+=matches.length;if(!matches.length||count>=100)continue;
     const group=document.createElement('section'),heading=document.createElement('h3');heading.textContent=collection.name;group.append(heading);
     for(const variable of matches.slice(0,100-count)){const button=I.button('Apply '+collection.name+' / '+variable.name,async()=>{
      if(applying)return;if(!dialog.open||!current()){dialog.close();return;}applying=true;search.disabled=true;modeControls.disabled=bindingActions.disabled=true;for(const row of results.querySelectorAll('button'))row.disabled=true;message.textContent='Applying…';
      try{const result=await RetouchVariableModePreview({revision:library.revision,modes:{...pickerModes},variableId:variable.id}),resolved=result.values.find(item=>item.id===variable.id);if(!resolved)throw Error('This variable could not be resolved.');const value=type==='boolean'?(resolved.value?'visible':'hidden'):String(resolved.value)+(type==='number'?unit:'');if(!V.valid(target,value))throw Error('This variable cannot control the selected property. Choose another variable or unit.');if(!dialog.open||!current()){dialog.close();return;}
       await writeBinding('applyVariable',width,{property:target,libraryRevision:library.revision,binding:{id:variable.id,modes:{...pickerModes},...(type==='number'?{unit}:{})}});dialog.close();
      }catch(error){message.textContent=error.message;}finally{applying=false;search.disabled=false;modeControls.disabled=bindingActions.disabled=false;for(const row of results.querySelectorAll('button'))row.disabled=false;}
     });button.classList.add('variable-picker-option');button.setAttribute('aria-label','Apply '+collection.name+' / '+variable.name);button.setAttribute('aria-pressed',String(variable.id===selected));const icon=document.createElement('span');icon.className='variable-picker-type';icon.textContent={color:'◈',number:'#',boolean:'◐',string:'T'}[type];icon.setAttribute('aria-hidden','true');const name=document.createElement('span');name.textContent=variable.name;name.className='variable-picker-name';const value=document.createElement('span');value.className='variable-picker-value';value.textContent='…';button.setAttribute('aria-description','Resolving value');button.replaceChildren(icon,name,value);previewRows.set(variable.id,{button,icon,value});group.append(button);count++;}results.append(group);
    }if(!count)I.note(results,'No matching '+type+' variables.');if(total>count)I.note(results,'Showing '+count+' of '+total+' variables. Refine your search to see more.');
    if(count)previewTimer=setTimeout(async()=>{
     try{const response=await RetouchVariableModePreview({revision:library.revision,modes:{...pickerModes},variableIds:[...previewRows.keys()]});if(!dialog.open||serial!==previewSerial)return;
      for(const resolved of response.values){const row=previewRows.get(resolved.id);if(!row)continue;const value=type==='boolean'?(resolved.value?'Visible':'Hidden'):String(resolved.value)+(type==='number'?unit:'');row.value.textContent=value;row.value.title=value;
       const path=resolved.path.map(step=>{const variable=library.variables.find(item=>item.id===step.variableId),collection=library.collections.find(item=>item.id===step.collectionId),mode=collection?.modes.find(item=>item.id===step.modeId);return (collection?.name||'')+' / '+(variable?.name||'')+' · '+(mode?.name||'');}).join(' → ');row.button.title=path+' = '+value;row.button.setAttribute('aria-description',row.button.title);
       if(type==='color'&&CSS.supports('color',resolved.value)){row.icon.textContent='';row.icon.classList.add('variable-picker-swatch');row.icon.style.backgroundColor=resolved.value;}
      }
      for(const error of response.errors||[]){const row=previewRows.get(error.id);if(row){row.value.textContent='Unavailable';row.button.title=error.reason;row.button.setAttribute('aria-description',error.reason);}}
     }catch(error){if(!dialog.open||serial!==previewSerial)return;for(const row of previewRows.values()){row.value.textContent='Unavailable';row.button.title=error.message;row.button.setAttribute('aria-description',error.message);}}
    },120);
   }
   search.addEventListener('input',list);dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dialog.close();return;}if(event.target.tagName==='SELECT'||!['ArrowDown','ArrowUp','Home','End'].includes(event.key)||applying)return;const rows=[...results.querySelectorAll('button')];if(!rows.length)return;const index=rows.indexOf(document.activeElement);if(index<0&&!['ArrowDown','ArrowUp'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?rows.length-1:index<0?(event.key==='ArrowDown'?0:rows.length-1):(index+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length;rows[next].focus();});
   const observer=new MutationObserver(()=>{if(!current())dialog.close();});observer.observe(document.body,{childList:true,subtree:true});
   dialog.addEventListener('close',()=>{clearTimeout(previewTimer);previewSerial++;observer.disconnect();dialog.remove();const focus=trigger.isConnected?trigger:[...parent.querySelectorAll('.property-variable')].find(button=>button.getAttribute('aria-label')===trigger.getAttribute('aria-label'))||[...document.querySelectorAll('[data-variable-picker-context]')].find(node=>node.dataset.variablePickerContext===context)?.querySelector('.variable-picker-trigger');focus?.focus();},{once:true});list();dialog.showModal();search.focus();
  }
  function render(){
   details.dataset.variablePickerContext=draftKey();
   controls.replaceChildren();controls.append(I.button('Reload collection bindings',load));if(!library)return;
   I.note(controls,'Bind '+(multiple?selection.length+' layers':'this layer')+' at '+(options.scopeLabel||(width?width+'px and larger':'all screen sizes'))+'. Collection edits update linked pages.');
   const labels=new Map(RetouchHTMLCSSValues.fields),properties=[...paints,...numbers,'visibility','font-family'];
   I.select(controls,'Collection binding target',properties.map(p=>[p,labels.get(p)||p]),target,value=>{target=value;init();remember();run(preview);});
   const type=paints.includes(target)?'color':numbers.includes(target)?'number':target==='visibility'?'boolean':'string';
   const choices=library.variables.filter(v=>v.type===type);if(!choices.length)I.note(controls,'No '+type+' variables yet. Use Variables in the toolbar to create one.');if(!choices.some(v=>v.id===selected))selected='';
   const picker=I.button('Browse variables',()=>browse(choices,type,picker));picker.classList.add('variable-picker-trigger');picker.setAttribute('aria-haspopup','dialog');controls.append(picker);
   I.select(controls,'Bound collection variable',[['','Choose a variable…'],...choices.map(v=>[v.id,library.collections.find(c=>c.id===v.collectionId).name+' / '+v.name])],selected,value=>{selected=value;remember();run(preview);});
   for(const collection of library.collections)I.select(controls,'Binding mode for '+collection.name,[['','Default ('+collection.modes.find(m=>m.id===collection.defaultMode).name+')'],...collection.modes.map(m=>[m.id,m.name])],modes[collection.id]||'',value=>{if(value)modes[collection.id]=value;else delete modes[collection.id];remember();run(preview);});
   if(type==='number')I.select(controls,'Binding unit',[...(unitless.includes(target)?[['','Unitless']]:[]),...(!['opacity','font-weight','flex-grow','flex-shrink'].includes(target)?['px','rem','em','%','vw','vh','ch'].map(v=>[v,v]):[])],unit,value=>{unit=value;remember();render();});
   const resolved=values.find(v=>v.id===selected),value=resolved?(type==='boolean'?(resolved.value?'visible':'hidden'):String(resolved.value)+(type==='number'?unit:'')):null;
   if(resolved)I.note(controls,'Resolved value: '+value);
   const valid=value!==null&&RetouchHTMLCSSValues.valid(target,value),apply=I.button('Apply collection binding',()=>run(()=>writeBinding('applyVariable',width,{property:target,libraryRevision:library.revision,binding:{id:selected,modes,...(type==='number'?{unit}:{})}})));apply.disabled=!valid;controls.append(apply);
   if(resolved&&!valid)I.note(controls,'This value cannot control the selected property. Choose another variable or unit.');
   const from=multiple?null:inherit(target);
   if(from){
    const variable=library.variables.find(v=>v.id===from.link.id);I.note(controls,'Inherited: '+(variable?.name||'Missing variable')+' · '+from.label+(from.override?' · Local override in that scope':''));
    const copy=I.button('Override collection binding here',()=>run(()=>writeBinding('applyVariable',width,{property:target,libraryRevision:library.revision,binding:{id:from.link.id,modes:from.link.modes,...(from.link.unit!==undefined?{unit:from.link.unit}:{})}})));controls.append(copy);
    I.note(controls,'Creates a binding here using the inherited variable and modes. It uses the library value; smaller screen scopes stay unchanged.');
   }
   const bound=ownLinks().filter(Boolean).length;
   if(multiple)I.note(controls,bound+' of '+selection.length+' layers bound in this scope'+(bound&&!link()?' · Mixed bindings': '')+'.');
   if(bound){
    if(!multiple){const variable=library.variables.find(v=>v.id===link().id);I.note(controls,'Linked: '+(variable?.name||'Missing variable')+(info.variableOverrides?.[width]?.includes(target)?' · Local override':''));}
    else I.note(controls,'Reset preserves each layer’s variable and modes. Unbound layers stay unchanged when resetting or detaching.');
    const fallback=multiple?null:inherit(target,true);if(fallback){controls.append(I.button('Use smaller-screen binding',()=>run(()=>writeBinding('removeVariable',width,{property:target}))));I.note(controls,'Removes this scope’s binding and property override to reveal '+fallback.label+'.');}
    controls.append(I.button('Reset collection binding',()=>run(()=>writeBinding('resetVariable',width,{property:target,libraryRevision:library.revision}))),I.button('Detach collection binding',()=>run(()=>writeBinding('detachVariable',width,{property:target}))));
   }
  }
  controllers.set(parent,{details,bound:property=>selection.some(item=>item.variableLinks?.[width]?.[property])?'Bound in this scope':!multiple&&inherit(property)?'Inherited variable binding':null,open:async(property,trigger,requestedUnit)=>{
   if(loadPromise)await loadPromise;if(!details.isConnected||busy)return;target=property;init();if(requestedUnit!==undefined&&!link()&&!inherit(property))unit=requestedUnit;remember();render();
   if(!library)await load();if(!details.isConnected)return;if(!library){for(let node=details;node&&node!==parent.parentElement;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;status.scrollIntoView({block:'nearest'});return;}
   const type=paints.includes(target)?'color':numbers.includes(target)?'number':target==='visibility'?'boolean':'string';
   browse(library.variables.filter(variable=>variable.type===type),type,trigger);
  }});
  render();
  details.addEventListener('toggle',()=>{expanded=details.open;if(expanded&&!library&&!busy)load();});if(expanded)load();
 }
 function decorate(parent){
  const controller=controllers.get(parent);if(!controller?.details.isConnected)return;
  const supported=new Set([...paints,...numbers,'visibility','font-family']);
  for(const input of parent.querySelectorAll('[data-variable-property]')){
   const property=input.dataset.variableProperty;if(!supported.has(property))continue;
   const field=input.closest('.inspector-field');if(!field)continue;let row=field.closest('.property-row');if(!row){row=document.createElement('div');row.className='property-row';field.before(row);row.append(field);}
   if(row.querySelector('.property-variable'))continue;
   const label=(new Map(V.fields).get(property)||property).toLowerCase(),button=I.button('Apply variable to '+label,()=>controller.open(property,button,input.dataset.variableUnit));button.classList.add('property-variable');button.textContent='◈';button.setAttribute('aria-label','Apply variable to '+label);button.setAttribute('aria-haspopup','dialog');button.title='Apply variable to '+label;button.disabled=input.disabled;const state=controller.bound(property);if(state){button.classList.add('is-bound');button.setAttribute('aria-description',state);button.title+=' · '+state;}row.append(button);
  }
 }
 return {mount,inherited,classInherited,decorate};
});
