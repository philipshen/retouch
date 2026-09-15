'use strict';
const shadows=require('../shell/shadow-visibility.js'),filters=require('../shell/filter-visibility.js'),visibility={'box-shadow':shadows.property,...filters.properties},properties=[...Object.keys(visibility),...Object.values(visibility)];
module.exports={...require('./style-library.cjs')({filename:'effect-styles.json',label:'effect style',propertyLabel:'effect',properties,valid:require('../shell/html-css-values.js').valid,validateValues(values){
 for(const [property,key]of Object.entries(visibility))if(Object.hasOwn(values,key)){
  if(!Object.hasOwn(values,property))throw Error('Effect visibility requires its effect stack.');
  (property==='box-shadow'?shadows:filters).read(values[property],values[key]);
 }
}}),visibility};
