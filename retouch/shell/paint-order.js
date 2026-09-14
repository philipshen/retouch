(function(root){
 'use strict';
 const V=typeof module==='object'&&module.exports?require('./html-css-values.js'):root.RetouchHTMLCSSValues,I=typeof module==='object'&&module.exports?require('./inspector.js'):root.RetouchInspector;
 const defaults={'background-size':'auto','background-position':'0% 0%','background-repeat':'repeat','background-origin':'padding-box','background-clip':'border-box','background-attachment':'scroll','background-blend-mode':'normal'},properties=Object.keys(defaults);
 function reorder(layers,framing,order){
  if(!Array.isArray(layers)||!layers.length||layers.length>8||!Array.isArray(order)||!order.length||order.length>8||order.some(index=>!Number.isInteger(index)||index<0||index>=layers.length))throw Error('Choose a valid paint order.');
  const changes={'background-image':order.map(index=>layers[index]).join(', ')};
  for(const property of properties){const value=framing[property]||defaults[property],values=typeof value==='string'?V.splitLayers(value):null;if(!values?.length||values.length>8||!V.valid(property,value))throw Error('This paint stack uses unsupported '+property+' values.');changes[property]=order.map(index=>values[index%values.length]).join(', ');}
  return changes;
 }
 function prepend(layers,framing,layer){
  if(!Array.isArray(layers)||layers.length>=8||typeof layer!=='string'||!(V.imageLayers(layer)?.length===1||/^var\(--rt-image-fill-[a-f0-9]{10}\)$/.test(layer)))throw Error('Choose a supported paint. A stack can contain up to eight paints.');
  const changes=layers.length?reorder(layers,framing,layers.map((_,index)=>index)):{};
  changes['background-image']=[layer,...layers].join(', ');
  const added={...defaults,'background-size':'cover','background-position':'50% 50%','background-repeat':'no-repeat'};
  for(const property of properties)changes[property]=added[property]+(layers.length?', '+changes[property]:'');
  return changes;
 }
 function edit(layers,framing,index,patch){
  if(!Array.isArray(layers)||!layers.length||layers.length>8||!Number.isInteger(index)||index<0||index>=layers.length||!patch||typeof patch!=='object'||Array.isArray(patch)||!Object.keys(patch).length)throw Error('Choose a paint property to change.');
  const changes={};
  for(const [property,value]of Object.entries(patch)){
   const before=framing[property]||defaults[property];if(!properties.includes(property)||typeof value!=='string'||V.splitLayers(value).length!==1||!V.valid(property,value)||!V.valid(property,before))throw Error('Choose a supported paint property value.');
   const values=V.splitLayers(before);changes[property]=layers.map((_,slot)=>slot===index?value:values[slot%values.length]).join(', ');
  }
  return changes;
 }
 function visibility(layers,framing,stored='none'){
  if(!Array.isArray(layers)||!layers.length||layers.length>8)throw Error('Choose a supported paint stack.');
  const sizes=V.splitLayers(framing['background-size']||defaults['background-size']);
  if(!sizes?.length||!V.valid('background-size',sizes.join(', ')))throw Error('This paint stack uses unsupported background-size values.');
  const entries=V.parsePaintVisibility(stored);
  for(const entry of entries)if(layers[entry.index]!==entry.paint||!/^0(?:px)? 0(?:px)?$/.test(sizes[entry.index%sizes.length]))throw Error('The hidden paint changed outside Retouch. Restore or update its source settings first.');
  return entries;
 }
 function toggleVisibility(layers,framing,stored,index,hidden){
  if(!Number.isInteger(index)||index<0||index>=layers.length||typeof hidden!=='boolean'||V.parseGradients(layers[index])?.length!==1)throw Error('Choose a solid or gradient paint.');
  const entries=visibility(layers,framing,stored),prior=entries.find(entry=>entry.index===index);
  if(!!prior===hidden)return {};
  const sizes=V.splitLayers(framing['background-size']||defaults['background-size']),next=entries.filter(entry=>entry.index!==index);
  if(hidden)next.push({index,paint:layers[index],size:sizes[index%sizes.length]});
  return {...edit(layers,framing,index,{'background-size':hidden?'0px 0px':prior.size}),[V.paintVisibilityProperty]:V.serializePaintVisibility(next.sort((a,b)=>a.index-b.index))};
 }
 function reorderVisibility(layers,framing,stored,order){
  const entries=visibility(layers,framing,stored),changes=reorder(layers,framing,order),next=[];
  order.forEach((oldIndex,index)=>{const entry=entries.find(item=>item.index===oldIndex);if(entry)next.push({...entry,index});});
  return {...changes,[V.paintVisibilityProperty]:V.serializePaintVisibility(next)};
 }
 function prependVisibility(layers,framing,stored,layer){
  const entries=layers.length?visibility(layers,framing,stored):V.parsePaintVisibility(stored);
  if(!layers.length&&entries.length)throw Error('The hidden paint changed outside Retouch.');
  return {...prepend(layers,framing,layer),[V.paintVisibilityProperty]:V.serializePaintVisibility(entries.map(entry=>({...entry,index:entry.index+1})))};
 }
 function editVisibilityPaint(layers,framing,stored,index,paint){
  const entries=visibility(layers,framing,stored);
  if(!Number.isInteger(index)||index<0||index>=layers.length||V.parseGradients(paint)?.length!==1)throw Error('Choose a solid or gradient paint.');
  return {'background-image':layers.map((layer,slot)=>slot===index?paint:layer).join(', '),[V.paintVisibilityProperty]:V.serializePaintVisibility(entries.map(entry=>entry.index===index?{...entry,paint}:entry))};
 }
 function frameClasses(before,changes){
  let next=before;
  for(const property of properties){if(!Object.hasOwn(changes,property))continue;const value=changes[property];if(!V.valid(property,value))throw Error('Choose supported paint framing.');const kind=property.slice(11),match=token=>token.startsWith('['+property+':')||({size:/^bg-(?:(?:cover|contain|auto)$|\[length:|size-\[)/,position:/^bg-(?:(?:center|top|bottom|left|right|(?:left|right)-(?:top|bottom))$|\[position:|position-\[)/,repeat:/^bg-(?:repeat(?:-x|-y|-round|-space)?|no-repeat)$/,origin:/^bg-origin-(?:border|padding|content)$/,clip:/^bg-clip-(?:border|padding|content|text)$/,attachment:/^bg-(?:fixed|local|scroll)$/, 'blend-mode':/^bg-blend-(?:normal|multiply|screen|overlay|darken|lighten|color-dodge|color-burn|hard-light|soft-light|difference|exclusion|hue|saturation|color|luminosity)$/}[kind]?.test(token));next=I.replace(next,match,value===null?'':'!['+property+':'+value.replace(/\s/g,'_')+']');}
  if(Object.hasOwn(changes,V.paintVisibilityProperty)){const value=changes[V.paintVisibilityProperty];if(!V.valid(V.paintVisibilityProperty,value))throw Error('The stored paint visibility is invalid.');next=I.replace(next,token=>token.startsWith('['+V.paintVisibilityProperty+':'),value===null?'':'!['+V.paintVisibilityProperty+':'+value+']');}
  return next;
 }
 const api={properties,defaults,reorder,prepend,edit,frameClasses,visibility,toggleVisibility,reorderVisibility,prependVisibility,editVisibilityPaint};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPaintOrder=api;
})(typeof window==='object'?window:globalThis);
