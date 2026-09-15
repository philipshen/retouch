'use strict';
const background=require('../shell/background-paint.js');
const colors=require('../shell/html-css-values.js'),responsive=require('../shell/responsive.js'),inspector=require('../shell/inspector.js'),tokens=require('./class-tokens.cjs');
const properties=['color','background-color','border-color','fill','stroke'];
function encode(property,value){
 if(!properties.includes(property))throw Error('Choose a supported color property.');
 if(typeof value!=='string'||!colors.valid(property==='border-color'?'border-color':'color',value,false))throw Error('Enter a supported literal CSS color.');
 return '!['+property+':'+value.replace(/\s+/g,'_')+']';
}
function related(plain,property){
 if(/^\[all:/.test(plain))return true;
 if(property==='fill')return /^\[fill:/.test(plain)||/^fill-/.test(plain);
 if(property==='stroke'){
  if(/^\[stroke:/.test(plain))return true;
  if(!/^stroke-/.test(plain))return false;
  return !/^stroke-(?:\d+(?:\.\d+)?|\[(?:length:[^\]]+|[-.\d][^\]]*)\]|\(length:[^)]+\))$/.test(plain);
 }
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
function own(plain,property){
 if(plain.startsWith('['+property+':'))return true;
 if(property==='border-color'&&/^\[border-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end)-color:/.test(plain))return true;
 const match=(property==='color'?/^text-(.+)$/:property==='background-color'?/^bg-(.+)$/:property==='fill'?/^fill-(.+)$/:property==='stroke'?/^stroke-(.+)$/:/^border-(?:[trblxyse]-)?(.+)$/).exec(plain);if(!match)return false;
 const value=match[1],alpha='(?:/(?:[0-9]+(?:\\.[0-9]+)?|\\[[^\\]]+\\]|\\([^)]+\\)))?';
 // Restrict implicit names to the standard palette; custom utility names can
 // carry arbitrary declarations and must not be discarded on a guess.
 const named=(['fill','stroke'].includes(property)?'(?:none|':'(?:')+'inherit|current|transparent|black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950))';
 return new RegExp('^'+named+alpha+'$').test(value)||new RegExp('^\\[(?:#[a-fA-F0-9]{3,8}|color:[^\\]]+|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\\([^\\]]+\\))\\]'+alpha+'$').test(value)||new RegExp('^\\(color:[^)]+\\)'+alpha+'$').test(value);
}
function hiddenBackground(className,scope){
 const parts=className.split(/\s+/).filter(Boolean).map(token=>responsive.split(token)).filter(part=>part.prefix===scope).map(part=>inspector.base(part.value));
 const prefix='['+background.property+':',metadata=parts.filter(part=>part.startsWith(prefix));
 if(!metadata.length)return null;
 if(metadata.length!==1)throw Error('The hidden background color settings are ambiguous.');
 const stored=metadata[0].slice(prefix.length,-1).replace(/_/g,' ');
 if(stored==='none')return {stored,hidden:false};
 const declarations=parts.filter(part=>own(part,'background-color'));
 if(declarations.length!==1||!declarations[0].startsWith('[background-color:'))throw Error('The hidden background color settings are ambiguous.');
 const current=declarations[0].slice('[background-color:'.length,-1).replace(/_/g,' ');
 return {...background.state(current,stored),current,stored};
}
function compose(className,property,value,scope=''){
 if(!properties.includes(property))throw Error('Choose a supported color property.');
 if(typeof className!=='string')throw Error('Color styles require literal classes.');responsive.replaceScope('','',scope);
 const hidden=property==='background-color'?hiddenBackground(className,scope):null;
 let metadata;
 if(hidden){
  if(value===null)metadata=null;
  else if(hidden.hidden){const changes=background.edit(hidden.current,hidden.stored,value);value=changes[property];metadata=changes[background.property];}
 }
 const encoded=value===null?null:encode(property,value);
 const kept=[];
 for(const token of className.split(/\s+/).filter(Boolean)){
  if(!tokens.valid(token))throw Error('The source contains unsupported class syntax.');
  const part=responsive.split(token),plain=inspector.base(part.value);
  if(part.prefix!==scope){kept.push(token);continue;}
  if(metadata!==undefined&&plain.startsWith('['+background.property+':'))continue;
  if(own(plain,property))continue;
  // Ordinary utilities remain intact underneath the explicit linked property.
  // Important shorthands may own geometry or images too, so never delete them.
  if(/^!|!$/.test(part.value)&&related(plain,property))throw Error('Resolve the important '+property+' utility before linking this color.');
  kept.push(token);
 }
 if(metadata)kept.push(scope+'!['+background.property+':'+metadata+']');
 return (encoded===null?kept:kept.concat(scope+encoded)).join(' ');
}
function overridden(className,property,value,scope=''){
 const hidden=property==='background-color'?hiddenBackground(className,scope):null;
 if(hidden?.hidden){if(hidden.color!==background.state(value).color)return true;value=hidden.current;}
 const encoded=encode(property,value),projected=responsive.project(className,scope).split(/\s+/).filter(Boolean);
 return !projected.includes(encoded)||projected.some(token=>token!==encoded&&/^!|!$/.test(token)&&related(inspector.base(token),property));
}
function composeBackground(className,changes,scope=''){
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.keys(changes).length!==2||!Object.hasOwn(changes,'background-color')||!Object.hasOwn(changes,background.property)||Object.entries(changes).some(([p,v])=>!colors.valid(p,v)))throw Error('Provide background color and visibility together.');
 if(changes[background.property]!==null&&changes[background.property]!=='none')background.state(changes['background-color'],changes[background.property]);
 if((changes['background-color']===null)!==(changes[background.property]===null))throw Error('Reset background color and visibility together.');
 const kept=className.split(/\s+/).filter(Boolean).filter(token=>{if(!tokens.valid(token))throw Error('The source contains unsupported class syntax.');const part=responsive.split(token);return part.prefix!==scope||!inspector.base(part.value).startsWith('['+background.property+':');}).join(' ');
 const composed=compose(kept,'background-color',changes['background-color'],scope);
 return composed+(changes[background.property]===null?'':' '+scope+'!['+background.property+':'+changes[background.property]+']');
}
function composeStyle(className,property,value,scope='',observed){
 if(property==='background-color'&&observed!==undefined){
  if(!observed||typeof observed!=='object'||Array.isArray(observed)||Object.keys(observed).length!==2||typeof observed.current!=='string'||typeof observed.stored!=='string')throw Error('Re-select the layer to read its background paint.');
  const state=background.state(observed.current,observed.stored);
  // Named screen ranges are defined by the site's CSS. The live inspector
  // supplies the effective paint instead of guessing their cascade in Node.
  if(state.hidden)return composeBackground(className,background.edit(observed.current,observed.stored,value),scope);
 }
 return compose(className,property,value,scope);
}
module.exports={properties,encode,compose,overridden,composeBackground,composeStyle};
