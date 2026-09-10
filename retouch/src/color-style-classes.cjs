'use strict';
const catalog=require('./color-styles.cjs'),responsive=require('../shell/responsive.js'),inspector=require('../shell/inspector.js'),tokens=require('./class-tokens.cjs');
const properties=['color','background-color','border-color'];
function encode(property,value){
 if(!properties.includes(property))throw Error('Choose a supported color property.');
 catalog.validate({version:1,styles:[{id:'11111111-1111-4111-8111-111111111111',name:'Color',properties:{color:value}}]});
 return '!['+property+':'+value+']';
}
function related(plain,property){
 if(/^\[(?:all):/.test(plain))return true;
 if(property==='color')return /^\[color:/.test(plain)||/^text-/.test(plain)&&!inspector.fontSizeToken(plain)&&!inspector.textAlignToken(plain)&&!/^text-(?:wrap|nowrap|balance|pretty|ellipsis|clip)$/.test(plain);
 if(property==='background-color')return /^\[background(?:-color)?:/.test(plain)||/^bg-/.test(plain);
 return /^\[border(?:-[a-z]+)*:/.test(plain)||/^border(?:-|$)/.test(plain);
}
function own(plain,property){return plain.startsWith('['+property+':');}
function compose(className,property,value,scope=''){
 const encoded=encode(property,value);if(typeof className!=='string')throw Error('Color styles require literal classes.');responsive.replaceScope('','',scope);
 const kept=[];
 for(const token of className.split(/\s+/).filter(Boolean)){
  if(!tokens.valid(token))throw Error('The source contains unsupported class syntax.');
  const part=responsive.split(token),plain=inspector.base(part.value);
  if(part.prefix!==scope){kept.push(token);continue;}
  if(own(plain,property))continue;
  // Ordinary utilities remain intact underneath the explicit linked property.
  // Important shorthands may own geometry or images too, so never delete them.
  if(/^!|!$/.test(part.value)&&related(plain,property))throw Error('Resolve the important '+property+' utility before linking this color.');
  kept.push(token);
 }
 return kept.concat(scope+encoded).join(' ');
}
function overridden(className,property,value,scope=''){
 const encoded=encode(property,value),projected=responsive.project(className,scope).split(/\s+/).filter(Boolean);
 return !projected.includes(encoded)||projected.some(token=>token!==encoded&&/^!|!$/.test(token)&&related(inspector.base(token),property));
}
module.exports={properties,encode,compose,overridden};
