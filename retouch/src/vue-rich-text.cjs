'use strict';
const { NodeTypes, ElementTypes } = require('@vue/compiler-dom');
const { parseFragment } = require('parse5');
const source = require('./rich-text-source.cjs');
const tags = new Set(['h1','h2','h3','h4','h5','h6','p','div','span','blockquote','label','a','li']);
// Vue emits adjacent literal and interpolation nodes as one browser text node.
function groups(nodes,commentsAsText=false) {
  const result=[];
  for(const node of nodes){
    if([NodeTypes.TEXT,NodeTypes.INTERPOLATION].includes(node.type)||commentsAsText&&node.type===NodeTypes.COMMENT){
      if(result.at(-1)?.text)result.at(-1).nodes.push(node);
      else result.push({text:true,nodes:[node]});
    }else result.push({text:false,nodes:[node]});
  }
  return result;
}
function attributes(node) {
  return node.props.map(prop=>{
    if(prop.type===NodeTypes.ATTRIBUTE){
      if(['ref','key'].includes(prop.name.toLowerCase()))throw Error('This text has a source identity that needs separate preservation.');
      return [prop.name,prop.value?.content||''];
    }
    const argument=prop.arg?.isStatic?prop.arg.content.toLowerCase():null;
    const binding=prop.name==='bind'&&argument&&(['class','style','title','lang','dir'].includes(argument)||/^aria-[a-z-]+$/.test(argument)||node.tag==='a'&&argument==='href');
    const event=prop.name==='on';
    if(!binding&&!event)throw Error('This text contains Vue logic that needs separate preservation.');
    // Validate with Vue, then retain the original directive attribute spelling
    // for the independent HTML shape check. Never emit a reconstructed binding.
    const parsed=parseFragment('<span '+prop.loc.source+'></span>').childNodes[0]?.attrs;
    if(parsed?.length!==1)throw Error('The Vue binding has ambiguous source attributes.');
    return [parsed[0].name,parsed[0].value];
  }).sort();
}
// A rendered destination is not an editable literal when Vue supplies it.
const canEditHref=node=>!node.attrs?.some(attr=>/^(?::href|\.href|v-bind:href)(?:\.|$)/.test(attr.name));
function context(resolved, adapter) {
  const element = resolved.element;
  const commentsAsText=adapter.compilerOptions?.().comments===false;
  if (element.node.ns !== 0 || !tags.has(element.tag) || element.node.isSelfClosing || element.node.props.some(prop => prop.type === NodeTypes.DIRECTIVE && ['html','text'].includes(prop.name))) throw Error('Choose a native text container.');
  const opening = element.node.loc.source.match(/^<(?:[^"'<>]|"[^"]*"|'[^']*')*>/)?.[0];
  const close = element.node.loc.source.lastIndexOf('</' + element.tag);
  if (!opening || close < opening.length) throw Error('The text container is incomplete.');
  const expressions=[];
  function expression(node,last=node){
    let marker='RTVUE'+adapter.contentHash(resolved.source+'|expression|'+node.loc.start.offset).slice(0,20)+'TOKEN';
    while(resolved.source.includes(marker))marker+='X';
    const start=node.loc.start.offset-element.node.loc.start.offset,end=last.loc.end.offset-element.node.loc.start.offset;
    expressions.push({marker,raw:element.node.loc.source.slice(start,end),start,end,empty:node.type===NodeTypes.COMMENT});
    return marker;
  }
  function vue(nodes) {
    return groups(nodes,commentsAsText).map(group => {
      if(group.text){
        const first=group.nodes.findIndex(node=>node.type===NodeTypes.INTERPOLATION),last=group.nodes.findLastIndex(node=>node.type===NodeTypes.INTERPOLATION);
        // Multiple expressions have no observable DOM boundary. Preserve their
        // shared dynamic portion together, including separators between them.
        const literal=node=>node.type===NodeTypes.COMMENT?expression(node):node.content.replace(/\r\n?/g,'\n');
        return {text:first<0?group.nodes.map(literal).join(''):group.nodes.slice(0,first).map(literal).join('')+expression(group.nodes[first],group.nodes[last])+group.nodes.slice(last+1).map(literal).join('')};
      }
      const node=group.nodes[0];
      if(node.type===NodeTypes.COMMENT)return {comment:node.content.replace(/\r\n?/g,'\n')};
      if (node.type !== NodeTypes.ELEMENT || node.tagType !== ElementTypes.ELEMENT || node.ns !== 0 || ['script','style','template','iframe'].includes(node.tag)) throw Error('This text contains Vue logic that needs separate preservation.');
      // v-pre disappears from Vue's AST; its removal would change interpretation.
      const token = node.loc.source.match(/^<(?:[^"'<>]|"[^"]*"|'[^']*')*>/)?.[0] || '';
      if (/\sv-pre(?:[\s=>]|$)/.test(token.replace(/"[^"]*"|'[^']*'/g,''))) throw Error('This text changes Vue template interpretation.');
      return { tag: node.tag, attrs: attributes(node), children: vue(node.children) };
    });
  }
  function html(nodes) {
    return nodes.map(node => node.nodeName === '#text' ? { text: node.value } : node.nodeName === '#comment' ? {comment:node.data} : { tag: node.tagName, attrs: (node.attrs || []).map(attr => [attr.name,attr.value]).sort(), children: html(node.childNodes || []) });
  }
  const expected=vue(element.node.children);
  // Even in preserve mode Vue trims boundary whitespace and condenses some
  // whitespace-only nodes around comments. Mirror only those compiler-owned
  // whitespace changes before comparing with HTML; authored comments and tags
  // remain byte-for-byte, and non-whitespace parser disagreements still fail.
  const whitespace=[];
  const relative=offset=>offset-element.node.loc.start.offset;
  function normalizeWhitespace(node){
    if(node.type!==NodeTypes.ELEMENT)return;
    const open=node.loc.source.match(/^<(?:[^"'<>]|"[^"]*"|'[^']*')*>/)?.[0],close=node.loc.source.lastIndexOf('</'+node.tag);
    if(!open||close<open.length)return;
    let cursor=node.loc.start.offset+open.length;
    const gap=end=>{if(end>cursor){const raw=element.node.loc.source.slice(relative(cursor),relative(end));if(!/^\s*$/.test(raw))throw Error('The Vue text contains unmapped source.');whitespace.push({start:relative(cursor),end:relative(end),marker:''});}};
    for(const child of node.children){
      gap(child.loc.start.offset);
      if(child.type===NodeTypes.TEXT&&/^\s+$/.test(child.loc.source)&&child.loc.source!==child.content)whitespace.push({start:relative(child.loc.start.offset),end:relative(child.loc.end.offset),marker:child.content});
      normalizeWhitespace(child);cursor=child.loc.end.offset;
    }
    gap(node.loc.start.offset+close);
  }
  normalizeWhitespace(element.node);
  let masked=element.node.loc.source;
  const edits=[...expressions,...whitespace.filter(entry=>!expressions.some(expression=>entry.start>=expression.start&&entry.end<=expression.end))].sort((a,b)=>b.start-a.start);
  for(const entry of edits)masked=masked.slice(0,entry.start)+entry.marker+masked.slice(entry.end);
  const start=element.start+opening.length,end=element.start+close,value=masked.slice(opening.length,masked.lastIndexOf('</'+element.tag));
  const browser=parseFragment(masked).childNodes;
  if(browser.length!==1||browser[0].tagName!==element.tag||JSON.stringify(expected)!==JSON.stringify(html(browser[0].childNodes)))throw Error('The browser and Vue interpret this text differently.');
  const tokens=expressions.map(entry=>entry.marker);
  const described=source.describe(value,element.id,{tokens,canEditHref});
  const tokenIds=new Map([...described.kept].filter(([,entry])=>entry.tag==='#text').map(([id,entry])=>[entry.raw,id]));
  return {start,end,value,tokens,expressions,commentsAsText,tokenIds,descriptor:described.descriptor};
}
function describe(resolved, adapter, rendered) {
  try {
    const data = context(resolved,adapter);
    require('./vue-css.cjs').structuralStyles(resolved,adapter,data,false);
    function normalize(items,raw,nodes) {
      const originals=groups(raw);
      return groups(nodes).map(group=>{
        const index=originals.findIndex(prior=>prior.nodes.some(node=>node.loc.start.offset===group.nodes[0].loc.start.offset)),item=items[index];
        if(!item)throw Error('The rendered Vue text could not be matched.');
        if(group.nodes[0].type===NodeTypes.COMMENT)return item;
        if(!group.text)return {...item,children:normalize(item.children,originals[index].nodes[0].children,group.nodes[0].children)};
        const first=group.nodes.findIndex(node=>node.type===NodeTypes.INTERPOLATION),last=group.nodes.findLastIndex(node=>node.type===NodeTypes.INTERPOLATION);
        const literal=node=>({t:'text',value:node.content});
        const parts=first<0?group.nodes.map(literal):[...group.nodes.slice(0,first).map(literal),item.parts.find(part=>part.t==='token'),...group.nodes.slice(last+1).map(literal)];
        if(parts.some(part=>!part))throw Error('A Vue expression could not be matched.');
        return {...item,parts,value:parts.map(part=>part.t==='text'?part.value:'').join('')};
      });
    }
    const descendants=adapter.collect(resolved.source,resolved.relPath).elements.filter(element=>element.start>resolved.element.start&&element.end<resolved.element.end);
    const plainFormattingIds=descendants.filter(element=>['strong','b','em','i','u','s','sup','sub','br'].includes(element.tag)&&!element.node.props.length).map(element=>element.id);
    const plainLinkIds=descendants.filter(element=>element.tag==='a'&&element.node.props.length===1&&element.node.props[0].type===NodeTypes.ATTRIBUTE&&element.node.props[0].name==='href'&&require('../shell/link-values.js').valid(element.node.props[0].value?.content)).map(element=>element.id);
    const richText=rendered&&data.commentsAsText?require('./vue-rich-comments.cjs').project(data,resolved.element.node,rendered.node,adapter.compilerOptions(),groups):rendered?{children:normalize(data.descriptor.children,resolved.element.node.children,rendered.node.children)}:data.descriptor;
    return { canSetChildren: true, plainFormattingIds, plainLinkIds, richText };
  }
  catch { return { canSetChildren: false }; }
}
function plan(resolved, op, adapter, escapeText) {
  try {
    if (op.fileHash !== resolved.hash) throw Error('The file changed. Re-select the text.');
    const data = context(resolved,adapter);
    if (resolved.element.tag === 'a' && require('./rich-text.cjs').hasLink(op.children)) throw Error('Text links cannot be nested.');
    const styles=require('./vue-css.cjs'),prior=styles.documentState(resolved.source,resolved.relPath).model;
    const model=styles.structuralStyles(resolved,adapter,data,false).model,allocated=new Set(),copies=new Map();
    function inventory(node){if(node.type===NodeTypes.ELEMENT)for(const prop of node.props)if(prop.type===NodeTypes.ATTRIBUTE&&prop.name.toLowerCase()==='data-rt-style')allocated.add(prop.value?.content);for(const child of node.children||[])inventory(child);}
    inventory(adapter.collect(resolved.source,resolved.relPath).ast);
    let ordinal=0;
    const copyMarkup=(markup,original)=>{
      const id=parseFragment(original.raw).childNodes[0]?.attrs?.find(attr=>attr.name==='data-rt-style')?.value;
      if(!id)return markup;
      let fresh;do{fresh=adapter.contentHash(resolved.source+'|rich-split|'+id+'|'+ordinal++).slice(0,10);}while(allocated.has(fresh));
      allocated.add(fresh);copies.set(fresh,id);
      return markup.replace(/^<([a-z][a-z0-9-]*)/i,'<$1 data-rt-style="'+fresh+'"');
    };
    // Placeholders are compiler-owned. Literal edits cannot manufacture them,
    // and each live expression must survive exactly once, even inside kept runs.
    if(data.tokens.some(token=>JSON.stringify(op.children).includes(token)))throw Error('Edit the literal text around the live value.');
    let replacement=source.rewrite(data.value,resolved.element.id,op.children,{parentTag:resolved.element.tag,escapeText,copyMarkup,tokens:data.tokens,canEditHref});
    for(const entry of data.expressions){
      if(replacement.split(entry.marker).length!==2)throw Error('Keep each live Vue value exactly once while editing its surrounding text.');
      replacement=replacement.replace(entry.marker,()=>entry.raw);
    }
    let after = resolved.source.slice(0,data.start) + replacement + resolved.source.slice(data.end);
    const beforeElements = adapter.collect(resolved.source,resolved.relPath).elements, next = adapter.collect(after,resolved.relPath).elements;
    const root = next.find(element => element.id === resolved.element.id);
    if (!root || root.tag !== resolved.element.tag || root.end !== resolved.element.end + after.length - resolved.source.length) throw Error('Formatting changed the surrounding Vue structure.');
    context({...resolved,source:after,element:root},adapter);
    const outside = (elements,root) => elements.filter(element => element.start <= root.start || element.end >= root.end).map(element => [element.id,element.tag]);
    if (JSON.stringify(outside(beforeElements,resolved.element)) !== JSON.stringify(outside(next,root))) throw Error('Formatting changed an unrelated Vue layer.');
    // Remove ownership for the edited contents, then restore surviving owners.
    // The wrapper and unrelated layers retain their original style entries.
    const owners=new Set();
    function visit(node){
      if(node.type===NodeTypes.ELEMENT){
        const markers=node.props.filter(prop=>prop.type===NodeTypes.ATTRIBUTE&&prop.name.toLowerCase()==='data-rt-style');
        if(markers.length>1)throw Error('A text run has duplicate style identities.');
        if(markers.length){const id=markers[0].value?.content;if(!/^[a-f0-9]{10}$/.test(id||'')||owners.has(id))throw Error('A text run would share an invalid or duplicate style identity.');owners.add(id);const original=copies.get(id)||id;if(Object.hasOwn(prior.layers,original))model.layers[id]=prior.layers[original];}
      }
      for(const child of node.children||[])visit(child);
    }
    visit(adapter.collect(after,resolved.relPath).ast);
    after=styles.replaceModel(after,resolved.relPath,{version:1,layers:Object.fromEntries(Object.entries(model.layers).sort(([a],[b])=>a.localeCompare(b)))});
    const final=adapter.collect(after,resolved.relPath).elements;
    if(final.length!==next.length||final.some((element,i)=>element.id!==next[i].id||element.tag!==next[i].tag))throw Error('Text style cleanup changed source identity.');
    return { ok:true, structural:true, hash:adapter.contentHash(after), edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}] };
  } catch(error) { return {ok:false,refused:true,reason:error.message}; }
}
module.exports={describe,plan};
