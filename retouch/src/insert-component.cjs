'use strict';
const fs=require('node:fs'),path=require('node:path'),traverse=require('@babel/traverse').default,MagicString=require('magic-string');
const {collectElements,contentHash}=require('./id.cjs');
const refuse=reason=>({ok:false,refused:true,reason});
const containers=new Set(['div','main','section','article','aside','header','footer','nav','form','fieldset','dialog','figure','details','blockquote','li','td','th','body']);
const canContain=resolved=>resolved.element.kind==='host'&&containers.has(resolved.element.node?.openingElement?.name?.name)&&!resolved.element.node.openingElement.attributes.some(attr=>['dangerouslySetInnerHTML','children'].includes(attr.name?.name));
function plan(resolved,op){
 try{
  const swapping=op.type==='swapComponent',previous=swapping?require('./component-swap-props.cjs').read(resolved):null;if(previous&&!previous.ok)throw Error(previous.reason);
  if(op.fileHash!==resolved.hash)throw Error('The frame source changed. Select it again before inserting.');
  const node=resolved.element.node,tag=node?.openingElement?.name?.name;
  if(!swapping&&(resolved.element.kind!=='host'||!tag||!containers.has(tag)))throw Error('Select a frame that can contain component layers.');
  if(!swapping&&node.openingElement.attributes.some(attr=>['dangerouslySetInnerHTML','children'].includes(attr.name?.name)))throw Error('This frame supplies its children through a property. Edit that binding before inserting.');
  const root=fs.realpathSync(resolved.appRoot),file=path.resolve(root,op.definitionFile||'');
  if(typeof op.definitionFile!=='string'||!file.startsWith(root+path.sep)||file.includes(path.sep+'node_modules'+path.sep)||fs.realpathSync(file)!==file)throw Error('Choose a component definition inside this project.');
  const source=fs.readFileSync(file,'utf8');if(contentHash(source)!==op.definitionHash)throw Error('The component changed. Refresh the library before inserting.');
  const rel=path.relative(root,file).split(path.sep).join('/'),def=require('./component-definitions.cjs').definitions(source,rel).find(item=>item.definitionId===op.definitionId);
  if(!def)throw Error('The component definition no longer resolves.');
  if(swapping){const current=require('./components.cjs').definition(resolved);if(current.file===file&&current.fn.start===def.fn.start)throw Error('This instance already uses that component.');}
  if(file===resolved.file&&node.start>=def.fn.start&&node.end<=def.fn.end)throw Error('A component cannot be inserted into its own definition.');
  const definition={...def,file},{fields,dependencies,checks,revision,properties}=require('./component-insertion-props.cjs')(resolved,definition);
  if(op.contractHash!==undefined&&op.contractHash!==revision)throw Error('The component properties changed. Cancel and reopen insertion to load the current controls.');
  const supplied=op.props??{};if(!supplied||typeof supplied!=='object'||Array.isArray(supplied)||Object.keys(supplied).length>100)throw Error('Component properties must be a literal property object.');
  const matched=swapping?require('./component-swap-props.cjs').match(properties,previous.props):{kept:{},removed:[]};
  if(swapping&&JSON.stringify([...matched.removed].sort())!==JSON.stringify(Array.isArray(op.dropProps)?[...op.dropProps].sort():[]))throw Error('Review the overrides that will be removed before swapping.');
  const props={...matched.kept,...supplied};
  for(const [name,field] of fields)if(field.required&&!Object.hasOwn(props,name))throw Error('Set the required component property "'+name+'" before inserting.');
  const attributes=previous?.key?[previous.key]:[];
  for(const [name,value] of Object.entries(props)){
   const field=fields.get(name),contract=field?.contract;
   if(!field||!/^[$A-Za-z_][\w$-]*$/.test(name)||['key','ref','children','__proto__'].includes(name)||!['string','number','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value))throw Error('Choose supported literal component properties.');
   if(contract&&(typeof value!==contract.type||contract.choices&&!contract.choices.includes(value)))throw Error('The property "'+name+'" does not match the component contract.');
   attributes.push(name+'={'+JSON.stringify(value)+'}');
  }
  const {ast}=collectElements(resolved.source,resolved.relPath);let selected;const used=new Set();
  traverse(ast,{Identifier(p){used.add(p.node.name);},JSXIdentifier(p){used.add(p.node.name);},JSXElement(p){if(p.node.start===node.start)selected=p;}});
  if(!selected)throw Error('The selected frame no longer resolves.');
  let parentBefore=swapping?null:resolved.element;
  if(swapping)for(let p=selected.parentPath;p;p=p.parentPath){parentBefore=resolved.elements.find(element=>element.kind==='host'&&element.node.start===p.node.start);if(parentBefore)break;}
  if(swapping&&!parentBefore)throw Error('Swap an instance inside a source frame. Root instance swapping is not supported yet.');
  let local=def.name,importText='',importAt=ast.program.directives.at(-1)?.end||ast.program.interpreter?.end||0;
  if(file===resolved.file){
   const binding=selected.scope.getBinding(local),bindingStart=binding?.path.node.init?.start??binding?.path.node.start;
   if(bindingStart!==def.fn.start)throw Error('This component name is not accessible in the selected frame.');
  }else if(local=require('./component-import-binding.cjs')(ast,selected,root,file,{...def,usageFile:resolved.file},checks)){
   // Keep the existing module import and all pre-existing source IDs unchanged.
  }else{
   const exported=def.exports.find(name=>name==='default'||/^[A-Z][\w$]*$/.test(name));if(!exported)throw Error('Export this component before inserting it into another file.');
   let specifier=path.relative(path.dirname(resolved.file),file).split(path.sep).join('/').replace(/\.(jsx|tsx)$/,'');if(!specifier.startsWith('.'))specifier='./'+specifier;
   local=/^[A-Z][\w$]*$/.test(def.name)?def.name:'InsertedComponent';let suffix=2;const base=local;while(used.has(local))local=base+suffix++;
   const baseFile=file.replace(/\.(jsx|tsx)$/,'');for(const candidate of [baseFile,baseFile+'.ts',baseFile+'.tsx',baseFile+'.js',baseFile+'.jsx']){const check=require('./source-path-checks.cjs').snapshot(root,candidate);checks.set(candidate,check);if(candidate!==file&&check.kind!=='missing')throw Error('This import path has another matching module. Give the component a distinct module name.');}
   const spec=exported==='default'?local:'{ '+exported+(exported!==local?' as '+local:'')+' }';
   importText='\nimport '+spec+' from '+JSON.stringify(specifier)+';\n';
  }
  const jsx='<'+local+(attributes.length?' '+attributes.join(' '):'')+'/>',ms=new MagicString(resolved.source);
  let position;
  if(swapping){position=node.start;ms.overwrite(node.start,node.end,jsx);}
  else if(node.openingElement.selfClosing){position=node.openingElement.end-2;ms.overwrite(position,node.openingElement.end,'>\n'+jsx+'\n</'+tag+'>');position+=2;}
  else{position=node.closingElement.start;ms.appendLeft(position,'\n'+jsx+'\n');position++;}
  if(importText)ms.appendLeft(importAt,importText);
  const after=ms.toString(),elements=collectElements(after,resolved.relPath).elements,offset=importText.length;
  const inserted=elements.find(element=>element.kind==='instance'&&element.node.start===position+offset),parent=elements.find(element=>element.kind==='host'&&element.node.start===parentBefore.node.start+offset);
  if(!inserted||!parent)throw Error('The inserted component could not be mapped to source.');
  const edits=[{file:resolved.file,before:resolved.source,after}];for(const [dependency,before] of dependencies)if(dependency!==resolved.file)edits.push({file:dependency,before,after:before});
  return {ok:true,hash:contentHash(after),insertedComponent:{instanceId:inserted.id,parentId:parent.id,previousParentId:parentBefore.id,...(swapping?{previousInstanceId:resolved.element.id}: {})},edits,pathChecks:[...checks.values()]};
 }catch(error){return refuse(error.message);}
}
module.exports={plan,canContain};
