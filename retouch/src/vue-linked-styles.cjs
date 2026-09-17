'use strict';
const {NodeTypes}=require('@vue/compiler-dom');
// Share color/effect semantics with HTML without parsing Vue source as HTML.
// Every location and decoded attribute comes from the Vue compiler AST.
function create(family,adapter=require('./adapters/vue.cjs')){
 if(!['color','effect'].includes(family))throw Error('Unsupported Vue style family.');
 const attribute='data-rt-'+family+'-styles',title=family==='color'?'Color':'Effect',refuse=reason=>({ok:false,refused:true,reason});
 function project(element){return {...element,node:{...element.node,attrs:element.attributes.map(a=>({name:a.name.toLowerCase(),value:a.value}))},location:{startTag:{startOffset:element.start},attrs:Object.fromEntries(element.attributes.map(a=>[a.name.toLowerCase(),{startOffset:a.start,endOffset:a.end}]))}};}
 const renderer={...adapter,collect:(source,relative)=>{const parsed=adapter.collect(source,relative);return {...parsed,elements:parsed.elements.map(project)};}},css={describe:r=>require('./vue-css.cjs').describe(r,adapter),plan:(r,op)=>require('./vue-css.cjs').plan(r,op,adapter)},core=require('./html-'+family+'-styles.cjs').create(renderer,css);
 function resolve(r){return {...r,element:project(r.element)};}
 function links(r){
  const props=r.element.node.props;
  if(props.some(p=>p.type===NodeTypes.DIRECTIVE&&p.name==='bind'&&(!p.arg||!p.arg.isStatic||p.arg.content.toLowerCase()===attribute)))throw Error('This Vue layer computes its '+family+' style links.');
  if(props.filter(p=>p.type===NodeTypes.ATTRIBUTE&&p.name.toLowerCase()===attribute).length>1)throw Error('This Vue layer has duplicate '+family+' style links.');
  return core.links(resolve(r));
 }
 function describe(r){try{links(r);return core.describe(resolve(r));}catch(error){return family==='color'?{colorStyles:false,colorStyleReason:error.message}:{effectStyleLinkReason:error.message};}}
 function plan(r,op,style){try{links(r);return core.plan(resolve(r),op,style);}catch(error){return refuse(error.message);}}
 function planFile(file,relPath,before,style){try{
  require('./'+family+'-styles.cjs').validate({version:1,styles:[style]});const parsed=adapter.collect(before,relPath),indexed=new Set(parsed.elements.map(e=>e.node.loc.start.offset)),targets=[];
  const owns=node=>node.props?.some(p=>p.type===NodeTypes.ATTRIBUTE&&p.name.toLowerCase()===attribute||p.type===NodeTypes.DIRECTIVE&&p.name==='bind'&&p.arg?.isStatic&&p.arg.content.toLowerCase()===attribute);
  function check(node){if(!node)return;if(owns(node)&&!indexed.has(node.loc.start.offset))throw Error('A '+family+' style link belongs to unsupported Vue markup.');for(const child of node.children||[])check(child);}check(parsed.ast);
  for(const element of parsed.elements){if(!owns(element.node))continue;for(const [width,value]of Object.entries(links({element}))){if(family==='color'){for(const [property,link]of Object.entries(value))if(link.id===style.id)targets.push({id:element.id,width:Number(width),property});}else if(value.id===style.id)targets.push({id:element.id,width:Number(width)});}}
  let source=before;for(const target of targets){const element=adapter.collect(source,relPath).elements.find(e=>e.id===target.id);if(!element)throw Error('A linked Vue layer could not be resolved.');const result=plan({source,file,relPath,element,hash:adapter.contentHash(source)},{type:'refresh'+title+'Style',width:target.width,property:target.property},style);if(!result.ok)return result;source=result.edits[0]?.after||source;}
  return {ok:true,updated:targets.length,edits:source===before?[]:[{file,before,after:source}]};
 }catch(error){return refuse(error.message);}}
 return {links,describe,plan,planFile,...(core.properties?{properties:core.properties}:{})};
}
module.exports={create};
