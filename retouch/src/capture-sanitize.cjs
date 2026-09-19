'use strict';
const parse5=require('parse5');
// The capture page is untrusted even when our serializer runs there. Reparse
// its result outside that page and admit only inert HTML/SVG authoring content.
const html=new Set('html head body title style meta a abbr address article aside b bdi bdo blockquote br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr i img input ins kbd label legend li main map mark menu meter nav ol optgroup option output p picture pre progress q rp rt ruby s samp section select slot small source span strong sub summary sup table tbody td textarea tfoot th thead time tr u ul var video audio wbr'.split(' '));
const svg=new Set('svg a g defs symbol use image path rect circle ellipse line polyline polygon text tspan textPath style clipPath mask pattern linearGradient radialGradient stop filter feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence title desc marker'.split(' '));
function sanitize(source,{fragment=false,baseURL}={}){
 const tree=fragment?parse5.parseFragment(source):parse5.parse(source);
 function walk(parent){parent.childNodes=(parent.childNodes||[]).filter(node=>{
  if(!node.tagName)return node.nodeName!=='#comment';
  const isHTML=node.namespaceURI==='http://www.w3.org/1999/xhtml',isSVG=node.namespaceURI==='http://www.w3.org/2000/svg';
  if(!(isHTML?html:isSVG?svg:new Set()).has(node.tagName))return false;
  if(node.tagName==='meta'){node.attrs=[{name:'charset',value:'utf-8'}];return true;}
  node.attrs=node.attrs.filter(attr=>{
   const name=attr.name.toLowerCase();if(name.startsWith('on')||name.startsWith('data-rt')||['srcdoc','action','formaction','form','method','is','nonce','autoplay','autofocus','ping'].includes(name))return false;
   if(name==='srcset'){if(!isHTML||!['img','source'].includes(node.tagName))return false;attr.value=require('./capture-srcset.cjs').sanitize(attr.value,baseURL);return !!attr.value;}
   if(['src','href','poster','background'].includes(name)){const value=attr.value.trim();if(name==='href'&&value.startsWith('#'))return true;if(name==='href'&&isSVG&&!['a','image','feImage','use','linearGradient','radialGradient','pattern','textPath','filter','clipPath','mask'].includes(node.tagName))return false;if(/^(https?:\/\/|blob:)/i.test(value))return true;if(baseURL&&!/^[a-z][a-z0-9+.-]*:/i.test(value)){try{attr.value=new URL(value,baseURL).href;return /^https?:/.test(attr.value);}catch{}}return (name==='src'||isSVG&&['image','feImage'].includes(node.tagName))&&/^data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)[;,]/i.test(value);}
   return name!=='srcset';
  });
  if(node.tagName==='form')node.attrs.push({name:'method',value:'dialog'});
  if(node.tagName==='style')for(const child of node.childNodes||[])if(child.nodeName==='#text')child.value=child.value.replace(/</g,'\\3c ');
  walk(node);return true;
 });}
 walk(tree);return parse5.serialize(tree);
}
module.exports={sanitize};
