'use strict';
function read(r){try{
 if(r.element.kind!=='instance')throw Error('Select a component instance to swap.');const node=r.element.node;
 if(node.fragment.nodes.some(n=>n.type!=='Text'||n.data.trim()))throw Error('This instance has child content. Preserve that content before swapping.');
 const props=Object.create(null),seen=new Set();for(const attribute of node.attributes){const name=attribute.name;if(attribute.type!=='Attribute'||typeof name!=='string'||seen.has(name))throw Error('Make the component properties explicit and unique before swapping.');seen.add(name);if(!/^[A-Za-z_$][\w$-]*$/.test(name)||['children','slot','this','__proto__','ref'].includes(name)||/^(?:data-rt|__retouch)/.test(name))throw Error('This instance has a property with special behavior that cannot be swapped yet.');const literal=require('./svelte-component-props.cjs').literal(attribute);if(!literal)throw Error('The property "'+name+'" has a binding or expression. Preserve that binding before swapping.');props[name]=literal.value;}
 return {ok:true,props};
 }catch(error){return {ok:false,reason:error.message};}}
function match(properties,values){const kept=Object.create(null),removed=[];for(const [name,value]of Object.entries(values)){const field=properties.find(p=>p.name===name);if(field?.supported&&typeof value===field.type&&(!field.choices||field.choices.includes(value)))kept[name]=value;else removed.push(name);}return {kept,removed};}
module.exports={read,match};
