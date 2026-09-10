'use strict';
const catalog=require('./effect-styles.cjs'),responsive=require('../shell/responsive.js'),inspector=require('../shell/inspector.js'),tokens=require('./class-tokens.cjs');
const {properties}=catalog;
function encode(values){
 const validated=catalog.validate({version:1,styles:[{id:'11111111-1111-4111-8111-111111111111',name:'Effects',properties:values}]}).styles[0].properties;
 return Object.fromEntries(Object.entries(validated).map(([property,value])=>{
  const token='!['+property+':'+value.replace(/\s/g,'_')+']';
  if(!tokens.valid(token))throw Error('This effect cannot be represented as a class.');
  return [property,token];
 }));
}
function related(plain,property){
 if(/^\[all:/.test(plain)||plain.startsWith('['+property+':'))return true;
 if(property==='box-shadow')return /^(?:shadow|inset-shadow|ring|inset-ring)(?:-|$)/.test(plain);
 if(property==='backdrop-filter')return /^backdrop-/.test(plain)||/^\[-webkit-backdrop-filter:/.test(plain);
 return /^(?:filter|blur|brightness|contrast|drop-shadow|grayscale|hue-rotate|invert|saturate|sepia)(?:-|$)/.test(plain)||/^-hue-rotate-/.test(plain);
}
function compose(className,values,scope='',remove=[]){
 if(typeof className!=='string')throw Error('Effect styles require literal classes.');
 if(!Array.isArray(remove)||remove.some(property=>!properties.includes(property)))throw Error('Unsupported effect reset properties.');
 responsive.replaceScope('','',scope);
 const encoded=values&&typeof values==='object'&&!Array.isArray(values)&&!Object.keys(values).length&&remove.length?{}:encode(values),keys=[...new Set([...Object.keys(encoded),...remove])],kept=[];
 for(const token of className.split(/\s+/).filter(Boolean)){
  if(!tokens.valid(token))throw Error('The source contains unsupported class syntax.');
  const part=responsive.split(token),plain=inspector.base(part.value);
  if(part.prefix!==scope){kept.push(token);continue;}
  if(keys.some(property=>plain.startsWith('['+property+':')))continue;
  // Utility families can share Tailwind custom properties. Keep their source,
  // and refuse important conflicts rather than discard unrelated declarations.
  if(/^!|!$/.test(part.value)&&keys.some(property=>related(plain,property)))throw Error('Resolve the important effect utility before linking this style.');
  kept.push(token);
 }
 return kept.concat(Object.values(encoded).map(token=>scope+token)).join(' ');
}
function overrides(className,baseline,scope=''){
 const encoded=encode(baseline),projected=responsive.project(className,scope).split(/\s+/).filter(Boolean);
 return Object.keys(encoded).filter(property=>!projected.includes(encoded[property])||projected.some(token=>token!==encoded[property]&&/^!|!$/.test(token)&&related(inspector.base(token),property))).sort();
}
function refresh(className,baseline,next,scope='',retained=[]){
 encode(baseline);encode(next);
 if(!Array.isArray(retained)||retained.some(property=>!properties.includes(property)))throw Error('Invalid effect style overrides.');
 const local=new Set([...retained,...overrides(className,baseline,scope)]),projected=responsive.project(className,scope).split(/\s+/).filter(Boolean).map(inspector.base);
 for(const property of Object.keys(next))if(!Object.hasOwn(baseline,property)&&projected.some(token=>related(token,property)))local.add(property);
 const values=Object.fromEntries(Object.entries(next).filter(([property])=>!local.has(property))),removed=Object.keys(baseline).filter(property=>!Object.hasOwn(next,property)&&!local.has(property));
 return {classes:Object.keys(values).length||removed.length?compose(className,values,scope,removed):className,overrides:[...local].sort()};
}
module.exports={properties,encode,compose,overrides,refresh};
