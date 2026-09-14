'use strict';
const ids=require('./id.cjs'),mask=require('./html-svg-mask.cjs'),geometry=require('./jsx-svg-geometry.cjs');
// A location-preserving view lets the shared transaction planner operate on
// JSX without parsing JavaScript as HTML or changing React's source IDs.
function collect(source,relPath){
 const native=ids.collectElements(source,relPath).elements,byStart=new Map(),elements=native.map(e=>{
  const ast=e.node,tag=ids.jsxElementName(ast),attrs=[],locations={};
  for(const a of ast.openingElement.attributes){const name=a.type==='JSXAttribute'?(a.name.name==='maskType'?'mask-type':a.name.name):'__spread__',value=geometry.literal(a);attrs.push({name:value===undefined?'__dynamic__':name,value});if(name)locations[name]={startOffset:a.start,endOffset:a.end};}
  const opening=ast.openingElement,closing=ast.closingElement,location={startOffset:ast.start,endOffset:ast.end,startTag:{startOffset:opening.start,endOffset:opening.end},endTag:closing?{startOffset:closing.start,endOffset:closing.end}:null,attrs:locations};
  const ancestor=native.filter(p=>p.node.start<ast.start&&p.node.end>ast.end&&['svg','foreignObject'].includes(ids.jsxElementName(p.node))).at(-1);
  const node={tagName:tag,nodeName:tag,attrs,childNodes:[],parentNode:null,namespaceURI:(tag==='svg'||ancestor&&ids.jsxElementName(ancestor.node)==='svg')?'http://www.w3.org/2000/svg':'http://www.w3.org/1999/xhtml'};
  const result={...e,native:e,tag,node,location};byStart.set(ast.start,result);return result;
 });
 for(const e of elements)for(const child of e.native.node.children){
  const found=child.type==='JSXElement'?byStart.get(child.start):null;
  if(found){found.node.parentNode=e.node;e.node.childNodes.push(found.node);}
  else if(child.type==='JSXText')e.node.childNodes.push({nodeName:'#text',value:child.value});
  else if(child.type==='JSXExpressionContainer'&&child.expression.type==='JSXEmptyExpression')e.node.childNodes.push({nodeName:'#comment',value:source.slice(child.start,child.end)});
  else e.node.childNodes.push({tagName:'#expression',nodeName:'#expression',value:source.slice(child.start,child.end)});
 }
 return {elements};
}
function deletion(r){
 const e=r.element;if(!e.native)return null;
 return require('./jsx-svg-delete.cjs').describe({...r,element:e.native,elements:r.elements.map(e=>e.native)});
}
function context(r){
 const elements=collect(r.source,r.relPath).elements,element=elements.find(e=>e.id===r.element.id);if(!element)return null;
 return {...r,elements,element,maskCollect:collect,maskDeletion:deletion,maskAttributeName:name=>name==='mask-type'?'maskType':name};
}
function plan(r,op){const resolved=context(r);if(!resolved)return {ok:false,refused:true,reason:'Select an editable SVG layer.'};return mask.plan(resolved,op);}
function describe(r){const resolved=context(r);return resolved?mask.describe(resolved):null;}
module.exports={plan,describe};
