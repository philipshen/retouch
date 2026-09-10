'use strict';
// Resolve source bindings, never runtime names or user-supplied file paths.
const fs = require('node:fs');
const path = require('node:path');
const MagicString = require('magic-string');
const traverse = require('@babel/traverse').default;
const { parseSource, collectElements, contentHash, jsxElementName } = require('./id.cjs');
const refuse = reason => ({ ok: false, refused: true, reason });
function readConfig(file) {
  // JSONC is parsed as syntax, never executed. Only JSON-shaped AST nodes pass.
  const ast = parseSource('const config = ' + fs.readFileSync(file, 'utf8'));
  function value(node) {
    if (node.type === 'ObjectExpression') {
      const result = Object.create(null);
      for (const prop of node.properties) {
        if (prop.type !== 'ObjectProperty' || prop.computed) throw new Error('Nonliteral config');
        const key = prop.key.name ?? prop.key.value;
        if (Object.hasOwn(result, key)) throw new Error('Duplicate config key');
        result[key] = value(prop.value);
      }
      return result;
    }
    if (node.type === 'ArrayExpression') return node.elements.map(value);
    if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral', 'NullLiteral'].includes(node.type)) return node.value ?? null;
    throw new Error('Nonliteral config');
  }
  return value(ast.program.body[0].declarations[0].init);
}
function contained(root, file) {
  const real = fs.realpathSync(file);
  if (!real.startsWith(fs.realpathSync(root) + path.sep) || real.split(path.sep).includes('node_modules')) throw new Error('The component definition is outside this project.');
  return real;
}
function moduleFile(root, from, specifier) {
  const candidates = [];
  if (specifier.startsWith('.')) candidates.push(path.resolve(path.dirname(from),specifier));
  else {
    for (const name of ['tsconfig.json','jsconfig.json']) {
      try {
        const config = readConfig(path.join(root,name));
        const base = path.resolve(root,config.compilerOptions?.baseUrl || '.');
        for (const [pattern,values] of Object.entries(config.compilerOptions?.paths || {})) {
          const [prefix,suffix=''] = pattern.split('*');
          if (pattern.includes('*') ? specifier.startsWith(prefix)&&specifier.endsWith(suffix) : specifier===pattern) {
            const middle=pattern.includes('*')?specifier.slice(prefix.length,suffix.length?-suffix.length:undefined):'';
            for(const value of values)candidates.push(path.resolve(base,value.replace('*',middle)));
          }
        }
      } catch {}
    }
  }
  for (const candidate of candidates) for (const ext of ['', '.tsx','.jsx','.ts','.js','/index.tsx','/index.jsx','/index.ts','/index.js']) {
    const file=candidate+ext;
    if(fs.existsSync(file)&&fs.statSync(file).isFile()&&/\.[jt]sx?$/.test(file))return contained(root,file);
  }
  throw new Error(`Cannot resolve local component module ${specifier}.`);
}
function functionNode(node) {
  if (!node) return null;
  if (['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type)) return node;
  if (node.type==='VariableDeclarator') return functionNode(node.init);
  if (node.type==='CallExpression') return node.arguments.map(functionNode).find(Boolean) || null;
  return null;
}
function bindingIn(ast,name) {
  let found;
  traverse(ast,{Program(p){found=p.scope.getBinding(name)?.path.node;p.stop();}});
  return found;
}
function exported(root,file,name,seen=new Set()) {
  const key=file+'#'+name;if(seen.has(key))throw new Error('Component exports form a cycle.');seen.add(key);
  const source=fs.readFileSync(file,'utf8'),ast=parseSource(source);
  for(const item of ast.program.body) {
    if(item.type==='ExportDefaultDeclaration'&&name==='default') {
      const node=item.declaration.type==='Identifier'?bindingIn(ast,item.declaration.name):item.declaration;
      const fn=functionNode(node);if(fn)return {file,source,fn,exportName:name};
    }
    if(item.type==='ExportNamedDeclaration') {
      const decl=item.declaration;
      if(decl?.id?.name===name&&functionNode(decl))return {file,source,fn:functionNode(decl),exportName:name};
      if(decl?.type==='VariableDeclaration')for(const d of decl.declarations)if(d.id.name===name&&functionNode(d))return {file,source,fn:functionNode(d),exportName:name};
      for(const spec of item.specifiers)if((spec.exported.name||spec.exported.value)===name) {
        const local=spec.local?.name||spec.local?.value;
        if(item.source)return exported(root,moduleFile(root,file,item.source.value),local,seen);
        const node=bindingIn(ast,local),fn=functionNode(node);
        if(fn)return {file,source,fn,exportName:name};
        if(node?.type==='ImportSpecifier'||node?.type==='ImportDefaultSpecifier') {
          const imp=ast.program.body.find(n=>n.type==='ImportDeclaration'&&n.specifiers.includes(node));
          return exported(root,moduleFile(root,file,imp.source.value),node.type==='ImportDefaultSpecifier'?'default':node.imported.name,seen);
        }
      }
    }
    if(item.type==='ExportAllDeclaration'&&name!=='default') {
      try{return exported(root,moduleFile(root,file,item.source.value),name,seen);}catch{}
    }
  }
  throw new Error('This export is not a locally resolvable function component.');
}
function definition(resolved) {
  if(resolved.element.kind!=='instance')throw new Error('Select a component instance to inspect its definition.');
  const name=jsxElementName(resolved.element.node),parts=name.split('.'),ast=parseSource(resolved.source);
  if(parts.length>2)throw new Error('Deep component member bindings cannot be resolved.');
  let binding;
  traverse(ast,{JSXElement(p){if(p.node.start===resolved.element.node.start){binding=p.scope.getBinding(parts[0]);p.stop();}}});
  if(!binding)throw new Error('The component binding cannot be resolved to local source.');
  const node=binding.path.node;
  if(binding.kind==='module') {
    const imp=binding.path.parentPath.node;
    const exportName=node.type==='ImportDefaultSpecifier'?'default':node.type==='ImportNamespaceSpecifier'?parts[1]:node.imported.name||node.imported.value;
    if(!exportName||(parts.length>1&&node.type!=='ImportNamespaceSpecifier'))throw new Error('Computed component members cannot be resolved.');
    return {...exported(resolved.appRoot,moduleFile(resolved.appRoot,resolved.file,imp.source.value),exportName),name};
  }
  const fn=functionNode(node);if(!fn)throw new Error('The local component is not a function component.');
  if(!binding.scope.path.isProgram())throw new Error('Nested components capture local values and cannot be detached as a module.');
  // A same-file function must be exported before a copied module can import it.
  return {file:resolved.file,source:resolved.source,fn,exportName:parts[0],name,local:true};
}
function describe(resolved) {
  try {
    resolved = { ...resolved, appRoot: fs.realpathSync(resolved.appRoot), file: fs.realpathSync(resolved.file) };
    const def=definition(resolved),rel=path.relative(resolved.appRoot,def.file).split(path.sep).join('/');
    const {elements,ast}=collectElements(def.source,rel);
    const declaration=ast.program.body.find(item=>['ExportNamedDeclaration','ExportDefaultDeclaration'].includes(item.type)&&item.declaration?.start===def.fn.start);
    const explicitComponent=[...(def.fn.leadingComments||[]),...(declaration?.leadingComments||[])].some(comment=>comment.value.trim()==='* @retouch-component');
    const host=elements.find(e=>e.kind==='host'&&e.node.start>=def.fn.start&&e.node.end<=def.fn.end);
    const props=new Map();
    let param=def.fn.params[0];if(param?.type==='AssignmentPattern')param=param.left;
    if(param?.type==='ObjectPattern')for(const p of param.properties) {
      if(p.type==='RestElement'){props.set('…'+p.argument.name,{name:'…'+p.argument.name,default:'Forwarded props',value:'—'});continue;}
      const name=p.key.name||p.key.value;
      props.set(name,{name,default:p.value?.type==='AssignmentPattern'?def.source.slice(p.value.right.start,p.value.right.end):'—',value:'—'});
    }
    for(const attr of resolved.element.node.openingElement.attributes) {
      if(attr.type==='JSXSpreadAttribute'){const name='…'+resolved.source.slice(attr.argument.start,attr.argument.end);props.set(name,{name,value:'Spread expression',default:'—'});continue;}
      const name=attr.name.name;if(typeof name!=='string'||name.startsWith('data-rt'))continue;
      const value=attr.value?resolved.source.slice(attr.value.start,attr.value.end):'true';
      props.set(name,{name,default:props.get(name)?.default||'—',value});
    }
    const children=resolved.element.node.children?.filter(n=>n.type!=='JSXText'||n.value.trim());
    if(children?.length)props.set('children',{name:'children',default:'—',value:resolved.source.slice(children[0].start,children.at(-1).end)});
    const detached=def.file.includes('.retouch-'+resolved.element.id+'.');
    const duplication=require('./duplicate-component.cjs').describe(resolved);
    return {ok:true,usageHash:resolved.hash,canDuplicate:duplication.ok,duplicateReason:duplication.reason||null,explicitComponent,name:def.name,file:rel,hash:contentHash(def.source),source:def.source.slice(def.fn.start,def.fn.end),props:[...props.values()].map(prop=>({...prop,editor:require('./component-props.cjs').describe(resolved,prop.name)})),definitionId:host?.id||null,detached,canDetach:!detached};
  }catch(err){return refuse(err.message);}
}
function planDetach(resolved,op) {
  resolved = { ...resolved, appRoot: fs.realpathSync(resolved.appRoot), file: fs.realpathSync(resolved.file) };
  if(op.fileHash!==resolved.hash)return refuse('The usage file changed. Re-select the instance and retry.');
  let def;try{def=definition(resolved);}catch(err){return refuse(err.message);}
  if(def.file.includes('.retouch-'+resolved.element.id+'.'))return refuse('This usage already has an independent component module.');
  if(op.definitionHash!==contentHash(def.source))return refuse('The component definition changed. Reopen it before detaching.');
  const ext=path.extname(def.file),copy=def.file.slice(0,-ext.length)+'.retouch-'+resolved.element.id+ext;
  if(fs.existsSync(copy))return refuse('A detached module already exists for this usage.');
  const baseName=def.name.replace(/\W/g,'');
  const alias=baseName[0].toUpperCase()+baseName.slice(1)+'Detached_'+resolved.element.id;
  if(new RegExp('\\b'+alias+'\\b').test(resolved.source))return refuse('The detached component name is already in use.');
  let moduleSource=def.source;
  if(def.local) {
    // Export the copied declaration without changing the shared module.
    try{exported(resolved.appRoot,def.file,def.exportName);}catch{moduleSource+=`\nexport { ${def.exportName} };\n`;}
  }
  const ms=new MagicString(resolved.source),node=resolved.element.node;
  ms.overwrite(node.openingElement.name.start,node.openingElement.name.end,alias);
  if(node.closingElement)ms.overwrite(node.closingElement.name.start,node.closingElement.name.end,alias);
  let spec=path.relative(path.dirname(resolved.file),copy).split(path.sep).join('/');if(!spec.startsWith('.'))spec='./'+spec;
  const importText=def.exportName==='default'?alias:`{ ${def.exportName} as ${alias} }`;
  // Appending preserves structural IDs of every existing usage site.
  ms.append(`\nimport ${importText} from ${JSON.stringify(spec)};\n`);
  const next=ms.toString();
  try{parseSource(next);parseSource(moduleSource);}catch(err){return refuse('Detached code did not parse: '+err.message);}
  return {ok:true,hash:contentHash(next),createdFile:copy,createdHash:contentHash(moduleSource),detachedFile:path.relative(resolved.appRoot,copy).split(path.sep).join('/'),name:alias,
    edits:[{file:copy,before:null,after:moduleSource},{file:resolved.file,before:resolved.source,after:next}]};
}
function detach(resolved,op) {
  return require('./transactions.cjs').applyPlan(resolved.appRoot, planDetach(resolved,op));
}
function hasReference(root, file, excluded) {
  const stem = path.basename(file, path.extname(file));
  const skip = new Set(['node_modules', 'dist', 'build', 'out', 'public', 'coverage']);
  function scan(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.name.startsWith('.') || item.isSymbolicLink() || skip.has(item.name)) continue;
      const candidate = path.join(dir, item.name);
      if (item.isDirectory()) { if (scan(candidate)) return true; }
      else if (/\.[cm]?[jt]sx?$/.test(item.name) && !excluded.includes(candidate) && fs.readFileSync(candidate, 'utf8').includes(stem)) return true;
    }
    return false;
  }
  return scan(root);
}

module.exports={describe,detach,planDetach,hasReference,definition};
