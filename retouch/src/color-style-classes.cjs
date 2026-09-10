'use strict';
const catalog=require('./color-styles.cjs'),responsive=require('../shell/responsive.js'),inspector=require('../shell/inspector.js'),tokens=require('./class-tokens.cjs');
const properties=['color','background-color','border-color'];
function encode(property,value){
 if(!properties.includes(property))throw Error('Choose a supported color property.');
 catalog.validate({version:1,styles:[{id:'11111111-1111-4111-8111-111111111111',name:'Color',properties:{color:value}}]});
 return '!['+property+':'+value+']';
}
function related(plain,property){
 if(/^\[all:/.test(plain))return true;
 if(property==='color')return /^\[color:/.test(plain)||/^text-/.test(plain)&&!inspector.fontSizeToken(plain)&&!inspector.textAlignToken(plain)&&!/^text-(?:wrap|nowrap|balance|pretty|ellipsis|clip)$/.test(plain);
 if(property==='background-color'){
  if(/^\[background(?:-color)?:/.test(plain))return true;
  if(!/^bg-/.test(plain))return false;
  // These utilities own image placement/compositing, never background-color.
  if(/^bg-(?:none|auto|cover|contain|fixed|local|scroll|repeat|repeat-x|repeat-y|repeat-space|repeat-round|no-repeat|center|top|bottom|left|right|left-top|left-bottom|right-top|right-bottom)$/.test(plain))return false;
  if(/^bg-(?:clip|origin)-(?:border|padding|content|text)$/.test(plain)||/^bg-blend-/.test(plain)||/^bg-(?:gradient-to-|linear-|radial|conic)/.test(plain))return false;
  if(/^bg-\[(?:url\(|image:|length:|size:|position:|(?:repeating-)?(?:linear|radial|conic)-gradient\()/.test(plain)||/^bg-\((?:image|length|size|position):/.test(plain))return false;
  return true;
 }
 const declaration=/^\[([a-z-]+):/.exec(plain)?.[1];
 if(declaration)return /^border(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?(?:-color)?$/.test(declaration);
 if(!/^border(?:-|$)/.test(plain))return false;
 if(/^border(?:-[trblxyse])?(?:-(?:\d+(?:\.\d+)?|\[(?:length:[^\]]+|[-.\d][^\]]*)\]|\(length:[^)]+\)))?$/.test(plain))return false;
 if(/^border(?:-[trblxyse])?-(?:solid|dashed|dotted|double|hidden|none)$/.test(plain)||/^border-(?:collapse|separate)$/.test(plain)||/^border-spacing-/.test(plain))return false;
 return true;
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
