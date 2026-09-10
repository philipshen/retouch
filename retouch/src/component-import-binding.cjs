'use strict';
const path=require('node:path');
// Reuse direct value imports only when their lexical binding reaches the frame.
module.exports=function importedBinding(ast,selected,root,file,definition,checks){
 const stem=file.replace(/\.(jsx|tsx)$/,''),snapshot=require('./source-path-checks.cjs').snapshot;
 for(const declaration of ast.program.body){
  if(declaration.type!=='ImportDeclaration'||declaration.importKind==='type'||!declaration.source.value.startsWith('.'))continue;
  const from=path.resolve(path.dirname(definition.usageFile),declaration.source.value);
  if(from!==file&&from!==stem)continue;
  const candidates=from===file?[file]:[stem,stem+'.ts',stem+'.tsx',stem+'.js',stem+'.jsx'],observed=candidates.map(candidate=>snapshot(root,candidate));
  if(observed.some(check=>check.file!==file&&check.kind!=='missing')||!observed.some(check=>check.file===file&&check.kind==='file'&&check.realPath===file))continue;
  for(const spec of declaration.specifiers){
   if(spec.importKind==='type')continue;
   const name=spec.local.name,binding=selected.scope.getBinding(name);if(binding?.kind!=='module'||binding.path.node!==spec)continue;
   let result;
   if(spec.type==='ImportNamespaceSpecifier'){
    const exported=definition.exports.find(value=>/^[$A-Za-z_][\w$]*$/.test(value));if(exported)result=name+'.'+exported;
   }else if(/^[A-Z][\w$]*$/.test(name)){
    const exported=spec.type==='ImportDefaultSpecifier'?'default':spec.imported?.name??spec.imported?.value;
    if(definition.exports.includes(exported))result=name;
   }
   if(!result)continue;
   for(const check of observed){if(checks.has(check.file)&&JSON.stringify(checks.get(check.file))!==JSON.stringify(check))throw Error('The component import resolution changed. Refresh the library.');checks.set(check.file,check);}
   return result;
  }
 }
 return null;
};
