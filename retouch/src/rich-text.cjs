'use strict';
const rangeStyles=require('../shell/range-style-values.js');
const links=require('../shell/link-values.js');
const WRAP_TAGS = new Set(['strong', 'em', 'u', 's', 'sup', 'sub']);

function validateChildrenTree(children, depth, inLink=false, blockDepth=0, keptTag=null) {
  if (!Array.isArray(children)) return 'setChildren needs a children array.';
  if (depth > 8 || blockDepth > 16) return 'Nesting too deep.';
  for (const c of children) {
    if (!c || typeof c !== 'object') return 'Bad node.';
    if (c.t === 'text') {
      if (typeof c.value !== 'string' || c.value.length > 10000) return 'Bad text node.';
    } else if (c.t === 'break') {
      if(Object.keys(c).some(key=>key!=='t'))return 'Bad line break node.';
    } else if (c.t === 'paragraph') {
      const error=require('./text-paragraphs.cjs').validate(c);if(error)return error;
      const err=validateChildrenTree(c.children,depth,inLink,blockDepth+1,keptTag);if(err)return err;
    } else if (c.t === 'block') {
      if(inLink)return 'Text links cannot contain paragraphs or lists.';
      const blocks=require('./rich-text-blocks.cjs'),error=blocks.validateNode(c);if(error)return error;
      const err=validateChildrenTree(c.children,depth,inLink,blockDepth+1,keptTag);if(err)return err;
    } else if (c.t === 'link') {
      if(inLink||!links.valid(c.href))return 'Invalid or nested text link.';
      const err=validateChildrenTree(c.children,depth+1,true,blockDepth,keptTag);if(err)return err;
    } else if (c.t === 'wrap') {
      if (!WRAP_TAGS.has(c.tag)) return `Formatting tag not allowed: ${String(c.tag)}`;
      const err = validateChildrenTree(c.children, depth + 1,inLink,blockDepth,keptTag);
      if (err) return err;
    } else if (c.t === 'style' || c.t === 'styles') {
      if (!(c.t==='styles'?rangeStyles.validProperties(c.properties):rangeStyles.valid(c.property,c.value))) return 'Unsupported text range style.';
      const err = validateChildrenTree(c.children, depth + 1,inLink,blockDepth,keptTag);
      if (err) return err;
    } else if (c.t === 'copy') {
      if(!/^[0-9a-f]{10}$/.test(c.id||'')||!keptTag||!require('./rich-text-copy.cjs').tags.has(keptTag(c.id))||Object.keys(c).some(key=>!['t','id','children','href','marker','paragraph'].includes(key)))return 'Invalid split text source.';
      if(Object.hasOwn(c,'paragraph')&&(c.paragraph!=='inline'||!keptTag||!['span','li'].includes(keptTag(c.id))||Object.hasOwn(c,'tag')||Object.hasOwn(c,'marker')))return 'Invalid paragraph join.';
      if(Object.hasOwn(c,'marker')&&!require('./list-markers.cjs').valid(keptTag(c.id),c.marker))return 'Invalid split list marker.';
      if(Object.hasOwn(c,'href')&&(keptTag(c.id)!=='a'||c.href!==null&&!links.valid(c.href)))return 'Invalid split link URL.';
      if(inLink&&keptTag(c.id)==='a')return 'Text links cannot be nested.';
      const nestedLink=items=>Array.isArray(items)&&items.some(item=>item.t==='link'||['keep','copy'].includes(item.t)&&keptTag(item.id)==='a'||nestedLink(item.children));
      if(keptTag(c.id)==='a'&&nestedLink(c.children))return 'Text links cannot be nested.';
      const block=!c.paragraph&&['li','p','div'].includes(keptTag(c.id));
      const err=validateChildrenTree(c.children,depth+(block?0:1),inLink,blockDepth+(block?1:0),keptTag);if(err)return err;
    } else if (c.t === 'keep') {
      if(Object.hasOwn(c,'paragraph')&&(c.paragraph!=='inline'||!keptTag||!['span','li'].includes(keptTag(c.id))||Object.hasOwn(c,'tag')||Object.hasOwn(c,'marker')))return 'Invalid paragraph join.';
      if(Object.hasOwn(c,'marker')&&(!keptTag||!['ul','ol','div','p','li'].includes(keptTag(c.id))||!require('./list-markers.cjs').valid(c.tag||keptTag(c.id),c.marker)))return 'Invalid kept list marker.';
      if(Object.hasOwn(c,'tag')&&(!['p','ul','ol','li','div'].includes(c.tag)||Object.hasOwn(c,'href')))return 'Invalid kept paragraph/list tag.';
      if(inLink)return 'Source-owned nodes cannot be moved inside a new text link.';
      if(Object.hasOwn(c,'href')&&c.href!==null&&!links.valid(c.href))return 'Invalid kept link URL.';
      if (!/^[0-9a-f]{10}$/.test(c.id || '')) return 'Bad keep id.';
      if (c.children) {
        const block=!c.paragraph&&keptTag&&['p','ul','ol','li','div'].includes(keptTag(c.id));
        const err = validateChildrenTree(c.children, depth+(block?0:1),inLink,blockDepth+(block?1:0),keptTag);
        if (err) return err;
      }
    } else {
      return 'Unknown node type.';
    }
  }
  return null;
}


function styleMarkup(node,content,jsx=false) {
  const properties=node.t==='styles'?node.properties:{[node.property]:node.value};
  if(!rangeStyles.validProperties(properties))throw new Error('Unsupported text range style.');
  const entries=rangeStyles.names.filter(property=>Object.hasOwn(properties,property)).map(property=>[property,properties[property]]);
  const attribute=jsx?'style={{'+entries.map(([property,value])=>rangeStyles.camel(property)+':'+JSON.stringify(value)).join(',')+'}}':'style="'+entries.map(([property,value])=>property+': '+value+';').join(' ').replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"';
  return '<span '+attribute+'>'+content+'</span>';
}

function hrefMarkup(value,jsx=false){
  if(!links.valid(value))throw Error('Invalid text link.');
  return jsx?'{'+JSON.stringify(value)+'}':'"'+value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\{/g,'&#123;').replace(/\}/g,'&#125;')+'"';
}
function linkMarkup(node,content,jsx=false){
  return '<a href='+hrefMarkup(node.href,jsx)+'>'+content+'</a>';
}
function hasLink(children){return Array.isArray(children)&&children.some(node=>node&&(node.t==='link'||node.children&&hasLink(node.children)));}
module.exports={validateChildrenTree,styleMarkup,linkMarkup,hrefMarkup,hasLink};
