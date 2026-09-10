'use strict';
const {contentHash}=require('./id.cjs');
module.exports=function insertionProps(resolved,definition){
 const types=require('./component-prop-choices.cjs'),fields=new Map();let param=definition.fn.params[0];if(param?.type==='AssignmentPattern')param=param.left;
 if(param?.type==='ObjectPattern')for(const field of param.properties)if(field.type==='ObjectProperty'&&!field.computed)fields.set(field.key.name??field.key.value,{defaulted:field.value.type==='AssignmentPattern'});
 const declaredNames=types.names(resolved,definition);for(const name of declaredNames)if(!fields.has(name))fields.set(name,{});
 const dependencies=new Map([[definition.file,definition.source]]),checks=new Map();
 for(const [name,field] of fields){
  const contract=types.property(resolved,name,definition);field.contract=contract;field.required=!field.defaulted&&(contract?!contract.optional:true);
  for(const dependency of contract?.dependencies||[]){if(dependencies.has(dependency.file)&&dependencies.get(dependency.file)!==dependency.source)throw Error('The component contract changed while preparing insertion. Refresh the library.');dependencies.set(dependency.file,dependency.source);}
  for(const check of contract?.pathChecks||[]){if(checks.has(check.file)&&JSON.stringify(checks.get(check.file))!==JSON.stringify(check))throw Error('The component type resolution changed while preparing insertion. Refresh the library.');checks.set(check.file,check);}
 }
 if(JSON.stringify(declaredNames)!==JSON.stringify(types.names(resolved,definition)))throw Error('The component properties changed while preparing insertion. Refresh the library.');
 const properties=[...fields].map(([name,field])=>({name,required:field.required,defaulted:!!field.defaulted,type:field.contract?.type||null,...(field.contract?.choices?{choices:field.contract.choices}:{}),supported:!!field.contract&&/^[$A-Za-z_][\w$-]*$/.test(name)&&!['key','ref','children','__proto__'].includes(name)}));
 const revision=contentHash(JSON.stringify([properties,[...dependencies].sort(([a],[b])=>a.localeCompare(b)).map(([file,source])=>[file,contentHash(source)]),[...checks.values()].sort((a,b)=>a.file.localeCompare(b.file))]));
 return {fields,dependencies,checks,properties,revision};
};
