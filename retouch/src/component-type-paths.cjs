'use strict';
const fs=require('node:fs'),path=require('node:path');
const {parseSource}=require('./id.cjs');
// Read JSON-shaped configuration as syntax; never evaluate project code.
function configValue(source){
 const ast=parseSource('const config = '+source);
 if(ast.program.body.length!==1||ast.program.body[0].declarations?.length!==1)throw Error('Invalid project config');
 function read(node){
  if(node?.type==='ObjectExpression'){
   const result=Object.create(null);
   for(const prop of node.properties){if(prop.type!=='ObjectProperty'||prop.computed)throw Error('Nonliteral config');const key=prop.key.name??prop.key.value;if(Object.hasOwn(result,key))throw Error('Duplicate config key');result[key]=read(prop.value);}return result;
  }
  if(node?.type==='ArrayExpression')return node.elements.map(read);
  if(['StringLiteral','NumericLiteral','BooleanLiteral','NullLiteral'].includes(node?.type))return node.value??null;
  if(node?.type==='UnaryExpression'&&node.operator==='-'&&node.argument.type==='NumericLiteral')return -node.argument.value;
  throw Error('Nonliteral config');
 }
 const value=read(ast.program.body[0].declarations[0].init);if(!value||Array.isArray(value)||typeof value!=='object')throw Error('Invalid project config');return value;
}
module.exports=function typePaths(appRoot){
 const root=fs.realpathSync(appRoot),dependencies=new Map(),cache=new Map();
 function snapshot(file){
  if(!file.startsWith(root+path.sep)||file.split(path.sep).includes('node_modules'))throw Error('Type config is outside this project');
  if(!fs.existsSync(file)){dependencies.set(file,{file,source:null});return null;}
  if(fs.realpathSync(file)!==file)throw Error('Type config follows a symbolic link');
  const source=fs.readFileSync(file,'utf8');if(source.length>1000000)throw Error('Type config is too large');dependencies.set(file,{file,source});return source;
 }
 function load(file,seen=new Set()){
  if(seen.has(file)||seen.size>=20)throw Error('Type config inheritance cycle or depth limit');
  if(cache.has(file))return cache.get(file);
  if(cache.size>=40)throw Error('Too many type configs');
  const source=snapshot(file);if(source===null)throw Error('Extended type config is missing');
  const config=configValue(source),next=new Set(seen);next.add(file);let result={};
  const bases=config.extends===undefined?[]:Array.isArray(config.extends)?config.extends:[config.extends];
  for(const spec of bases){
   if(typeof spec!=='string'||!spec.startsWith('.'))throw Error('Only relative local config inheritance is supported');
   let target=path.resolve(path.dirname(file),spec);if(!path.extname(target))target+='.json';
   result={...result,...load(target,next)};
  }
  const options=config.compilerOptions??{};if(typeof options!=='object'||Array.isArray(options))throw Error('Invalid compiler options');
  if(Object.hasOwn(options,'baseUrl')){if(typeof options.baseUrl!=='string')throw Error('Invalid baseUrl');result.baseUrl=path.resolve(path.dirname(file),options.baseUrl);}
  if(Object.hasOwn(options,'paths')){if(!options.paths||typeof options.paths!=='object'||Array.isArray(options.paths))throw Error('Invalid paths');result.paths=options.paths;result.pathsOrigin=path.dirname(file);}
  cache.set(file,result);return result;
 }
 const tsconfig=path.join(root,'tsconfig.json'),jsconfig=path.join(root,'jsconfig.json');
 const selected=snapshot(tsconfig)!==null?tsconfig:snapshot(jsconfig)!==null?jsconfig:null;
 const config=selected?load(selected):{};
 return {
  dependencies(){return [...dependencies.values()];},
  candidates(specifier){
   const matches=[];
   for(const [pattern,targets] of Object.entries(config.paths||{})){
    if(pattern.split('*').length>2||!Array.isArray(targets)||!targets.length||targets.some(target=>typeof target!=='string'||target.split('*').length>2))throw Error('Invalid path mapping');
    const [prefix,suffix='']=pattern.split('*'),wild=pattern.includes('*');
    if(wild?specifier.length>=prefix.length+suffix.length&&specifier.startsWith(prefix)&&specifier.endsWith(suffix):specifier===pattern)matches.push({pattern,targets,prefix,suffix,wild});
   }
   matches.sort((a,b)=>Number(a.wild)-Number(b.wild)||b.prefix.length-a.prefix.length);
   if(!matches.length)return [];
   const match=matches[0],middle=match.wild?specifier.slice(match.prefix.length,match.suffix.length?-match.suffix.length:undefined):'';
   return match.targets.map(target=>path.resolve(config.baseUrl||config.pathsOrigin,target.replace('*',middle)));
  }
 };
};
