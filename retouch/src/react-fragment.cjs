'use strict';
// Only actual React imports are transparent. A component that happens to be
// called Fragment (or exposes a .Fragment member) must keep its own identity.
module.exports=function isReactFragment(path){
 const name=path.node.openingElement.name;
 let local,member=false;
 if(name.type==='JSXIdentifier')local=name.name;
 else if(name.type==='JSXMemberExpression'&&name.object.type==='JSXIdentifier'&&name.property.name==='Fragment'){local=name.object.name;member=true;}
 else return false;
 const binding=path.scope.getBinding(local);if(!binding||!binding.constant)return false;
 const spec=binding.path.node,declaration=binding.path.parentPath.node;
 if(declaration.type!=='ImportDeclaration'||declaration.source.value!=='react'||declaration.importKind==='type'||spec.importKind==='type')return false;
 if(member)return ['ImportDefaultSpecifier','ImportNamespaceSpecifier'].includes(spec.type)||spec.type==='ImportSpecifier'&&(spec.imported.name??spec.imported.value)==='default';
 return spec.type==='ImportSpecifier'&&(spec.imported.name??spec.imported.value)==='Fragment';
};
