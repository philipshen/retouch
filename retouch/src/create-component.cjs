'use strict';
const traverse = require('@babel/traverse').default;
const MagicString = require('magic-string');
const {parseSource,collectElements,contentHash} = require('./id.cjs');
const refuse = reason => ({ok:false,refused:true,reason});

// Same-module extraction keeps imports and module bindings in their original
// scope. Stable parent-local bindings become explicit props at the call site.
function plan(resolved,op) {
  if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the layer before creating a component.');
  if(resolved.element.kind!=='host')return refuse('Select a source layer to create a component.');
  if(typeof op.name!=='string'||! /^[A-Z][A-Za-z0-9_$]{0,79}$/.test(op.name))return refuse('Use a component name starting with a capital letter, followed by letters, numbers, underscores or dollar signs.');
  try {
    const ast=parseSource(resolved.source),node=resolved.element.node;
    if(ast.program.directives.some(d=>d.value.value==='use server'))return refuse('A server-action module cannot contain this component declaration.');
    let selected,collision=false,scopedStyle=false;
    traverse(ast,{
      JSXElement(p){
        if(p.node.start===node.start&&p.node.end===node.end)selected=p;
        if(p.node.openingElement.name.name==='style'&&p.node.openingElement.attributes.some(a=>a.name?.name==='jsx'))scopedStyle=true;
      },
      Identifier(p){if(p.node.name===op.name)collision=true;},
      JSXIdentifier(p){if(p.node.name===op.name)collision=true;},
    });
    if(!selected)return refuse('The selected source subtree no longer resolves.');
    if(collision)return refuse('That name already appears in this module. Choose a different component name.');
    if(scopedStyle)return refuse('This module uses scoped JSX styles. Extract its styles with the component before creating it.');
    const keys=selected.node.openingElement.attributes.filter(a=>a.name?.name==='key');
    if(keys.length>1)return refuse('Resolve duplicate key attributes before creating a component.');
    const key=keys[0],inside=n=>n.start>=node.start&&n.end<=node.end;
    let reason=null;
    const captures=new Map();
    selected.traverse({
      enter(p){
        if(reason){p.skip();return;}
        if(key&&p.node.start>=key.start&&p.node.end<=key.end){p.skip();return;}
        if(['ThisExpression','Super','MetaProperty','AwaitExpression','YieldExpression'].includes(p.node.type)){reason='This subtree depends on its surrounding execution context.';return;}
        if(p.node.type.startsWith('TS')){reason='Extract TypeScript expression annotations together with their type scope before creating a component.';return;}
        if(p.isAssignmentExpression()||p.isUpdateExpression()){reason='This subtree mutates values during evaluation. Refactor those mutations before extracting.';return;}
        if(p.isJSXSpreadAttribute()){reason='Expand spread attributes before creating a component so key and ref behavior stays explicit.';return;}
        if(p.isJSXAttribute()&&p.node.name?.name==='ref'&&p.node.value?.type==='StringLiteral'){reason='String refs depend on the original component owner.';return;}
        if(p.isCallExpression()){
          if(p.node.callee.type==='Identifier'&&p.node.callee.name==='eval'){reason='Direct eval depends on its original lexical scope.';return;}
          const callee=p.node.callee,name=callee.type==='Identifier'?callee.name:callee.type==='MemberExpression'&&!callee.computed?callee.property.name:'';
          const binding=callee.type==='Identifier'?p.scope.getBinding(name):null,imported=binding?.path.node.imported?.name;
          if(/^use[A-Z0-9]/.test(name||'')||/^use[A-Z0-9]/.test(imported||'')){reason='Move hook calls out of the selected subtree before creating a component.';return;}
        }
        if(p.isReferencedIdentifier()){
          const name=p.node.name,binding=p.scope.getBinding(name);
          if(name==='arguments'){reason='This subtree depends on its surrounding arguments.';return;}
          if(binding&&!binding.scope.path.isProgram()&&!inside(binding.path.node)){
            if(binding.kind!=='param'&&!binding.path.isFunctionDeclaration()&&binding.path.node.end>node.start){reason='The local value "'+name+'" is initialized after this layer. Move its initialization before the layer before extracting.';return;}
            if(!binding.constant){reason='The local value "'+name+'" is reassigned. Make its update behavior explicit before extracting.';return;}
            captures.set(name,binding);
          }
        }
      },
    });
    if(reason)return refuse(reason);
    if(captures.size&&/\.tsx?$/.test(resolved.relPath))return refuse('TypeScript local dependencies need an explicit typed prop contract before extracting.');
    // React consumes key/ref and development metadata instead of forwarding them.
    // Alias those names, avoiding collisions with every other captured binding.
    const used=new Set(captures.keys()),props=[...captures.keys()].map((name,index)=>{
      let prop=name;
      if(['key','ref','__self','__source','__proto__'].includes(name)){
        prop='retouchValue'+index;while(used.has(prop))prop+='x';used.add(prop);
      }
      return {name,prop};
    });
    const parameters=props.length?'{ '+props.map(({name,prop})=>prop===name?name:prop+': '+name).join(', ')+' }':'';
    const attributes=props.map(({name,prop})=>' '+prop+'={'+name+'}').join('');
    const fragment=new MagicString(resolved.source.slice(node.start,node.end));
    if(key)fragment.remove(key.start-node.start,key.end-node.start);
    const replacement='<'+op.name+(key?' '+resolved.source.slice(key.start,key.end):'')+attributes+' />';
    const ms=new MagicString(resolved.source);ms.overwrite(node.start,node.end,replacement);
    // A non-exported declaration also works in Next page/layout modules, which
    // restrict named exports. Existing JSX paths and sibling IDs stay stable.
    ms.append('\n\n/** @retouch-component */\nfunction '+op.name+'('+parameters+') {\n  return ('+fragment.toString()+');\n}\n');
    const after=ms.toString(),next=collectElements(after,resolved.relPath);
    const instance=next.elements.find(e=>e.id===resolved.element.id&&e.kind==='instance');
    const definition=next.elements.find(e=>e.kind==='host'&&e.node.start>resolved.source.length-node.end+node.start+replacement.length);
    if(!instance||!definition)return refuse('The extracted component could not be mapped back to source.');
    return {ok:true,hash:contentHash(after),createdComponent:{name:op.name,props:props.map(({name,prop})=>({name:prop,local:name})),instanceId:instance.id,definitionId:definition.id},edits:[{file:resolved.file,before:resolved.source,after}]};
  }catch(error){return refuse('Could not create the component: '+error.message);}
}
module.exports={plan};
