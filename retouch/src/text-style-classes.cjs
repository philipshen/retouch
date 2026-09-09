'use strict';
const {properties}=require('./text-styles.cjs');
const {valid}=require('../shell/html-css-values.js');
const inspector=require('../shell/inspector.js');
const {fontFamilyClass}=inspector;
const responsive=require('../shell/responsive.js');
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
const matchers={
 'font-family':inspector.fontFamilyToken,'font-size':inspector.fontSizeToken,'font-weight':inspector.fontWeightToken,'font-style':inspector.fontStyleToken,
 'font-optical-sizing':inspector.opticalToken,'font-variation-settings':inspector.variationToken,'font-variant-numeric':inspector.numericToken,
 'line-height':inspector.lineHeightToken,'letter-spacing':inspector.letterSpacingToken,'text-align':inspector.textAlignToken,'text-decoration-line':inspector.decorationToken,'text-transform':inspector.caseToken
};
function hasSizeLeading(token){
 if(!inspector.fontSizeToken(token)||!token.startsWith('text-'))return false;let depth=0;
 for(const character of token){if(character==='['||character==='(')depth++;else if(character===']'||character===')')depth--;else if(character==='/'&&depth===0)return true;}return false;
}
function compose(classes,values,prefix=''){
 if(typeof classes!=='string')throw Error('Text styles require a class string.');
 responsive.replaceScope('','',prefix);const encoded=encode(values),keys=Object.keys(encoded),retained=[];
 for(const token of classes.split(/\s+/).filter(Boolean)){
  if(!classTokens.valid(token))throw Error('The source contains unsupported class syntax.');
  const part=responsive.split(token);if(part.prefix!==prefix){retained.push(token);continue;}
  const plain=inspector.base(part.value);
  if(/^\[font:/.test(plain)||Object.hasOwn(values,'font-variant-numeric')&&/^\[font-variant:/.test(plain))throw Error('Expand the font shorthand before applying a text style.');
  if(hasSizeLeading(plain)&&keys.some(key=>key==='font-size'||key==='line-height')){
   if(!Object.hasOwn(values,'font-size')||!Object.hasOwn(values,'line-height'))throw Error('This utility combines font size and line height. Apply both properties together.');
   continue;
  }
  if(!keys.some(property=>matchers[property](plain)))retained.push(token);
 }
 return retained.concat(Object.values(encoded).map(token=>prefix+token)).join(' ');
}
module.exports={encode,compose};
