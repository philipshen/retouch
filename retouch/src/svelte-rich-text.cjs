'use strict';
const {parseFragment}=require('parse5'),source=require('./svelte-source.cjs'),rich=require('./rich-text-source.cjs'),css=require('./svelte-css.cjs');
const tags=new Set(['h1','h2','h3','h4','h5','h6','p','div','span','blockquote','label','a','li']);
const escape=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/{/g,'&#123;').replace(/}/g,'&#125;');
function context(r){
 const root=r.element.node;if(r.element.scope.svg||!tags.has(root.name)||root.attributes.some(a=>a.type==='SpreadAttribute'||a.type==='BindDirective'&&['innerHTML','innerText','textContent'].includes(a.name)))throw Error('Choose a native text container without content bindings.');
 const end=root.end-('</'+root.name+'>').length;if(r.source.slice(end,root.end)!=='</'+root.name+'>')throw Error('The text container is incomplete.');
 const start=r.source.indexOf('>',Math.max(root.start+1+root.name.length,...root.attributes.map(a=>a.end)))+1;
 const expressions=[],attributes=[],edits=[];let ordinal=0;
 function marker(){let value='RTSVELTE'+source.contentHash(r.source+'|rich|'+ordinal++).slice(0,20)+'TOKEN';while(r.source.includes(value))value+='X';return value;}
 function shape(nodes){
  const result=[];
  for(let index=0;index<nodes.length;index++){
   const node=nodes[index];
   if(['Text','ExpressionTag','Comment'].includes(node.type)){
    const group=[node];while(['Text','ExpressionTag','Comment'].includes(nodes[index+1]?.type))group.push(nodes[++index]);
    const token=(first,last=first)=>{const value=marker(),entry={marker:value,raw:r.source.slice(first.start,last.end),start:first.start,end:last.end,empty:first.type==='Comment'&&first===last};expressions.push(entry);edits.push(entry);return value;};
    const literal=n=>n.type==='Comment'?token(n):n.data.replace(/\r\n?/g,'\n');
    const first=group.findIndex(n=>n.type==='ExpressionTag'),last=group.findLastIndex(n=>n.type==='ExpressionTag');
    result.push({text:first<0?group.map(literal).join(''):group.slice(0,first).map(literal).join('')+token(group[first],group[last])+group.slice(last+1).map(literal).join('')});continue;
   }
   if(node.type!=='RegularElement'||['script','style','svg','math','iframe','template'].includes(node.name))throw Error('This text contains Svelte structure that needs separate preservation.');
   for(const attr of node.attributes){
    if(source.literal(attr))continue;
    if(!['Attribute','OnDirective','ClassDirective','StyleDirective'].includes(attr.type))throw Error('This text contains a Svelte binding that needs separate preservation.');
    const name=attr.type==='OnDirective'?'on:'+attr.name:attr.type==='ClassDirective'?'class:'+attr.name:attr.type==='StyleDirective'?'style:'+attr.name:attr.name;
    const token=marker(),entry={token,marker:name+'="'+token+'"',raw:r.source.slice(attr.start,attr.end),start:attr.start,end:attr.end};attributes.push(entry);edits.push(entry);
   }
   result.push({tag:node.name,children:shape(node.fragment.nodes)});
  }
  return result;
 }
 const expected=shape(root.fragment.nodes);let value=r.source.slice(start,end);
 for(const edit of edits.sort((a,b)=>b.start-a.start))value=value.slice(0,edit.start-start)+edit.marker+value.slice(edit.end-start);
 const html=nodes=>nodes.map(n=>n.nodeName==='#text'?{text:n.value}:n.nodeName==='#comment'?{comment:n.data}:{tag:n.tagName,children:html(n.childNodes||[])});
 const parsed=parseFragment(value);if(JSON.stringify(expected)!==JSON.stringify(html(parsed.childNodes)))throw Error('The browser and Svelte interpret this text differently.');
 const canEditHref=node=>!node.attrs?.some(a=>a.name==='href'&&attributes.some(entry=>entry.marker==='href="'+a.value+'"'));
 const tokens=expressions.map(entry=>entry.marker),described=rich.describe(value,r.element.id,{tokens,canEditHref});
 const empty=new Set(expressions.filter(e=>e.empty).map(e=>e.marker));
 function mark(items){for(const item of items){for(const part of item.parts||[])if(part.t==='token'&&empty.has(described.kept.get(part.id)?.raw))part.empty=true;if(item.children)mark(item.children);}}
 mark(described.descriptor.children);
 return {start,end,value,tokens,expressions,attributes,canEditHref,tokenIds:new Map([...described.kept].filter(([,item])=>item.tag==='#text').map(([id,item])=>[item.raw,id])),descriptor:described.descriptor};
}
// Mirror the pinned compiler's HTML whitespace normalization. Matching still
// checks the complete live DOM before editing; unsupported render shapes refuse.
function rendered(r,data){
 const parsed=source.collect(r.source,r.relPath),preserve=!!parsed.ast.options?.preserveWhitespace||parsed.elements.some(e=>['pre','textarea'].includes(e.tag)&&e.start<r.element.start&&e.end>r.element.end);
 function project(nodes,items,keepWhitespace){
  const regular=nodes.filter(n=>n.type!=='Comment').map(n=>({...n})),values=new Map(nodes.filter(n=>n.type==='Text').map(n=>[n.start,'']));
  if(!keepWhitespace){
   while(regular[0]?.type==='Text'&&!/[^ \t\r\n]/.test(regular[0].data))regular.shift();
   if(regular[0]?.type==='Text')regular[0].data=regular[0].data.replace(/^[ \t\r\n]+/,'');
   while(regular.at(-1)?.type==='Text'&&!/[^ \t\r\n]/.test(regular.at(-1).data))regular.pop();
   if(regular.at(-1)?.type==='Text')regular.at(-1).data=regular.at(-1).data.replace(/[ \t\r\n]+$/,'');
  }
  for(let i=0;i<regular.length;i++){const n=regular[i];if(n.type!=='Text')continue;if(!keepWhitespace){if(regular[i-1]?.type!=='ExpressionTag')n.data=n.data.replace(/^[ \t\r\n]+/,regular[i-1]?.type==='Text'&&/[ \t\r\n]$/.test(regular[i-1].data)?'':' ');if(regular[i+1]?.type!=='ExpressionTag')n.data=n.data.replace(/[ \t\r\n]+$/,' ');}values.set(n.start,n.data);}
  const result=[];let at=0;
  for(let i=0;i<nodes.length;i++){
   const node=nodes[i],item=items[at++];if(!item)throw Error('The Svelte text descriptor could not be matched.');
   if(!['Text','ExpressionTag','Comment'].includes(node.type)){result.push({...item,children:project(node.fragment.nodes,item.children,keepWhitespace||['pre','textarea'].includes(node.name))});continue;}
   const group=[node];while(['Text','ExpressionTag','Comment'].includes(nodes[i+1]?.type))group.push(nodes[++i]);
   const parts=[],dynamic=group.some(n=>n.type==='ExpressionTag');
   for(let index=0;index<group.length;index++){const n=group[index];if(n.type==='Text'){parts.push({t:'text',value:dynamic?(values.get(n.start)||''):(values.get(n.start)||'').replace(/\r\n?/g,'\n')});continue;}const entry=data.expressions.find(e=>e.start===n.start);if(!entry)throw Error('A Svelte expression could not be matched.');parts.push({t:'token',id:data.tokenIds.get(entry.marker),...(entry.empty?{empty:true}:{})});while(group[index+1]?.end<=entry.end)index++;}
   if(parts.some(p=>!p))throw Error('The Svelte live text token could not be matched.');
   if(parts.some(p=>p.t==='token'||p.value))result.push({...item,value:parts.filter(p=>p.t==='text').map(p=>p.value).join(''),parts});
  }
  return result;
 }
 return {children:project(r.element.node.fragment.nodes,data.descriptor.children,preserve)};
}
function describe(r){try{
 const data=context(r);css.ownership(css.documentState(r.source,r.relPath));
 const descendants=source.collect(r.source,r.relPath).elements.filter(e=>e.start>r.element.start&&e.end<r.element.end);
 return {canSetChildren:true,richText:rendered(r,data),plainFormattingIds:descendants.filter(e=>['strong','b','em','i','u','s','sup','sub','br'].includes(e.tag)&&!e.node.attributes.length).map(e=>e.id),plainLinkIds:descendants.filter(e=>e.tag==='a'&&e.node.attributes.length===1&&e.attributes[0]?.name==='href'&&require('../shell/link-values.js').valid(e.attributes[0].value)).map(e=>e.id)};
}catch(error){return {canSetChildren:false,richTextReason:error.message};}}
function plan(r,op){try{
 if(op.fileHash!==r.hash)throw Error('The file changed. Re-select the text.');
 const data=context(r),prior=css.documentState(r.source,r.relPath),copies=new Map(),allocated=new Set(css.ownership(prior).keys());let ordinal=0;
 if(r.element.tag==='a'&&require('./rich-text.cjs').hasLink(op.children))throw Error('Text links cannot be nested.');
 if([...data.tokens,...data.attributes.map(e=>e.token)].some(token=>JSON.stringify(op.children).includes(token)))throw Error('Edit literal text around the live Svelte value.');
 const copyMarkup=(markup,original)=>{const id=parseFragment(original.raw).childNodes[0]?.attrs?.find(a=>a.name==='data-rt-style')?.value;if(!id)return markup;let fresh;do{fresh=source.contentHash(r.source+'|rich-split|'+id+'|'+ordinal++).slice(0,10);}while(allocated.has(fresh));allocated.add(fresh);copies.set(fresh,id);return markup.replace(/^<([a-z][a-z0-9-]*)/i,'<$1 data-rt-style="'+fresh+'"');};
 let replacement=rich.rewrite(data.value,r.element.id,op.children,{parentTag:r.element.tag,escapeText:escape,copyMarkup,tokens:data.tokens,canEditHref:data.canEditHref});
 for(const expression of data.expressions){if(replacement.split(expression.marker).length!==2)throw Error('Keep each live Svelte value exactly once.');replacement=replacement.replace(expression.marker,()=>expression.raw);}
 for(const attribute of data.attributes)replacement=replacement.split(attribute.marker).join(attribute.raw);
 let after=r.source.slice(0,data.start)+replacement+r.source.slice(data.end),next=source.collect(after,r.relPath),root=next.elements.find(e=>e.id===r.element.id);
 if(!root||root.tag!==r.element.tag||root.end!==r.element.end+after.length-r.source.length)throw Error('Formatting changed surrounding Svelte structure.');
 const nextContext=context({...r,source:after,element:root});
 // Formatting may remove a run or copy its appearance, but cannot introduce
 // template expressions or directives supplied as literal style values.
 const knownAttributes=new Set(data.attributes.map(entry=>entry.raw));
 if(nextContext.attributes.some(entry=>!knownAttributes.has(entry.raw)))throw Error('Formatting cannot introduce a new Svelte binding.');
 if(nextContext.expressions.some(entry=>!data.expressions.some(original=>original.raw.includes(entry.raw))))throw Error('Formatting cannot introduce a new Svelte expression.');
 const outside=(elements,root)=>elements.filter(e=>e.start<=root.start||e.end>=root.end).map(e=>[e.id,e.tag]);
 if(JSON.stringify(outside(prior.parsed.elements,r.element))!==JSON.stringify(outside(next.elements,root)))throw Error('Formatting changed an unrelated Svelte layer.');
 const layers={...prior.model.layers};for(const element of prior.parsed.elements)if(element.start>=data.start&&element.end<=data.end){const id=element.attributes.find(a=>a.name==='data-rt-style')?.value;if(id)delete layers[id];}
 const owners=new Set();for(const element of next.elements){const markers=element.node.attributes.filter(a=>a.name?.toLowerCase()==='data-rt-style');if(markers.length>1||markers.some(a=>!source.literal(a)))throw Error('A text run has ambiguous style ownership.');const id=element.attributes.find(a=>a.name==='data-rt-style')?.value;if(!id)continue;if(!/^[a-f0-9]{10}$/.test(id)||owners.has(id))throw Error('A text run has duplicate style ownership.');owners.add(id);if(prior.model.layers[copies.get(id)||id])layers[id]=prior.model.layers[copies.get(id)||id];}
 after=css.replaceModel(after,r.relPath,{...prior.model,layers:Object.fromEntries(Object.entries(layers).sort(([a],[b])=>a.localeCompare(b)))});
 css.ownership(css.documentState(after,r.relPath));
 return {ok:true,structural:true,hash:source.contentHash(after),edits:after===r.source?[]:[{file:r.file,before:r.source,after}]};
}catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={context,describe,plan,rendered};
