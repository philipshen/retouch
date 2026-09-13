(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchHTMLCSSValues=api;})(typeof window==='object'?window:globalThis,function(){
 function gridPlacement(value){
  if(typeof value!=='string'||value.length>150)return false;
  const parts=value.split('/').map(v=>v.trim());if(parts.length>2)return false;
  const line=v=>v==='auto'||/^-?[1-9][0-9]{0,2}$/.test(v)&&Math.abs(Number(v))<=128||/^span (?:[1-9]|1[0-9]|2[0-4])$/.test(v)||/^[A-Za-z_][\w-]*$/.test(v)&&!['span','initial','inherit','unset','revert','revert-layer'].includes(v.toLowerCase());
  return parts.every(line)&&!(parts.length===2&&parts.every(v=>v.startsWith('span '))&&parts[0]!==parts[1]);
 }
 function gridTracks(value){
  if(typeof value!=='string'||value.length>2048)return false;
  if(value==='none')return true;
  function split(text,comma=false){
   const result=[],stack=[];let start=0;
   for(let i=0;i<text.length;i++){
    const c=text[i];if(c==='('||c==='[')stack.push(c);
    else if(c===')'||c===']'){if(stack.pop()!==(c===')'?'(':'['))return null;}
    else if(!stack.length&&(comma?c===',':/\s/.test(c))){const part=text.slice(start,i).trim();if(part)result.push(part);else if(comma)return null;start=i+1;}
   }
   if(stack.length)return null;const end=text.slice(start).trim();if(end)result.push(end);else if(comma)return null;return result;
  }
  const length=v=>/^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|%|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pt|pc))$/.test(v);
  function variable(v,fallback,depth){
   if(depth>=4)return false;const match=/^var\((.*)\)$/.exec(v),args=match&&split(match[1],true);
   return !!args&&args.length<=2&&/^--[a-zA-Z_][a-zA-Z0-9_-]{0,127}$/.test(args[0])&&(args.length===1||fallback(args[1],depth+1));
  }
  const trackLength=(v,depth=0)=>length(v)||variable(v,trackLength,depth);
  const breadth=(v,flex=true,depth=0)=>length(v)||['auto','min-content','max-content'].includes(v)||flex&&/^(?:\d+(?:\.\d+)?|\.\d+)fr$/.test(v)||variable(v,(fallback,next)=>breadth(fallback,flex,next),depth);
  function size(v){
   if(breadth(v))return true;
   const match=/^(minmax|fit-content)\((.*)\)$/.exec(v);if(!match)return false;
   const args=split(match[2],true);return !!args&&(match[1]==='minmax'?args.length===2&&breadth(args[0],false)&&breadth(args[1]):args.length===1&&trackLength(args[0]));
  }
  function list(text,repeated=false){
   const parts=split(text);if(!parts?.length)return 0;let count=0;
   for(const part of parts){
    if(/^\[(?:[A-Za-z_][\w-]*(?:\s+[A-Za-z_][\w-]*)*)\]$/.test(part)){if(part.slice(1,-1).split(/\s+/).some(n=>['auto','span'].includes(n.toLowerCase())))return 0;continue;}
    if(size(part)){count++;continue;}
    const repeat=/^repeat\((.*)\)$/.exec(part),args=repeat&&split(repeat[1],true);
    if(repeated||!args||args.length!==2||! /^(?:[1-9]|1[0-9]|2[0-4])$/.test(args[0]))return 0;
    const tracks=list(args[1],true);if(!tracks)return 0;count+=Number(args[0])*tracks;
   }
   return count<=128?count:0;
  }
  return list(value)>0;
 }
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
 const options={'font-optical-sizing':['auto','none'],visibility:['visible','hidden'],overflow:['visible','hidden','clip','auto','scroll'],'overflow-x':['visible','hidden','clip','auto','scroll'],'overflow-y':['visible','hidden','clip','auto','scroll'],'mix-blend-mode':['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity','plus-lighter'],isolation:['auto','isolate'],'font-style':['normal','italic','oblique'],'text-decoration-line':['none','underline','line-through','overline','underline line-through'],'text-transform':['none','uppercase','lowercase','capitalize'],'object-fit':['cover','contain','fill','none','scale-down'],display:['block','inline-block','flex','inline-flex','grid','inline-grid','none'],'flex-direction':['row','column','row-reverse','column-reverse'],'flex-wrap':['nowrap','wrap','wrap-reverse'],'align-content':['flex-start','flex-end','center','stretch','space-between','space-around','space-evenly'],'align-items':['flex-start','flex-end','start','center','end','stretch','baseline'],'justify-content':['flex-start','flex-end','start','center','end','space-between','space-around','space-evenly'],'text-align':['start','end','left','center','right','justify'],'border-style':['none','solid','dashed','dotted','double']};
 const svgFields=[['fill','SVG fill'],['stroke','SVG stroke'],['stroke-width','SVG stroke width'],['stroke-linecap','SVG line ends'],['stroke-linejoin','SVG line joins'],['stroke-dasharray','SVG dash pattern'],['stroke-dashoffset','SVG dash offset'],['stroke-miterlimit','SVG miter limit'],['vector-effect','SVG stroke scaling']];
 Object.assign(options,{position:['static','relative','absolute','fixed','sticky'],'box-sizing':['border-box','content-box'],'stroke-linecap':['butt','round','square'],'stroke-linejoin':['miter','round','bevel'],'vector-effect':['none','non-scaling-stroke']});
 const sides=['top','right','bottom','left'];
 const corners=['top-left','top-right','bottom-right','bottom-left'];
 const families={inset:sides,'inset-inline':['inset-inline-start','inset-inline-end'],'inset-block':['inset-block-start','inset-block-end'],'border-radius':corners.map(c=>'border-'+c+'-radius'),overflow:['overflow-x','overflow-y'],'grid-column':['grid-column-start','grid-column-end'],'grid-row':['grid-row-start','grid-row-end'],padding:sides.map(s=>'padding-'+s),margin:sides.map(s=>'margin-'+s),gap:['row-gap','column-gap'],'border-width':sides.map(s=>'border-'+s+'-width')};
 const fields=[['width','Width'],['height','Height'],['min-width','Minimum width'],['max-width','Maximum width'],['min-height','Minimum height'],['max-height','Maximum height'],['display','Display'],['flex-direction','Direction'],['flex-wrap','Wrap'],['align-items','Align items'],['align-content','Align lines'],['justify-content','Distribute items'],['gap','Gap'],['padding','Padding'],...sides.map(s=>['padding-'+s,'Padding '+s]),['margin','Margin'],...sides.map(s=>['margin-'+s,'Margin '+s]),['font-family','Font family'],['font-weight','Font weight'],['font-style','Font style'],['text-decoration-line','Text decoration'],['text-transform','Text case'],['font-size','Font size'],['line-height','Line height'],['letter-spacing','Letter spacing'],['text-align','Text alignment'],['color','Text color'],['background-color','Background color'],['border-width','Border width'],['border-style','Border style'],['border-color','Border color'],['border-radius','Corner radius'],...corners.map(c=>['border-'+c+'-radius',c.split('-').map((word,i)=>i?word:word[0].toUpperCase()+word.slice(1)).join(' ')+' corner'])];
 const lengths=new Set([...sides,...fields.map(([p])=>p).filter(p=>!options[p]&&!p.endsWith('color')),'flex-basis','row-gap','column-gap',...families['border-width']]);
 const colors=new Set(['color','background-color','border-color']);
 const colorNumber='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?',hslHue=colorNumber+'(?:deg|grad|rad|turn)?',hslPercent=colorNumber+'%',hslAlpha=colorNumber+'%?';
 const literalHSL=new RegExp('^hsla?\\(\\s*'+hslHue+'(?:\\s*,\\s*'+hslPercent+'\\s*,\\s*'+hslPercent+'(?:\\s*,\\s*'+hslAlpha+')?|\\s+'+hslPercent+'\\s+'+hslPercent+'(?:\\s*/\\s*'+hslAlpha+')?)\\s*\\)$','i');
 const rgbChannel=colorNumber+'%?',literalRGB=new RegExp('^rgba?\\(\\s*'+rgbChannel+'(?:\\s*,\\s*'+rgbChannel+'\\s*,\\s*'+rgbChannel+'(?:\\s*,\\s*'+hslAlpha+')?|\\s+'+rgbChannel+'\\s+'+rgbChannel+'(?:\\s*/\\s*'+hslAlpha+')?)\\s*\\)$','i');

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
 // Explicit Oklab/OkLCh syntax, preserving channels instead of converting gamut.
 // https://www.w3.org/TR/css-color-4/#specifying-oklab-oklch
 function okColor(value){
  const match=/^(oklab|oklch)\((.*)\)$/i.exec(value);if(!match)return false;
  const parts=match[2].split('/');if(parts.length>2)return false;
  const channels=parts[0].trim().split(/\s+/);if(channels.length!==3)return false;
  const component=(token,hue=false)=>{if(token.toLowerCase()==='none')return true;const parsed=/^([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)(%|deg|grad|rad|turn)?$/i.exec(token);return !!parsed&&Number.isFinite(Number(parsed[1]))&&Math.abs(Number(parsed[1]))<=1e6&&(hue?parsed[2]!=='%':!parsed[2]||parsed[2]==='%');};
  return channels.every((token,index)=>component(token,match[1].toLowerCase()==='oklch'&&index===2))&&(parts.length===1||component(parts[1].trim()));
 }
 const variableName=value=>typeof value==='string'&&/^--[a-zA-Z_][a-zA-Z0-9_-]{0,127}$/.test(value);
 function variableCycle(definitions){
  const finished=new Set();
  for(const start of Object.keys(definitions).filter(variableName)){
   const route=[],positions=new Map();let name=start;
   while(variableName(name)&&Object.hasOwn(definitions,name)&&!finished.has(name)){
    if(positions.has(name))return [...route.slice(positions.get(name)),name];
    positions.set(name,route.length);route.push(name);
    name=/^var\((--[a-zA-Z_][a-zA-Z0-9_-]{0,127})\)$/.exec(definitions[name])?.[1];
   }
   for(const name of route)finished.add(name);
  }
  return null;
 }
 function variableValue(value){return value===null||typeof value==='string'&&value.length<=150&&(/^(?:[+-]?(?:\d+(?:\.\d+)?|\.\d+))(?:px|rem|em|%|vw|vh)?$/.test(value)&&Math.abs(parseFloat(value))<=100000||/^var\(--[a-zA-Z_][a-zA-Z0-9_-]{0,127}\)$/.test(value)||valid('color',value,false));}
 function valid(property,value,allowVariable=true){
  if(variableName(property))return variableValue(value)&&value!=='var('+property+')';
  if(allowVariable&&[...fields,...svgFields].some(([name])=>name===property)&&typeof value==='string'&&/^var\(--[a-zA-Z_][a-zA-Z0-9_-]{0,127}\)$/.test(value))return valid(property,null);
  if(['fill','stroke'].includes(property))return value===null||value==='none'||valid('color',value);
  if(property==='stroke-dashoffset')return value===null||typeof value==='string'&&value.length<=40&&/^[-+]?(?:\d+\.?\d*|\.\d+)(?:px|%)?$/.test(value)&&Math.abs(parseFloat(value))<=100000;
  if(property==='stroke-miterlimit')return value===null||typeof value==='string'&&value.length<=40&&/^(?:\d+\.?\d*|\.\d+)$/.test(value)&&Number(value)>=1&&Number(value)<=100000;
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
  if(value===null)return ['flex-grow','flex-shrink','grid-template-columns','grid-template-rows','grid-column','grid-row','opacity','rotate','scale','object-position'].includes(property)||lengths.has(property)||colors.has(property)||Object.hasOwn(options,property);
  if(['grid-template-columns','grid-template-rows'].includes(property))return gridTracks(value)||property==='grid-template-columns'&&parseAdaptiveColumns(value)!==null;
  if(typeof value!=='string'||!value||value.length>150)return false;
  if(property==='border-radius'&&value.includes('/')){const axes=value.split('/');return axes.length===2&&axes.every(axis=>{const tokens=axis.trim().split(/\s+/);return tokens.length>=1&&tokens.length<=4&&tokens.every(token=>valid('border-top-left-radius',token));});}
  if(['flex-grow','flex-shrink'].includes(property))return /^(?:\d*\.)?\d+$/.test(value)&&Number(value)>=0&&Number(value)<=1000;
  if(property==='flex-basis'&&['auto','content'].includes(value))return true;

  if(['grid-column','grid-row'].includes(property))return gridPlacement(value);
  if(property==='font-family')return value.split(',').every(part=>{const name=part.trim();return /^(?:[\p{L}\p{N}_-]+(?: +[\p{L}\p{N}_-]+)*|"[\p{L}\p{N} _-]+"|'[\p{L}\p{N} _-]+')$/u.test(name);});
  if(property==='font-weight')return ['normal','bold'].includes(value)||/^(?:\d*\.)?\d+$/.test(value)&&Number(value)>=1&&Number(value)<=1000;
  if(property==='opacity')return /^(?:\d*\.)?\d+$/.test(value)&&Number(value)>=0&&Number(value)<=1;
  if(property==='scale')return typeof value==='string'&&value.split(' ').length>=2&&value.split(' ').length<=3&&value.split(' ').every(part=>/^-?(?:\d*\.)?\d+(?:e[-+]?\d+)?$/i.test(part)&&Number.isFinite(Number(part))&&Math.abs(Number(part))<=10000);
  if(property==='rotate')return /^-?(?:\d*\.)?\d+deg$/.test(value)&&Math.abs(parseFloat(value))<=360;
  if(property==='object-position'){const parts=value.split(/\s+/);return parts.length===2&&parts.every(p=>/^(?:\d*\.)?\d+%$/.test(p)&&parseFloat(p)>=0&&parseFloat(p)<=100);}
  if(sides.includes(property)&&/^calc\(50% [+-] (?:\d*\.)?\d+px\)$/.test(value))return true;
  if(Object.hasOwn(options,property))return options[property].includes(value);
  if(colors.has(property)&&/^rgba?\(/i.test(value))return literalRGB.test(value);
  if(colors.has(property)&&/^hsla?\(/i.test(value))return literalHSL.test(value);
  if(colors.has(property)&&/^okl(?:ab|ch)\(/i.test(value))return okColor(value);
  if(colors.has(property)&&/^color\((?:srgb|display-p3)\s/i.test(value))return (typeof module==='object'&&module.exports?require('./palette-values.js'):globalThis.RetouchPaletteValues).valid(value);
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
 function shadowTokens(value){
  const result=[];let depth=0,start=0;
  for(let i=0;i<value.length;i++){
   if(value[i]==='(')depth++;
   else if(value[i]===')'&&--depth<0)return null;
   if(/\s/.test(value[i])&&depth===0){if(i>start)result.push(value.slice(start,i));start=i+1;}
  }
  if(depth)return null;if(start<value.length)result.push(value.slice(start));return result;
 }
 function parseShadows(value){
  if(typeof value!=='string'||!value.trim()||value.length>4096)return null;
  if(value.trim()==='none')return [];
  const parts=splitLayers(value);if(!parts||parts.length>16)return null;
  const result=[];
  for(const part of parts){
   const tokens=shadowTokens(part.trim());if(!tokens)return null;
   let color=null,inset=false;const lengths=[];
   for(const token of tokens){
    if(token==='inset'&&!inset){inset=true;continue;}
    if(/^-?(?:\d*\.)?\d+(?:px)?$/.test(token)&&(token.endsWith('px')||Number(token)===0)){
     const number=parseFloat(token);if(!Number.isFinite(number)||Math.abs(number)>10000)return null;lengths.push(number);
    }else if(color===null&&token!=='inset'&&valid('color',token,false))color=token;
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
    const shadows=parseShadows(arg),lengths=(shadowTokens(arg)||[]).filter(token=>/^-?(?:\d*\.)?\d+(?:px)?$/.test(token));
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
 const gradientColorSpaces=['srgb','srgb-linear','display-p3','display-p3-linear','a98-rgb','prophoto-rgb','rec2020','lab','oklab','xyz','xyz-d50','xyz-d65','hsl','hwb','lch','oklch'];
 function parseGradients(value){
  if(typeof value!=='string'||!value.trim()||value.length>8192)return null;
  if(value.trim()==='none')return [];
  const layers=splitLayers(value);if(!layers||layers.length>8)return null;
  const result=[];
  for(const layer of layers){
   const match=/^(?:repeating-)?(linear|radial|conic)-gradient\((.*)\)$/.exec(layer);if(!match)return null;
   const args=splitLayers(match[2]);if(!args)return null;
   const gradient={type:match[1],angle:match[1]==='conic'?0:180,x:50,y:50,shape:'ellipse',stops:[]};
   if(layer.startsWith('repeating-'))gradient.repeat=true;
   let needsGeometry=false;
   const blending=/(?:^|\s)in ([a-z0-9-]+)(?: (shorter|longer|increasing|decreasing) hue)?(?=\s|$)/.exec(args[0]);
   if(blending){
    if(!gradientColorSpaces.includes(blending[1])||blending[2]&&!['hsl','hwb','lch','oklch'].includes(blending[1]))return null;
    gradient.colorSpace=blending[1];if(blending[2])gradient.hue=blending[2];
    args[0]=(args[0].slice(0,blending.index)+' '+args[0].slice(blending.index+blending[0].length)).trim();
    needsGeometry=!!args[0];if(!args[0])args.shift();
   }

   const headerCount=args.length;
   if(gradient.type==='linear'){
    const angle=/^(-?(?:\d*\.)?\d+)deg$/.exec(args[0]);
    const directions={'to top':0,'to right':90,'to bottom':180,'to left':270};
    if(angle){gradient.angle=Number(angle[1]);args.shift();if(Math.abs(gradient.angle)>360)return null;}
    else if(Object.hasOwn(directions,args[0]))gradient.angle=directions[args.shift()];
   }else if(gradient.type==='conic'){
    // CSS Images 4: angular stops use angles or percentages of a full turn.
    // https://www.w3.org/TR/css-images-4/#conic-gradients
    const header=/^(?:from (-?(?:\d*\.)?\d+)(deg|turn|rad|grad))?(?: at ((?:\d*\.)?\d+)% ((?:\d*\.)?\d+)%)?$/.exec(args[0].startsWith('at ')?'from 0deg '+args[0]:args[0]);
    if(header&&(header[1]!==undefined||header[3]!==undefined)){
     gradient.angle=Number(header[1]??0)*({deg:1,turn:360,rad:180/Math.PI,grad:.9}[header[2]]??1);gradient.x=Number(header[3]??50);gradient.y=Number(header[4]??50);args.shift();
     if(Math.abs(gradient.angle)>360||gradient.x>100||gradient.y>100)return null;
    }
   }else {
    const radial=/^(.+?)(?: at ((?:\d*\.)?\d+)% ((?:\d*\.)?\d+)%)?$/.exec(args[0].startsWith('at ')?'ellipse '+args[0]:args[0]);
    if(radial){
     const tokens=radial[1].split(/\s+/),shapes=tokens.filter(token=>['circle','ellipse'].includes(token)),sizes=tokens.filter(token=>!['circle','ellipse'].includes(token));
     const keyword=sizes.length===1&&['closest-side','closest-corner','farthest-side','farthest-corner'].includes(sizes[0]);
     const radii=sizes.length>0&&sizes.length<=2&&sizes.every(token=>/^(?:0|(?:\d*\.)?\d+(?:px|%))$/.test(token)&&parseFloat(token)<=10000);
     const shape=shapes[0]||(radii&&sizes.length===1?'circle':'ellipse');
     if(shapes.length<=1&&(keyword||!sizes.length&&shapes.length||radii&&(shape==='ellipse'?sizes.length===2:sizes.length===1&&!sizes[0].endsWith('%')))){
      gradient.shape=shape;if(sizes.length)gradient.size=sizes.map(token=>token==='0'?'0px':token).join(' ');gradient.x=Number(radial[2]??50);gradient.y=Number(radial[3]??50);args.shift();if(gradient.x>100||gradient.y>100)return null;
     }else if(shapes.length||tokens.some(token=>['closest-side','closest-corner','farthest-side','farthest-corner'].includes(token))||/^[\d.-]/.test(radial[1]))return null;
    }
   }
   if(needsGeometry&&args.length===headerCount)return null;
   if(args.length<2||args.length>16)return null;
   const positionPattern=gradient.type==='conic'?/^(.*)\s+((?:\d*\.)?\d+)(%|deg|turn|rad|grad)$/:/^(.*)\s+((?:\d*\.)?\d+)(%)$/;
   for(const arg of args){
    let color=arg;const positions=[];
    for(let count=0;count<2;count++){
     const stop=positionPattern.exec(color);if(!stop)break;
     positions.unshift(Number(stop[2])*({'%':1,deg:100/360,turn:100,rad:100/(2*Math.PI),grad:.25}[stop[3]]));color=stop[1];
    }
    if(!valid('color',color,false)||positions.some(position=>!Number.isFinite(position)||position>100))return null;
    for(const position of positions.length?positions:[null])gradient.stops.push({color,position});
    if(gradient.stops.length>16)return null;
   }
   // Preserve CSS stop fixup: endpoint defaults, ascending anchors, then equal spacing.
   // https://www.w3.org/TR/css-images-3/#color-stop-fixup
   const stops=gradient.stops;stops[0].position??=0;stops.at(-1).position??=100;
   let anchor=0;
   for(let i=1;i<stops.length;i++){
    if(stops[i].position===null)continue;
    stops[i].position=Math.max(stops[anchor].position,stops[i].position);
    const step=(stops[i].position-stops[anchor].position)/(i-anchor);
    for(let j=anchor+1;j<i;j++)stops[j].position=stops[anchor].position+step*(j-anchor);
    anchor=i;
   }
   result.push(gradient);
  }
  return result;
 }
 function serializeGradients(gradients){return gradients.length?gradients.map(g=>`${g.repeat?'repeating-':''}${g.type}-gradient(${g.type==='linear'?g.angle+'deg':g.type==='conic'?'from '+g.angle+'deg at '+g.x+'% '+g.y+'%':g.shape+(g.size?' '+g.size:'')+' at '+g.x+'% '+g.y+'%'}${g.colorSpace?' in '+g.colorSpace+(g.hue?' '+g.hue+' hue':''):''}, ${g.stops.map(s=>s.color+' '+s.position+'%').join(', ')})`).join(', '):'none';}
 function affected(property){
  if(property==='border')return sides.flatMap(side=>['width','style','color'].map(part=>'border-'+side+'-'+part));
  if(/^border-(top|right|bottom|left)$/.test(property))return ['width','style','color'].map(part=>property+'-'+part);
  if(property==='border-color'||property==='border-style')return sides.map(side=>'border-'+side+'-'+property.slice(7));
  return families[property]||[property];
 }
 function overlaps(a,b){if(a==='-webkit-backdrop-filter')a='backdrop-filter';if(b==='-webkit-backdrop-filter')b='backdrop-filter';return a==='all'||b==='all'||/^inset-(?:inline|block)(?:-(?:start|end))?$/.test(a)&&sides.includes(b)||/^inset-(?:inline|block)(?:-(?:start|end))?$/.test(b)&&sides.includes(a)||a==='background'&&b.startsWith('background-')||b==='background'&&a.startsWith('background-')||a==='flex'&&['flex-grow','flex-shrink','flex-basis'].includes(b)||a==='grid'&&b.startsWith('grid-')||a==='grid-template'&&b.startsWith('grid-template-')||a==='grid-area'&&['grid-row','grid-column'].includes(b)||affected(a).some(p=>affected(b).includes(p))||a==='border'&&b.startsWith('border-')&&!b.endsWith('radius')||b==='border'&&a.startsWith('border-')&&!a.endsWith('radius')||['font','font-variant'].includes(a)&&b==='font-variant-numeric'||['font','font-variant'].includes(b)&&a==='font-variant-numeric'||a==='font'&&['font-family','font-weight','font-style','font-size','line-height','font-variation-settings','font-optical-sizing'].includes(b)||a==='text-decoration'&&b==='text-decoration-line';}
 return {variableCycle,variableName,variableValue,parseVariations,serializeVariations,numericGroups,numericValid,numericChange,options,fields,svgFields,families,adaptiveColumns,parseAdaptiveColumns,stackLayout,flexAlignment,valid,overlaps,parseShadows,serializeShadows,parseFilters,withBlur,parseGradients,serializeGradients,gradientColorSpaces};
});
