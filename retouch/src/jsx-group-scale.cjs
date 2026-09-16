'use strict';
const fs=require('node:fs'),path=require('node:path'),MagicString=require('magic-string');
const {collectElements,contentHash}=require('./id.cjs'),runtime=require('./react-group-scale-runtime.cjs');
const moduleName='./.retouch-group-scale.jsx';
function attribute(element,name){return element.node.openingElement.attributes.find(a=>a.type==='JSXAttribute'&&a.name.name===name);}
function literal(element,name){const a=attribute(element,name);if(!a)return null;if(!a.value)return '';if(a.value.type==='StringLiteral')return a.value.value;if(a.value.type==='JSXExpressionContainer'&&a.value.expression.type==='StringLiteral')return a.value.expression.value;throw Error('Resolve dynamic '+name+' before scaling.');}
function plan(resolved,op){try{
 if(op.fileHash!==resolved.hash)throw Error('The file changed. Re-select the group.');
 if(!Number.isInteger(op.width)||op.width<0||op.width>7680||!Number.isFinite(op.factor)||op.factor<.01||op.factor>100)throw Error('Choose a valid screen width and scale factor.');
 for(const pair of [op.offset??[0,0],op.move??[0,0]])if(!Array.isArray(pair)||pair.length!==2||pair.some(n=>!Number.isFinite(n)||Math.abs(n)>10000))throw Error('Choose finite group offsets.');
 const source=resolved.source,{ast,elements}=collectElements(source,resolved.relPath),group=elements.find(e=>e.id===resolved.element.id);
 if(!group||group.kind!=='host'||!attribute(group,'data-rt-group')||!group.node.closingElement)throw Error('Choose a source-backed React group.');
 const helper=path.join(path.dirname(resolved.file),'.retouch-group-scale.jsx'),generated=runtime.component(),before=fs.existsSync(helper)?fs.readFileSync(helper,'utf8'):null;
 if(before!==null&&before!==generated&&!require('../runtime/react-group-scale-legacy.json').some(entry=>entry.sha256===require('node:crypto').createHash('sha256').update(before).digest('hex')))throw Error('The generated React scale helper changed outside this runtime version.');
 const imports=ast.program.body.filter(n=>n.type==='ImportDeclaration'&&n.source.value===moduleName);
 if(imports.length>1||imports.some(n=>n.specifiers.length!==1||n.specifiers[0].type!=='ImportDefaultSpecifier'||n.importKind==='type'))throw Error('Resolve the React scale helper import.');
 let binding=imports[0]?.specifiers[0].local.name;
 if(!binding){binding='RetouchScaleRuntime';let i=0;while(new RegExp('\\b'+binding+'\\b').test(source))binding='RetouchScaleRuntime'+(++i);}
 if(imports.length){const traverse=require('@babel/traverse').default;traverse(ast,{JSXElement(p){if(p.node===group.node&&p.scope.getBinding(binding)?.path.node!==imports[0].specifiers[0])throw Error('The React runtime import is shadowed in this group.');}});}
 const inside=e=>e.node.start>group.node.start&&e.node.end<group.node.end;
 const children=elements.filter(inside),anchors=children.filter(e=>e.kind==='instance'&&e.node.openingElement.name.name===binding);
 if(anchors.length>1||anchors.some(e=>!group.node.children.includes(e.node)||e.node.openingElement.attributes.length||!e.node.openingElement.selfClosing))throw Error('Resolve the React group runtime registration.');
 if(anchors.length&&!imports.length)throw Error('Resolve the existing React runtime component.');
 const members=children.filter(e=>!anchors.includes(e));
 if(!members.length||members.length>100||members.some(e=>e.kind!=='host'||e.node.openingElement.attributes.some(a=>a.type==='JSXSpreadAttribute'))||group.node.openingElement.attributes.some(a=>a.type==='JSXSpreadAttribute'))throw Error('Choose 1–100 native children with explicit attributes.');
 // Expressions can contain text, but generated JSX needs per-instance identities.
 const visit=node=>{if(!node||typeof node!=='object')return;if(node.type==='JSXExpressionContainer'&&elements.some(e=>e.node.start>node.start&&e.node.end<node.end))throw Error('Generated React children need instance-aware scale identities.');for(const [key,value]of Object.entries(node))if(key!=='loc'&&key!=='extra'){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}};visit(group.node);
 if(elements.some(e=>e!==group&&attribute(e,'data-rt-scale')&&(inside(e)||e.node.start<group.node.start&&e.node.end>group.node.end)))throw Error('Overlapping responsive scale groups are not supported yet.');
 const seen=new Set(),snapshots={};
 for(const member of members){const id=literal(member,'data-rt-scale-member')??member.id;if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||seen.has(id))throw Error('Group members need distinct persistent identities.');seen.add(id);
  if(attribute(member,'style'))throw Error('Resolve inline member styles before composing the group.');
  const ranges=require('./group-scale-classes.cjs').snapshot(literal(member,'className')||'');if(Object.keys(ranges).length)snapshots[id]=ranges;
 }
 const stored=literal(group,'data-rt-scale'),metadata=require('./group-scale-metadata.cjs').compose(stored===null?null:JSON.parse(stored),op,()=>snapshots),out=new MagicString(source);
 const set=(el,name,value)=>{const a=attribute(el,name),text=name+'={'+JSON.stringify(value)+'}';if(a)out.overwrite(a.start,a.end,text);else out.appendLeft(el.node.openingElement.name.end,' '+text);};
 set(group,'data-rt-scale',metadata);for(const member of members)set(member,'data-rt-scale-member',literal(member,'data-rt-scale-member')??member.id);
 if(!anchors.length)out.appendLeft(group.node.closingElement.start,'<'+binding+' />');
 if(!imports.length)out.append('\nimport '+binding+' from '+JSON.stringify(moduleName)+';\n');
 const after=out.toString(),next=collectElements(after,resolved.relPath).elements;
 for(const element of elements)if(!next.some(e=>e.id===element.id&&e.kind===element.kind))throw Error('Scaling changed source layer identity.');
 return {ok:true,hash:contentHash(after),edits:[...(before===generated?[]:[{file:helper,before,after:generated}]),{file:resolved.file,before:source,after}]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}}
