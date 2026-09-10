(function(root){
 'use strict';
 const V=()=>root.RetouchHTMLCSSValues||require('./html-css-values.js'),expanded={};
 const types={blur:{label:'Blur',unit:'px',initial:'4px',max:1000},brightness:{label:'Brightness',unit:'%',initial:'100%',max:10000},contrast:{label:'Contrast',unit:'%',initial:'100%',max:10000},grayscale:{label:'Grayscale',unit:'%',initial:'100%',max:100},'hue-rotate':{label:'Hue rotation',unit:'deg',initial:'0deg',min:-10000,max:10000},invert:{label:'Invert',unit:'%',initial:'100%',max:100},opacity:{label:'Opacity',unit:'%',initial:'100%',max:100},saturate:{label:'Saturation',unit:'%',initial:'100%',max:10000},sepia:{label:'Sepia',unit:'%',initial:'100%',max:100},'drop-shadow':{label:'Drop shadow',initial:'0px 2px 4px rgba(0, 0, 0, 0.25)'}};
 function change(value,action,index,argument){
  const parsed=V().parseFilters(value);if(!parsed)throw Error('This filter stack contains unsupported values.');const stack=parsed.map(item=>item.raw);
  if(action==='add'){if(!Object.hasOwn(types,argument))throw Error('Choose a supported effect.');stack.push(argument+'('+types[argument].initial+')');}
  else{
   if(!Number.isInteger(index)||index<0||index>=stack.length)throw Error('The selected effect no longer exists.');
   if(action==='remove')stack.splice(index,1);
   else if(action==='up'||action==='down'){const other=index+(action==='up'?-1:1);if(other<0||other>=stack.length)throw Error('The effect cannot move farther.');[stack[index],stack[other]]=[stack[other],stack[index]];}
   else if(action==='type'){if(!Object.hasOwn(types,argument))throw Error('Choose a supported effect.');stack[index]=argument+'('+types[argument].initial+')';}
   else if(action==='value'){if(typeof argument!=='string'||!argument.trim())throw Error('Enter an effect value.');const next=parsed[index].name+'('+argument.trim()+')',single=V().parseFilters(next);if(!single||single.length!==1||single[0].name!==parsed[index].name)throw Error('Enter a value for this effect only.');stack[index]=next;}
   else throw Error('Unsupported filter edit.');
  }
  const next=stack.join(' ')||'none';if(!V().parseFilters(next))throw Error('The effect value is unsupported or the stack exceeds 16 effects.');return next;
 }
 function dropShadow(value,index,changes){
  const stack=V().parseFilters(value);if(!stack||!Number.isInteger(index)||stack[index]?.name!=='drop-shadow')throw Error('Select a drop shadow effect.');
  if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length||Object.keys(changes).some(key=>!['x','y','blur','color'].includes(key)))throw Error('Choose a shadow offset, blur or color.');
  for(const [key,item]of Object.entries(changes))if(key==='color'?typeof item!=='string'||!V().valid('color',item):!Number.isFinite(item)||Math.abs(item)>10000||key==='blur'&&item<0)throw Error('Enter a supported shadow value.');
  const shadow={...V().parseShadows(stack[index].arg)[0],...changes};
  return change(value,'value',index,`${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.color}`);
 }
 function amount(filter){const type=types[filter.name];if(type.unit==='%')return parseFloat(filter.arg)*(filter.arg.endsWith('%')?1:100);if(type.unit==='deg'){const value=parseFloat(filter.arg);return filter.arg.endsWith('turn')?value*360:filter.arg.endsWith('grad')?value*.9:filter.arg.endsWith('rad')?value*180/Math.PI:value;}return parseFloat(filter.arg);}
 function mount(parent,property,value,save,{disabled=false,reset=false}={}){
  const I=root.RetouchInspector,d=parent.ownerDocument,prefix=property==='filter'?'Layer':'Backdrop',details=d.createElement('details'),summary=d.createElement('summary');summary.textContent=prefix+' filter stack';details.append(summary);details.open=!!expanded[property];details.ontoggle=()=>{if(details.isConnected)expanded[property]=details.open;};parent.append(details);
  const parsed=V().parseFilters(value),write=async next=>{try{await save(next);}catch(error){I.note(details,error.message,'refused');}},edit=(action,index,arg)=>{try{return write(change(value,action,index,arg));}catch(error){I.note(details,error.message,'refused');}};
  if(!parsed)I.note(details,'This stack contains filters these controls cannot edit.');
  else{
   parsed.forEach((filter,index)=>{const group=d.createElement('fieldset'),legend=d.createElement('legend'),label=prefix+' effect '+(index+1),type=types[filter.name];legend.textContent=label;group.append(legend);
    I.select(group,label+' type',Object.entries(types).map(([key,item])=>[key,item.label]),filter.name,name=>edit('type',index,name));
    if(type.unit)I.number(group,label+' '+type.label+' ('+type.unit+')',amount(filter),type.min??0,type.max,number=>edit('value',index,String(number)+type.unit));
    else{
     const shadow=V().parseShadows(filter.arg)[0],update=changes=>{try{write(dropShadow(value,index,changes));}catch(error){I.note(group,error.message,'refused');}};
     for(const [key,title]of [['x','X'],['y','Y'],['blur','Blur']])I.number(group,label+' Shadow '+title+' (px)',shadow[key],key==='blur'?0:-10000,10000,number=>update({[key]:number}));
     const color=d.createElement('input');color.value=shadow.color;I.field(group,label+' Shadow color',color);color.oninput=()=>color.setCustomValidity('');color.onchange=()=>{try{const next=dropShadow(value,index,{color:color.value.trim()});if(!d.defaultView.CSS.supports('color',color.value.trim()))throw Error('Enter a supported color.');write(next);}catch(error){color.setCustomValidity(error.message);color.reportValidity();}};
    }
    group.append(I.button('Remove '+label.toLowerCase(),()=>edit('remove',index)));if(index>0)group.append(I.button('Move '+label.toLowerCase()+' up',()=>edit('up',index)));if(index<parsed.length-1)group.append(I.button('Move '+label.toLowerCase()+' down',()=>edit('down',index)));details.append(group);
   });
   let next='blur';I.select(details,'New '+prefix.toLowerCase()+' effect',Object.entries(types).map(([key,item])=>[key,item.label]),next,value=>{next=value;});const add=I.button('Add '+prefix.toLowerCase()+' effect',()=>edit('add',0,next));add.disabled=parsed.length>=16;details.append(add);
  }
  const clear=I.button('Clear '+prefix.toLowerCase()+' filters',()=>write('none'));clear.disabled=parsed?.length===0;details.append(clear);if(reset)details.append(I.button('Reset '+prefix.toLowerCase()+' filters',()=>write(null)));
  if(disabled){for(const input of details.querySelectorAll('input,select,button'))input.disabled=true;I.note(details,'An inline important filter controls this layer.');}
  I.note(details,'Filters run in order. Moving an effect can change the result.');return details;
 }
 const api={change,dropShadow,amount,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchFilterStack=api;
})(typeof window==='object'?window:globalThis);
