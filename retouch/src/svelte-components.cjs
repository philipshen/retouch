'use strict';
const fs=require('node:fs'),path=require('node:path'),source=require('./svelte-source.cjs'),markers=require('./svelte-component-markers.cjs'),props=require('./svelte-component-props.cjs');
const refused=reason=>({ok:false,refused:true,reason});
function definition(r){
 const parsed=source.collect(r.source,r.relPath),element=parsed.components.find(e=>e.id===r.element.id);
 if(!element)throw Error('Select a Svelte component usage.');
 const name=element.tag;if(!/^[A-Za-z_$][\w$]*$/.test(name))throw Error('Select a directly imported Svelte component.');
 const imports=[...(parsed.ast.instance?.content.body||[]),...(parsed.ast.module?.content.body||[])].filter(n=>n.type==='ImportDeclaration').flatMap(n=>n.specifiers.filter(s=>s.type==='ImportDefaultSpecifier'&&s.local.name===name).map(()=>n.source.value));
 if(imports.length!==1||!imports[0].endsWith('.svelte'))throw Error('This component needs a direct Svelte source import.');
 // A template or script binding may shadow the imported component name.
 function binds(node){if(!node||typeof node!=='object')return false;if(node.type==='Identifier')return node.name===name;if(node.type==='RestElement')return binds(node.argument);if(node.type==='AssignmentPattern')return binds(node.left);if(node.type==='ObjectPattern')return node.properties.some(p=>binds(p.value||p.argument));if(node.type==='ArrayPattern')return node.elements.some(binds);return false;}
 function shadow(node){if(!node||typeof node!=='object'||node.type==='ImportDeclaration')return false;if(node.type==='VariableDeclarator'&&binds(node.id)||/^(?:Function|Class)(?:Declaration|Expression)$/.test(node.type)&&binds(node.id)||node.params?.some(binds)||node.type==='EachBlock'&&(binds(node.context)||node.index===name)||node.type==='AwaitBlock'&&(binds(node.value)||binds(node.error))||node.type==='SnippetBlock'&&(binds(node.expression)||node.parameters?.some(binds)))return true;return Object.values(node).some(v=>Array.isArray(v)?v.some(shadow):v&&typeof v==='object'&&shadow(v));}
 if(shadow(parsed.ast))throw Error('A local binding shadows this imported component.');
 const root=fs.realpathSync(r.appRoot||path.dirname(r.file)),resolver=require('./svelte-component-imports.cjs')(root),file=resolver.resolve(fs.realpathSync(r.file),imports[0]),relative=path.relative(root,file),resolution={dependencies:resolver.dependencies(),pathChecks:resolver.pathChecks()};
 const text=fs.readFileSync(file,'utf8'),rel=relative.split(path.sep).join('/'),meta=markers.metadata(text,rel);
 const contracts=require('./svelte-component-choices.cjs').read(text,{appRoot:root,file}),types=contracts.metadata();resolution.dependencies.push(...types.dependencies.filter(item=>item.file!==file));resolution.pathChecks.push(...types.pathChecks);r.guardComponentResolution?.(resolution);
 const definitionHash=resolution.dependencies.length||types.pathChecks.length?source.contentHash(JSON.stringify([file,source.contentHash(text),resolution.dependencies,resolution.pathChecks])):source.contentHash(text);
 return {name,file,rel,text,meta,definitionHash,contracts};
}
function describeComponent(r){try{
 const def=definition(r),info=props.describe(r),roots=def.meta.roots,groups=def.meta.rootGroups,anchor=groups[0]?.find(id=>groups.every(ids=>ids.includes(id)));
 const defaults=require('./svelte-component-defaults.cjs').read(def.text),definitionHash=def.definitionHash,spread=info.element.node.attributes.some(a=>a.type==='SpreadAttribute');
 const properties=info.props.map(prop=>{const fallback=defaults.get(prop.name);return {name:prop.name,value:prop.value===undefined?'Expression':String(prop.value),default:fallback?String(fallback.value):'—',editor:{...prop,...(fallback?{definitionHash,canReset:prop.editable}: {})}};});
 for(const [name,fallback]of defaults)if(!properties.some(prop=>prop.name===name)&&/^[A-Za-z_$][\w$-]*$/.test(name)&&!/^(?:data-rt|__retouch)/.test(name)&&!['children','slot','this'].includes(name))properties.push({name,value:String(fallback.value),default:String(fallback.value),editor:{...fallback,editable:!spread,inherited:true,definitionHash,canReset:false,...(spread?{reason:'A spread controls this component usage.'}:{})}});

 const contracts=def.contracts,accepts=require('./svelte-component-choices.cjs').accepts;
 for(const name of contracts.names){const contract=contracts.get(name);if(properties.some(prop=>prop.name===name)||!contract?.supported||!/^[A-Za-z_$][\w$-]*$/.test(name)||/^(?:data-rt|__retouch)/.test(name)||['children','slot','this'].includes(name))continue;const computed=contracts.hasDefault(name);properties.push({name,value:computed?'Computed default':'Not set',default:computed?'Computed':'—',editor:{type:contract.type,editable:!spread&&!computed,unset:!computed,...(computed?{reason:'This property uses a computed default.'}:spread?{reason:'A spread controls this component usage.'}:{})}});}
 for(const property of properties){const contract=contracts.get(property.name);if(!contract)continue;const editor=property.editor,valid=contract.supported&&editor.type===contract.type;const allowUnset=!!contract.optional&&!contracts.hasDefault(property.name);Object.assign(editor,{definitionHash,allowUnset,canClear:allowUnset&&editor.editable&&valid,...(contract.choices?{choices:contract.choices}:contract.type==='boolean'&&(allowUnset||editor.unset)?{choices:[true,false]}:{}),editable:editor.editable&&valid,canReset:!!editor.canReset&&accepts(contract,defaults.get(property.name)?.value),...(!valid?{reason:'This declared property type is not supported by the literal editor.'}:{})});}
 for(const property of properties){const editor=require('./svelte-component-default.cjs').describe(def,property.name);if(editor)property.defaultEditor=editor;}
 const names=properties.filter(prop=>prop.editor.canReset||prop.editor.canClear&&!prop.editor.unset).map(prop=>prop.name),resetProperties=names.length?{names,revision:source.contentHash(JSON.stringify([r.hash,definitionHash,names]))}:null;
 return {ok:true,swap:require('./svelte-component-swap.cjs').read(r),resetProperties,name:def.name,file:def.rel,hash:source.contentHash(def.text),usageHash:r.hash,source:def.text,explicitComponent:true,definitionId:anchor||roots[0]?.id||null,definitionIds:roots.map(e=>e.id),rootGroups:def.meta.rootGroups,...require('./svelte-component-structure.cjs').describe(r,{contentHash:source.contentHash},definition),movement:require('./svelte-component-order.cjs').describe(r),...require('./svelte-component-detach.cjs').describe(r,def),props:properties};
 }catch(error){return refused(error.message);}}
