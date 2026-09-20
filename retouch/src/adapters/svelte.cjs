'use strict';
const path=require('node:path'),MagicString=require('magic-string'),source=require('../svelte-source.cjs');
const refuse=reason=>({ok:false,refused:true,reason}),attr=(element,name)=>element.attributes.find(a=>a.name===name),bound=(element,name)=>element.node.attributes.filter(a=>a.name?.toLowerCase()===name).length>1||element.node.attributes.some(a=>a.type==='SpreadAttribute'||a.name?.toLowerCase()===name&&!source.literal(a));
const escape=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/{/g,'&#123;').replace(/}/g,'&#125;'),escapeAttr=value=>escape(value).replace(/"/g,'&quot;');
const textRange=source.textRange;
function describe(r){
 const e=r.element,range=textRange(e,r.source),canSetSrc=e.tag==='img'&&!e.scope.picture&&!bound(e,'src')&&!bound(e,'srcset')&&!attr(e,'srcset');
 return {id:e.id,kind:'host',tag:e.tag,file:r.relPath,hash:r.hash,renderRevisionAttribute:'data-rt-revision',preserveTextNodes:true,linkedStyleAuthoring:true,textStyleAuthoring:true,className:attr(e,'class')?.value||'',classNameDynamic:true,classNameReason:'Use the responsive CSS properties for Svelte styles.',text:range?.text??null,renderedText:range?.text??null,textDynamic:!range,textReason:'This Svelte region contains expressions, bindings, or nested markup. Its template logic is preserved.',canSetTag:false,canRename:!bound(e,'data-rt-name'),layerName:attr(e,'data-rt-name')?.value||'',src:attr(e,'src')?.value??null,srcDynamic:bound(e,'src'),canSetSrc,srcReason:canSetSrc?null:'Choose an image without source bindings or a responsive picture.',href:e.tag==='a'?attr(e,'href')?.value??null:undefined,canSetHref:e.tag==='a'&&!bound(e,'href'),hrefReason:'The link destination is controlled by a Svelte binding.',context:r.context||null,...require('../svelte-css.cjs').describe(r),...Object.assign({},...['text','color','effect','variable'].map(family=>require('../svelte-linked-styles.cjs').create(family,adapter).describe(r)))};
}
function planOp(r,op){try{
 if(op.fileHash!==r.hash)return refuse('The file changed. Re-select the layer.');
 if(op.type==='setCSS')return require('../svelte-css.cjs').plan(r,op);
 if(op.type==='setCSSSelection')return require('../svelte-css.cjs').planSelection(r,op,adapter);
 const e=r.element,info=describe(r),out=new MagicString(r.source);
 function setAttribute(name,value){const old=attr(e,name);if(value===null){if(old)out.remove(old.start,old.end);return;}const token=name+'="'+escapeAttr(value)+'"';if(old)out.overwrite(old.start,old.end,token);else out.appendLeft(e.start+1+e.tag.length,' '+token);}
 if(op.type==='setText'){
  const range=textRange(e,r.source);if(!range)return refuse(info.textReason);if(typeof op.text!=='string'||op.text.length>1000000||op.text.includes('\0'))return refuse('Invalid text.');if(op.text===range.text)return {ok:true,hash:r.hash,edits:[]};if(range.start===range.end)out.appendLeft(range.start,escape(op.text));else out.overwrite(range.start,range.end,escape(op.text));
 }else if(op.type==='renameElement'){
  if(!info.canRename||typeof op.name!=='string'||op.name.length>200||/[\x00-\x1f\x7f]/.test(op.name))return refuse('Use a literal, single-line layer name of up to 200 characters.');setAttribute('data-rt-name',op.name.trim()||null);
 }else if(op.type==='setHref'){
  if(!info.canSetHref||op.href!==null&&!require('../../shell/link-values.js').valid(op.href))return refuse('Choose a literal link destination.');setAttribute('href',op.href);
 }else if(op.type==='setSrc'){
  if(!info.canSetSrc||typeof op.src!=='string'||op.src.length>100000||/[\x00-\x1f\x7f]/.test(op.src)||!['http:','https:'].includes(new URL(op.src,'https://retouch.local/').protocol))return refuse('Choose a literal image path or HTTP URL.');setAttribute('src',op.src);
 }else return refuse('This Svelte operation is not implemented yet.');
 const after=out.toString();if(after===r.source)return {ok:true,hash:r.hash,edits:[]};
 const before=source.collect(r.source,r.relPath).elements,next=source.collect(after,r.relPath).elements;if(before.length!==next.length||before.some((item,i)=>item.id!==next[i].id||item.tag!==next[i].tag))return refuse('This edit would change surrounding Svelte template structure.');
 if(op.type==='setText'&&textRange(next.find(item=>item.id===e.id),after)?.text!==op.text)return refuse('Svelte would interpret this text differently.');
 return {ok:true,hash:source.contentHash(after),edits:[{file:r.file,before:r.source,after}]};
}catch(error){return refuse('The Svelte source edit was refused: '+error.message);}}
const adapter={name:'svelte',matches:file=>/\.svelte$/i.test(file),collect:source.collect,stamp:source.stamp,contentHash:source.contentHash,describe,planOp,assets:{directory:'public',urlPrefix:'/',uploadDirectory:'rt-assets',imageOnly:true},capabilities:{classAttr:'class',ops:['setText','renameElement','setHref','setSrc','setCSS','setCSSSelection',...['Text','Color','Effect'].flatMap(family=>['apply','reset','detach'].flatMap(action=>[action+family+'Style',action+family+'StyleSelection'])), 'updateTextStyle','updateEffectStyle',...['apply','reset','detach','remove'].flatMap(action=>[action+'Variable',action+'VariableSelection'])]},applyOp:(r,op)=>require('../transactions.cjs').applyPlan(r.appRoot||path.dirname(r.file),planOp(r,op))};
module.exports=adapter;