function describe(resolved){
 const group=resolved.element;if(!attribute(group,'data-rt-group'))return attribute(group,'data-rt-scale-member')?{scaleMember:true}:{};
 const elements=resolved.elements||collectElements(resolved.source,resolved.relPath).elements;
 return {groupScale:{react:true,runtimeRevision:require('./group-scale-runtime.cjs').revision(),metadata:literal(group,'data-rt-scale'),members:Object.fromEntries(elements.filter(e=>e.kind==='host'&&e.node.start>group.node.start&&e.node.end<group.node.end).map(e=>[e.id,literal(e,'data-rt-scale-member')]))}};
}
const structural=new Set(['frameSelection','groupSelection','removeFrame','reparentElement','reparentSelection','duplicateSelection','deleteSelection','moveSelection','insertElement','duplicateElement','pasteElement','deleteElement','moveElement','setChildren','setTag','createComponent','detachComponent','insertComponent','swapComponent','moveComponent','reparentComponentSelection','deleteComponent','deleteComponentSelection','duplicateComponent','duplicateComponentSelection']);
function guard(resolved,op){
 if(!structural.has(op.type))return null;
 const elements=resolved.elements||collectElements(resolved.source,resolved.relPath).elements,ids=new Set([resolved.element.id,...(Array.isArray(op.ids)?op.ids:[]),op.copiedId,op.parentId,op.targetId,op.destinationId]),selected=elements.filter(e=>ids.has(e.id));
 const owners=elements.filter(e=>attribute(e,'data-rt-scale'));
 if(owners.some(owner=>selected.some(e=>e.node.start<owner.node.end&&e.node.end>owner.node.start)))return {ok:false,refused:true,reason:'Responsive React groups need preserved scale ownership for this structural edit. Undo the group scaling first.'};
 return null;
}
module.exports={plan,describe,guard};
