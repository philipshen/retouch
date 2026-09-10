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
function compose(classes,values,prefix='',remove=[]){
 if(!Array.isArray(remove)||remove.some(property=>!properties.includes(property)))throw Error('Unsupported typography reset properties.');
 if(typeof classes!=='string')throw Error('Text styles require a class string.');
 responsive.replaceScope('','',prefix);const encoded=values&&typeof values==='object'&&!Array.isArray(values)&&!Object.keys(values).length&&remove.length?{}:encode(values),keys=[...new Set([...Object.keys(encoded),...remove])],retained=[];
 for(const token of classes.split(/\s+/).filter(Boolean)){
  if(!classTokens.valid(token))throw Error('The source contains unsupported class syntax.');
  const part=responsive.split(token);if(part.prefix!==prefix){retained.push(token);continue;}
  const plain=inspector.base(part.value);
  if(/^\[font:/.test(plain)||Object.hasOwn(values,'font-variant-numeric')&&/^\[font-variant:/.test(plain))throw Error('Expand the font shorthand before applying a text style.');
  if(hasSizeLeading(plain)&&keys.some(key=>key==='font-size'||key==='line-height')){
   if(!keys.includes('font-size')||!keys.includes('line-height')){
    for(const value of require('../shell/react-selection.js').expandSizeLeading(part.value).split(/\s+/))if(!keys.some(property=>matchers[property](inspector.base(value))))retained.push(prefix+value);
   }
   continue;
  }
  if(!keys.some(property=>matchers[property](plain)))retained.push(token);
 }
 return retained.concat(Object.values(encoded).map(token=>prefix+token)).join(' ');
}
function overrides(className,baseline,prefix=''){
 const encoded=encode(baseline),tokens=responsive.project(className,prefix).split(/\s+/).filter(Boolean);
 return Object.keys(encoded).filter(property=>!tokens.includes(encoded[property])||tokens.some(token=>token!==encoded[property]&&(/^!|!$/.test(token))&&(matchers[property](inspector.base(token))||property==='line-height'&&hasSizeLeading(inspector.base(token))||/^\[font:/.test(inspector.base(token))))).sort();
}
function refresh(className,baseline,next,prefix='',retained=[]){
 encode(baseline);encode(next);
 if(!Array.isArray(retained)||retained.some(property=>!properties.includes(property)))throw Error('Invalid text style overrides.');
 const local=new Set([...retained,...overrides(className,baseline,prefix)]),tokens=responsive.project(className,prefix).split(/\s+/).filter(Boolean).map(inspector.base);
 for(const property of Object.keys(next))if(!Object.hasOwn(baseline,property)&&tokens.some(token=>matchers[property](token)||property==='line-height'&&hasSizeLeading(token)||/^\[font:/.test(token)))local.add(property);
 const values=Object.fromEntries(Object.entries(next).filter(([property])=>!local.has(property))),removed=Object.keys(baseline).filter(property=>!Object.hasOwn(next,property)&&!local.has(property));
 return {classes:Object.keys(values).length||removed.length?compose(className,values,prefix,removed):className,overrides:[...local].sort()};
}
module.exports={encode,compose,overrides,refresh};
