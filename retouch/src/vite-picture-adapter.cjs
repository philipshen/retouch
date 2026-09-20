'use strict';
const coverage=require('./vite-picture-styles.cjs'),responsive=require('./svelte-responsive-image.cjs');
function create(base,server,root){
 return {...base,
  describe(r){const info=base.describe(r);if(info.responsiveImage?.plain&&!info.responsiveImage.reason){info.pictureSourceAuthoring=true;info.pictureStylesRequired=true;}return info;},
  planOp(r,op){
   if(op.type!=='setPictureSources'||op.action!=='add'||responsive.describe(r)?.picture)return base.planOp(r,op);
   return (async()=>{try{
    if(op.fileHash!==r.hash)throw Error('The file changed. Re-select the image.');
    const inventory=await coverage.validate(server,{root,documents:op.pictureStyles});
    if(coverage.discover(server,{root}).fingerprint!==inventory.fingerprint)throw Error('The stylesheet graph changed. Re-select the image.');
    const renderer={...responsive.adapter,allowWrapper:true,planPictureStyles:(resolved,options)=>{
     const styles=require('./svelte-picture-style-plan.cjs').plan(resolved,{...options,files:inventory.files});
     return {...styles,inlineRefresh:true};
    }};
    return require('./html-picture-sources.cjs').plan(responsive.prepare(r),op,renderer);
   }catch(error){return {ok:false,refused:true,reason:error.message};}})();
  }
 };
}
module.exports={create};
