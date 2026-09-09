'use strict';
const {properties}=require('./text-styles.cjs');
const {valid}=require('../shell/html-css-values.js');
const {fontFamilyClass}=require('../shell/inspector.js');
const classTokens=require('./class-tokens.cjs');
// Canonical property tokens make future linked-style ownership independent of
// theme-specific utility names. Source adapters handle their own quoting.
function encode(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!Object.keys(input).length||Object.keys(input).some(property=>!properties.includes(property)))throw Error('Provide supported text style properties.');
 const result={};
 for(const property of properties){
  if(!Object.hasOwn(input,property))continue;const value=input[property];
  if(typeof value!=='string'||!valid(property,value))throw Error('Unsupported text style value for '+property+'.');
  const token=property==='font-family'?fontFamilyClass(value):'['+property+':'+value.replace(/\s/g,'_')+']';
  if(!token||!classTokens.valid(token))throw Error('This text style cannot be represented as a class.');
  result[property]='!'+token;
 }
 return result;
}
module.exports={encode};
