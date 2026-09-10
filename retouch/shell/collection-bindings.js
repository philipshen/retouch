(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./html-css-values.js'),require('./responsive.js'),require('./inspector.js'));else root.RetouchCollectionBindings=factory(root.RetouchHTMLCSSValues,root.RetouchResponsive,root.RetouchInspector);})(typeof globalThis!=='undefined'?globalThis:this,function(V,R,I){
 'use strict';
 let expanded=false,target='color';
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
  let library=null,values=[],selected='',modes={},unit='',busy=false;
  const inherit=(property,ignoreOwn=false)=>options.inherited?options.inherited(property,ignoreOwn):inherited(info,width,property,ignoreOwn);
  const ownLinks=()=>selection.map(item=>item.variableLinks?.[width]?.[target]);
  const link=()=>{const links=ownLinks();return links[0]&&links.every(item=>JSON.stringify(item)===JSON.stringify(links[0]))?links[0]:null;};
  const init=()=>{const current=link()||(!multiple&&inherit(target)?.link);selected=current?.id||'';modes={...current?.modes};unit=current?.unit??(unitless.includes(target)?'':'px');};init();
  async function run(action){if(busy)return;busy=true;controls.disabled=true;status.textContent='Working…';try{await action();if(details.isConnected){render();status.textContent='';}}catch(error){values=[];if(details.isConnected){render();status.textContent=error.message;}}finally{busy=false;controls.disabled=false;}}
  const preview=async()=>{values=[];if(selected)values=(await RetouchVariableModePreview({revision:library.revision,modes,variableId:selected})).values;};
  const load=()=>run(async()=>{library=await RetouchVariableLibraryRequest();await preview();});
  function render(){
   controls.replaceChildren();controls.append(I.button('Reload collection bindings',load));if(!library)return;
   I.note(controls,'Bind '+(multiple?selection.length+' layers':'this layer')+' at '+(options.scopeLabel||(width?width+'px and larger':'all screen sizes'))+'. Collection edits update linked pages.');
   const labels=new Map(RetouchHTMLCSSValues.fields),properties=[...paints,...numbers,'visibility','font-family'];
   I.select(controls,'Collection binding target',properties.map(p=>[p,labels.get(p)||p]),target,value=>{target=value;init();run(preview);});
   const type=paints.includes(target)?'color':numbers.includes(target)?'number':target==='visibility'?'boolean':'string';
   const choices=library.variables.filter(v=>v.type===type);if(!choices.length)I.note(controls,'No '+type+' variables yet. Use Variables in the toolbar to create one.');if(!choices.some(v=>v.id===selected))selected='';
   I.select(controls,'Bound collection variable',[['','Choose a variable…'],...choices.map(v=>[v.id,library.collections.find(c=>c.id===v.collectionId).name+' / '+v.name])],selected,value=>{selected=value;run(preview);});
   for(const collection of library.collections)I.select(controls,'Binding mode for '+collection.name,[['','Default ('+collection.modes.find(m=>m.id===collection.defaultMode).name+')'],...collection.modes.map(m=>[m.id,m.name])],modes[collection.id]||'',value=>{if(value)modes[collection.id]=value;else delete modes[collection.id];run(preview);});
   if(type==='number')I.select(controls,'Binding unit',[...(unitless.includes(target)?[['','Unitless']]:[]),...(!['opacity','font-weight','flex-grow','flex-shrink'].includes(target)?['px','rem','em','%','vw','vh','ch'].map(v=>[v,v]):[])],unit,value=>{unit=value;render();});
   const resolved=values.find(v=>v.id===selected),value=resolved?(type==='boolean'?(resolved.value?'visible':'hidden'):String(resolved.value)+(type==='number'?unit:'')):null;
   if(resolved)I.note(controls,'Resolved value: '+value);
   const valid=value!==null&&RetouchHTMLCSSValues.valid(target,value),apply=I.button('Apply collection binding',()=>run(()=>write('applyVariable',width,{property:target,libraryRevision:library.revision,binding:{id:selected,modes,...(type==='number'?{unit}:{})}})));apply.disabled=!valid;controls.append(apply);
   if(resolved&&!valid)I.note(controls,'This value cannot control the selected property. Choose another variable or unit.');
   const from=multiple?null:inherit(target);
   if(from){
    const variable=library.variables.find(v=>v.id===from.link.id);I.note(controls,'Inherited: '+(variable?.name||'Missing variable')+' · '+from.label+(from.override?' · Local override in that scope':''));
    const copy=I.button('Override collection binding here',()=>run(()=>write('applyVariable',width,{property:target,libraryRevision:library.revision,binding:{id:from.link.id,modes:from.link.modes,...(from.link.unit!==undefined?{unit:from.link.unit}:{})}})));controls.append(copy);
    I.note(controls,'Creates a binding here using the inherited variable and modes. It uses the library value; smaller screen scopes stay unchanged.');
   }
   const bound=ownLinks().filter(Boolean).length;
   if(multiple)I.note(controls,bound+' of '+selection.length+' layers bound in this scope'+(bound&&!link()?' · Mixed bindings': '')+'.');
   if(bound){
    if(!multiple){const variable=library.variables.find(v=>v.id===link().id);I.note(controls,'Linked: '+(variable?.name||'Missing variable')+(info.variableOverrides?.[width]?.includes(target)?' · Local override':''));}
    else I.note(controls,'Reset preserves each layer’s variable and modes. Unbound layers stay unchanged when resetting or detaching.');
    const fallback=multiple?null:inherit(target,true);if(fallback){controls.append(I.button('Use smaller-screen binding',()=>run(()=>write('removeVariable',width,{property:target}))));I.note(controls,'Removes this scope’s binding and property override to reveal '+fallback.label+'.');}
    controls.append(I.button('Reset collection binding',()=>run(()=>write('resetVariable',width,{property:target,libraryRevision:library.revision}))),I.button('Detach collection binding',()=>run(()=>write('detachVariable',width,{property:target}))));
   }
  }
  render();
  details.addEventListener('toggle',()=>{expanded=details.open;if(expanded&&!library&&!busy)load();});if(expanded)load();
 }
 return {mount,inherited,classInherited};
});
