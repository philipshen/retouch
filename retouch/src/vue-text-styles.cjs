'use strict';
const MagicString=require('magic-string'),{NodeTypes}=require('@vue/compiler-dom'),catalog=require('./text-styles.cjs');
function create(adapter=require('./adapters/vue.cjs')){
const css={describe:resolved=>require('./vue-css.cjs').describe(resolved,adapter),plan:(resolved,op)=>require('./vue-css.cjs').plan(resolved,op,adapter)};
const attribute='data-rt-text-styles';
const refuse=reason=>({ok:false,refused:true,reason});
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function links(resolved){
 const props=resolved.element.node.props;
 if(props.some(prop=>prop.type===NodeTypes.DIRECTIVE&&prop.name==='bind'&&(!prop.arg||!prop.arg.isStatic||prop.arg.content.toLowerCase()===attribute)))throw Error('This Vue layer computes its text style links.');
 const markers=props.filter(prop=>prop.type===NodeTypes.ATTRIBUTE&&prop.name.toLowerCase()===attribute);
 if(markers.length>1)throw Error('This Vue layer has duplicate text style links.');
 return require('./html-text-styles.cjs').links({element:{node:{attrs:markers.map(prop=>({name:attribute,value:prop.value?.content||''}))}}});
}
function describe(resolved){try{
 const state=links(resolved),rules=css.describe(resolved);if(rules.cssReason)throw Error(rules.cssReason);
 const overrides=Object.fromEntries(Object.entries(state).map(([width,link])=>[width,[...new Set([...(link.overrides||[]),...Object.keys(link.properties).filter(property=>rules.cssRules[width]?.[property]!==link.properties[property])])].sort()]));
 return {textStyleLinks:state,textStyleOverrides:overrides};
}catch{return {textStyleLinkReason:'This layer has invalid text style links or managed CSS.'};}}
function plan(resolved,op,style){
 try{
  if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the element.');
  if(!Number.isInteger(op.width)||op.width<0||op.width>7680)return refuse('Choose a supported screen width.');
  const current=links(resolved);let source=resolved.source;
  if(op.type==='applyTextStyle'||op.type==='refreshTextStyle'||op.type==='resetTextStyle'){
   const validated=catalog.validate({version:1,styles:[style]}).styles[0];
   let changes=validated.properties,overrides=[];
   if(op.type==='resetTextStyle'){
    const baseline=current[op.width];if(!baseline||baseline.id!==validated.id)return refuse('The layer is no longer linked to this text style.');
    changes={...validated.properties};for(const property of [...Object.keys(baseline.properties),...(baseline.overrides||[])])if(!Object.hasOwn(changes,property))changes[property]=null;
   }
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
  const element=adapter.collect(source,resolved.relPath).elements.find(e=>e.id===resolved.element.id);if(!element)return refuse('The layer changed during text style application.');
  const out=new MagicString(source),old=element.attributes.find(item=>item.name.toLowerCase()===attribute);
  if(Object.keys(current).length){const serialized=JSON.stringify(current);if(serialized.length>128*1024)return refuse('The layer text style links are too large.');const token=attribute+'="'+escape(serialized)+'"';if(old)out.overwrite(old.start,old.end,token);else out.appendLeft(element.start+1+element.tag.length,' '+token);}
  else if(old)out.remove(old.start,old.end);
  const after=out.toString();return {ok:true,hash:adapter.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
function planFile(file,relPath,before,style){
 try{
  catalog.validate({version:1,styles:[style]});let source=before,updated=0;
  const targets=[],parsed=adapter.collect(source,relPath),elements=parsed.elements;
  const indexedStarts=new Set(elements.map(element=>element.node.loc.start.offset));
  const ownsLink=node=>node.props?.some(prop=>prop.type===NodeTypes.ATTRIBUTE&&prop.name.toLowerCase()===attribute||prop.type===NodeTypes.DIRECTIVE&&prop.name==='bind'&&prop.arg?.isStatic&&prop.arg.content.toLowerCase()===attribute);
  function checkCoverage(node){
   if(!node)return;
   const owns=ownsLink(node);
   if(owns&&!indexedStarts.has(node.loc.start.offset))throw Error('A text style link belongs to unsupported or ambiguous Vue markup.');
   for(const child of node.children||[])checkCoverage(child);
  }
  checkCoverage(parsed.ast);
  for(const element of elements){
   if(!ownsLink(element.node))continue;
   const state=links({element});for(const [width,link]of Object.entries(state))if(link.id===style.id)targets.push({id:element.id,width:Number(width)});
  }
  for(const target of targets){
   const element=adapter.collect(source,relPath).elements.find(item=>item.id===target.id);
   if(!element)return refuse('A linked layer could not be resolved.');
   const result=plan({file,relPath,source,hash:adapter.contentHash(source),element},{type:'refreshTextStyle',width:target.width},style);
   if(!result.ok)return result;source=result.edits[0]?.after||source;updated++;
  }
  return {ok:true,updated,edits:source===before?[]:[{file,before,after:source}]};
 }catch(error){return refuse(error.message);}
}
return {links,describe,plan,planFile};
}
module.exports={create};
