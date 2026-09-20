'use strict';
const source=require('./svelte-source.cjs'),shared=require('./html-responsive-image.cjs');
const fields=new Set(['src','srcset','sizes','media','type']);
const escapeAttribute=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/{/g,'&#123;').replace(/}/g,'&#125;');
function collect(text,file){
 const parsed=source.collect(text,file),nodes=new Map(),parents=new Map();
 function visit(node,parent){if(!node||typeof node!=='object')return;parents.set(node,parent);for(const [key,value]of Object.entries(node)){if(['attributes','expression','metadata'].includes(key))continue;for(const child of Array.isArray(value)?value:[value])if(child&&typeof child==='object')visit(child,node);}}
 visit(parsed.ast.fragment,null);
 for(const element of parsed.elements){const node=element.node,attrs={};for(const attr of node.attributes||[])if(attr.name)attrs[attr.name.toLowerCase()]={startOffset:attr.start,endOffset:attr.end};const end=text.indexOf('>',Math.max(node.start+1+node.name.length,...node.attributes.map(attr=>attr.end)))+1;
  nodes.set(node,{tagName:element.tag,attrs:element.attributes.map(attr=>({name:attr.name,value:attr.value})),sourceCodeLocation:{startOffset:element.start,endOffset:element.end,startTag:{startOffset:element.start,endOffset:end},attrs},original:node,childNodes:[]});
 }
 const elements=parsed.elements.map(element=>{const node=nodes.get(element.node);node.parentNode=nodes.get(parents.get(parents.get(element.node)))||null;node.childNodes=element.node.fragment.nodes.map(child=>nodes.get(child)||{original:child});return {...element,node,location:node.sourceCodeLocation};});
 return {...parsed,elements};
}
const adapter={collect,contentHash:source.contentHash,escapeAttribute};
function prepare(resolved){
 const parsed=collect(resolved.source,resolved.relPath),element=parsed.elements.find(element=>element.id===resolved.element.id);
 if(!element||element.tag!=='img')throw Error('Select a Svelte image.');
 const picture=element.node.parentNode?.tagName==='picture'?element.node.parentNode:null;
 if(picture&&picture.childNodes.some(child=>!['source','img'].includes(child.tagName)&&!(child.original.type==='Comment'||child.original.type==='Text'&&!child.original.data.trim())))throw Error('This picture contains Svelte control flow or generated children.');
 for(const node of picture?picture.childNodes.filter(child=>child.tagName):[element.node]){
  const seen=new Set();for(const attr of node.original.attributes){const name=attr.name?.toLowerCase();if(attr.type==='SpreadAttribute'||name&&fields.has(name)&&(!source.literal(attr)||seen.has(name)))throw Error('Responsive image attributes are bound or ambiguous.');if(name)seen.add(name);}
 }
 return {...resolved,element,elements:parsed.elements};
}
function describe(resolved){if(resolved.element.tag!=='img')return null;try{return shared.describe(prepare(resolved),adapter);}catch(error){return {reason:error.message,candidates:[]};}}
function run(method,resolved,op){try{return shared[method](prepare(resolved),op,adapter);}catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={describe,plan:(r,op)=>run('plan',r,op),planSource:(r,op)=>run('planSource',r,op),planCandidates:(r,op)=>run('planCandidates',r,op)};
