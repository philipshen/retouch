'use strict';
// A palette color is independent of whether a layer uses it as text, fill or stroke.
// Explicit hex, sRGB and Display P3 retain alpha without environment-dependent names.
module.exports=require('./style-library.cjs')({
 filename:'color-styles.json',label:'color style',properties:['color'],
 valid:(property,value)=>property==='color'&&require('../shell/palette-values.js').valid(value)
});
