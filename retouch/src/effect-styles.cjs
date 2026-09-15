'use strict';
const shadows=require('../shell/shadow-visibility.js'),properties=['box-shadow','filter','backdrop-filter',shadows.property];
module.exports=require('./style-library.cjs')({filename:'effect-styles.json',label:'effect style',propertyLabel:'effect',properties,valid:require('../shell/html-css-values.js').valid,validateValues(values){
 if(Object.hasOwn(values,shadows.property)){
  if(!Object.hasOwn(values,'box-shadow'))throw Error('Shadow visibility requires its shadow stack.');
  shadows.read(values['box-shadow'],values[shadows.property]);
 }
}});