function create(base){
 const host=r=>({...r,elements:r.elements.filter(e=>e.kind==='host')});
 const adapter={...base,
  collect(text,relative){const parsed=source.collect(text,relative);return {...parsed,elements:[...parsed.elements,...parsed.components].sort((a,b)=>a.start-b.start)};},
  describeComponent,
  describe(r){if(r.element.kind!=='instance')return {...base.describe(host(r)),canInsertComponent:require('./svelte-insert.cjs').describe(r).canInsert};return {componentMovement:require('./svelte-component-order.cjs').describe(r),id:r.element.id,kind:'instance',tag:r.element.tag,file:r.relPath,hash:r.hash,renderRevisionAttribute:'data-rt-i-revision',context:r.context||null,canRename:false,textDynamic:true,classNameDynamic:true,structure:{},component:describeComponent(r)};},
  planOp(r,op){if(['insertComponent','swapComponent'].includes(op.type))return require('./svelte-insert-component.cjs').plan(r,op,adapter);if(r.element.kind!=='instance')return base.planOp(host(r),op);if(op.type==='setComponentDefault')return require('./svelte-component-default.cjs').plan(r,op,definition);if(op.type==='detachComponent')return require('./svelte-component-detach.cjs').plan(r,op,adapter,definition);if(['moveComponent','moveComponentSelection','reparentComponentSelection'].includes(op.type))return require('./svelte-component-order.cjs').plan(r,op,adapter);if(require('./svelte-component-structure.cjs').types.includes(op.type))return require('./svelte-component-structure.cjs').plan(r,op,adapter,definition);if(['pasteComponentProps','setComponentPropSelection','resetComponentProps','resetComponentPropsSelection'].includes(op.type))return require('./svelte-component-batch-props.cjs').plan(r,op,adapter);if(op.type!=='setComponentProp')return refused('Choose a supported component property edit.');const component=describeComponent(r);if(!component.ok)return component;const def=definition(r),contract=def.contracts.get(op.name);
   if(op.definitionHash!==undefined&&op.definitionHash!==def.definitionHash)return refused('The component definition changed. Re-select the instance.');
   if(contract){if(op.definitionHash!==def.definitionHash)return refused('The component property type changed. Re-select the instance.');const value=op.reset?require('./svelte-component-defaults.cjs').read(def.text).get(op.name)?.value:op.value;if(!op.clear&&!require('./svelte-component-choices.cjs').accepts(contract,value))return refused('Choose a value allowed by the declared component property type.');}
   const result=op.reset||op.clear||!props.describe(r).props.some(prop=>prop.name===op.name)?require('./svelte-component-defaults.cjs').plan(r,op,def):props.plan(r,op);
   if(result.ok&&contract&&result.edits.length&&!result.edits.some(edit=>edit.file===def.file))result.edits.push({file:def.file,before:def.text,after:def.text});return result;},
  hasReference:require('./svelte-component-detach.cjs').hasReference,
  capabilities:{...base.capabilities,ops:[...base.capabilities.ops,'setComponentDefault','detachComponent','insertComponent','swapComponent','moveComponent','moveComponentSelection','reparentComponentSelection',...require('./svelte-component-structure.cjs').types,'setComponentProp','setComponentPropSelection','pasteComponentProps','resetComponentProps','resetComponentPropsSelection']}
 };
 const planComponentOp=adapter.planOp;
 adapter.planOp=(r,op)=>{try{
  const dependencies=new Map(),checks=new Map();
  const plan=planComponentOp({...r,guardComponentResolution(resolution){
     for(const item of resolution.dependencies){const old=dependencies.get(item.file);if(old&&old.source!==item.source)throw Error('Component configuration changed during planning.');dependencies.set(item.file,item);}
   for(const item of resolution.pathChecks){const old=checks.get(item.file);if(old&&JSON.stringify(old)!==JSON.stringify(item))throw Error('Component resolution changed during planning.');checks.set(item.file,item);}
  }},op);
  if(!plan.ok||!plan.edits.length)return plan;
  for(const item of plan.pathChecks||[]){const old=checks.get(item.file);if(old&&JSON.stringify(old)!==JSON.stringify(item))throw Error('Component resolution changed during planning.');checks.set(item.file,item);}
  for(const item of dependencies.values()){const existing=plan.edits.find(edit=>edit.file===item.file);if(existing){if(existing.before!==item.source||existing.after!==item.source)throw Error('Component configuration changed during planning.');}else plan.edits.push({file:item.file,before:item.source,after:item.source});}
  if(checks.size)plan.pathChecks=[...checks.values()];return plan;
 }catch(error){return refused(error.message);}};
 adapter.applyOp=(r,op)=>require('./transactions.cjs').applyPlan(r.appRoot||path.dirname(r.file),adapter.planOp(r,op));return adapter;
}
module.exports={create,definition,describeComponent};
