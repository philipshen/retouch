(function(root){
 'use strict';
 const V=()=>root.RetouchHTMLCSSValues||require('./html-css-values.js'),I=()=>root.RetouchInspector||require('./inspector.js');let expanded=false;
 const imageToken=t=>/^\[background-image:/.test(t)||t==='bg-none'||/^bg-(?:gradient-to-|linear-|radial|conic)/.test(t)||/^bg-\[(?:image:|url\(|(?:repeating-)?(?:linear|radial|conic)-gradient\()/.test(t)||/^bg-\(image:/.test(t);
 function classes(current,value){
  if(value!==null&&!V().valid('background-image',value))throw Error('Choose a supported gradient stack.');
  if((current||'').split(/\s+/).some(token=>/^!|!$/.test(token)&&/^\[(?:background|all):/.test(I().base(token)||'')))throw Error('Resolve the important background shorthand before editing gradients.');
  return I().replace(current,imageToken,value===null?'':'![background-image:'+value.replace(/\s/g,'_')+']');
 }
 function mount(parent,info,element,save){
  const inspector=I(),d=parent.ownerDocument,details=d.createElement('details'),summary=d.createElement('summary');summary.textContent='Gradient fills';details.append(summary);details.open=expanded;details.ontoggle=()=>{if(details.isConnected)expanded=details.open;};parent.append(details);
  const gradients=V().parseGradients(element.ownerDocument.defaultView.getComputedStyle(element).backgroundImage);
  const write=async next=>{try{await save(classes(info.className,next===null?null:V().serializeGradients(next)));}catch(error){inspector.note(details,error.message,'refused');}};
  if(!gradients)inspector.note(details,'This background image cannot be edited as a gradient. Clear background images to start a gradient fill.');
  else{
   gradients.forEach((gradient,index)=>{const group=d.createElement('fieldset'),legend=d.createElement('legend'),label='Gradient '+(index+1);legend.textContent=label;group.className='gradient-controls';group.append(legend);const update=next=>write(gradients.map((item,i)=>i===index?next:item));
    const preview=d.createElement('div');preview.className='gradient-preview';preview.style.backgroundImage=V().serializeGradients([gradient]);preview.setAttribute('aria-label',label+' preview');group.append(preview,root.RetouchGradientStopRail({gradient,index,info,el:element,preview,gradients,update,label:'Gradient'}));
    root.RetouchGradientGeometry({gradient,index,el:element,preview,gradients,update,label:'Gradient'});
    inspector.select(group,label+' type',[['linear','Linear'],['radial','Radial'],['conic','Angular']],gradient.type,type=>update({...gradient,type}));
    inspector.select(group,label+' Color blending',[['','Browser default'],...V().gradientColorSpaces.filter(space=>d.defaultView.CSS.supports('background-image',V().serializeGradients([{...gradient,colorSpace:space,hue:undefined}]))).map(space=>[space,space])],gradient.colorSpace||'',colorSpace=>update({...gradient,colorSpace,hue:undefined}));
    if(['hsl','hwb','lch','oklch'].includes(gradient.colorSpace))inspector.select(group,label+' Hue direction',[['','Default'],['shorter','Shorter'],['longer','Longer'],['increasing','Increasing'],['decreasing','Decreasing']],gradient.hue||'',hue=>update({...gradient,hue}));
    const repeat=d.createElement('input');repeat.type='checkbox';repeat.checked=!!gradient.repeat;inspector.field(group,label+' Repeat',repeat);repeat.onchange=()=>update({...gradient,repeat:repeat.checked});if(gradient.repeat)inspector.note(group,'The pattern repeats between the first and last stop. Bring them closer for more repeats.');
    root.RetouchRadialGradient(group,gradient,label,update);
    for(const [key,title,min,max]of [...(gradient.type!=='radial'?[['angle','Angle (deg)',-360,360]]:[]),...(gradient.type!=='linear'?[['x','Center X (%)',0,100],['y','Center Y (%)',0,100]]:[])])inspector.number(group,label+' '+title,gradient[key],min,max,value=>update({...gradient,[key]:value}));
    gradient.stops.forEach((stop,stopIndex)=>{const prefix=label+' stop '+(stopIndex+1),row=d.createElement('fieldset'),title=d.createElement('legend');title.textContent='Stop '+(stopIndex+1);row.className='gradient-controls';row.append(title);const color=d.createElement('input');color.value=stop.color;inspector.field(row,prefix+' color',color);color.oninput=()=>color.setCustomValidity('');color.onchange=()=>{const value=color.value.trim();if(!V().valid('color',value)||!d.defaultView.CSS.supports('color',value)){color.setCustomValidity('Enter a supported color.');color.reportValidity();return;}update({...gradient,stops:gradient.stops.map((item,i)=>i===stopIndex?{...item,color:value}:item)});};
     inspector.number(row,prefix+' Position (%)',stop.position,0,100,position=>update({...gradient,stops:gradient.stops.map((item,i)=>i===stopIndex?{...item,position}:item).sort((a,b)=>a.position-b.position)}));const remove=inspector.button('Remove '+prefix.toLowerCase(),()=>update({...gradient,stops:gradient.stops.filter((_,i)=>i!==stopIndex)}));remove.disabled=gradient.stops.length<=2;row.append(remove);group.append(row);
    });
    const addStop=inspector.button('Add '+label.toLowerCase()+' stop',()=>update({...gradient,stops:[...gradient.stops,{color:'#808080',position:50}].sort((a,b)=>a.position-b.position)}));addStop.disabled=gradient.stops.length>=16;group.append(addStop,inspector.button('Remove '+label.toLowerCase(),()=>write(gradients.filter((_,i)=>i!==index))));if(index>0)group.append(inspector.button('Move '+label.toLowerCase()+' up',()=>{const next=[...gradients];[next[index-1],next[index]]=[next[index],next[index-1]];write(next);}));details.append(group);
   });
   const add=inspector.button('Add gradient fill',()=>write([...gradients,{type:'linear',angle:180,x:50,y:50,shape:'ellipse',stops:[{color:'#000000',position:0},{color:'#ffffff',position:100}]}]));add.disabled=gradients.length>=8;details.append(add);
  }
  const clear=inspector.button('Clear background images',()=>write([]));clear.disabled=gradients?.length===0;details.append(clear);const reset=inspector.button('Reset gradient fills',()=>write(null));try{reset.disabled=classes(info.className,null)===info.className;}catch(error){reset.disabled=true;reset.title=error.message;}details.append(reset);
  if(element.style.getPropertyPriority('background-image')==='important'||element.style.getPropertyPriority('background')==='important'){for(const input of details.querySelectorAll('input,select,button'))input.disabled=true;inspector.note(details,'An inline important background controls this layer.');}
  for(const label of details.querySelectorAll('.inspector-field > span'))label.textContent=label.textContent.replace(/^Gradient \d+(?: stop \d+)? /,'');
  inspector.note(details,'Fills are stacked from front to back. Edits follow the selected screen scope.');
 }
 const api={classes,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchClassGradients=api;
})(typeof window==='object'?window:globalThis);
