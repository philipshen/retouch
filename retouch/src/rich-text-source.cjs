'use strict';
// An HTML string source uses the same keep/text/wrap edit tree as source
// markup. Descriptors contain no renderer-language syntax for the shell to
// interpret: interpolation ranges arrive as opaque, preserved tokens.
const {parseFragment}=require('parse5');
const crypto=require('node:crypto');
const {validateChildrenTree,styleMarkup,linkMarkup,hasLink}=require('./rich-text.cjs');
const blockValues=require('./rich-text-blocks.cjs');
const inlineNode=node=>blockValues.inlineTag(node.tagName||node.nodeName)&&(node.childNodes||[]).every(inlineNode);
const escapeText=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\{/g,'&#123;').replace(/\}/g,'&#125;');

function describe(value,sourceId,{tokens=[]}={}) {
  const duplicates=[];
  const tree=parseFragment(value,{sourceCodeLocationInfo:true,onParseError:error=>{if(error.code==='duplicate-attribute')duplicates.push(error.startOffset);}}),kept=new Map();
  const id=key=>crypto.createHash('sha1').update(sourceId+'|'+key).digest('hex').slice(0,10);
  function visit(nodes,prefix) {
    return nodes.map((node,i)=>{
      const key=prefix+'/'+i,loc=node.sourceCodeLocation;
      if (node.nodeName==='#text') {
        const parts=[];let at=0,ordinal=0;
        // The adapter identifies placeholders. Only exact occurrences in text
        // nodes are mapped; attributes stay inside their original opening tag.
        while (at<node.value.length) {
          let found=null;
          for (const token of tokens) {
            const start=node.value.indexOf(token,at);
            if (start>=0&&(!found||start<found.start)) found={token,start};
          }
          if (!found) {parts.push({t:'text',value:node.value.slice(at)});break;}
          if (found.start>at) parts.push({t:'text',value:node.value.slice(at,found.start)});
          const tokenId=id(key+':token:'+ordinal++);
          kept.set(tokenId,{tag:'#text',inline:true,raw:found.token,opaque:true});
          parts.push({t:'token',id:tokenId});at=found.start+found.token.length;
        }
        return {t:'text',value:node.value,parts};
      }
      if (!loc) throw new Error('The stored HTML needs browser repairs; edit its source before formatting it.');
      const nodeId=id(key),raw=value.slice(loc.startOffset,loc.endOffset);
      if (!node.tagName) {kept.set(nodeId,{tag:'#comment',inline:true,raw,opaque:true});return {t:'comment',id:nodeId};}
      const hrefSource=require('./link-source.cjs').htmlHref(value,node);
      const opaque=['script','style','svg','template','iframe'].includes(node.tagName);
      const listTemplate=['ul','ol'].includes(node.tagName)&&!duplicates.some(offset=>offset>=loc.startOffset&&offset<loc.startTag.endOffset)?{tag:node.tagName,attributes:node.attrs.filter(attr=>['class','style'].includes(attr.name)).map(attr=>({name:attr.name,raw:value.slice(loc.attrs[attr.name].startOffset,loc.attrs[attr.name].endOffset)}))}:null;
      kept.set(nodeId,{listTemplate,tag:node.tagName,inline:inlineNode(node),inlineChildren:(node.childNodes||[]).every(inlineNode),raw,opaque,hrefSource:hrefSource?{missing:!!hrefSource.missing,start:hrefSource.start-loc.startOffset,end:hrefSource.end-loc.startOffset}:null,open:value.slice(loc.startOffset,loc.startTag.endOffset),close:loc.endTag?value.slice(loc.endTag.startOffset,loc.endOffset):null});
      return {t:'element',id:nodeId,tag:node.tagName,opaque,editableLink:!!hrefSource,plainLink:!!hrefSource&&node.tagName==='a'&&node.attrs.length===1&&node.attrs[0].name==='href'&&require('../shell/link-values.js').valid(node.attrs[0].value)&&!/\{[%{]/.test(value.slice(loc.startOffset,loc.startTag.endOffset)),children:opaque?[]:visit(node.childNodes,key)};
    });
  }
  return {descriptor:{children:visit(tree.childNodes,'')},kept};
}

function rewrite(value,sourceId,children,options) {
  const {kept}=describe(value,sourceId,options),seen=new Set();
  const error=validateChildrenTree(children,0,false,0,id=>kept.get(id)?.tag);if(error)throw new Error(error);
  const blocks=require('./rich-text-blocks.cjs');
  if(blocks.contains(children)){const error=blocks.placement(children,options?.parentTag||'div',id=>kept.get(id));if(error)throw Error(error);}
  function build(items) {
    return items.map(item=>{
      if(item.t==='text')return escapeText(item.value);
      if(item.t==='break')return '<br>';
      if(item.t==='paragraph')return require('./text-paragraphs.cjs').markup(build(item.children),false,item.spacing);
      if(item.t==='block')return blocks.markup(item,build(item.children),false,item.template?kept.get(item.template)?.listTemplate:null);
      if(item.t==='style'||item.t==='styles')return styleMarkup(item,build(item.children));
      if(item.t==='link')return linkMarkup(item,build(item.children));
      if(item.t==='copy'){const original=kept.get(item.id);if(!original||original.opaque)throw Error('Unknown split text source.');return require('./rich-text-copy.cjs').markup(original.raw,build(item.children),false,item);}
      if(item.t==='wrap')return `<${item.tag}>${build(item.children)}</${item.tag}>`;
      const original=kept.get(item.id);
      if(!original||seen.has(item.id))throw new Error('A kept node is not unique to this text source.');
      seen.add(item.id);
      const patch=raw=>{if(Object.hasOwn(item,'tag'))raw=blocks.patchTag(raw,original.tag,item.tag);if(Object.hasOwn(item,'listInset'))raw=require('./list-inset.cjs').patch(raw,item.tag||original.tag,item.listInset);if(Object.hasOwn(item,'listSpacing'))raw=require('./list-spacing.cjs').patch(raw,item.listSpacing);if(Object.hasOwn(item,'start'))raw=require('./list-start.cjs').patch(raw,item.start);if(Object.hasOwn(item,'spacing'))raw=require('./text-paragraphs.cjs').patchSpacing(raw,item.spacing);if(item.paragraph==='inline')raw=require('./text-paragraphs.cjs').inline(raw);if(item.marker)raw=require('./list-markers.cjs').patch(raw,item.tag||original.tag,item.marker);if(!Object.hasOwn(item,'href'))return raw;if(!original.hrefSource)throw Error('This link URL is controlled by its source.');return raw.slice(0,original.hrefSource.start)+require('./link-source.cjs').attributePatch(original.hrefSource,item.href)+raw.slice(original.hrefSource.end);};
      if(!item.children)return patch(original.raw);
      if(/^<a(?:\s|>)/i.test(original.open||original.raw)&&hasLink(item.children))throw Error('Text links cannot be nested.');
      if(original.opaque||!original.close)throw new Error('This preserved node cannot have editable children.');
      return (Object.hasOwn(item,'tag')||item.marker||item.paragraph)?patch(original.open+build(item.children)+original.close):patch(original.open)+build(item.children)+original.close;
    }).join('');
  }
  const result=build(children);
  if(result.length>50000)throw new Error('The rich text is too large.');
  return result;
}
module.exports={describe,rewrite};
