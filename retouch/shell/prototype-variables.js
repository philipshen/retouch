(function(root){
 'use strict';
 const documents=new Set(),styles=new Map(),B=root.RetouchCollectionBindings;
 let epoch=0,values={},revision,library=null,queue=Promise.resolve(),scheduled=false,dirty=false;
 const report=error=>root.RetouchPresentationHost.error(error.message);
 function restore(el,property,entry){
  if(el.style.getPropertyValue(property)!==entry.applied||el.style.getPropertyPriority(property)!=='important')return;
  if(entry.value)el.style.setProperty(property,entry.value,entry.priority);else el.style.removeProperty(property);
  if(!entry.hadStyle&&!el.getAttribute('style'))el.removeAttribute('style');
 }
 function restoreDocument(d){for(const [el,entries]of styles)if(!d||el.ownerDocument===d){for(const [property,entry]of entries)restore(el,property,entry);styles.delete(el);}}
 function currentBindings(info,d,el){
  if(!info.variables&&!info.classVariables)throw Error(info.variableReason||'This layer cannot resolve variable bindings.');
  const properties=[...new Set(Object.values(info.variableLinks||{}).flatMap(group=>Object.keys(group)))],width=d.defaultView.innerWidth,result=[];
  for(const property of properties){
   // Query just above the current width so exact boundary bindings participate.
   const scoped=info.classVariables?info:{...info,variableLinks:Object.fromEntries(Object.entries(info.variableLinks||{}).filter(([scope])=>Number(scope)<=width)),cssRules:Object.fromEntries(Object.entries(info.cssRules||{}).filter(([scope])=>Number(scope)<=width))};
   const inherited=info.classVariables?root.RetouchPrototypeBindingCascade.classLink(info,el,property,styles.get(el)?.get(property)):B.inherited(scoped,width+1,property);
   if(!inherited||inherited.override||inherited.link.override)continue;
   const link=inherited.link;result.push({property,binding:{id:link.id,modes:link.modes,...(link.unit!==undefined?{unit:link.unit}:{})}});
  }
  return result;
 }
 async function project(next,ticket){
  const targets=[];
  for(const d of [...documents]){
   for(const el of d.querySelectorAll('[data-rt-variables]')){
    const info=await root.RetouchPrototypeHost.variableInfo(el);if(ticket!==epoch)return false;
    for(const request of currentBindings(info,d,el))targets.push({el,request});
   }
  }
  // Split transport batches, but apply only after every batch resolves.
  const projected=[];
  for(let offset=0;offset<targets.length;offset+=256){const batch=targets.slice(offset,offset+256),response=await root.RetouchVariableModePreview({revision,overrides:next,bindings:batch.map(t=>t.request)});if(ticket!==epoch)return false;projected.push(...response.bindings);}
  if(ticket!==epoch)return false;
  if(targets.some(({el})=>!el.isConnected||!documents.has(el.ownerDocument)))return false;
  const desired=new Map();
  targets.forEach(({el,request},i)=>{if(!projected[i].path.some(step=>Object.hasOwn(next,step.variableId)))return;let props=desired.get(el);if(!props)desired.set(el,props=new Map());props.set(request.property,projected[i].value);});
  for(const [el,entries]of styles){for(const [property,entry]of entries)if(!desired.get(el)?.has(property)){restore(el,property,entry);entries.delete(property);}if(!entries.size)styles.delete(el);}
  for(const [el,props]of desired){let entries=styles.get(el);if(!entries)styles.set(el,entries=new Map());for(const [property,value]of props){let entry=entries.get(property);if(!entry||el.style.getPropertyValue(property)!==entry.applied||el.style.getPropertyPriority(property)!=='important')entry={value:el.style.getPropertyValue(property),priority:el.style.getPropertyPriority(property),hadStyle:el.hasAttribute('style')};el.style.setProperty(property,value,'important');entry.applied=el.style.getPropertyValue(property);entries.set(property,entry);}}
  return true;
 }
 function enqueue(work){const ticket=epoch;queue=queue.then(()=>ticket===epoch?work(ticket):undefined).catch(error=>{if(ticket===epoch)report(error);});return queue;}
 function refresh(){if(!Object.keys(values).length)return;dirty=true;if(scheduled)return;scheduled=true;const generation=epoch;enqueue(ticket=>{dirty=false;return project(values,ticket);}).finally(()=>{if(generation!==epoch)return;scheduled=false;if(dirty)refresh();});}
 root.RetouchPrototypeVariables={
  assign(input){return enqueue(async ticket=>{
   const assignment=root.RetouchPrototypeValues.assignment(input);
   if(!library){const loaded=await root.RetouchVariableLibraryRequest();if(ticket!==epoch)return;library=loaded;revision=loaded.revision;}
   const variable=library.variables.find(v=>v.id===assignment.id);if(!variable||variable.type!==assignment.type)throw Error('The prototype variable is missing or its type changed. Edit this interaction again.');
   const next={...values,[assignment.id]:assignment.value};
   // Validate even if no mounted layer uses the variable.
   await root.RetouchVariableModePreview({revision,overrides:next,variableId:assignment.id});if(ticket!==epoch)return;
   const applied=await project(next,ticket);if(ticket===epoch){values=next;if(!applied)refresh();}
  });},
  mount(d){documents.add(d);const observed=new Set(),resize=new ResizeObserver(refresh),watch=()=>{const current=new Set([d.documentElement]);for(const el of d.querySelectorAll('[data-rt-variables]'))for(let node=el;node;node=node.parentElement)current.add(node);for(const node of observed)if(!current.has(node)){resize.unobserve(node);observed.delete(node);}for(const node of current)if(!observed.has(node)){observed.add(node);resize.observe(node);}};watch();const observer=new MutationObserver(()=>{watch();refresh();});observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-rt-variables','class']});d.defaultView.addEventListener('resize',refresh);d.addEventListener('load',refresh,true);refresh();let released=false;return ()=>{if(released)return;released=true;observer.disconnect();resize.disconnect();d.defaultView?.removeEventListener('resize',refresh);d.removeEventListener('load',refresh,true);documents.delete(d);restoreDocument(d);};},
  reset(){epoch++;values={};library=null;revision=undefined;queue=Promise.resolve();scheduled=false;dirty=false;restoreDocument();}
 };
})(window);
