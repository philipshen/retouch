'use strict';
// An HTML string source uses the same keep/text/wrap edit tree as source
// markup. Descriptors contain no renderer-language syntax for the shell to
// interpret: interpolation ranges arrive as opaque, preserved tokens.
const {parseFragment}=require('parse5');
const crypto=require('node:crypto');
const {validateChildrenTree}=require('./rich-text.cjs');
const escapeText=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\{/g,'&#123;').replace(/\}/g,'&#125;');

function describe(value,sourceId,{tokens=[]}={}) {
  const tree=parseFragment(value,{sourceCodeLocationInfo:true}),kept=new Map();
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
          kept.set(tokenId,{raw:found.token,opaque:true});
          parts.push({t:'token',id:tokenId});at=found.start+found.token.length;
        }
        return {t:'text',value:node.value,parts};
      }
      if (!loc) throw new Error('The stored HTML needs browser repairs; edit its source before formatting it.');
      const nodeId=id(key),raw=value.slice(loc.startOffset,loc.endOffset);
      if (!node.tagName) {kept.set(nodeId,{raw,opaque:true});return {t:'comment',id:nodeId};}
      const opaque=['script','style','svg','template','iframe'].includes(node.tagName);
      kept.set(nodeId,{raw,opaque,open:value.slice(loc.startOffset,loc.startTag.endOffset),close:loc.endTag?value.slice(loc.endTag.startOffset,loc.endOffset):null});
      return {t:'element',id:nodeId,tag:node.tagName,opaque,children:opaque?[]:visit(node.childNodes,key)};
    });
  }
  return {descriptor:{children:visit(tree.childNodes,'')},kept};
}

function rewrite(value,sourceId,children,options) {
  const error=validateChildrenTree(children,0);if(error)throw new Error(error);
  const {kept}=describe(value,sourceId,options),seen=new Set();
  function build(items) {
    return items.map(item=>{
      if(item.t==='text')return escapeText(item.value);
      if(item.t==='wrap')return `<${item.tag}>${build(item.children)}</${item.tag}>`;
      const original=kept.get(item.id);
      if(!original||seen.has(item.id))throw new Error('A kept node is not unique to this text source.');
      seen.add(item.id);
      if(!item.children)return original.raw;
      if(original.opaque||!original.close)throw new Error('This preserved node cannot have editable children.');
      return original.open+build(item.children)+original.close;
    }).join('');
  }
  const result=build(children);
  if(result.length>50000)throw new Error('The rich text is too large.');
  return result;
}
module.exports={describe,rewrite};
