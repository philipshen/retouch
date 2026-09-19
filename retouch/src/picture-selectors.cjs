'use strict';
const parser=require('postcss-selector-parser');
const marker='[data-rt-picture]',excluded=':not(:where('+marker+','+marker+' > source))',image=':where(img)',wrapper=':where('+marker+')';
const lists=new Set([':is',':where',':not',':has']),positions=new Set([':first-child',':last-child',':only-child',':nth-child',':nth-last-child']);
const nodes=text=>parser().astSync(text).first.nodes;
function pseudoElement(node){return node.type==='pseudo'&&(/^::/.test(node.value)||[':before',':after',':first-line',':first-letter'].includes(node.value));}
function beforePseudo(compound,extra){const result=compound.map(node=>node.clone()),at=result.findIndex(pseudoElement);result.splice(at<0?result.length:at,0,...nodes(extra));return result;}
function transform(selector){
 if(typeof selector!=='string'||selector.length>65536)throw Error('A stylesheet selector is too large to adapt for a picture.');
 const ast=parser().astSync(selector);let count=0;
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
    if(node.type==='pseudo'&&(/^:(?:nth-(?:last-)?of-type|first-of-type|last-of-type|only-of-type)$/i.test(node.value)||/^:nth-(?:last-)?child$/i.test(node.value)&&/\bof\b/i.test(node.toString())))throw Error('Type-based or filtered sibling positions cannot yet be adapted for a picture.');
   });
   for(const node of original.nodes)if(node.type==='pseudo'&&lists.has(node.value.toLowerCase()))container(node);
   const compounds=[[]],combinators=[];
   for(const node of original.nodes){if(node.type==='combinator'){combinators.push(node.clone());compounds.push([]);}else compounds.at(-1).push(node);}
   const variants=compounds.map((compound,index)=>{
    if(!compound.length)return [[]];
    const positional=compound.filter(node=>node.type==='pseudo'&&positions.has(node.value.toLowerCase())),rest=compound.filter(node=>!positional.includes(node));
    let normal=beforePseudo(compound,excluded);if(positional.length)normal=beforePseudo(normal,':not(:where('+marker+' > img))');
    const choices=[normal],last=index===compounds.length-1,following=combinators[index]?.value.trim(),preceding=combinators[index-1]?.value.trim();
    if(!last&&!['+','~'].includes(following)||last&&!positional.length&&(!preceding||!['>','+','~'].includes(preceding)))return choices;
    if(!last&&compound.some(pseudoElement))return choices;
    const representative=nodes(wrapper).concat(positional.map(node=>node.clone())),target=beforePseudo(beforePseudo(rest,excluded),image);
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
