'use strict';
const fs=require('node:fs'),path=require('node:path');
// Resolution depends on missing candidates as well as the selected file. These
// read-only snapshots are checked with source revisions before a transaction writes.
function snapshot(root,file){
 if(typeof file!=='string'||!path.isAbsolute(file))throw Error('Invalid source resolution path');
 file=path.resolve(file);const realRoot=fs.realpathSync(root);
 if(!file.startsWith(realRoot+path.sep)||file.split(path.sep).includes('node_modules'))throw Error('Source resolution is outside the project');
 let stat;
 try{stat=fs.statSync(file);}catch(error){
  if(!['ENOENT','ENOTDIR'].includes(error.code))throw error;
  try{const link=fs.lstatSync(file);if(link.isSymbolicLink())return {file,kind:'unresolved-link',target:fs.readlinkSync(file)};}catch(error){if(!['ENOENT','ENOTDIR'].includes(error.code))throw error;}
  return {file,kind:'missing'};
 }
 const realPath=fs.realpathSync(file);
 if(!realPath.startsWith(realRoot+path.sep)||realPath.split(path.sep).includes('node_modules'))throw Error('Source resolution follows a link outside the project');
 if(!stat.isFile()&&!stat.isDirectory())throw Error('Unsupported source resolution entry');
 return {file,kind:stat.isFile()?'file':'directory',realPath};
}
function verify(root,checks){
 if(!Array.isArray(checks)||checks.length>1000)throw Error('Invalid source resolution checks');
 const seen=new Set();
 for(const check of checks){
  if(!check||typeof check!=='object'||seen.has(check.file))throw Error('Invalid source resolution check');seen.add(check.file);
  const actual=snapshot(root,check.file);
  if(actual.file!==check.file||actual.kind!==check.kind||actual.realPath!==check.realPath||actual.target!==check.target)throw Error('The component import resolution changed. Re-select the instance before saving.');
 }
}
module.exports={snapshot,verify};
