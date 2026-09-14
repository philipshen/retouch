#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function run(command,args){
 const result=spawnSync(command,args,{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
 if(result.error||result.status!==0)throw Error(command+' failed: '+(result.error?.message||result.stderr));
 return {stdout:result.stdout,stderr:result.stderr};
}
function profile(value){if(typeof value!=='string'||!value.trim()||value.length>128||/[\x00-\x1f\x7f]/.test(value))throw Error('A valid notarytool keychain profile name is required');return value;}
function create(deps={}){
 const execute=deps.run||run,verify=deps.verify||require('./verify-package.cjs').verify;
 function locked(output,fn){
  fs.mkdirSync(output,{recursive:true});output=fs.realpathSync(output);
  const lock=path.join(output,'.notarization.lock');let fd;
  try{fd=fs.openSync(lock,'wx');}catch(error){if(error.code==='EEXIST')throw Error('Another notarization command owns '+lock);throw error;}
  try{fs.writeFileSync(fd,String(process.pid));return fn(output);}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
 }
 function write(output,state){const temporary=path.join(output,'notarization.json.tmp');fs.writeFileSync(temporary,JSON.stringify(state,null,2)+'\n',{flag:'wx'});fs.renameSync(temporary,path.join(output,'notarization.json'));}
 function submit(input,output,keychainProfile){
  profile(keychainProfile);input=fs.realpathSync(input);
  return locked(output,dir=>{
   if(input===dir||input.startsWith(dir+path.sep)||dir.startsWith(input+path.sep))throw Error('Input app and output directory must be separate');
   const stateFile=path.join(dir,'notarization.json');if(fs.existsSync(stateFile)||fs.existsSync(path.join(dir,'submission.zip')))throw Error('Submission already exists; use status, never automatically resubmit');
   const snapshot=path.join(dir,'Retouch.app');
   if(fs.existsSync(snapshot))throw Error('A retained app snapshot exists; inspect it before retrying');
   fs.cpSync(input,snapshot,{recursive:true,dereference:false,verbatimSymlinks:true});
   const packageVerification=verify(snapshot);
   const details=execute('codesign',['-dv','--verbose=4',snapshot]);const signature=details.stdout+'\n'+details.stderr;
   if(!/^Authority=Developer ID Application:/m.test(signature)||!/^Timestamp=.+/m.test(signature)||!/^CodeDirectory=.*\bruntime\b/m.test(signature))throw Error('Developer ID signing, hardened runtime, and secure timestamp are required');
   const zip=path.join(dir,'submission.zip');
   execute('ditto',['-c','-k','--sequesterRsrc','--keepParent',snapshot,zip]);
   const state={schemaVersion:1,phase:'submitting',keychainProfile,sha256:hash(zip),packageVerification,createdAt:new Date().toISOString()};
   write(dir,state);
   // Persist intent before sending. An interrupted upload may already exist at
   // Apple; retain its bytes and refuse retries that could create duplicate jobs.
   try{
    const result=JSON.parse(execute('xcrun',['notarytool','submit',zip,'--keychain-profile',keychainProfile,'--output-format','json','--no-wait']).stdout);
    if(!uuid.test(result.id||''))throw Error('Apple did not return a valid submission ID');
    state.submissionId=result.id;state.phase='submitted';write(dir,state);return state;
   }catch(error){state.phase='submission-unknown';state.error=error.message;write(dir,state);throw error;}
  });
 }
 function observe(dir){
  const state=JSON.parse(fs.readFileSync(path.join(dir,'notarization.json'),'utf8'));
  if(state.schemaVersion!==1||!uuid.test(state.submissionId||'')||!['submitted','observed'].includes(state.phase)||!/^[a-f0-9]{64}$/.test(state.sha256||''))throw Error('No resumable submission ID; investigate the original upload before submitting again');
  profile(state.keychainProfile);
  const zip=path.join(dir,'submission.zip');if(fs.lstatSync(zip).isSymbolicLink()||hash(zip)!==state.sha256)throw Error('Submitted archive changed');
  const result=JSON.parse(execute('xcrun',['notarytool','info',state.submissionId,'--keychain-profile',state.keychainProfile,'--output-format','json']).stdout);
  if(result.id!==state.submissionId||!['In Progress','Accepted','Invalid','Rejected'].includes(result.status))throw Error('Unexpected Apple submission response');
  state.phase='observed';state.appleStatus=result.status;state.checkedAt=new Date().toISOString();write(dir,state);return state;
 }
 function status(output){return locked(output,observe);}
 function finish(output){return locked(output,dir=>{
  const state=observe(dir);
  if(state.appleStatus==='In Progress')return {pending:true,submissionId:state.submissionId};
  const log=JSON.parse(execute('xcrun',['notarytool','log',state.submissionId,'--keychain-profile',state.keychainProfile]).stdout);
  if(typeof log.jobId!=='string'||log.jobId.toLowerCase()!==state.submissionId.toLowerCase()||log.status!==state.appleStatus)throw Error('Notarization log does not match the submission');
  if(log.sha256!==undefined&&log.sha256!==state.sha256)throw Error('Apple archive checksum does not match');
  fs.writeFileSync(path.join(dir,'apple-log.json'),JSON.stringify(log,null,2)+'\n');
  if(state.appleStatus!=='Accepted')throw Error('Apple rejected this archive; see apple-log.json');
  const stage=fs.mkdtempSync(path.join(dir,'.notarization-finish-'));let preserve=false;
  try{
   const distribution=path.join(stage,'distribution');fs.mkdirSync(distribution);
   const app=path.join(distribution,'Retouch.app');
   // Extract the retained submitted bytes, never the independently editable app.
   execute('ditto',['-x','-k',path.join(dir,'submission.zip'),distribution]);
   if(fs.lstatSync(app).isSymbolicLink()||!fs.statSync(app).isDirectory())throw Error('Expected an extracted Retouch.app directory');
   const before=verify(app);
   if(JSON.stringify(before)!==JSON.stringify(state.packageVerification))throw Error('Extracted package verification differs from submission');
   execute('xcrun',['stapler','staple',app]);
   execute('xcrun',['stapler','validate',app]);
   const after=verify(app);
   execute('spctl',['--assess','--type','execute','-vv',app]);
   const zipName='Retouch-mac.zip',zip=path.join(distribution,zipName);
   execute('ditto',['-c','-k','--sequesterRsrc','--keepParent',app,zip]);
   const extracted=path.join(stage,'archive-check');fs.mkdirSync(extracted);
   execute('ditto',['-x','-k',zip,extracted]);
   const archivedApp=path.join(extracted,'Retouch.app');
   verify(archivedApp);
   execute('xcrun',['stapler','validate',archivedApp]);
   execute('spctl',['--assess','--type','execute','-vv',archivedApp]);
   const sha256=hash(zip);
   fs.writeFileSync(path.join(distribution,zipName+'.sha256'),sha256+'  '+zipName+'\n');
   const receipt={schemaVersion:1,submissionId:state.submissionId,submittedSha256:state.sha256,sha256,packageVerification:after,appleLog:log,checks:['strict package verification','stapler validate','Gatekeeper assessment','final ZIP extraction and package, ticket, Gatekeeper verification'],nativeLaunch:'not tested',createdAt:new Date().toISOString()};
   fs.writeFileSync(path.join(distribution,'verification.json'),JSON.stringify(receipt,null,2)+'\n');
   (deps.publish||require('./publish-package.cjs'))(stage,dir,['distribution']);
   return receipt;
  }catch(error){preserve=!!error.preserveStaging;throw error;}finally{if(!preserve)fs.rmSync(stage,{recursive:true,force:true});}
 });}
 return {submit,status,finish};
}
if(require.main===module){try{const [command,...args]=process.argv.slice(2),api=create();if(command==='submit'&&args.length===3)console.log(JSON.stringify(api.submit(...args),null,2));else if(['status','finish'].includes(command)&&args.length===1)console.log(JSON.stringify(api[command](...args),null,2));else throw Error('Usage: notarize.cjs submit <Retouch.app> <separate-output-dir> <keychain-profile> | status <output-dir> | finish <output-dir>');}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={create};
