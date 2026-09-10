'use strict';
// A palette color is independent of whether a layer uses it as text, fill or stroke.
// Canonical sRGB hex retains explicit alpha without environment-dependent names.
module.exports=require('./style-library.cjs')({
 filename:'color-styles.json',label:'color style',properties:['color'],
 valid:(property,value)=>property==='color'&&/^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value)
});
