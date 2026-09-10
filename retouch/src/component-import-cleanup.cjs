'use strict';
// Remove only the old binding made unused by this edit. Preserve module evaluation.
module.exports=function cleanupImport(ast,selected,source,replacementName,{preserveKey=true,appendSideEffect=false}={}){
 let name=selected.node.openingElement.name;while(name.type==='JSXMemberExpression')name=name.object;
 if(name.type!=='JSXIdentifier')return null;
 const binding=selected.scope.getBinding(name.name);
 if(binding?.kind!=='module'||replacementName.split('.')[0]===name.name||binding.constantViolations.length)return null;
 const spec=binding.path.node,declaration=binding.path.parentPath.node;
 if(declaration.type!=='ImportDeclaration'||declaration.importKind==='type'||spec.importKind==='type')return null;
 const node=selected.node,key=node.openingElement.attributes.find(attr=>attr.name?.name==='key');
 const inside=(ref,range)=>ref.node.start>=range.start&&ref.node.end<=range.end;
 if(binding.referencePaths.some(ref=>!inside(ref,node)||preserveKey&&key&&inside(ref,key)))return null;
 const kept=declaration.specifiers.filter(item=>item!==spec);
 const comments=(ast.comments||[]).filter(comment=>comment.start>=declaration.start&&comment.end<=declaration.source.start);
 function text(item){let result=source.slice(item.start,item.end);for(const comment of [...comments].reverse())if(comment.start>=item.start&&comment.end<=item.end)result=result.slice(0,comment.start-item.start)+' '.repeat(comment.end-comment.start)+result.slice(comment.end-item.start);return result;}
 const leading=comments.map(comment=>source.slice(comment.start,comment.end)).join('\n'),module=source.slice(declaration.source.start,declaration.source.end),tail=source.slice(declaration.source.end,declaration.end);
 const direct=kept.filter(item=>item.type!=='ImportSpecifier').map(text),named=kept.filter(item=>item.type==='ImportSpecifier').map(text);if(named.length)direct.push('{ '+named.join(', ')+' }');
 const sideEffect='import '+module+tail;
 let after=kept.length?'import '+direct.join(', ')+' from '+module+tail:sideEffect;
 let append='';if(kept.length&&!kept.some(item=>item.importKind!=='type')){if(appendSideEffect)append='\n'+sideEffect+'\n';else after+='\n'+sideEffect;}
 if(leading)after=leading+'\n'+after;
 return {start:declaration.start,end:declaration.end,after,append};
};
