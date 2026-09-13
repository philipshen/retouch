(function(root){
  const palette=typeof module!=='undefined'&&module.exports?require('./palette-values.js'):root.RetouchPaletteValues;
  const names={'font-family':'fontFamily','font-weight':'fontWeight','font-style':'fontStyle','font-size':'fontSize','line-height':'lineHeight','letter-spacing':'letterSpacing','text-transform':'textTransform','font-variant-caps':'fontVariantCaps','color':'color'};
  function valid(property,value){
    if(typeof value!=='string')return false;
    if(property==='font-family')return value.length>0&&value.length<=500&&!/^(inherit|initial|unset|revert|revert-layer)$/i.test(value.trim())&&value.split(',').every(part=>/^(?:[\p{L}_-][\p{L}\p{N}_-]*(?: +[\p{L}\p{N}_-]+)*|"[\p{L}\p{N} _-]+"|'[\p{L}\p{N} _-]+')$/u.test(part.trim()));
    if(property==='color'){try{palette.fromComputed(value);return true;}catch{return false;}}
    if(property==='font-weight')return /^(?:[1-9]\d{0,3})(?:\.\d{1,3})?$/.test(value)&&Number(value)>=1&&Number(value)<=1000;
    if(property==='line-height')return value==='normal'||/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?(?:px|em|%)?$/.test(value);
    if(property==='letter-spacing')return value==='normal'||/^-?(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?(?:px|em)$/.test(value);
    if(property==='text-transform')return ['none','uppercase','lowercase','capitalize'].includes(value);
    if(property==='font-variant-caps')return ['normal','small-caps','all-small-caps'].includes(value);
    if(property==='font-style')return value==='normal'||value==='italic';
    return property==='font-size'&&/^(?:0|[1-9]\d{0,3})(?:\.\d{1,3})?px$/.test(value)&&parseFloat(value)>=0.1&&parseFloat(value)<=1000;
  }
  function spacingValue(property,input){
    const value=String(input).trim().toLowerCase();if(value==='auto'||value==='normal')return 'normal';
    const match=/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(px|em|%|x)?$/.exec(value);if(!match)throw Error('Use pixels or a percentage.');
    const number=Number(match[1]),unit=match[2]||'px';let result;
    if(unit==='x'){if(property!=='line-height')throw Error('A multiplier is only valid for line height.');result=String(number);}
    else if(unit==='%'&&property==='letter-spacing')result=String(Number((number/100).toFixed(8)))+'em';
    else result=String(number)+unit;
    if(!valid(property,result))throw Error('Unsupported text spacing.');return result;
  }
  function spacingDisplay(property,value){
    if(value==='normal')return 'Auto';
    if(property==='letter-spacing'&&value.endsWith('em'))return String(Number((parseFloat(value)*100).toFixed(6)))+'%';
    if(property==='line-height'&&/^\d+(?:\.\d+)?$/.test(value))return value+'x';
    return value;
  }
  const validProperties=properties=>!!properties&&typeof properties==='object'&&!Array.isArray(properties)&&Object.keys(properties).length>0&&Object.keys(properties).length<=Object.keys(names).length&&Object.entries(properties).every(([property,value])=>valid(property,value));
  const api={valid,validProperties,spacingValue,spacingDisplay,names:Object.freeze(Object.keys(names)),camel:property=>Object.hasOwn(names,property)?names[property]:null};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.RetouchRangeStyles=api;
})(typeof window!=='undefined'?window:null);
