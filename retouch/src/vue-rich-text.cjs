'use strict';
const { NodeTypes, ElementTypes } = require('@vue/compiler-dom');
const { parseFragment } = require('parse5');
const source = require('./rich-text-source.cjs');
const tags = new Set(['h1','h2','h3','h4','h5','h6','p','div','span','blockquote','label','a','li']);
function context(resolved, adapter) {
  const element = resolved.element;
  if (element.node.ns !== 0 || !tags.has(element.tag) || element.node.isSelfClosing || element.node.props.some(prop => prop.type === NodeTypes.DIRECTIVE && ['html','text'].includes(prop.name))) throw Error('Choose a native text container.');
  const opening = element.node.loc.source.match(/^<(?:[^"'<>]|"[^"]*"|'[^']*')*>/)?.[0];
  const close = element.node.loc.source.lastIndexOf('</' + element.tag);
  if (!opening || close < opening.length) throw Error('The text container is incomplete.');
  function vue(nodes) {
    return nodes.map(node => {
      if (node.type === NodeTypes.TEXT) return { text: node.content };
      if (node.type !== NodeTypes.ELEMENT || node.tagType !== ElementTypes.ELEMENT || node.ns !== 0 || ['script','style','template','iframe'].includes(node.tag) || node.props.some(prop => prop.type !== NodeTypes.ATTRIBUTE || ['ref','key','data-rt-style'].includes(prop.name.toLowerCase()))) throw Error('This text contains Vue logic or source-owned styles that need separate preservation.');
      // v-pre disappears from Vue's AST; its removal would change interpretation.
      const token = node.loc.source.match(/^<(?:[^"'<>]|"[^"]*"|'[^']*')*>/)?.[0] || '';
      if (/\sv-pre(?:[\s=>]|$)/.test(token.replace(/"[^"]*"|'[^']*'/g,''))) throw Error('This text changes Vue template interpretation.');
      return { tag: node.tag, attrs: node.props.map(prop => [prop.name, prop.value?.content || '']).sort(), children: vue(node.children) };
    });
  }
  function html(nodes) {
    return nodes.map(node => node.nodeName === '#text' ? { text: node.value } : { tag: node.tagName, attrs: (node.attrs || []).map(attr => [attr.name,attr.value]).sort(), children: html(node.childNodes || []) });
  }
  const start = element.start + opening.length, end = element.start + close, value = resolved.source.slice(start,end);
  const browser = parseFragment(element.node.loc.source).childNodes;
  if (browser.length !== 1 || browser[0].tagName !== element.tag || JSON.stringify(vue(element.node.children)) !== JSON.stringify(html(browser[0].childNodes))) throw Error('The browser and Vue interpret this text differently.');
  return { start, end, value, descriptor: source.describe(value, element.id).descriptor };
}
function describe(resolved, adapter, rendered) {
  try {
    const data = context(resolved,adapter);
    function normalize(items,raw,nodes) {
      return nodes.map(node=>{
        const index=raw.findIndex(prior=>prior.type===node.type&&prior.loc.start.offset===node.loc.start.offset),item=items[index];
        if(!item)throw Error('The rendered Vue text could not be matched.');
        return node.type===NodeTypes.TEXT?{t:'text',value:node.content,parts:[{t:'text',value:node.content}]}:{...item,children:normalize(item.children,raw[index].children,node.children)};
      });
    }
    const descendants=adapter.collect(resolved.source,resolved.relPath).elements.filter(element=>element.start>resolved.element.start&&element.end<resolved.element.end);
    const plainFormattingIds=descendants.filter(element=>['strong','b','em','i','u','s','sup','sub','br'].includes(element.tag)&&!element.node.props.length).map(element=>element.id);
    const plainLinkIds=descendants.filter(element=>element.tag==='a'&&element.node.props.length===1&&element.node.props[0].type===NodeTypes.ATTRIBUTE&&element.node.props[0].name==='href'&&require('../shell/link-values.js').valid(element.node.props[0].value?.content)).map(element=>element.id);
    return { canSetChildren: true, plainFormattingIds, plainLinkIds, richText: rendered?{children:normalize(data.descriptor.children,resolved.element.node.children,rendered.node.children)}:data.descriptor };
  }
  catch { return { canSetChildren: false }; }
}
function plan(resolved, op, adapter, escapeText) {
  try {
    if (op.fileHash !== resolved.hash) throw Error('The file changed. Re-select the text.');
    const data = context(resolved,adapter);
    if (resolved.element.tag === 'a' && require('./rich-text.cjs').hasLink(op.children)) throw Error('Text links cannot be nested.');
    const replacement = source.rewrite(data.value,resolved.element.id,op.children,{parentTag:resolved.element.tag,escapeText});
    const after = resolved.source.slice(0,data.start) + replacement + resolved.source.slice(data.end);
    const beforeElements = adapter.collect(resolved.source,resolved.relPath).elements, next = adapter.collect(after,resolved.relPath).elements;
    const root = next.find(element => element.id === resolved.element.id);
    if (!root || root.tag !== resolved.element.tag || root.end !== resolved.element.end + after.length - resolved.source.length) throw Error('Formatting changed the surrounding Vue structure.');
    context({...resolved,source:after,element:root},adapter);
    const outside = (elements,root) => elements.filter(element => element.start <= root.start || element.end >= root.end).map(element => [element.id,element.tag]);
    if (JSON.stringify(outside(beforeElements,resolved.element)) !== JSON.stringify(outside(next,root))) throw Error('Formatting changed an unrelated Vue layer.');
    return { ok:true, structural:true, hash:adapter.contentHash(after), edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}] };
  } catch(error) { return {ok:false,refused:true,reason:error.message}; }
}
module.exports={describe,plan};
