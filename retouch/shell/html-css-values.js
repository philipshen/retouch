(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchHTMLCSSValues=api;})(typeof window==='object'?window:globalThis,function(){
 const options={'font-style':['normal','italic','oblique'],'text-decoration-line':['none','underline','line-through','overline','underline line-through'],'text-transform':['none','uppercase','lowercase','capitalize'],'object-fit':['cover','contain','fill','none','scale-down'],display:['block','inline-block','flex','inline-flex','grid','inline-grid','none'],'flex-direction':['row','column','row-reverse','column-reverse'],'flex-wrap':['nowrap','wrap','wrap-reverse'],'align-items':['start','center','end','stretch','baseline'],'justify-content':['start','center','end','space-between','space-around','space-evenly'],'text-align':['start','left','center','right','justify'],'border-style':['none','solid','dashed','dotted','double']};
 const sides=['top','right','bottom','left'];
 const families={'grid-column':['grid-column-start','grid-column-end'],'grid-row':['grid-row-start','grid-row-end'],padding:sides.map(s=>'padding-'+s),margin:sides.map(s=>'margin-'+s),gap:['row-gap','column-gap'],'border-width':sides.map(s=>'border-'+s+'-width')};
 const fields=[['width','Width'],['height','Height'],['min-width','Minimum width'],['max-width','Maximum width'],['min-height','Minimum height'],['max-height','Maximum height'],['display','Display'],['flex-direction','Direction'],['flex-wrap','Wrap'],['align-items','Align items'],['justify-content','Distribute items'],['gap','Gap'],['padding','Padding'],...sides.map(s=>['padding-'+s,'Padding '+s]),['margin','Margin'],...sides.map(s=>['margin-'+s,'Margin '+s]),['font-family','Font family'],['font-weight','Font weight'],['font-style','Font style'],['text-decoration-line','Text decoration'],['text-transform','Text case'],['font-size','Font size'],['line-height','Line height'],['letter-spacing','Letter spacing'],['text-align','Text alignment'],['color','Text color'],['background-color','Background color'],['border-width','Border width'],['border-style','Border style'],['border-color','Border color'],['border-radius','Corner radius']];
 const lengths=new Set([...fields.map(([p])=>p).filter(p=>!options[p]&&!p.endsWith('color')),'flex-basis','row-gap','column-gap',...families['border-width']]);
 const colors=new Set(['color','background-color','border-color']);
 function valid(property,value){
  if(property==='box-shadow')return value===null||parseShadows(value)!==null;
  if(value===null)return ['flex-grow','flex-shrink','grid-template-columns','grid-template-rows','grid-column','grid-row','opacity','rotate','object-position'].includes(property)||lengths.has(property)||colors.has(property)||Object.hasOwn(options,property);
  if(typeof value!=='string'||!value||value.length>150)return false;
  if(['flex-grow','flex-shrink'].includes(property))return /^(?:\d*\.)?\d+$/.test(value)&&Number(value)>=0&&Number(value)<=1000;
  if(property==='flex-basis'&&['auto','content'].includes(value))return true;
  if(['grid-template-columns','grid-template-rows'].includes(property)){const match=/^repeat\(([1-9]|1[0-9]|2[0-4]), minmax\(0, 1fr\)\)$/.exec(value);return !!match||value==='none';}
  if(['grid-column','grid-row'].includes(property)){const match=/^span ([1-9]|1[0-9]|2[0-4]) \/ span ([1-9]|1[0-9]|2[0-4])$/.exec(value);return !!match&&match[1]===match[2]||value==='auto';}
  if(property==='font-family')return value.split(',').every(part=>{const name=part.trim();return /^(?:[\p{L}\p{N}_-]+(?: +[\p{L}\p{N}_-]+)*|"[\p{L}\p{N} _-]+"|'[\p{L}\p{N} _-]+')$/u.test(name);});
  if(property==='font-weight')return ['normal','bold'].includes(value)||/^(?:\d*\.)?\d+$/.test(value)&&Number(value)>=1&&Number(value)<=1000;
  if(property==='opacity')return /^(?:\d*\.)?\d+$/.test(value)&&Number(value)>=0&&Number(value)<=1;
  if(property==='rotate')return /^-?(?:\d*\.)?\d+deg$/.test(value)&&Math.abs(parseFloat(value))<=360;
  if(property==='object-position'){const parts=value.split(/\s+/);return parts.length===2&&parts.every(p=>/^(?:\d*\.)?\d+%$/.test(p)&&parseFloat(p)>=0&&parseFloat(p)<=100);}
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
 function parseShadows(value){
  if(typeof value!=='string'||!value.trim()||value.length>4096)return null;
  if(value.trim()==='none')return [];
  const parts=value.split(/,(?![^()]*\))/);if(parts.length>16)return null;
  const result=[];
  for(const part of parts){
   const tokens=part.trim().match(/(?:rgba?|hsla?)\([^()]*\)|[^\s]+/g)||[];
   let color=null,inset=false;const lengths=[];
   for(const token of tokens){
    if(token==='inset'&&!inset){inset=true;continue;}
    if(/^-?(?:\d*\.)?\d+(?:px)?$/.test(token)&&(token.endsWith('px')||Number(token)===0)){
     const number=parseFloat(token);if(!Number.isFinite(number)||Math.abs(number)>10000)return null;lengths.push(number);
    }else if(color===null&&token!=='inset'&&valid('color',token))color=token;
    else return null;
   }
   if(lengths.length<2||lengths.length>4||(lengths[2]??0)<0)return null;
   result.push({x:lengths[0],y:lengths[1],blur:lengths[2]??0,spread:lengths[3]??0,color:color??'currentColor',inset});
  }
  return result;
 }
 function serializeShadows(shadows){return shadows.length?shadows.map(s=>`${s.inset?'inset ':''}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`).join(', '):'none';}
 function affected(property){
  if(property==='border')return sides.flatMap(side=>['width','style','color'].map(part=>'border-'+side+'-'+part));
  if(/^border-(top|right|bottom|left)$/.test(property))return ['width','style','color'].map(part=>property+'-'+part);
  if(property==='border-color'||property==='border-style')return sides.map(side=>'border-'+side+'-'+property.slice(7));
  return families[property]||[property];
 }
 function overlaps(a,b){return a==='all'||b==='all'||a==='flex'&&['flex-grow','flex-shrink','flex-basis'].includes(b)||a==='grid'&&b.startsWith('grid-')||a==='grid-template'&&b.startsWith('grid-template-')||a==='grid-area'&&['grid-row','grid-column'].includes(b)||affected(a).some(p=>affected(b).includes(p))||a==='border'&&b.startsWith('border-')||b==='border'&&a.startsWith('border-')||a==='font'&&['font-family','font-weight','font-style','font-size','line-height'].includes(b)||a==='text-decoration'&&b==='text-decoration-line';}
 return {options,fields,families,valid,overlaps,parseShadows,serializeShadows};
});
