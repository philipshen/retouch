(function(){
 'use strict';
 let expanded=false,property='color';
 const namePattern=/^--[a-zA-Z_][a-zA-Z0-9_-]{0,127}$/;
 function mount(selection,width,save,rules,saveIndividual=null){
  const elements=Array.isArray(selection)?selection:[selection],element=elements[0],owns=Array.isArray(rules)?rules:[rules];
  const I=RetouchInspector,details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Site variables';details.append(summary);details.open=expanded;details.addEventListener('toggle',()=>{expanded=details.open;});
  I.note(details,'Use a variable already defined by this site. Each selected layer keeps its own inherited value at the active screen size.');const controls=document.createElement('div');details.append(controls);
  function render(){
   controls.replaceChildren();
   const properties=[...RetouchHTMLCSSValues.fields,...(elements.every(item=>item.namespaceURI==='http://www.w3.org/2000/svg')?RetouchHTMLCSSValues.svgFields:[])];
   if(!properties.some(([key])=>key===property))property='color';
   I.select(controls,'Variable target',properties,property,value=>{property=value;render();});
   const computed=elements.map(item=>item.ownerDocument.defaultView.getComputedStyle(item)),variables=[];
   for(let index=0;index<computed[0].length&&variables.length<500;index++){
    const name=computed[0].item(index);if(!namePattern.test(name))continue;const values=computed.map(css=>css.getPropertyValue(name).trim());
    if(values.every(value=>value&&value.length<=1000&&element.ownerDocument.defaultView.CSS.supports(property,value)))variables.push({name,value:values.every(value=>value===values[0])?values[0]:'Varies by layer'});
   }
   variables.sort((a,b)=>a.name.localeCompare(b.name));
   const links=owns.map(own=>/^var\((--[a-zA-Z_][a-zA-Z0-9_-]{0,127})\)$/.exec(own[property]||'')?.[1]),count=links.filter(Boolean).length,linked=links.every(link=>link===links[0])?links[0]:null;
   if(count)I.note(controls,elements.length===1?'Bound to '+linked+' · '+(computed[0].getPropertyValue(linked).trim()||'No value at this layer.'):count+' of '+elements.length+' layers bound'+(linked?' to '+linked: ' · Mixed bindings')+'.');
   const choice=I.select(controls,'Site variable',[['','Choose a variable…'],...variables.map(item=>[item.name,item.name+' · '+item.value])],variables.some(item=>item.name===linked)?linked:'',()=>{apply.disabled=!choice.value;});
   const status=I.note(controls,variables.length?'Values shown at the current preview size. Applying creates a binding at the selected style scope.':'No compatible variables found for this property on every selected layer.');status.setAttribute('role','status');
   const apply=I.button('Apply site variable',()=>save(property,'var('+choice.value+')',width));apply.disabled=!choice.value;controls.append(apply);
   if(count){
    const writeEach=values=>saveIndividual?saveIndividual(values.map((value,index)=>links[index]?{[property]:value}:{})):save(property,values[0],width);
    const detach=I.button('Detach site variable',()=>{
     const values=elements.map((item,index)=>links[index]?item.ownerDocument.defaultView.getComputedStyle(item).getPropertyValue(property).trim():null);
     if(values.some((value,index)=>links[index]&&!RetouchHTMLCSSValues.valid(property,value))){status.textContent='A computed value cannot be stored as a literal yet. Use the CSS fields to replace the binding.';return;}
     writeEach(values);
    });controls.append(detach,I.button('Reset variable binding',()=>writeEach(elements.map(()=>null))));
   }
   controls.append(I.button('Refresh site variables',render));
  }
  render();return details;
 }
 window.RetouchSiteVariables={mount};
})();
