'use strict';
// Theme JSON is component-usage source. Its structural IDs, definitions and
// transaction plans use the same contract as a component call in markup.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const json=require('./json-source.cjs');
const render=require('./liquid-context.cjs');
const hash=value=>crypto.createHash('sha1').update(value).digest('hex');
const idFor=(rel,keys)=>hash(rel+'|component:'+JSON.stringify(keys)).slice(0,10);
const matches=file=>/(?:^|\/)(?:templates|sections)\/(?:[^/]+\/)*[^/]+\.json$/.test(file.replaceAll('\\','/'));
const suffix=(runtime,key)=>runtime===key||runtime?.endsWith('__'+key);

function collect(source,rel) {
  const tree=json.parse(source),elements=[];
  function visit(node,keys,parent,sectionKey,blockKeys) {
    const type=node.children?.get('type');
    if(typeof type?.value!=='string'||!/^[_\w-]+$/.test(type.value))return;
    const element={id:idFor(rel,keys),kind:'instance',theme:true,tag:type.value,moduleName:type.value,
      directory:parent?'blocks':'sections',keys,parent,sectionKey,blockKeys,node,typeNode:type,
      static:node.value.static===true,settings:node.value.settings||{}};
    elements.push(element);
    for(const [key,child]of node.children?.get('blocks')?.children||[])visit(child,[...keys,'blocks',key],element,sectionKey,[...blockKeys,key]);
  }
  for(const [key,section]of tree.children?.get('sections')?.children||[])visit(section,['sections',key],null,key,[]);
  return {elements};
}
function safeRead(root,rel) {
  if(path.isAbsolute(rel))throw new Error('A component source is outside the project.');
  const file=path.resolve(root,rel),real=fs.realpathSync(file);
  if(!real.startsWith(fs.realpathSync(root)+path.sep))throw new Error('A component source is outside the project.');
  return {file,rel,source:fs.readFileSync(file,'utf8')};
}
function documents(root,context) {
  const files=[];
  if(/^[\w-]+(?:\/[\w-]+)*(?:\.[\w-]+)?$/.test(context.template||''))files.push('templates/'+context.template+'.json');
  const sections=path.join(root,'sections');
  if(fs.existsSync(sections))for(const name of fs.readdirSync(sections))if(name.endsWith('.json'))files.push('sections/'+name);
  return files.filter(rel=>fs.existsSync(path.join(root,rel))).map(rel=>safeRead(root,rel));
}
function bindings(root,value) {
  const context=render.context(value);
  if(!root||!context.section)return [];
  const candidates=[];
  for(const doc of documents(root,context))for(const element of collect(doc.source,doc.rel).elements) {
    if(!suffix(context.section,element.sectionKey))continue;
    if(context.block) {
      if(!suffix(context.block,element.blockKeys.at(-1)))continue;
      let at=0;
      const matches=(context.blocks||[]).every(hint=>{
        while(at<element.blockKeys.length&&!suffix(hint,element.blockKeys[at]))at++;
        return at++<element.blockKeys.length;
      });
      if(!matches)continue;
    } else if(element.parent)continue;
    candidates.push({...doc,element});
  }
  if(candidates.length!==1)return [];
  const {element,...doc}=candidates[0],out=[];
  for(let current=element;current;current=current.parent)out.push({...doc,element:current});
  return out;
}
function scope(element,value) {
  const context=render.context(value),attrs={'data-rt-section':context.section};
  if(element.parent) {
    const key=element.blockKeys.at(-1);
    const runtime=[...(context.blocks||[]),context.block].find(id=>suffix(id,key));
    if(!runtime)return null;
    attrs['data-rt-block']=runtime;
  }
  return Object.fromEntries(Object.entries(attrs).filter(([,v])=>v));
}
function ancestry(resolved) {
  try{return bindings(resolved.appRoot,resolved.context).map(({element})=>({id:element.id,label:element.moduleName}));}
  catch{return [];}
}
function definition(root,element) {return safeRead(root,element.directory+'/'+element.moduleName+'.liquid');}
function schema(source) {
  const match=/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/.exec(source);
  if(!match)return null;
  return {tree:json.parse(match[1]),offset:match.index+match[0].indexOf(match[1])};
}
function staticCalls(source) {
  const out=[],tags=/\{%-?([\s\S]*?)-?%\}/g;let match;
  while((match=tags.exec(source))) {
    const body=match[1].trim(),name=body.split(/\s/)[0];
    if(['comment','doc','raw','schema','javascript','stylesheet'].includes(name)) {
      const end=new RegExp('\\{%-?\\s*end'+name+'\\s*-?%\\}','g');end.lastIndex=tags.lastIndex;
      tags.lastIndex=end.exec(source)?end.lastIndex:source.length;continue;
    }
    // Standalone tags may span lines. A liquid-block command ends at newline.
    const commands=name==='liquid'?[...match[1].matchAll(/[^\n]+/g)].map(m=>({text:m[0],offset:match.index+match[0].indexOf(match[1])+m.index})):[{text:match[1],offset:match.index+match[0].indexOf(match[1])}];
    for(const command of commands) {
      if(!/^\s*content_for\s+(['"])block\1\s*,/.test(command.text))continue;
      let quote=null,start=0;const args=new Map();
      for(let i=0;i<=command.text.length;i++) {
        const ch=command.text[i];
        if(quote){if(ch===quote)quote=null;continue;}
        if(ch==='"'||ch==="'"){quote=ch;continue;}
        if(ch!==','&&i!==command.text.length)continue;
        const part=command.text.slice(start,i),arg=/^\s*(type|id)\s*:\s*(['"])([_\w-]+)\2\s*$/.exec(part);
        if(arg){const offset=command.offset+start+part.indexOf(arg[2]+arg[3])+1;args.set(arg[1],{value:arg[3],start:offset,end:offset+arg[3].length});}
        start=i+1;
      }
      const type=args.get('type'),id=args.get('id');
      if(type&&id)out.push({type:type.value,key:id.value,start:type.start,end:type.end});
    }
  }
  return out;
}
function detachPlan(resolved) {
  const original=resolved.element;
  if(original.moduleName.endsWith('-retouch-'+original.id))throw new Error('This instance is already detached.');
  const edits=[],types=[],dependencies=[];
  let current=original,source=definition(resolved.appRoot,current);
  const firstName=current.moduleName+'-retouch-'+current.id;
  const detachedFile=current.directory+'/'+firstName+'.liquid';
  for(;;) {
    const name=current.moduleName+'-retouch-'+current.id;
    const rel=current.directory+'/'+name+'.liquid',file=path.join(resolved.appRoot,rel);
    if(fs.existsSync(file))throw new Error('A detached definition already exists for this usage.');
    edits.push({file,before:null,after:source.source});
    types.push({start:current.typeNode.start,end:current.typeNode.end,value:JSON.stringify(name)});
    if(!current.parent)break;
    const parent=current.parent,def=definition(resolved.appRoot,parent);dependencies.push(def);
    let next=def.source;
    if(current.static) {
      const calls=staticCalls(next).filter(call=>call.key===current.blockKeys.at(-1)&&call.type===current.moduleName);
      if(calls.length!==1)throw new Error('The static block has no unique literal call in its parent definition.');
      next=next.slice(0,calls[0].start)+name+next.slice(calls[0].end);
    } else {
      const data=schema(next),allowed=data?.tree.children?.get('blocks');
      const entries=allowed?.value||[];
      if(!name.startsWith('_')&&entries.some(block=>block.type==='@theme'))break;
      if(!allowed||!Array.isArray(entries))throw new Error('The parent has no editable block declaration.');
      const at=data.offset+allowed.end-1;
      next=next.slice(0,at)+(entries.length?',':'')+JSON.stringify({type:name})+next.slice(at);
    }
    current=parent;source={...def,source:next};
  }
  let next=resolved.source;
  for(const item of types.sort((a,b)=>b.start-a.start))next=next.slice(0,item.start)+item.value+next.slice(item.end);
  json.parse(next);
  edits.push({file:resolved.file,before:resolved.source,after:next});
  return {ok:true,name:firstName,detachedFile,hash:hash(next),edits,dependencies};
}
function describe(resolved) {
  try {
    const element=resolved.element,def=definition(resolved.appRoot,element),data=schema(def.source),props=new Map();
    for(const setting of data?.tree.value.settings||[])if(setting.id)props.set(setting.id,{name:setting.id,value:'—',default:setting.default===undefined?'—':JSON.stringify(setting.default)});
    for(const [name,value]of Object.entries(element.settings))props.set(name,{name,value:JSON.stringify(value),default:props.get(name)?.default||'—'});
    const host=require('./adapters/liquid.cjs').collect(def.source,def.rel).elements.find(el=>el.kind==='host');
    let plan=null,reason=null;try{plan=detachPlan(resolved);}catch(err){reason=err.message;}
    const version=hash(JSON.stringify([def.source,...(plan?.dependencies||[]).map(d=>d.source)]));
    const detached=element.moduleName.endsWith('-retouch-'+element.id);
    return {ok:true,name:element.moduleName,file:def.rel,source:def.source,hash:version,props:[...props.values()],
      definitionId:host?.id||null,renderScope:scope(element,resolved.context),detached,canDetach:!!plan,reason};
  }catch(err){return {ok:false,refused:true,reason:err.message};}
}
function planDetach(resolved,op) {
  try {
    if(op.fileHash!==resolved.hash)throw new Error('The component usage changed. Re-select the instance.');
    const info=describe(resolved);
    if(!info.ok||!info.canDetach)throw new Error(info.reason);
    if(op.definitionHash!==info.hash)throw new Error('The component or a parent definition changed. Reopen the component.');
    const result=detachPlan(resolved);delete result.dependencies;return result;
  }catch(err){return {ok:false,refused:true,reason:err.message};}
}
module.exports={matches,collect,bindings,ancestry,scope,describe,planDetach,staticCalls,schema};
