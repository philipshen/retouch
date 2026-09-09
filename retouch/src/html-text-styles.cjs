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
  if(!/^(0|[1-9]\d*)$/.test(width)||Number(width)>7680||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['id','properties','overrides'].includes(key)))throw Error('Invalid layer text style link.');
  catalog.validate({version:1,styles:[{id:value.id,properties:value.properties,name:'Linked style'}]});
  if(value.overrides!==undefined&&(!Array.isArray(value.overrides)||value.overrides.length>catalog.properties.length||new Set(value.overrides).size!==value.overrides.length||value.overrides.some(property=>!catalog.properties.includes(property))))throw Error('Invalid text style overrides.');
 }
 return input;
}
function describe(resolved){try{return {textStyleLinks:links(resolved)};}catch{return {textStyleLinkReason:'This layer has invalid text style links.'};}}
function plan(resolved,op,style){
 try{
  if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the element.');
  if(!Number.isInteger(op.width)||op.width<0||op.width>7680)return refuse('Choose a supported screen width.');
  const current=links(resolved);let source=resolved.source;
  if(op.type==='applyTextStyle'||op.type==='refreshTextStyle'){
   const validated=catalog.validate({version:1,styles:[style]}).styles[0];
   let changes=validated.properties,overrides=[];
   if(op.type==='refreshTextStyle'){
    const baseline=current[op.width];if(!baseline||baseline.id!==validated.id)return refuse('The layer is no longer linked to this text style.');
    const state=css.describe(resolved);if(state.cssReason)return refuse(state.cssReason);
    const own=state.cssRules[op.width]||{},retained=new Set(baseline.overrides||[]);changes={};
    for(const property of new Set([...Object.keys(baseline.properties),...Object.keys(validated.properties)])){
     // Missing formerly applied values are explicit local resets. Newly added
     // style properties apply only if the layer has no local value for them.
     if(retained.has(property))continue;
     if(Object.hasOwn(baseline.properties,property)?own[property]===baseline.properties[property]:!Object.hasOwn(own,property))changes[property]=validated.properties[property]??null;else retained.add(property);
    }
    overrides=[...retained].sort();
   }
   if(Object.keys(changes).length){const applied=css.plan(resolved,{width:op.width,changes});if(!applied.ok)return applied;source=applied.edits[0]?.after||source;}
   current[op.width]={id:validated.id,properties:validated.properties,...(overrides.length?{overrides}:{})};
   if(Object.keys(current).length>32)return refuse('A layer supports up to 32 text style scopes.');
  }else if(op.type==='detachTextStyle')delete current[op.width];else return refuse('Unsupported text style operation.');
  const element=html.collect(source,resolved.relPath).elements.find(e=>e.id===resolved.element.id);if(!element)return refuse('The layer changed during text style application.');
  const out=new MagicString(source),old=element.location.attrs?.[attribute];
  if(Object.keys(current).length){const serialized=JSON.stringify(current);if(serialized.length>128*1024)return refuse('The layer text style links are too large.');const token=attribute+'="'+escape(serialized)+'"';if(old)out.overwrite(old.startOffset,old.endOffset,token);else out.appendLeft(element.location.startTag.startOffset+1+element.tag.length,' '+token);}
  else if(old)out.remove(old.startOffset,old.endOffset);
  const after=out.toString();return {ok:true,hash:html.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
function planFile(file,relPath,before,style){
 try{
  catalog.validate({version:1,styles:[style]});let source=before,updated=0;
  const targets=[],elements=html.collect(source,relPath).elements;
  const indexedStarts=new Set(elements.map(element=>element.location.startTag.startOffset));
  const tree=require('parse5').parse(source,{sourceCodeLocationInfo:true});
  function checkCoverage(node){
   if(node.attrs?.some(item=>item.name===attribute)&&!indexedStarts.has(node.sourceCodeLocation?.startTag?.startOffset))throw Error('A text style link belongs to unsupported or ambiguous markup. Resolve that layer before updating.');
   for(const child of node.childNodes||[])checkCoverage(child);
   if(node.content)checkCoverage(node.content);
  }
  checkCoverage(tree);
  for(const element of elements){
   const state=links({element});for(const [width,link]of Object.entries(state))if(link.id===style.id)targets.push({id:element.id,width:Number(width)});
  }
  for(const target of targets){
   const element=html.collect(source,relPath).elements.find(item=>item.id===target.id);
   if(!element)return refuse('A linked layer could not be resolved.');
   const result=plan({file,relPath,source,hash:html.contentHash(source),element},{type:'refreshTextStyle',width:target.width},style);
   if(!result.ok)return result;source=result.edits[0]?.after||source;updated++;
  }
  return {ok:true,updated,edits:source===before?[]:[{file,before,after:source}]};
 }catch(error){return refuse(error.message);}
}
module.exports={links,describe,plan,planFile};
