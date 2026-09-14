'use strict';
// Reuse lossless SVG mask and duplication edits while preserving the Liquid adapter's own IDs.
const html=require('./adapters/html.cjs'),liquid=require('./adapters/liquid.cjs'),mask=require('./html-svg-mask.cjs'),structure=require('./structure.cjs');
function collect(source,relPath){
 const names=require('./liquid-layer-name.cjs');
 const sanitized=source.replace(/\{% comment %\}retouch-layer-v1:[A-Za-z0-9+/=]*\{% endcomment %\}/g,text=>names.read(text,0)?' '.repeat(text.length):text);
 return html.collect(sanitized,relPath);
}
function context(r){
 const elements=r.elements||liquid.collect(r.source,r.relPath).elements,parsed=collect(r.source,r.relPath).elements;
 const byStart=new Map(parsed.map(e=>[e.location.startOffset,e])),toHTML=e=>{const found=byStart.get(e?.tagStart);return found?.tag===e?.tag?found:null;};
 const element=toHTML(r.element);if(!element||!structure.describe(r,'liquid').canDelete)return null;
 const resolved={...r,elements:parsed,element,maskCollect:collect};
 return {elements,parsed,toHTML,resolved};
}
function describe(r){
 const c=context(r);if(!c)return null;const info=mask.describe(c.resolved);if(!info)return null;
 const translate=id=>{const e=c.parsed.find(e=>e.id===id);return c.elements.find(n=>n.tagStart===e?.location.startOffset&&n.tag===e.tag)?.id;};
 const result={...info};for(const key of ['parentId','ownerId'])if(result[key]){result[key]=translate(result[key]);if(!result[key])return null;}
 if(result.maskIds){result.maskIds=result.maskIds.map(translate);if(result.maskIds.some(id=>!id))return null;}
 return result;
}
function describeDuplicate(r){const c=context(r);return c?require('./svg-duplicate.cjs').describe(c.resolved):null;}
function plan(r,op){
 const refuse=reason=>({ok:false,refused:true,reason}),c=context(r);if(!c)return refuse('Select literal SVG layers outside Liquid control scopes.');
 const translated={...op};
 if(op.type==='createSVGMask'){
  if(!Array.isArray(op.ids))return refuse('Select sibling mask layers.');
  const selected=op.ids.map(id=>c.elements.find(e=>e.id===id));if(selected.some(e=>!e||!structure.describe({...r,elements:c.elements,element:e},'liquid').canDelete||!c.toHTML(e)))return refuse('Mask layers must have complete literal source.');
  translated.ids=selected.map(e=>c.toHTML(e).id);translated.maskId=c.toHTML(c.elements.find(e=>e.id===op.maskId))?.id;
 }
 const duplicating=op.type==='duplicateElement',planner=duplicating?require('./svg-duplicate.cjs'):mask;
 const result=planner.plan(c.resolved,translated);if(!result.ok||result.unchanged)return result;
 const after=result.edits[0].after,next=liquid.collect(after,r.relPath).elements,nextHTML=collect(after,r.relPath).elements,htmlMapping=new Map(result.sourceIdMap),removedHTML=new Set(result.removedSourceIds),mapping=new Map(),removed=[];
 let prefix=0;while(prefix<r.source.length&&prefix<after.length&&r.source[prefix]===after[prefix])prefix++;
 let suffix=0;while(suffix<r.source.length-prefix&&suffix<after.length-prefix&&r.source[r.source.length-1-suffix]===after[after.length-1-suffix])suffix++;
 for(const old of c.elements){
  const h=c.toHTML(old);if(h&&removedHTML.has(h.id)){removed.push(old.id);continue;}
  const mapped=h?nextHTML.find(e=>e.id===(htmlMapping.get(h.id)||h.id)):null;
  const start=mapped?.location.startOffset??(old.tagStart<prefix?old.tagStart:old.tagStart>=r.source.length-suffix?old.tagStart+after.length-r.source.length:null);
  const fresh=next.find(e=>e.tagStart===start&&e.tag===old.tag&&e.kind===old.kind);if(!fresh)return refuse('A Liquid layer could not be preserved.');mapping.set(old.id,fresh.id);
 }
 const added=duplicating?c.elements.filter(e=>e.tagStart>=r.element.tagStart&&e.tagStart<r.element.closeEnd).length:op.type==='createSVGMask'?3:0;
 if(next.length!==c.elements.length-removed.length+added)return refuse('Masking would change surrounding Liquid structure.');
 const translate=id=>{const h=nextHTML.find(e=>e.id===id);return next.find(e=>e.tagStart===h?.location.startOffset&&e.tag===h.tag)?.id;};
 const parentId=translate(result.parentId),selectionIds=(result.selectionIds||[result.createdId]).map(translate);if(!parentId||selectionIds.some(id=>!id))return refuse('Mask selection could not be preserved.');
 return {...result,...(duplicating?{createdId:selectionIds[0]}:{}),hash:liquid.contentHash(after),parentId,selectionIds,sourceIdMap:[...mapping].filter(([a,b])=>a!==b),removedSourceIds:removed};
}
module.exports={describe,describeDuplicate,plan};
