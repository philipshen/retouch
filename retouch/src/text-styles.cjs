'use strict';
const properties=['font-family','font-size','font-weight','font-style','font-optical-sizing','font-variation-settings','font-variant-numeric','line-height','letter-spacing','text-align','text-decoration-line','text-transform'];
module.exports=require('./style-library.cjs')({filename:'text-styles.json',label:'text style',propertyLabel:'typography',properties,valid:require('../shell/html-css-values.js').valid});
