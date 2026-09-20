'use strict';
// Shared source planner for resolved style paste into React and Liquid classes.
const values=require('../shell/html-css-values.js'),responsive=require('../shell/responsive.js'),inspector=require('../shell/inspector.js'),tokens=require('./class-tokens.cjs');
const text=require('./text-style-classes.cjs'),textProperties=require('./text-styles.cjs').properties,colors=require('./color-style-classes.cjs'),effects=require('./effect-style-classes.cjs');
const imageFill=require('../shell/image-fill.js'),paintOrder=require('../shell/paint-order.js');
const properties=['opacity','background-color','background-image',...paintOrder.properties,'border-color','border-width','border-style','border-radius','box-shadow','filter','backdrop-filter','mix-blend-mode','isolation','color','font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','text-decoration-line','text-transform','display','flex-direction','flex-wrap','justify-content','align-items','gap','padding','width','height'];
// Shorthands and utility families may own more than the requested property.
// Keep ordinary classes beneath the explicit override; never delete a custom
// class or an important shorthand on a guess about its other declarations.
const overlaps={
 opacity:/^opacity-|^\[opacity:/,
 'border-width':/^border(?:-[trblxyse])?(?:$|-(?:\d|\[|\())|^\[border(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?(?:-width)?:/,
 'border-style':/^border(?:-[trblxyse])?-(?:solid|dashed|dotted|double|hidden|none)$|^\[border(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?(?:-style)?:/,
 'border-radius':/^rounded(?:-|$)|^\[border(?:-[a-z-]+)?-radius:/,
 'mix-blend-mode':/^mix-blend-|^\[mix-blend-mode:/,
 isolation:/^(?:isolate|isolation-auto)$|^\[isolation:/,
 display:/^(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid|hidden|contents|flow-root|table(?:-[a-z-]+)?|list-item)$|^\[display:/,
 'flex-direction':/^flex-(?:row|col)(?:-reverse)?$|^\[flex-(?:direction|flow):/,
 'flex-wrap':/^flex-(?:wrap|wrap-reverse|nowrap)$|^\[flex-(?:wrap|flow):/,
 'justify-content':/^justify-(?!items-|self-)|^place-content-|^\[(?:justify-content|place-content):/,
 'align-items':/^items-|^place-items-|^\[(?:align-items|place-items):/,
 gap:/^gap-|^\[(?:(?:row|column)-)?gap:/,
 padding:/^p[xytrblse]?-[^ ]+|^p[ib][se]?-[^ ]+|^\[padding(?:-[a-z-]+)?:/,
 width:/^w-|^size-|^\[(?:width|inline-size|block-size):/,
 height:/^h-|^size-|^\[(?:height|inline-size|block-size):/
};
function compose(className,changes,scope=''){
 if(typeof className!=='string'||!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length||Object.keys(changes).length>properties.length)throw Error('Provide copied layer styles and literal target classes.');
 responsive.replaceScope('','',scope);
 for(const [property,value]of Object.entries(changes))if(!properties.includes(property)||typeof value!=='string'||value.length>10000||!values.valid(property,value,false))throw Error('Unsupported copied layer style: '+property+'.');
 for(const token of className.split(/\s+/).filter(Boolean))if(!tokens.valid(token))throw Error('The source contains unsupported class syntax.');
 // Global resets invalidate even the specialized composers' ownership proofs.
 if(className.split(/\s+/).some(token=>{const part=responsive.split(token);return part.prefix===scope&&/^!|!$/.test(part.value)&&inspector.base(part.value).startsWith('[all:');}))throw Error('Resolve the important all-property reset before pasting styles.');
 let result=className;
 const typography=Object.fromEntries(Object.entries(changes).filter(([key])=>textProperties.includes(key)));if(Object.keys(typography).length)result=text.compose(result,typography,scope);
 const effectValues=Object.fromEntries(Object.entries(changes).filter(([key])=>effects.properties.includes(key)));if(Object.keys(effectValues).length)result=effects.compose(result,effectValues,scope);
 for(const [property,value]of Object.entries(changes)){
  if(textProperties.includes(property)||effects.properties.includes(property))continue;
  if(colors.properties.includes(property)){result=property==='background-color'?colors.composeBackground(result,{'background-color':value,[values.hiddenBackgroundProperty]:'none'},scope):colors.compose(result,property,value,scope);continue;}
  if(property==='background-image'||paintOrder.properties.includes(property)){
   const active=responsive.project(result,scope);
   if(active.split(/\s+/).some(token=>/^!|!$/.test(token)&&/^\[background:/.test(inspector.base(token))))throw Error('Resolve the important background shorthand before pasting image fills.');
   if(property==='background-position'&&active.split(/\s+/).some(token=>/^!|!$/.test(token)&&/^\[background-position-[xy]:/.test(inspector.base(token))))throw Error('Resolve the important image-position axis before pasting image framing.');
   const next=property==='background-image'?paintOrder.frameClasses(imageFill.stackClasses(active,values.imageLayers(value)),{[values.paintVisibilityProperty]:'none'}):paintOrder.frameClasses(active,{[property]:value});
   if(next.split(/\s+/).some(token=>!tokens.valid(token)))throw Error('This image fill cannot be represented as source classes.');
   result=responsive.replaceScope(result,next,scope);continue;
  }
  // Tailwind treats underscores as spaces. Values with literal underscores or
  // escapes need property-aware encoding; refuse rather than alter an asset URL.
  if(/[_\\]/.test(value))throw Error('This copied '+property+' value cannot yet be represented faithfully as a class.');
  const addition='!['+property+':'+value.replace(/\s/g,'_')+']';if(!tokens.valid(addition))throw Error('This copied '+property+' value cannot be represented as a class.');
  const kept=[];
  for(const token of result.split(/\s+/).filter(Boolean)){
   const part=responsive.split(token),plain=inspector.base(part.value);
   if(part.prefix!==scope){kept.push(token);continue;}
   if(plain.startsWith('['+property+':'))continue;
   if(/^!|!$/.test(part.value)&&overlaps[property].test(plain))throw Error('Resolve the important '+property+' utility before pasting this style.');
   kept.push(token);
  }
  result=kept.concat(scope+addition).join(' ');
 }
 return result;
}
module.exports={properties,compose};
