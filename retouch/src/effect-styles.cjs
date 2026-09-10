'use strict';
const properties=['box-shadow','filter','backdrop-filter'];
module.exports=require('./style-library.cjs')({filename:'effect-styles.json',label:'effect style',propertyLabel:'effect',properties,valid:require('../shell/html-css-values.js').valid});
