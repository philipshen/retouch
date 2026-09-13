(function(root){
  const palette=typeof module!=='undefined'&&module.exports?require('./palette-values.js'):root.RetouchPaletteValues;
  const names={'font-weight':'fontWeight','font-style':'fontStyle','font-size':'fontSize','color':'color'};
  function valid(property,value){
    if(typeof value!=='string')return false;
    if(property==='color'){try{palette.fromComputed(value);return true;}catch{return false;}}
    if(property==='font-weight')return value==='400'||value==='700';
    if(property==='font-style')return value==='normal'||value==='italic';
    return property==='font-size'&&/^(?:0|[1-9]\d{0,3})(?:\.\d{1,3})?px$/.test(value)&&parseFloat(value)>=0.1&&parseFloat(value)<=1000;
  }
  const api={valid,camel:property=>Object.hasOwn(names,property)?names[property]:null};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.RetouchRangeStyles=api;
})(typeof window!=='undefined'?window:null);
