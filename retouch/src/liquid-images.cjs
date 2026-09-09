'use strict';
// image_tag is one host node in the source tree, even though Liquid generates
// its markup. Edits preserve that generator and its attributes on every render.
const classes=require('./liquid-classes.cjs');
function parts(value,separator) {
  const out=[];let quote=null,start=0;
  for(let i=0;i<value.length;i++) {
    if(quote){if(value[i]===quote)quote=null;}
    else if(value[i]==='"'||value[i]==="'")quote=value[i];
    else if(value[i]===separator){out.push({value:value.slice(start,i),start,end:i});start=i+1;}
  }
  out.push({value:value.slice(start),start,end:value.length});return out;
}
function literal(expr) {
  const m=/^(['"])([\s\S]*)\1$/.exec(expr.trim());return m&&!m[2].includes(m[1])?m[2]:null;
}
function read(source,start,end) {
  const offset=start+(source.startsWith('{{-',start)?3:2);
  const stop=end-(source.slice(end-3,end)==='-}}'?3:2);
  const expression=source.slice(offset,stop),filters=parts(expression,'|');
  const filter=filters.at(-1),match=/^\s*image_tag\b\s*(:?)/.exec(filter.value);
  if(!match||filters.length<2)return null;
  const argsStart=offset+filter.start+match[0].length;
  const args=new Map();
  for(const part of parts(source.slice(argsStart,stop),',')) {
    if(!part.value.trim())continue;
    const arg=/^\s*([\w-]+)\s*:\s*([\s\S]*?)(\s*)$/.exec(part.value);
    if(!arg)return null;
    const valueStart=argsStart+part.start+part.value.indexOf(arg[2],part.value.indexOf(':')+1);
    if(args.has(arg[1]))return null;
    args.set(arg[1],{expression:arg[2],start:valueStart,end:valueStart+arg[2].length});
  }
  return {tag:'img',kind:'host',generatedImage:true,tagStart:start,openEnd:end,closeStart:end,closeEnd:end,
    childrenStart:end,childrenEnd:end,children:[],selfClosing:true,image:{args,insert:stop,hasArgs:args.size>0,hasColon:!!match[1]}};
}
function separator(node){return node.image.hasArgs?', ':node.image.hasColon?' ':': ';}
function appendArg(ms,node,name,value) {
  const arg=node.image.args.get(name);
  if(arg)ms.overwrite(arg.start,arg.end,value);
  else ms.appendLeft(node.image.insert,separator(node)+name+': '+value+' ');
}
function stamp(ms,node,isInstance) {
  const args=[['data-rt',`'${node.id}'`],['data-rt-section','section.id'],['data-rt-block','block.id'],['data-rt-template','__rt_template'],['data-rt-locale','request.locale.iso_code']];
  if(isInstance)args.push(['data-rt-i','__rt_instance']);
  const additions=[];
  for(const [name,value] of args){const prior=node.image.args.get(name);if(prior)ms.overwrite(prior.start,prior.end,value);else additions.push(name+': '+value);}
  if(additions.length)ms.appendLeft(node.image.insert,separator(node)+additions.join(', ')+' ');
}
function classSource(source,node) {
  const name='__rt_image_classes_'+node.id,prefix=`{% capture ${name} %}`;
  const arg=node.image.args.get('class');
  if(arg?.expression===name) {
    const start=source.lastIndexOf(prefix,node.tagStart),end=source.lastIndexOf('{% endcapture %}',node.tagStart);
    const between=source.slice(end+16,node.tagStart).trim();
    if(start>=0&&end>start&&(between===''||between===`{% capture __rt_image_${node.id} %}`)) return {value:source.slice(start+prefix.length,end),start,end:end+16,name};
  }
  const value=arg?literal(arg.expression):'';
  return {value:value===null?`{{ ${arg.expression} }}`:value,literal:value!==null,name};
}
function describe(source,node,context) {
  const value=classSource(source,node),snapshot=context.className;
  const editable=value.literal||typeof snapshot==='string';
  const wrapper=sourceWrapper(source,node);
  return {className:editable?(value.literal?value.value:classes.effective(value.value,node.id,snapshot)):null,
    classNameDynamic:!editable,classNameReason:editable?null:'Reload the preview to read this element’s rendered classes.',
    src:wrapper?.src||context.src||null,srcMatch:wrapper?.src.startsWith('/assets/')?{pathnameSuffix:'/'+wrapper.src.slice(8)}:null,
    srcDynamic:false,canSetSrc:!node.image.args.has('srcset'),srcReason:node.image.args.has('srcset')?'This image has authored responsive sources. Editing those choices is deferred.':null,canSetTag:false,text:null,textDynamic:false,canSetChildren:false,mixedText:false};
}
function setClasses(ms,resolved,value) {
  const node=resolved.element,prior=classSource(resolved.source,node);
  if(prior.literal) {
    if(!value.includes('\\')&&!value.includes("'"))appendArg(ms,node,'class',`'${value}'`);
    else {ms.appendLeft(node.tagStart,`{% capture ${prior.name} %}${value}{% endcapture %}`);appendArg(ms,node,'class',prior.name);}
    return;
  }
  const snapshot=require('./liquid-context.cjs').context(resolved.context).className;
  const patch=classes.edit(prior.value,node.id,snapshot,value,resolved.source,false);
  const next=`{% capture ${prior.name} %}${patch}{% endcapture %}`;
  if(prior.start!=null)ms.overwrite(prior.start,prior.end,next);
  else {ms.appendLeft(node.tagStart,next);appendArg(ms,node,'class',prior.name);}
}
function sourceWrapper(source,node) {
  const prefix=`{% capture __rt_image_${node.id} %}`;
  const start=source.lastIndexOf(prefix,node.tagStart);
  const suffix=`{% endcapture %}{% assign __rt_image_src_${node.id}`;
  const innerEnd=source.indexOf(suffix,node.openEnd);
  if(start<0||innerEnd<0)return null;
  const meta=/\{% comment %\}retouch-image-v1:([A-Za-z0-9+/=]+)\{% endcomment %\}/g;meta.lastIndex=innerEnd;
  const match=meta.exec(source);if(!match)return null;
  const {src}=JSON.parse(Buffer.from(match[1],'base64').toString('utf8'));
  if(typeof src!=='string')throw new Error('The image source patch changed.');
  return {start,end:meta.lastIndex,original:source.slice(start+prefix.length,innerEnd),src};
}
function setSrc(ms,resolved,src) {
  const node=resolved.element,prior=sourceWrapper(resolved.source,node);
  const original=prior?prior.original:resolved.source.slice(node.tagStart,node.openEnd);
  const v='__rt_image_'+node.id,old=v+'_old',next=v+'_next',oldset=v+'_set',nextset=v+'_newset',item=v+'_item',descriptor=v+'_descriptor',size=v+'_size';
  const asset=src.startsWith('/assets/'),file=src.slice(8);
  const url=asset?`{{ '${file}' | asset_url }}`:src;
  const sized=asset?`{{ '${file}' | asset_img_url: ${size} }}`:src;
  const metadata=Buffer.from(JSON.stringify({src})).toString('base64');
  const output=`{% capture ${v} %}${original}{% endcapture %}`+
    `{% assign __rt_image_src_${node.id} = ${v} | split: ' src="' | last | split: '"' | first %}`+
    `{% capture ${old} %} src="{{ __rt_image_src_${node.id} }}"{% endcapture %}`+
    `{% capture ${next} %} src="${url}"{% endcapture %}`+
    `{% assign ${v} = ${v} | replace: ${old}, ${next} %}`+
    `{% if ${v} contains ' srcset="' %}`+
    `{% assign ${oldset} = ${v} | split: ' srcset="' | last | split: '"' | first %}`+
    `{% assign ${v}_candidates = ${oldset} | split: ',' %}`+
    `{% capture ${nextset} %} srcset="{% for ${item} in ${v}_candidates %}`+
    `{% assign ${descriptor} = ${item} | strip | split: ' ' | last %}`+
    `{% assign ${size} = ${descriptor} | remove: 'w' | append: 'x' %}`+
    `${sized} {{ ${descriptor} }}{% unless forloop.last %}, {% endunless %}{% endfor %}"{% endcapture %}`+
    `{% capture ${old} %} srcset="{{ ${oldset} }}"{% endcapture %}`+
    `{% assign ${v} = ${v} | replace: ${old}, ${nextset} %}{% endif %}`+
    `{{ ${v} }}{% comment %}retouch-image-v1:${metadata}{% endcomment %}`;
  ms.overwrite(prior?.start??node.tagStart,prior?.end??node.openEnd,output);
}
module.exports={read,stamp,describe,setClasses,setSrc};
