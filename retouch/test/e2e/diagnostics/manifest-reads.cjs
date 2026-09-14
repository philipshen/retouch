'use strict';
// Opt-in NODE_OPTIONS preload for fixture runs, never a runtime dependency.
// Record empty/partial Next manifest reads without logging source or JSON data.
const fs=require('node:fs'),path=require('node:path');
const read=fs.readFileSync,parse=JSON.parse;
let lastRead;
fs.readFileSync=function(file,...args){
 const result=Reflect.apply(read,this,[file,...args]);
 lastRead=typeof file==='string'&&file.split(path.sep).includes('.next')&&file.endsWith('.json')?{file,result}:undefined;
 return result;
};
JSON.parse=function(value,...args){
 try{return Reflect.apply(parse,this,[value,...args]);}catch(error){
  if(error instanceof SyntaxError&&lastRead&&typeof value==='string'&&String(lastRead.result)===value){
   const evidence={pid:process.pid,file:lastRead.file,bytes:Buffer.byteLength(value),stack:String(error.stack||'').split('\n').slice(1).join('\n')};
   try{process.stderr.write('[retouch-manifest-read] '+JSON.stringify(evidence)+'\n');}catch{}
  }
  throw error;
 }
};
