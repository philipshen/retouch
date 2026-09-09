(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchHTMLCSSValues=api;})(typeof window==='object'?window:globalThis,function(){
 const options={display:['block','inline-block','flex','grid','none'],'flex-direction':['row','column','row-reverse','column-reverse'],'flex-wrap':['nowrap','wrap','wrap-reverse'],'align-items':['start','center','end','stretch','baseline'],'justify-content':['start','center','end','space-between','space-around','space-evenly'],'text-align':['start','left','center','right','justify'],'border-style':['none','solid','dashed','dotted','double']};
 const sides=['top','right','bottom','left'];
 const families={padding:sides.map(s=>'padding-'+s),margin:sides.map(s=>'margin-'+s),gap:['row-gap','column-gap'],'border-width':sides.map(s=>'border-'+s+'-width')};
 const fields=[['width','Width'],['height','Height'],['min-width','Minimum width'],['max-width','Maximum width'],['min-height','Minimum height'],['max-height','Maximum height'],['display','Display'],['flex-direction','Direction'],['flex-wrap','Wrap'],['align-items','Align items'],['justify-content','Distribute items'],['gap','Gap'],['padding','Padding'],...sides.map(s=>['padding-'+s,'Padding '+s]),['margin','Margin'],...sides.map(s=>['margin-'+s,'Margin '+s]),['font-size','Font size'],['line-height','Line height'],['letter-spacing','Letter spacing'],['text-align','Text alignment'],['color','Text color'],['background-color','Background color'],['border-width','Border width'],['border-style','Border style'],['border-color','Border color'],['border-radius','Corner radius']];
 const lengths=new Set([...fields.map(([p])=>p).filter(p=>!options[p]&&!p.endsWith('color')),'row-gap','column-gap',...families['border-width']]);
 const colors=new Set(['color','background-color','border-color']);
 function valid(property,value){
  if(value===null)return lengths.has(property)||colors.has(property)||Object.hasOwn(options,property);
  if(typeof value!=='string'||!value||value.length>150)return false;
  if(Object.hasOwn(options,property))return options[property].includes(value);
  if(colors.has(property))return /^(?:#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})|[a-z]+|(?:rgb|rgba|hsl|hsla)\([\d.%,\s/]+\))$/i.test(value);
  if(!lengths.has(property))return false;
  const parts=value.trim().split(/\s+/),limit=property==='gap'?2:['padding','margin','border-width','border-radius'].includes(property)?4:1;
  if(parts.length>limit)return false;
  return parts.every(token=>{
   if(token==='0')return true;
   const numeric=/^(-?)(?:\d*\.)?\d+(px|rem|em|%|vw|vh|ch)?$/.exec(token);
   if(numeric){
    if(numeric[1]&&property!=='letter-spacing'&&!property.startsWith('margin'))return false;
    if(!numeric[2]&&property!=='line-height')return false;
    if(numeric[2]==='%'&&(['letter-spacing','border-width',...families['border-width']].includes(property)))return false;
    return true;
   }
   if(token==='auto')return /^(?:width|height|min-width|min-height|margin(?:-(?:top|right|bottom|left))?)$/.test(property);
   if(token==='none')return property==='max-width'||property==='max-height';
   if(token==='normal')return ['gap','row-gap','column-gap','line-height','letter-spacing'].includes(property);
   if(['min-content','max-content','fit-content'].includes(token))return /^(?:(?:min|max)-)?(?:width|height)$/.test(property);
   return false;
  });
 }
 function affected(property){
  if(property==='border')return sides.flatMap(side=>['width','style','color'].map(part=>'border-'+side+'-'+part));
  if(/^border-(top|right|bottom|left)$/.test(property))return ['width','style','color'].map(part=>property+'-'+part);
  if(property==='border-color'||property==='border-style')return sides.map(side=>'border-'+side+'-'+property.slice(7));
  return families[property]||[property];
 }
 function overlaps(a,b){return a==='all'||b==='all'||affected(a).some(p=>affected(b).includes(p))||a==='border'&&b.startsWith('border-')||b==='border'&&a.startsWith('border-')||a==='font'&&['font-size','line-height'].includes(b);}
 return {options,fields,families,valid,overlaps};
});
