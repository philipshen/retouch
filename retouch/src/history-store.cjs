'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const LIMIT=64*1024*1024,object=value=>value&&typeof value==='object'&&!Array.isArray(value);
// Callers choose a private local state directory. Source paths remain relative
// to this project, and loading a journal never writes source files.
function createHistoryStore(root,directory){
 const actual=fs.realpathSync(root),project=crypto.createHash('sha256').update(actual).digest('hex'),file=path.join(directory,project+'.json'),lock=file+'.lock';let revision=null;
 function safe(){
  let ancestor=path.resolve(directory);while(!fs.existsSync(ancestor)){const parent=path.dirname(ancestor);if(parent===ancestor)throw Error('Invalid history directory.');ancestor=parent;}
  if(fs.realpathSync(ancestor)!==ancestor)throw Error('History storage must not follow symbolic links.');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  if(fs.realpathSync(directory)!==path.resolve(directory)||!fs.lstatSync(directory).isDirectory())throw Error('History storage must not follow symbolic links.');
  let stat;try{stat=fs.lstatSync(file);}catch(error){if(error.code!=='ENOENT')throw error;}if(stat&&(!stat.isFile()||stat.isSymbolicLink()||stat.size>LIMIT))throw Error('History storage is not a bounded regular file.');
 }
 function source(){safe();try{return fs.readFileSync(file,'utf8');}catch(error){if(error.code==='ENOENT')return null;throw error;}}
 const digest=value=>value===null?null:crypto.createHash('sha256').update(value).digest('hex');
 function validate(state,decode){
  if(!object(state)||state.version!==1||state.project!==project||!Array.isArray(state.undo)||!Array.isArray(state.redo)||state.undo.length+state.redo.length>100)throw Error('Invalid source history.');
  const ids=new Set();
  const stack=entries=>entries.map(entry=>{
   if(!object(entry)||typeof entry.id!=='string'||!/^[a-f0-9]{32}$/.test(entry.id)||ids.has(entry.id)||!Array.isArray(entry.edits)||!entry.edits.length||entry.edits.length>1000)throw Error('Invalid source history entry.');ids.add(entry.id);const files=new Set();
   if(entry.route!==undefined&&(typeof entry.route!=='string'||!entry.route.startsWith('/')||entry.route.startsWith('//')||entry.route.length>4096))throw Error('Invalid history route.');
   return {id:entry.id,...(entry.route?{route:entry.route}:{}),edits:entry.edits.map(edit=>{
    if(!object(edit)||typeof edit.file!=='string'||!edit.file||edit.file.length>4096||edit.file.includes('\\')||edit.file.includes('\0')||path.isAbsolute(edit.file)||edit.file.split('/').some(part=>!part||part==='.'||part==='..')||files.has(edit.file)||![edit.before,edit.after].every(value=>value===null||typeof value==='string'))throw Error('Invalid source history snapshot.');files.add(edit.file);
    return {file:decode?path.join(actual,edit.file):edit.file,before:edit.before,after:edit.after};
   })};
  });const result={undo:stack(state.undo),redo:stack(state.redo)};
  if(state.pending!==undefined){const pending=state.pending;if(!object(pending))throw Error('Invalid pending history operation.');if(pending.type==='record'){result.pending={type:'record',entry:stack([pending.entry])[0]};}else{if(!['undo','redo'].includes(pending.type)||result[pending.type].at(-1)?.id!==pending.id)throw Error('Invalid pending history restore.');result.pending={type:pending.type,id:pending.id};}if(pending.owner!==undefined){if(!Number.isSafeInteger(pending.owner)||pending.owner<=0)throw Error('Invalid pending history owner.');result.pending.owner=pending.owner;}}
  return result;
 }
 return {
  file,
  load(){
   const raw=source();if(raw===null){revision=null;return {undo:[],redo:[]};}const state=validate(JSON.parse(raw),true);revision=digest(raw);
   if(state.pending){
    if(state.pending.owner&&state.pending.owner!==process.pid){let alive=true;try{process.kill(state.pending.owner,0);}catch(error){if(error.code==='ESRCH')alive=false;}if(alive)throw Error('A source operation is still owned by another running editor.');}
    const {type}=state.pending,entry=type==='record'?state.pending.entry:state[type].at(-1),before=type==='undo'?'after':'before',after=type==='undo'?'before':'after';
    const contents=entry.edits.map(edit=>{
     const parent=fs.realpathSync(path.dirname(edit.file));if(parent!==path.dirname(edit.file)||!edit.file.startsWith(actual+path.sep))throw Error('Pending history follows a symbolic link.');
     let stat;try{stat=fs.lstatSync(edit.file);}catch(error){if(error.code!=='ENOENT')throw error;}if(!stat)return null;if(!stat.isFile()||stat.isSymbolicLink()||stat.size>LIMIT)throw Error('Pending history source is not a bounded regular file.');return fs.readFileSync(edit.file,'utf8');
    });
    const matches=side=>entry.edits.every((edit,index)=>contents[index]===edit[side]);
    if(matches(before)){}else if(matches(after)){if(type==='record'){state.undo.push(entry);state.undo=state.undo.slice(-100);state.redo=[];}else{state[type].pop();state[type==='undo'?'redo':'undo'].push(entry);}}else throw Error('An interrupted source operation left changed or mixed files. Source was not modified during recovery.');
    delete state.pending;this.save(state);
   }
   return state;
  },
  save(state){
   const encode=entries=>entries.map(entry=>({id:entry.id,...(entry.route?{route:entry.route}:{}),edits:entry.edits.map(edit=>({...edit,file:path.relative(actual,edit.file).split(path.sep).join('/')}))}));
   const data={version:1,project,undo:encode(state.undo),redo:encode(state.redo),...(state.pending?{pending:state.pending.type==='record'?{type:'record',entry:encode([state.pending.entry])[0],...(state.pending.owner?{owner:state.pending.owner}:{})}:state.pending}:{})};validate(data,false);const raw=JSON.stringify(data);if(Buffer.byteLength(raw)>LIMIT)throw Error('Source history exceeds the local storage limit.');
   safe();const fd=fs.openSync(lock,'wx',0o600);let temporary;
   try{
    if(digest(source())!==revision)throw Error('Source history changed in another editor.');
    temporary=file+'.'+crypto.randomBytes(12).toString('hex')+'.tmp';const out=fs.openSync(temporary,'wx',0o600);
    try{fs.writeFileSync(out,raw);fs.fsyncSync(out);}finally{fs.closeSync(out);}fs.renameSync(temporary,file);temporary=null;revision=digest(raw);
   }finally{if(temporary)fs.rmSync(temporary,{force:true});fs.closeSync(fd);fs.unlinkSync(lock);}
  }
 };
}
module.exports={createHistoryStore,LIMIT};
