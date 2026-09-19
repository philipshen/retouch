'use strict';
const postcss=require('postcss'),parser=require('postcss-selector-parser');
const groups=new Set(['media','supports','container','layer','starting-style']);
function resolve(selector,parent){
 if(selector.length>65536||parent?.length>65536)throw Error('A nested stylesheet selector is too large.');
 const ast=parser().astSync(selector),subject=parent?parser().astSync(':is('+parent+')').first.first:parser().astSync(':where(:scope)').first.first;
 let projected=selector.length;const length=subject.toString().length;
 for(const entry of ast.nodes){let count=0;entry.walkNesting(()=>count++);projected+=count?count*(length-1):parent?length+1:0;}
 if(projected>65536)throw Error('A nested stylesheet selector is too large.');
 for(const entry of ast.nodes){
  let explicit=false;entry.walkNesting(node=>{if(node.next()?.type==='tag')throw Error('Sass-style selector concatenation is not native CSS nesting.');explicit=true;node.replaceWith(subject.clone({spaces:node.spaces}));});
  if(parent&&!explicit){if(entry.first?.type!=='combinator')entry.prepend(parser.combinator({value:' '}));else if(!entry.first.spaces.before)entry.first.spaces.before=' ';entry.prepend(subject.clone());}
 }
 const result=ast.toString();if(result.length>65536)throw Error('A nested stylesheet selector is too large.');return result;
}
function flatten(root){
 let count=0,size=0;
 function visit(container,parent=null,template=null,depth=0){
  if(depth>64)throw Error('The stylesheet nesting is too deep.');
  const result=[];let pending=[];
  function emit(node,group=false){if(++count>50000)throw Error('The nested stylesheet expands to too many rules.');size+=Buffer.byteLength((group?node.clone({nodes:[]}):node).toString());if(size>20*1024*1024)throw Error('The flattened stylesheet is too large.');result.push(node);}
  function flush(){
   if(!pending.length)return;
   if(pending.some(node=>node.type==='decl')){const rule=template?template.clone({selector:parent,nodes:[]}):postcss.rule({selector:parent});for(const node of pending)rule.append(node.clone());emit(rule);}
   else for(const node of pending)emit(node.clone());
   pending=[];
  }
  for(const node of container.nodes||[]){
   if(parent&&(node.type==='decl'||node.type==='comment')){pending.push(node);continue;}
   flush();
   if(node.type==='rule'){
    const selector=resolve(node.selector,parent);
    if((node.nodes||[]).every(child=>child.type==='decl'||child.type==='comment'))emit(node.clone({selector}));
    else for(const child of visit(node,selector,node,depth+1))result.push(child);
   }else if(node.type==='atrule'&&node.nodes&&groups.has(node.name.toLowerCase())){
    const group=node.clone({nodes:[]});for(const child of visit(node,parent,template,depth+1))group.append(child);emit(group,true);
   }else{
    if(parent)throw Error('The nested @'+(node.name||node.type)+' rule cannot yet be flattened.');
    emit(node.clone());
   }
  }
  flush();return result;
 }
 const nodes=visit(root);root.removeAll();for(const node of nodes)root.append(node);return root;
}
module.exports={flatten,resolve};
