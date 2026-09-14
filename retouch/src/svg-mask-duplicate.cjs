'use strict';
const crypto=require('node:crypto'),mask=require('./html-svg-mask.cjs');
// Only complete, locally owned mask pairs may acquire a new identity. The
// mask descriptor also proves there are no references elsewhere in the file.
function references(r){
 const result=new Set();if(!r)return result;
 const {startOffset:start,endOffset:end}=r.element.location;
 for(const e of r.elements){
  if(e.tag!=='g'||!e.node.attrs.some(a=>a.name==='data-rt-mask-group')||e.location.startOffset<start||e.location.endOffset>end||!mask.describe({...r,element:e})?.canRelease)continue;
  const definition=r.elements.find(child=>child.node.parentNode===e.node&&child.tag==='mask');
  result.add(definition.node.attrs.find(a=>a.name==='id').value);
 }
 return result;
}
function rewrite(chunk,source,references){
 for(const original of references){
  let fresh;do{fresh='rt-mask-'+crypto.randomBytes(8).toString('hex');}while(source.includes(fresh)||chunk.includes(fresh));
  chunk=chunk.split(original).join(fresh);
 }
 return chunk;
}
module.exports={references,rewrite};
