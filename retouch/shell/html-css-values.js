(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchHTMLCSSValues=api;})(typeof window==='object'?window:globalThis,function(){
 function parseVariations(value){
  if(value==='normal')return [];
  if(typeof value!=='string'||value.length>500)return null;
  const result=new Map(),parts=value.split(',');if(!parts.length||parts.length>16)return null;
  for(const part of parts){const match=/^\s*(["'])([A-Za-z0-9]{4})\1\s+(-?(?:\d+\.?\d*|\.\d+))\s*$/.exec(part);if(!match||!Number.isFinite(Number(match[3]))||Math.abs(Number(match[3]))>10000)return null;result.set(match[2],Number(match[3]));}
  return [...result];
 }
 const serializeVariations=axes=>axes.map(([tag,value])=>'"'+tag+'" '+value).join(', ')||'normal';
 const numericGroups=[['Number width',[['','Font default'],['proportional-nums','Proportional'],['tabular-nums','Tabular']]],['Number style',[['','Font default'],['lining-nums','Lining'],['oldstyle-nums','Old style']]],['Fractions',[['','Font default'],['diagonal-fractions','Diagonal'],['stacked-fractions','Stacked']]],['Ordinals',[['','Font default'],['ordinal','Special forms']]],['Zero style',[['','Font default'],['slashed-zero','Slashed']]]];
 function numericValid(value){
  if(value==='normal')return true;
  if(typeof value!=='string'||value.length>150||!value.trim())return false;
  const parts=value.trim().split(/\s+/),seen=new Set();
  return parts.every(token=>{const group=numericGroups.findIndex(([,choices])=>choices.some(([v])=>v===token));if(group<0||seen.has(group))return false;seen.add(group);return true;});
 }
 function numericChange(current,label,value){
  const group=numericGroups.find(([name])=>name===label);if(!group||!group[1].some(([v])=>v===value)||!numericValid(current))return null;
  const parts=current==='normal'?[]:current.trim().split(/\s+/),kept=parts.filter(token=>!group[1].some(([v])=>v===token));
  if(value)kept.push(value);return kept.join(' ')||'normal';
 }
 const options={visibility:['visible','hidden'],overflow:['visible','hidden','clip','auto','scroll'],'overflow-x':['visible','hidden','clip','auto','scroll'],'overflow-y':['visible','hidden','clip','auto','scroll'],'mix-blend-mode':['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity','plus-lighter'],isolation:['auto','isolate'],'font-style':['normal','italic','oblique'],'text-decoration-line':['none','underline','line-through','overline','underline line-through'],'text-transform':['none','uppercase','lowercase','capitalize'],'object-fit':['cover','contain','fill','none','scale-down'],display:['block','inline-block','flex','inline-flex','grid','inline-grid','none'],'flex-direction':['row','column','row-reverse','column-reverse'],'flex-wrap':['nowrap','wrap','wrap-reverse'],'align-content':['flex-start','flex-end','center','stretch','space-between','space-around','space-evenly'],'align-items':['flex-start','flex-end','start','center','end','stretch','baseline'],'justify-content':['flex-start','flex-end','start','center','end','space-between','space-around','space-evenly'],'text-align':['start','left','center','right','justify'],'border-style':['none','solid','dashed','dotted','double']};
 const svgFields=[['fill','SVG fill'],['stroke','SVG stroke'],['stroke-width','SVG stroke width'],['stroke-linecap','SVG line ends'],['stroke-linejoin','SVG line joins'],['stroke-dasharray','SVG dash pattern']];
 Object.assign(options,{position:['static','relative','absolute','fixed','sticky'],'box-sizing':['border-box','content-box'],'stroke-linecap':['butt','round','square'],'stroke-linejoin':['miter','round','bevel']});
 const sides=['top','right','bottom','left'];
 const corners=['top-left','top-right','bottom-right','bottom-left'];
 const families={inset:sides,'inset-inline':['inset-inline-start','inset-inline-end'],'inset-block':['inset-block-start','inset-block-end'],'border-radius':corners.map(c=>'border-'+c+'-radius'),overflow:['overflow-x','overflow-y'],'grid-column':['grid-column-start','grid-column-end'],'grid-row':['grid-row-start','grid-row-end'],padding:sides.map(s=>'padding-'+s),margin:sides.map(s=>'margin-'+s),gap:['row-gap','column-gap'],'border-width':sides.map(s=>'border-'+s+'-width')};
 const fields=[['width','Width'],['height','Height'],['min-width','Minimum width'],['max-width','Maximum width'],['min-height','Minimum height'],['max-height','Maximum height'],['display','Display'],['flex-direction','Direction'],['flex-wrap','Wrap'],['align-items','Align items'],['align-content','Align lines'],['justify-content','Distribute items'],['gap','Gap'],['padding','Padding'],...sides.map(s=>['padding-'+s,'Padding '+s]),['margin','Margin'],...sides.map(s=>['margin-'+s,'Margin '+s]),['font-family','Font family'],['font-weight','Font weight'],['font-style','Font style'],['text-decoration-line','Text decoration'],['text-transform','Text case'],['font-size','Font size'],['line-height','Line height'],['letter-spacing','Letter spacing'],['text-align','Text alignment'],['color','Text color'],['background-color','Background color'],['border-width','Border width'],['border-style','Border style'],['border-color','Border color'],['border-radius','Corner radius'],...corners.map(c=>['border-'+c+'-radius',c.split('-').map((word,i)=>i?word:word[0].toUpperCase()+word.slice(1)).join(' ')+' corner'])];
 const lengths=new Set([...sides,...fields.map(([p])=>p).filter(p=>!options[p]&&!p.endsWith('color')),'flex-basis','row-gap','column-gap',...families['border-width']]);
 const colors=new Set(['color','background-color','border-color']);
 function adaptiveColumns(size){return Number.isInteger(size)&&size>=1&&size<=2000?`repeat(auto-fit, minmax(min(100%, ${size}px), 1fr))`:null;}
 function parseAdaptiveColumns(value){const match=/^repeat\(auto-fit, minmax\(min\(100%, ([1-9][0-9]{0,3})px\), 1fr\)\)$/.exec(value||'');return match&&Number(match[1])<=2000?Number(match[1]):null;}
 function stackLayout(axis,writingMode='horizontal-tb'){
  const vertical=/^(vertical|sideways)/.test(writingMode);
  return {display:'flex','flex-direction':(axis==='vertical')===vertical?'row':'column','flex-wrap':'nowrap'};
 }
 function flexAlignment(x,y,{writingMode='horizontal-tb',direction='ltr',flexDirection='row',flexWrap='nowrap'}={}){
  const vertical=/^(vertical|sideways)/.test(writingMode),inlineSign=(direction==='rtl'?-1:1)*(writingMode==='sideways-lr'?-1:1),blockSign=vertical&&writingMode.endsWith('-rl')?-1:1;
  const row=flexDirection.startsWith('row'),mainHorizontal=row?!vertical:vertical;
  const mainSign=(row?inlineSign:blockSign)*(flexDirection.endsWith('-reverse')?-1:1),crossSign=(row?blockSign:inlineSign)*(flexWrap==='wrap-reverse'?-1:1);
  const value=(position,sign)=>position===1?'center':(position===0)===(sign===1)?'flex-start':'flex-end';
  const changes={'justify-content':value(mainHorizontal?x:y,mainSign),'align-items':value(mainHorizontal?y:x,crossSign)};
  if(flexWrap!=='nowrap')changes['align-content']=changes['align-items'];
  return changes;
 }
 function valid(property,value){
  if(['fill','stroke'].includes(property))return value===null||value==='none'||valid('color',value);
  if(['stroke-width','stroke-dasharray'].includes(property)){
   if(value===null||property==='stroke-dasharray'&&value==='none')return true;
   if(typeof value!=='string'||value.length>150)return false;
   if(/(?:^\s*,|,\s*,|,\s*$)/.test(value))return false;
   const parts=value.trim().split(/[\s,]+/);
   return parts.length>=1&&parts.length<=(property==='stroke-width'?1:16)&&parts.every(n=>/^(?:\d+\.?\d*|\.\d+)(?:px|%)?$/.test(n)&&parseFloat(n)<=100000);
  }
  if(property==='aspect-ratio'){if(value===null||value==='auto')return true;if(typeof value!=='string'||value.length>60||! /^(?:auto )?(?:\d*\.)?\d+(?: *\/ *(?:\d*\.)?\d+)?$/.test(value))return false;return value.replace(/^auto /,'').split(/ *\/ */).every(n=>Number(n)>0&&Number(n)<=10000);}
  if(property==='background-image')return value===null||parseGradients(value)!==null;
  if(['filter','backdrop-filter'].includes(property))return value===null||parseFilters(value)!==null;
  if(property==='font-variation-settings')return value===null||parseVariations(value)!==null;
  if(property==='font-variant-numeric')return value===null||numericValid(value);
  if(property==='box-shadow')return value===null||parseShadows(value)!==null;
  if(value===null)return ['flex-grow','flex-shrink','grid-template-columns','grid-template-rows','grid-column','grid-row','opacity','rotate','object-position'].includes(property)||lengths.has(property)||colors.has(property)||Object.hasOwn(options,property);
  if(typeof value!=='string'||!value||value.length>150)return false;
  if(property==='border-radius'&&value.includes('/')){const axes=value.split('/');return axes.length===2&&axes.every(axis=>{const tokens=axis.trim().split(/\s+/);return tokens.length>=1&&tokens.length<=4&&tokens.every(token=>valid('border-top-left-radius',token));});}
  if(['flex-grow','flex-shrink'].includes(property))return /^(?:\d*\.)?\d+$/.test(value)&&Number(value)>=0&&Number(value)<=1000;
  if(property==='flex-basis'&&['auto','content'].includes(value))return true;
  if(['grid-template-columns','grid-template-rows'].includes(property)){const match=/^repeat\(([1-9]|1[0-9]|2[0-4]), minmax\(0, 1fr\)\)$/.exec(value);return !!match||value==='none'||property==='grid-template-columns'&&parseAdaptiveColumns(value)!==null;}
  if(['grid-column','grid-row'].includes(property)){const match=/^span ([1-9]|1[0-9]|2[0-4]) \/ span ([1-9]|1[0-9]|2[0-4])$/.exec(value);return !!match&&match[1]===match[2]||value==='auto';}
  if(property==='font-family')return value.split(',').every(part=>{const name=part.trim();return /^(?:[\p{L}\p{N}_-]+(?: +[\p{L}\p{N}_-]+)*|"[\p{L}\p{N} _-]+"|'[\p{L}\p{N} _-]+')$/u.test(name);});
  if(property==='font-weight')return ['normal','bold'].includes(value)||/^(?:\d*\.)?\d+$/.test(value)&&Number(value)>=1&&Number(value)<=1000;
  if(property==='opacity')return /^(?:\d*\.)?\d+$/.test(value)&&Number(value)>=0&&Number(value)<=1;
  if(property==='rotate')return /^-?(?:\d*\.)?\d+deg$/.test(value)&&Math.abs(parseFloat(value))<=360;
  if(property==='object-position'){const parts=value.split(/\s+/);return parts.length===2&&parts.every(p=>/^(?:\d*\.)?\d+%$/.test(p)&&parseFloat(p)>=0&&parseFloat(p)<=100);}
  if(sides.includes(property)&&/^calc\(50% [+-] (?:\d*\.)?\d+px\)$/.test(value))return true;
  if(Object.hasOwn(options,property))return options[property].includes(value);
  if(colors.has(property))return /^(?:#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})|[a-z]+|(?:rgb|rgba|hsl|hsla)\([\d.%,\s/]+\))$/i.test(value);
  if(!lengths.has(property))return false;
  const parts=value.trim().split(/\s+/),limit=property==='gap'||families['border-radius'].includes(property)?2:['padding','margin','border-width','border-radius'].includes(property)?4:1;
  if(parts.length>limit)return false;
  return parts.every(token=>{
   if(token==='0')return true;
   const numeric=/^(-?)(?:\d*\.)?\d+(px|rem|em|%|vw|vh|ch)?$/.exec(token);
   if(numeric){
    if(numeric[1]&&property!=='letter-spacing'&&!property.startsWith('margin')&&!sides.includes(property))return false;
    if(!numeric[2]&&property!=='line-height')return false;
    if(numeric[2]==='%'&&(['letter-spacing','border-width',...families['border-width']].includes(property)))return false;
    return true;
   }
   if(token==='auto'&&sides.includes(property))return true;
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
 function parseFilters(value){
  if(typeof value!=='string'||!value.trim()||value.length>4096)return null;
  if(value.trim()==='none')return [];
  const result=[];let rest=value.trim();
  while(rest){
   const match=/^([a-z-]+)\(/.exec(rest);if(!match||result.length>=16)return null;
   let end=match[0].length,depth=1;for(;end<rest.length&&depth;end++){if(rest[end]==='(')depth++;if(rest[end]===')')depth--;}
   if(depth)return null;
   const name=match[1],arg=rest.slice(match[0].length,end-1).trim(),raw=rest.slice(0,end);
   if(name==='blur'){if(!/^(?:\d*\.)?\d+(?:px)?$/.test(arg)||(!arg.endsWith('px')&&Number(arg)!==0)||parseFloat(arg)>1000)return null;}
   else if(name==='hue-rotate'){if(!/^-?(?:\d*\.)?\d+(?:deg|rad|turn)$/.test(arg)||Math.abs(parseFloat(arg))>10000)return null;}
   else if(['brightness','contrast','grayscale','invert','opacity','saturate','sepia'].includes(name)){if(!/^(?:\d*\.)?\d+%?$/.test(arg)||parseFloat(arg)>10000)return null;}
   else if(name==='drop-shadow'){
    const shadows=parseShadows(arg),lengths=arg.match(/(?:^|\s)-?(?:\d*\.)?\d+(?:px)?(?=\s|$)/g)||[];
    if(!shadows||shadows.length!==1||shadows[0].inset||lengths.length<2||lengths.length>3)return null;
   }else return null;
   result.push({name,arg,raw});rest=rest.slice(end).trimStart();
  }
  return result;
 }
 function withBlur(value,amount){
  const filters=parseFilters(value);if(!filters||filters.filter(f=>f.name==='blur').length>1||!Number.isFinite(amount)||amount<0||amount>1000)return null;
  const result=[];let found=false;
  for(const filter of filters){if(filter.name==='blur'){found=true;if(amount)result.push(`blur(${amount}px)`);}else result.push(filter.raw);}
  if(!found&&amount)result.push(`blur(${amount}px)`);
  return result.join(' ')||'none';
 }
 function splitLayers(value){
  const parts=[];let depth=0,start=0;
  for(let i=0;i<value.length;i++){if(value[i]==='(')depth++;if(value[i]===')'&&--depth<0)return null;if(value[i]===','&&!depth){parts.push(value.slice(start,i).trim());start=i+1;}}
  if(depth)return null;parts.push(value.slice(start).trim());return parts;
 }
 function parseGradients(value){
  if(typeof value!=='string'||!value.trim()||value.length>8192)return null;
  if(value.trim()==='none')return [];
  const layers=splitLayers(value);if(!layers||layers.length>8)return null;
  const result=[];
  for(const layer of layers){
   const match=/^(linear|radial)-gradient\((.*)\)$/.exec(layer);if(!match)return null;
   const args=splitLayers(match[2]);if(!args)return null;
   const gradient={type:match[1],angle:180,x:50,y:50,shape:'ellipse',stops:[]};
   if(gradient.type==='linear'){
    const angle=/^(-?(?:\d*\.)?\d+)deg$/.exec(args[0]);
    const directions={'to top':0,'to right':90,'to bottom':180,'to left':270};
    if(angle){gradient.angle=Number(angle[1]);args.shift();if(Math.abs(gradient.angle)>360)return null;}
    else if(Object.hasOwn(directions,args[0]))gradient.angle=directions[args.shift()];
   }else {
    const radial=/^(ellipse|circle)(?: at ((?:\d*\.)?\d+)% ((?:\d*\.)?\d+)%)?$/.exec(args[0].startsWith('at ')?'ellipse '+args[0]:args[0]);
    if(radial){gradient.shape=radial[1];gradient.x=Number(radial[2]??50);gradient.y=Number(radial[3]??50);args.shift();if(gradient.x>100||gradient.y>100)return null;}
   }
   if(args.length<2||args.length>16)return null;
   for(let i=0;i<args.length;i++){
    const stop=/^(.*?)\s+((?:\d*\.)?\d+)%$/.exec(args[i]);
    const color=stop?stop[1]:args[i],position=stop?Number(stop[2]):i===0?0:i===args.length-1?100:null;
    if(position===null||position>100||!valid('color',color)||gradient.stops.length&&position<gradient.stops.at(-1).position)return null;
    gradient.stops.push({color,position});
   }
   result.push(gradient);
  }
  return result;
 }
 function serializeGradients(gradients){return gradients.length?gradients.map(g=>`${g.type}-gradient(${g.type==='linear'?g.angle+'deg':g.shape+' at '+g.x+'% '+g.y+'%'}, ${g.stops.map(s=>s.color+' '+s.position+'%').join(', ')})`).join(', '):'none';}
 function affected(property){
  if(property==='border')return sides.flatMap(side=>['width','style','color'].map(part=>'border-'+side+'-'+part));
  if(/^border-(top|right|bottom|left)$/.test(property))return ['width','style','color'].map(part=>property+'-'+part);
  if(property==='border-color'||property==='border-style')return sides.map(side=>'border-'+side+'-'+property.slice(7));
  return families[property]||[property];
 }
 function overlaps(a,b){if(a==='-webkit-backdrop-filter')a='backdrop-filter';if(b==='-webkit-backdrop-filter')b='backdrop-filter';return a==='all'||b==='all'||/^inset-(?:inline|block)(?:-(?:start|end))?$/.test(a)&&sides.includes(b)||/^inset-(?:inline|block)(?:-(?:start|end))?$/.test(b)&&sides.includes(a)||a==='background'&&b.startsWith('background-')||b==='background'&&a.startsWith('background-')||a==='flex'&&['flex-grow','flex-shrink','flex-basis'].includes(b)||a==='grid'&&b.startsWith('grid-')||a==='grid-template'&&b.startsWith('grid-template-')||a==='grid-area'&&['grid-row','grid-column'].includes(b)||affected(a).some(p=>affected(b).includes(p))||a==='border'&&b.startsWith('border-')&&!b.endsWith('radius')||b==='border'&&a.startsWith('border-')&&!a.endsWith('radius')||['font','font-variant'].includes(a)&&b==='font-variant-numeric'||['font','font-variant'].includes(b)&&a==='font-variant-numeric'||a==='font'&&['font-family','font-weight','font-style','font-size','line-height','font-variation-settings'].includes(b)||a==='text-decoration'&&b==='text-decoration-line';}
 return {parseVariations,serializeVariations,numericGroups,numericValid,numericChange,options,fields,svgFields,families,adaptiveColumns,parseAdaptiveColumns,stackLayout,flexAlignment,valid,overlaps,parseShadows,serializeShadows,parseFilters,withBlur,parseGradients,serializeGradients};
});
