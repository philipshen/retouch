'use strict';
// Tokenize per the HTML image-candidate algorithm, not comma splitting: data
// URLs and ordinary image URLs can contain commas.
// https://html.spec.whatwg.org/multipage/images.html#parsing-a-srcset-attribute
const space=char=>/[\t\n\f\r ]/.test(char||'');
function parse(input,{locations=false}={}){
 const candidates=[];let index=0;
 while(index<input.length){
  while(index<input.length&&(space(input[index])||input[index]===','))index++;
  if(index>=input.length)break;
  const start=index;while(index<input.length&&!space(input[index]))index++;
  let url=input.slice(start,index),descriptors=[],candidateEnd=index;
  if(url.endsWith(',')){url=url.replace(/,+$/,'');candidateEnd=start+url.length;}
  else{
   let token='',parens=false;
   while(index<input.length){const char=input[index++];if(parens){token+=char;if(char===')')parens=false;continue;}
    if(char==='('){token+=char;parens=true;}else if(char===','){if(token)descriptors.push(token);token='';candidateEnd=index-1;break;}else if(space(char)){if(token)descriptors.push(token);token='';}else token+=char;
    candidateEnd=index;
   }
   if(token)descriptors.push(token);
  }
  let width=false,density=false,height=false,valid=!!url;
  for(const descriptor of descriptors){
   const number=Number(descriptor.slice(0,-1));
   if(/^\d+w$/.test(descriptor)&&number>0&&Number.isFinite(number)&&!width&&!density)width=true;
   else if(/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?x$/.test(descriptor)&&number>=0&&Number.isFinite(number)&&!width&&!height&&!density)density=true;
   else if(/^\d+h$/.test(descriptor)&&number>0&&Number.isFinite(number)&&!height&&!density)height=true;
   else valid=false;
  }
  if(valid&&(!height||width))candidates.push({url,descriptors,...(locations?{start,end:start+url.length,candidateEnd}:{})});
 }
 return candidates;
}
function rewrite(input,replace){return parse(input).flatMap(({url,descriptors})=>{const next=replace(url);return next?[next+(descriptors.length?' '+descriptors.join(' '):'')]:[];}).join(', ');}
function sanitize(input,baseURL){return rewrite(input,value=>{try{const url=new URL(value,baseURL);return ['http:','https:','blob:'].includes(url.protocol)||/^data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)[;,]/i.test(url.href)?url.href:null;}catch{return null;}});}
module.exports={parse,rewrite,sanitize};
