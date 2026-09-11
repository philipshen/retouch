'use strict';
const fs=require('node:fs'),path=require('node:path');
// Caller holds the output lock. Keep old outputs until every new artifact is
// installed; on an ordinary filesystem failure restore the previous set.
module.exports=function publish(staging,destination,names,io=fs){
 if(new Set(names).size!==names.length||names.some(name=>!name||name!==path.basename(name)||['.','..'].includes(name)))throw Error('Invalid package output names');
 for(const name of names)if(!io.existsSync(path.join(staging,name)))throw Error('Missing staged output: '+name);
 const backup=io.mkdtempSync(path.join(staging,'.previous-')),old=[],installed=[];
 try{
  for(const name of names){
   const target=path.join(destination,name);
   if(io.existsSync(target)){io.renameSync(target,path.join(backup,name));old.push(name);}
   io.renameSync(path.join(staging,name),target);installed.push(name);
  }
 }catch(error){
  const failures=[];
  for(const name of installed.reverse())try{io.rmSync(path.join(destination,name),{recursive:true,force:true});}catch(failure){failures.push(failure);}
  for(const name of old.reverse())try{io.renameSync(path.join(backup,name),path.join(destination,name));}catch(failure){failures.push(failure);}
  if(failures.length){const failure=new Error('Package publication and restoration failed. Preserve recovery files at '+backup,{cause:error});failure.preserveStaging=true;throw failure;}
  throw error;
 }
};
