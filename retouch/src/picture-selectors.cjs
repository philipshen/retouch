'use strict';
const parser=require('postcss-selector-parser');
const marker='[data-rt-picture]',excluded=':not(:where('+marker+','+marker+' > source))',image=':where(img)',wrapper=':where('+marker+')';
const lists=new Set([':is',':where',':not',':has']),positions=new Set([':first-child',':last-child',':only-child',':nth-child',':nth-last-child']);
const typePositions=new Set([':first-of-type',':last-of-type',':only-of-type',':nth-of-type',':nth-last-of-type']);
const nodes=text=>parser().astSync(text).first.nodes;
function pseudoElement(node){return node.type==='pseudo'&&(/^::/.test(node.value)||[':before',':after',':first-line',':first-letter'].includes(node.value));}
function beforePseudo(compound,extra){const result=compound.map(node=>node.clone()),at=result.findIndex(pseudoElement);result.splice(at<0?result.length:at,0,...nodes(extra));return result;}
function virtualTypePosition(node,filter){
 const name=node.value.toLowerCase(),formula=name.startsWith(':nth-')?node.nodes.map(value=>value.toString()).join(','):'1',last=name.includes('last'),count=':'+ (last?'nth-last-child':'nth-child')+'('+formula+' of :where('+filter+'))';
 return count+(name===':only-of-type'?':where(:nth-last-child(1 of :where('+filter+')))':'');
}
function normalTypePosition(node){
 // Only image and picture sibling counts change. Other element types retain
 // their native count, including custom tags without an explicit type selector.
 const pictures='picture:not('+marker+')';
 return ':is(:not(:where(img,picture))'+node.toString()+',:where(img)'+virtualTypePosition(node,'img,'+marker)+',:where(picture)'+virtualTypePosition(node,pictures)+')';
}
function transform(selector){
 if(typeof selector!=='string'||selector.length>65536)throw Error('A stylesheet selector is too large to adapt for a picture.');
 const ast=parser().astSync(selector);let count=0;
 function filteredPosition(node){
  if(!/^:nth-(?:last-)?child$/i.test(node.value))return null;
  const first=node.nodes?.[0],at=first?.nodes.findIndex(part=>part.type==='tag'&&part.value.toLowerCase()==='of');
  if(at===undefined||at<0)return null;
  const formula=first.nodes.slice(0,at).map(part=>part.toString()).join('').trim(),filter=parser.root(),head=parser.selector();
  for(const part of first.nodes.slice(at+1))head.append(part.clone());
  while(head.first&&(head.first.type==='comment'||head.first.type==='combinator'&&!head.first.value.trim()))head.first.remove();
  if(!formula||!head.nodes.length)throw Error('The filtered sibling position is incomplete.');
  filter.append(head);for(const entry of node.nodes.slice(1))filter.append(entry.clone());
  container(filter);const adapted=filter.toString();
  // Count the generated picture exactly when its image would have belonged to
  // the original sibling filter. Both alternatives retain the filter specificity.
  const result=node.value+'('+formula+' of '+adapted+','+wrapper+':has(> :is('+adapted+')'+image+'))';
  if(result.length>65536)throw Error('A stylesheet selector is too large to adapt for a picture.');
  return nodes(result)[0];
 }
 function container(root){
  const originals=[...root.nodes];root.removeAll();
  for(const original of originals){
   if(original.type!=='selector'){root.append(original);continue;}
   // Explicit wrapper rules, including our previous output, are already
   // written against the real DOM. Process other list members independently.
   let explicit=false;original.walkAttributes(node=>{if(node.attribute==='data-rt-picture')explicit=true;});
   if(explicit){root.append(original);continue;}
   original.walk(node=>{
    if(node.type==='nesting')throw Error('Nested CSS selectors cannot yet be adapted for a picture.');
   });
   // Simple rules whose subjects cannot be generated nodes are invariant under
   // this wrap. Preserve their original bytes rather than adding inert filters.
   let sensitive=false;
   original.walk(node=>{if(node.type==='combinator'&&/[>+~|]/.test(node.value)||node.type==='pseudo'&&(positions.has(node.value.toLowerCase())||typePositions.has(node.value.toLowerCase())||node.nodes?.length)||node.type==='tag'&&['picture','source'].includes(node.value.toLowerCase())||node.type==='universal')sensitive=true;});
   const simple=original.nodes.reduce((groups,node)=>{if(node.type==='combinator')groups.push([]);else groups.at(-1).push(node);return groups;},[[]]);
   if(!sensitive&&simple.every(group=>group.some(node=>['class','id','tag'].includes(node.type)))){root.append(original);continue;}
   for(const node of [...original.nodes])if(node.type==='pseudo'){
    if(lists.has(node.value.toLowerCase()))container(node);
    else{const filtered=filteredPosition(node);if(filtered)node.replaceWith(filtered);}
   }
   const compounds=[[]],combinators=[];
   for(const node of original.nodes){if(node.type==='combinator'){combinators.push(node.clone());compounds.push([]);}else compounds.at(-1).push(node);}
   const variants=compounds.map((compound,index)=>{
    if(!compound.length)return [[]];
    const typed=node=>node.type==='pseudo'&&typePositions.has(node.value.toLowerCase()),positional=compound.filter(node=>node.type==='pseudo'&&(positions.has(node.value.toLowerCase())||typed(node))),rest=compound.filter(node=>!positional.includes(node));
    let normal=beforePseudo(compound.flatMap(node=>typed(node)?nodes(normalTypePosition(node)):[node]),excluded);if(positional.length)normal=beforePseudo(normal,':not(:where('+marker+' > img))');
    const choices=[normal],last=index===compounds.length-1,following=combinators[index]?.value.trim(),preceding=combinators[index-1]?.value.trim();
    if(!last&&!['+','~'].includes(following)||last&&!positional.length&&(!preceding||!['>','+','~'].includes(preceding)))return choices;
    if(!last&&compound.some(pseudoElement))return choices;
    const representative=nodes(wrapper).concat(positional.flatMap(node=>typed(node)?nodes(virtualTypePosition(node,'img,'+marker)):[node.clone()])),target=beforePseudo(beforePseudo(rest,excluded),image);
    if(last)choices.push(representative.concat(parser.combinator({value:' > '}),target));
    else{const has=parser.pseudo({value:':has'}),relative=parser.selector();relative.append(parser.combinator({value:'> '}));target.forEach(node=>relative.append(node));has.append(relative);representative.push(has);choices.push(representative);}
    return choices;
   });
   function emit(index,parts){if(index===variants.length){if(++count>256)throw Error('A stylesheet selector creates too many picture alternatives.');const next=parser.selector();parts.forEach(node=>next.append(node.clone()));root.append(next);return;}
    for(const compound of variants[index])emit(index+1,parts.concat(index?[combinators[index-1]]:[],compound));
   }emit(0,[]);
  }
 }
 container(ast);
 ast.walkPseudos(node=>{if(node.value.toLowerCase()!==':has')return;for(let parent=node.parent;parent;parent=parent.parent)if(parent.type==='pseudo'&&parent.value.toLowerCase()===':has')throw Error('This relational selector would require nested :has() to preserve the picture layout.');});
 const result=ast.toString();if(result.length>65536)throw Error('A stylesheet selector is too large to adapt for a picture.');return result;
}
module.exports={transform};
