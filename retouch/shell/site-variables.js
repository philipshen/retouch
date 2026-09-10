(function(){
 'use strict';
 let expanded=false,property='color';
 const namePattern=/^--[a-zA-Z_][a-zA-Z0-9_-]{0,127}$/;
 function mount(element,width,save,own){
  const I=RetouchInspector,details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Site variables';details.append(summary);details.open=expanded;details.addEventListener('toggle',()=>{expanded=details.open;});
  const note=I.note(details,'Use a variable already defined by this site. Its value follows the selected layer’s inherited styles and active screen size.'),controls=document.createElement('div');details.append(controls);
  function render(){
   controls.replaceChildren();
   const properties=[...RetouchHTMLCSSValues.fields,...(element.namespaceURI==='http://www.w3.org/2000/svg'?RetouchHTMLCSSValues.svgFields:[])];
   if(!properties.some(([key])=>key===property))property='color';
   I.select(controls,'Variable target',properties,property,value=>{property=value;render();});
   const computed=element.ownerDocument.defaultView.getComputedStyle(element),variables=[];
   for(let index=0;index<computed.length&&variables.length<500;index++){
    const name=computed.item(index);if(!namePattern.test(name))continue;const value=computed.getPropertyValue(name).trim();
    if(value&&value.length<=1000&&element.ownerDocument.defaultView.CSS.supports(property,value))variables.push({name,value});
   }
   variables.sort((a,b)=>a.name.localeCompare(b.name));
   const linked=/^var\((--[a-zA-Z_][a-zA-Z0-9_-]{0,127})\)$/.exec(own[property]||'')?.[1];
   if(linked)I.note(controls,'Bound to '+linked+' · '+(computed.getPropertyValue(linked).trim()||'No value at this layer.'));
   const choice=I.select(controls,'Site variable',[['','Choose a variable…'],...variables.map(item=>[item.name,item.name+' · '+item.value])],variables.some(item=>item.name===linked)?linked:'',()=>{apply.disabled=!choice.value;});
   const status=I.note(controls,variables.length?'Values shown at the current preview size. Applying creates a binding at the selected style scope.':'No compatible variables found for this property on this layer.');status.setAttribute('role','status');
   const apply=I.button('Apply site variable',()=>save(property,'var('+choice.value+')',width));apply.disabled=!choice.value;controls.append(apply);
   if(linked){const detach=I.button('Detach site variable',()=>{const value=element.ownerDocument.defaultView.getComputedStyle(element).getPropertyValue(property).trim();if(!RetouchHTMLCSSValues.valid(property,value)){status.textContent='This computed value cannot be stored as a literal yet. Use the CSS field to replace the binding.';return;}save(property,value,width);});controls.append(detach,I.button('Reset variable binding',()=>save(property,null,width)));}
   controls.append(I.button('Refresh site variables',render));
  }
  render();return details;
 }
 window.RetouchSiteVariables={mount};
})();
