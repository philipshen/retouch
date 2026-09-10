'use strict';
const model=require('./variable-collections.cjs'),V=require('../shell/html-css-values.js');
const colors=['color','background-color','border-color','fill','stroke'];
const lengths=['width','height','min-width','max-width','min-height','max-height','gap','padding','margin','font-size','letter-spacing','border-width','border-radius',...['top','right','bottom','left'].flatMap(side=>['padding-'+side,'margin-'+side]),...['top-left','top-right','bottom-left','bottom-right'].map(corner=>'border-'+corner+'-radius')];
const units=['px','rem','em','%','vw','vh','ch'];
const properties=[...colors,...lengths,'opacity','font-weight','line-height','flex-grow','flex-shrink','visibility','font-family'];
function specification(binding){
 if(!binding||typeof binding!=='object'||Array.isArray(binding)||Object.keys(binding).some(key=>!['id','modes','unit'].includes(key)))throw Error('Invalid variable binding.');
 model.cssName(binding.id);if(binding.unit!==undefined&&!['',...units].includes(binding.unit))throw Error('Unsupported variable unit.');
 const modes=binding.modes===undefined?{}:binding.modes;if(!modes||typeof modes!=='object'||Array.isArray(modes)||Object.keys(modes).length>32)throw Error('Invalid collection modes.');for(const [collection,mode]of Object.entries(modes)){model.cssName(collection);model.cssName(mode);}
 return {id:binding.id,modes:{...modes},...(binding.unit!==undefined?{unit:binding.unit}:{})};
}
function resolve(library,property,binding){
 const spec=specification(binding),result=model.resolver(library,spec.modes).resolve(spec.id);let value;
 if(result.type==='color'&&colors.includes(property)&&spec.unit===undefined)value=result.value;
 else if(result.type==='number'){
  if(lengths.includes(property)&&spec.unit!=='')value=result.value+(spec.unit??'px');
  else if(property==='line-height')value=String(result.value)+(spec.unit||'');
  else if(['opacity','font-weight','flex-grow','flex-shrink'].includes(property)&&!spec.unit)value=String(result.value);
 }else if(result.type==='boolean'&&property==='visibility'&&spec.unit===undefined)value=result.value?'visible':'hidden';
 else if(result.type==='string'&&property==='font-family'&&spec.unit===undefined)value=result.value;
 if(value===undefined||!V.valid(property,value))throw Error('This variable type or resolved value cannot control '+property+'.');
 return {binding:spec,value,path:result.path,type:result.type};
}
module.exports={properties,specification,resolve};
