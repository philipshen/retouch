(function(){
 'use strict';
 let expanded=false,target='color';
 const paints=['color','background-color','border-color','fill','stroke'],numbers=['width','height','min-width','max-width','min-height','max-height','gap','padding','margin','font-size','letter-spacing','border-width','border-radius','opacity','font-weight','line-height','flex-grow','flex-shrink',...['top','right','bottom','left'].flatMap(side=>['padding-'+side,'margin-'+side]),...['top-left','top-right','bottom-left','bottom-right'].map(corner=>'border-'+corner+'-radius')];
 const unitless=['opacity','font-weight','line-height','flex-grow','flex-shrink'];
 function mount(parent,info,width,write){
  const I=RetouchInspector,details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Collection bindings';details.append(summary);parent.append(details);details.open=expanded;
  const status=I.note(details,''),controls=document.createElement('fieldset');status.setAttribute('role','status');controls.style.cssText='border:0;padding:0;margin:0;min-width:0';details.append(controls);
  let library=null,values=[],selected='',modes={},unit='',busy=false;
  const link=()=>info.variableLinks?.[width]?.[target];
  const init=()=>{const current=link();selected=current?.id||'';modes={...current?.modes};unit=current?.unit??(unitless.includes(target)?'':'px');};init();
  async function run(action){if(busy)return;busy=true;controls.disabled=true;status.textContent='Working…';try{await action();if(details.isConnected){render();status.textContent='';}}catch(error){values=[];if(details.isConnected){render();status.textContent=error.message;}}finally{busy=false;controls.disabled=false;}}
  const preview=async()=>{values=(await RetouchVariableModePreview({revision:library.revision,modes})).values;};
  const load=()=>run(async()=>{library=await RetouchVariableLibraryRequest();await preview();});
  function render(){
   controls.replaceChildren();controls.append(I.button('Reload collection bindings',load));if(!library)return;
   I.note(controls,'Bind this layer at '+(width?width+'px and larger':'all screen sizes')+'. Collection edits update linked pages.');
   const labels=new Map(RetouchHTMLCSSValues.fields),properties=[...paints,...numbers,'visibility','font-family'];
   I.select(controls,'Collection binding target',properties.map(p=>[p,labels.get(p)||p]),target,value=>{target=value;init();run(preview);});
   const type=paints.includes(target)?'color':numbers.includes(target)?'number':target==='visibility'?'boolean':'string';
   const choices=library.variables.filter(v=>v.type===type);if(!choices.length)I.note(controls,'No '+type+' variables yet. Use Variables in the toolbar to create one.');if(!choices.some(v=>v.id===selected))selected='';
   I.select(controls,'Bound collection variable',[['','Choose a variable…'],...choices.map(v=>[v.id,library.collections.find(c=>c.id===v.collectionId).name+' / '+v.name])],selected,value=>{selected=value;render();});
   for(const collection of library.collections)I.select(controls,'Binding mode for '+collection.name,[['','Default ('+collection.modes.find(m=>m.id===collection.defaultMode).name+')'],...collection.modes.map(m=>[m.id,m.name])],modes[collection.id]||'',value=>{if(value)modes[collection.id]=value;else delete modes[collection.id];run(preview);});
   if(type==='number')I.select(controls,'Binding unit',[...(unitless.includes(target)?[['','Unitless']]:[]),...(!['opacity','font-weight','flex-grow','flex-shrink'].includes(target)?['px','rem','em','%','vw','vh','ch'].map(v=>[v,v]):[])],unit,value=>{unit=value;render();});
   const resolved=values.find(v=>v.id===selected),value=resolved?(type==='boolean'?(resolved.value?'visible':'hidden'):String(resolved.value)+(type==='number'?unit:'')):null;
   if(resolved)I.note(controls,'Resolved value: '+value);
   const valid=value!==null&&RetouchHTMLCSSValues.valid(target,value),apply=I.button('Apply collection binding',()=>run(()=>write('applyVariable',width,{property:target,libraryRevision:library.revision,binding:{id:selected,modes,...(type==='number'?{unit}:{})}})));apply.disabled=!valid;controls.append(apply);
   if(resolved&&!valid)I.note(controls,'This value cannot control the selected property. Choose another variable or unit.');
   if(link()){
    const variable=library.variables.find(v=>v.id===link().id);I.note(controls,'Linked: '+(variable?.name||'Missing variable')+(info.variableOverrides?.[width]?.includes(target)?' · Local override':''));
    controls.append(I.button('Reset collection binding',()=>run(()=>write('resetVariable',width,{property:target,libraryRevision:library.revision}))),I.button('Detach collection binding',()=>run(()=>write('detachVariable',width,{property:target}))));
   }
  }
  render();
  details.addEventListener('toggle',()=>{expanded=details.open;if(expanded&&!library&&!busy)load();});if(expanded)load();
 }
 window.RetouchCollectionBindings={mount};
})();
