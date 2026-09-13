(function(root){
  const palette=typeof module!=='undefined'&&module.exports?require('./palette-values.js'):root.RetouchPaletteValues;
  const names={'font-family':'fontFamily','font-weight':'fontWeight','font-style':'fontStyle','font-size':'fontSize','color':'color'};
  function valid(property,value){
    if(typeof value!=='string')return false;
    if(property==='font-family')return value.length>0&&value.length<=500&&!/^(inherit|initial|unset|revert|revert-layer)$/i.test(value.trim())&&value.split(',').every(part=>/^(?:[\p{L}_-][\p{L}\p{N}_-]*(?: +[\p{L}\p{N}_-]+)*|"[\p{L}\p{N} _-]+"|'[\p{L}\p{N} _-]+')$/u.test(part.trim()));
    if(property==='color'){try{palette.fromComputed(value);return true;}catch{return false;}}
    if(property==='font-weight')return /^(?:[1-9]\d{0,3})(?:\.\d{1,3})?$/.test(value)&&Number(value)>=1&&Number(value)<=1000;
    if(property==='font-style')return value==='normal'||value==='italic';
    return property==='font-size'&&/^(?:0|[1-9]\d{0,3})(?:\.\d{1,3})?px$/.test(value)&&parseFloat(value)>=0.1&&parseFloat(value)<=1000;
  }
  const validProperties=properties=>!!properties&&typeof properties==='object'&&!Array.isArray(properties)&&Object.keys(properties).length>0&&Object.keys(properties).length<=Object.keys(names).length&&Object.entries(properties).every(([property,value])=>valid(property,value));
  const api={valid,validProperties,names:Object.freeze(Object.keys(names)),camel:property=>Object.hasOwn(names,property)?names[property]:null};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.RetouchRangeStyles=api;
})(typeof window!=='undefined'?window:null);
