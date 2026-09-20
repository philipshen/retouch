(function(root){
 'use strict';
 const documents=new Set(),styles=new Map(),ownedInline=new WeakMap();
 let epoch=0,values={},modes={},revision,library=null,queue=Promise.resolve(),scheduled=false,dirty=false;
 const report=error=>root.RetouchPresentationHost.error(error.message);
 function restore(el,property,entry){
  if(el.style.getPropertyValue(property)!==entry.applied||el.style.getPropertyPriority(property)!=='important')return;
  if(entry.value)el.style.setProperty(property,entry.value,entry.priority);else el.style.removeProperty(property);
  if(!entry.hadStyle&&!el.getAttribute('style'))el.removeAttribute('style');ownedInline.set(el,el.getAttribute('style'));
 }
 function restoreDocument(d){for(const [el,entries]of styles)if(!d||el.ownerDocument===d){for(const [property,entry]of entries)restore(el,property,entry);styles.delete(el);}}
 function currentBindings(info,d,el){
  if(!info.variables&&!info.classVariables)throw Error(info.variableReason||'This layer cannot resolve variable bindings.');
  const properties=[...new Set(Object.values(info.variableLinks||{}).flatMap(group=>Object.keys(group)))],result=[];
  for(const property of properties){
   const active=root.RetouchPrototypeBindingCascade.link(info,el,property,styles.get(el)?.get(property));
   if(!active||active.override)continue;
   const link=active.link;result.push({property,binding:{id:link.id,modes:link.modes,...(link.unit!==undefined?{unit:link.unit}:{})}});
  }
  return result;
 }

 async function project(next,ticket,nextModes=modes){
  const targets=[];
  for(const d of [...documents]){
   for(const el of d.querySelectorAll('[data-rt-variables]')){
    const info=await root.RetouchPrototypeHost.variableInfo(el);if(ticket!==epoch)return false;
    for(const request of currentBindings(info,d,el))targets.push({el,request:{...request,binding:{...request.binding,modes:{...nextModes,...request.binding.modes}}},explicitModes:request.binding.modes||{}});
   }
  }
  // Split transport batches, but apply only after every batch resolves.
  const projected=[];
  for(let offset=0;offset<targets.length;offset+=256){const batch=targets.slice(offset,offset+256),response=await root.RetouchVariableModePreview({revision,modeOverrides:next,bindings:batch.map(t=>t.request)});if(ticket!==epoch)return false;projected.push(...response.bindings);}
  if(ticket!==epoch)return false;
  if(targets.some(({el})=>!el.isConnected||!documents.has(el.ownerDocument)))return false;
  const desired=new Map();
  targets.forEach(({el,request,explicitModes},i)=>{if(!projected[i].path.some(step=>Object.hasOwn(next[step.variableId]||{},step.modeId)||Object.hasOwn(nextModes,step.collectionId)&&!Object.hasOwn(explicitModes,step.collectionId)))return;let props=desired.get(el);if(!props)desired.set(el,props=new Map());props.set(request.property,projected[i].value);});
  for(const [el,entries]of styles){for(const [property,entry]of entries)if(!desired.get(el)?.has(property)){restore(el,property,entry);entries.delete(property);}if(!entries.size)styles.delete(el);}
  for(const [el,props]of desired){let entries=styles.get(el);if(!entries)styles.set(el,entries=new Map());for(const [property,value]of props){let entry=entries.get(property);if(!entry||el.style.getPropertyValue(property)!==entry.applied||el.style.getPropertyPriority(property)!=='important')entry={value:el.style.getPropertyValue(property),priority:el.style.getPropertyPriority(property),hadStyle:el.hasAttribute('style')};el.style.setProperty(property,value,'important');entry.applied=el.style.getPropertyValue(property);entries.set(property,entry);ownedInline.set(el,el.getAttribute('style'));}}
  return true;
 }
 function enqueue(work){const ticket=epoch;queue=queue.then(()=>ticket===epoch?work(ticket):undefined).catch(error=>{if(ticket===epoch)report(error);});return queue;}
 function refresh(){if(!Object.keys(values).length&&!Object.keys(modes).length)return;dirty=true;if(scheduled)return;scheduled=true;const generation=epoch;enqueue(ticket=>{dirty=false;return project(values,ticket);}).finally(()=>{if(generation!==epoch)return;scheduled=false;if(dirty)refresh();});}
 root.RetouchPrototypeVariables={
  setMode(input){return enqueue(async ticket=>{
   const change=root.RetouchPrototypeValues.modeChange(input);
   if(!library){const loaded=await root.RetouchVariableLibraryRequest();if(ticket!==epoch)return;library=loaded;revision=loaded.revision;}
   const collection=library.collections.find(c=>c.id===change.collectionId);if(!collection?.modes.some(mode=>mode.id===change.modeId))throw Error('The prototype collection or mode is missing. Edit this interaction again.');
   const nextModes={...modes,[change.collectionId]:change.modeId};
   await root.RetouchVariableModePreview({revision,modes:nextModes,modeOverrides:values});if(ticket!==epoch)return;
   const applied=await project(values,ticket,nextModes);if(ticket===epoch){modes=nextModes;if(!applied)refresh();}
  });},
  assign(input){return enqueue(async ticket=>{
   const assignment=root.RetouchPrototypeValues.assignment(input);
   if(!library){const loaded=await root.RetouchVariableLibraryRequest();if(ticket!==epoch)return;library=loaded;revision=loaded.revision;}
   const variable=library.variables.find(v=>v.id===assignment.id);if(!variable||variable.type!==assignment.type)throw Error('The prototype variable is missing or its type changed. Edit this interaction again.');
   const collection=library.collections.find(c=>c.id===variable.collectionId),modeId=assignment.modeId||modes[variable.collectionId]||collection.defaultMode;
   if(!collection.modes.some(mode=>mode.id===modeId))throw Error('The target variable mode is missing. Edit this interaction again.');
   const targetModes=assignment.modeId?{...modes,[variable.collectionId]:modeId}:modes;
   let value=assignment.value;
   if(assignment.expression!==undefined){
    const response=await root.RetouchVariableModePreview({revision,modes,modeOverrides:values,expression:assignment.expression});if(ticket!==epoch)return;
    if(response.result?.type!==assignment.type)throw Error('The expression returned a different variable type.');value=response.result.value;
   }else if(assignment.variableId!==undefined){
    const source=library.variables.find(v=>v.id===assignment.variableId);if(!source||source.type!==assignment.type)throw Error('The source variable is missing or has a different type. Edit this interaction again.');
    const sourceModes={...modes};if(assignment.sourceModeId){const collection=library.collections.find(c=>c.id===source.collectionId);if(!collection.modes.some(mode=>mode.id===assignment.sourceModeId))throw Error('The source variable mode is missing. Edit this interaction again.');sourceModes[source.collectionId]=assignment.sourceModeId;}
    const resolved=await root.RetouchVariableModePreview({revision,modes:sourceModes,modeOverrides:values,variableId:source.id});if(ticket!==epoch)return;
    const current=resolved.values.find(v=>v.id===source.id);if(!current||current.type!==assignment.type)throw Error('The source variable could not be resolved.');value=current.value;
   }
   const next={...values,[assignment.id]:{...values[assignment.id],[modeId]:value}};
   // Validate even if no mounted layer uses the variable.
   await root.RetouchVariableModePreview({revision,modes:targetModes,modeOverrides:next,variableId:assignment.id});if(ticket!==epoch)return;
   const applied=await project(next,ticket);if(ticket===epoch){values=next;if(!applied)refresh();}
  });},
  mount(d){documents.add(d);const release=root.RetouchPrototypeVariableWatch.mount(d,refresh,el=>ownedInline.has(el)&&ownedInline.get(el)===el.getAttribute('style'));refresh();let released=false;return ()=>{if(released)return;released=true;release();documents.delete(d);restoreDocument(d);};},
  reset(){epoch++;values={};modes={};library=null;revision=undefined;queue=Promise.resolve();scheduled=false;dirty=false;restoreDocument();}
 };
})(window);
