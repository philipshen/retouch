'use strict';
const MagicString=require('magic-string'),html=require('./adapters/html.cjs'),css=require('./html-css.cjs'),catalog=require('./text-styles.cjs');
const attribute='data-rt-text-styles';
const refuse=reason=>({ok:false,refused:true,reason});
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function links(resolved){
 const raw=resolved.element.node.attrs.find(a=>a.name===attribute)?.value;if(raw===undefined)return {};
 if(raw.length>128*1024)throw Error('The layer text style links are too large.');
 const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length>32)throw Error('Invalid layer text style links.');
 for(const [width,value]of Object.entries(input)){
  if(!/^(0|[1-9]\d*)$/.test(width)||Number(width)>7680||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['id','properties'].includes(key)))throw Error('Invalid layer text style link.');
  catalog.validate({version:1,styles:[{...value,name:'Linked style'}]});
 }
 return input;
}
function describe(resolved){try{return {textStyleLinks:links(resolved)};}catch{return {textStyleLinkReason:'This layer has invalid text style links.'};}}
function plan(resolved,op,style){
 try{
  if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the element.');
  if(!Number.isInteger(op.width)||op.width<0||op.width>7680)return refuse('Choose a supported screen width.');
  const current=links(resolved);let source=resolved.source;
  if(op.type==='applyTextStyle'){
   const validated=catalog.validate({version:1,styles:[style]}).styles[0];
   const applied=css.plan(resolved,{width:op.width,changes:validated.properties});if(!applied.ok)return applied;
   source=applied.edits[0]?.after||source;current[op.width]={id:validated.id,properties:validated.properties};
   if(Object.keys(current).length>32)return refuse('A layer supports up to 32 text style scopes.');
  }else if(op.type==='detachTextStyle')delete current[op.width];else return refuse('Unsupported text style operation.');
  const element=html.collect(source,resolved.relPath).elements.find(e=>e.id===resolved.element.id);if(!element)return refuse('The layer changed during text style application.');
  const out=new MagicString(source),old=element.location.attrs?.[attribute];
  if(Object.keys(current).length){const serialized=JSON.stringify(current);if(serialized.length>128*1024)return refuse('The layer text style links are too large.');const token=attribute+'="'+escape(serialized)+'"';if(old)out.overwrite(old.startOffset,old.endOffset,token);else out.appendLeft(element.location.startTag.startOffset+1+element.tag.length,' '+token);}
  else if(old)out.remove(old.startOffset,old.endOffset);
  const after=out.toString();return {ok:true,hash:html.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={links,describe,plan};
