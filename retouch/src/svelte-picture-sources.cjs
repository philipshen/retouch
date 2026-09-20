'use strict';
const responsive=require('./svelte-responsive-image.cjs');
function plan(resolved,op){
 try{
  const prepared=responsive.prepare(resolved);
  if(op.action==='remove'){
   const source=prepared.element.node.parentNode?.childNodes.filter(node=>node.tagName==='source')[op.sourceIndex];
   if(source?.attrs.some(attr=>attr.name==='data-rt-style'))throw Error('Remove the responsive styles from this source before deleting it.');
  }
  return require('./html-picture-sources.cjs').plan(prepared,op,responsive.adapter);
 }catch(error){return {ok:false,refused:true,reason:error.message};}
}
module.exports={plan};
