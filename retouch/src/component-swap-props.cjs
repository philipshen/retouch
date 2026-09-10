'use strict';
function read(resolved){
 try{
  if(resolved.element.kind!=='instance')throw Error('Select a component instance to swap.');
  const node=resolved.element.node;if(node.children.some(child=>child.type!=='JSXText'||child.value.trim()))throw Error('This instance has children. Move or preserve that content before swapping.');
  const props=Object.create(null),seen=new Set();let key=null;
  for(const attr of node.openingElement.attributes){
   if(attr.type!=='JSXAttribute'||typeof attr.name.name!=='string')throw Error('This instance uses a spread or namespaced property. Make its overrides explicit before swapping.');
   const name=attr.name.name;if(seen.has(name))throw Error('Resolve duplicate properties before swapping.');seen.add(name);
   if(name==='key'){key=resolved.source.slice(attr.start,attr.end);continue;}
   if(['ref','children','__proto__','__self','__source'].includes(name)||name.startsWith('data-rt'))throw Error('This instance has a property with special behavior that cannot be swapped yet.');
   const literal=require('./component-props.cjs').literal(attr);if(!literal||typeof literal.value==='number'&&!Number.isFinite(literal.value))throw Error('The property "'+name+'" uses an expression. Preserve its binding before swapping.');
   props[name]=literal.value;
  }
  return {ok:true,props,key};
 }catch(error){return {ok:false,reason:error.message};}
}
function match(properties,values){
 const kept=Object.create(null),removed=[];
 for(const [name,value] of Object.entries(values)){const prop=properties.find(prop=>prop.name===name);if(prop&&(!prop.type||typeof value===prop.type)&&(!prop.choices||prop.choices.includes(value)))kept[name]=value;else removed.push(name);}
 return {kept,removed};
}
module.exports={read,match};
