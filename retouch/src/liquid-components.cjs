'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const hash=s=>crypto.createHash('sha1').update(s).digest('hex');
const refuse=reason=>({ok:false,refused:true,reason});
const RAW=new Set(['comment','doc','raw','schema','javascript','stylesheet']);

function calls(source,rel) {
  const out=[],tags=/\{%-?([\s\S]*?)-?%\}/g;let match;
  while ((match=tags.exec(source))) {
    const body=match[1].trim(),name=body.split(/\s/)[0];
    if (RAW.has(name)) {
      const end=new RegExp('\\{%-?\\s*end'+name+'\\s*-?%\\}','g');end.lastIndex=tags.lastIndex;
      tags.lastIndex=end.exec(source)?end.lastIndex:source.length;continue;
    }
    const call=/^render\s+(['"])([\w-]+)\1([\s\S]*)$/.exec(body);
    if (!call) continue;
    const nameStart=match.index+match[0].indexOf(call[1]+call[2]+call[1])+1;
    const id=hash(rel+'|render:'+out.length).slice(0,10);
    out.push({id,kind:'instance',tag:call[2],snippet:call[2],tagStart:match.index,openEnd:tags.lastIndex,
      nameStart,nameEnd:nameStart+call[2].length,insert:tags.lastIndex-(match[0].endsWith('-%}')?3:2),args:call[3]});
  }
  return out;
}
function definition(resolved) {
  if (resolved.element.kind!=='instance') throw new Error('Select a component instance.');
  const file=path.join(resolved.appRoot,'snippets',resolved.element.snippet+'.liquid');
  if (!fs.existsSync(file)) throw new Error('The component definition is not available in this project.');
  const real=fs.realpathSync(file);
  if (!real.startsWith(fs.realpathSync(resolved.appRoot)+path.sep)) throw new Error('The component definition is outside this project.');
  return {file,source:fs.readFileSync(file,'utf8'),rel:'snippets/'+resolved.element.snippet+'.liquid'};
}
function describe(resolved) {
  try {
    const def=definition(resolved),props=new Map();
    for (const m of def.source.matchAll(/@param\s+\{[^}]+\}\s+\[?([\w]+)\]?/g)) props.set(m[1],{name:m[1],value:'—',default:'—'});
    for (const m of def.source.matchAll(/assign\s+(\w+)\s*=\s*\1\s*\|\s*default:\s*([^\n%]+)/g)) {
      const name=m[1];props.set(name,{name,value:'—',default:m[2].trim()});
    }
    for (const arg of splitArgs(resolved.element.args)) {
      const m=/^\s*(\w+)\s*:\s*([\s\S]*)$/.exec(arg);
      if (m&&!m[1].startsWith('__rt_')) props.set(m[1],{name:m[1],value:m[2].trim(),default:props.get(m[1])?.default||'—'});
    }
    const host=require('./adapters/liquid.cjs').collect(def.source,def.rel).elements.find(e=>e.kind==='host');
    const detached=resolved.element.snippet.endsWith('-retouch-'+resolved.element.id);
    return {ok:true,name:resolved.element.snippet,file:def.rel,hash:hash(def.source),source:def.source,
      props:[...props.values()],definitionId:host?.id||null,detached,canDetach:!detached};
  } catch(err) { return refuse(err.message); }
}
function splitArgs(value) {
  const out=[];let quote=null,start=0;
  for (let i=0;i<value.length;i++) {
    if (quote) { if (value[i]===quote) quote=null; }
    else if (value[i]==='"'||value[i]==="'") quote=value[i];
    else if (value[i]===',') {out.push(value.slice(start,i));start=i+1;}
  }
  out.push(value.slice(start));return out;
}
function planDetach(resolved,op) {
  try {
    if (op.fileHash!==resolved.hash) return refuse('The usage file changed. Re-select the instance.');
    const def=definition(resolved);
    if (op.definitionHash!==hash(def.source)) return refuse('The definition changed. Reopen the component.');
    if (resolved.element.snippet.endsWith('-retouch-'+resolved.element.id)) return refuse('This instance is already detached.');
    const name=resolved.element.snippet+'-retouch-'+resolved.element.id;
    const file=path.join(resolved.appRoot,'snippets',name+'.liquid');
    if (fs.existsSync(file)) return refuse('A detached definition already exists for this usage.');
    const next=resolved.source.slice(0,resolved.element.nameStart)+name+resolved.source.slice(resolved.element.nameEnd);
    return {ok:true,hash:hash(next),name,detachedFile:'snippets/'+name+'.liquid',
      edits:[{file,before:null,after:def.source},{file:resolved.file,before:resolved.source,after:next}]};
  } catch(err) {return refuse(err.message);}
}
function hasReference(root,file,excluded) {
  const name=path.basename(file,'.liquid');
  function scan(dir) {
    for (const item of fs.readdirSync(dir,{withFileTypes:true})) {
      if (item.name.startsWith('.')||item.name==='node_modules'||item.isSymbolicLink()) continue;
      const next=path.join(dir,item.name);
      if (item.isDirectory()) {if(scan(next))return true;}
      else if (!excluded.includes(next)) {
        const rel=path.relative(root,next),theme=require('./liquid-theme.cjs');
        if(next.endsWith('.liquid')) {
          const source=fs.readFileSync(next,'utf8');
          if(calls(source,rel).some(c=>c.snippet===name)||theme.staticCalls(source).some(c=>c.type===name))return true;
          const schema=theme.schema(source);
          if(schema&&JSON.stringify(schema.tree.value).includes('"'+name+'"'))return true;
        } else if(theme.matches(rel)&&theme.collect(fs.readFileSync(next,'utf8'),rel).elements.some(c=>c.moduleName===name))return true;
      }
    }
    return false;
  }
  return scan(root);
}
module.exports={calls,describe,planDetach,hasReference};
