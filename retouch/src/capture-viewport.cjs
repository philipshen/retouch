'use strict';
const fs=require('node:fs'),path=require('node:path');
// Only viewport dimensions cross into the editor. Capture metadata is project
// content, so malformed, oversized or linked manifests must not affect startup.
function read(root){
 let fd;
 try{
  fd=fs.openSync(path.join(root,'capture.json'),fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.size>1024*1024)return null;
  const bytes=Buffer.alloc(stat.size),count=fs.readSync(fd,bytes,0,bytes.length,0),manifest=JSON.parse(bytes.subarray(0,count).toString('utf8'));
  if(manifest.version!==1||manifest.kind!=='rendered-page-capture')return null;
  const {width,height}=manifest.viewport||{};
  return [width,height].every(value=>Number.isInteger(value)&&value>=240&&value<=7680)?{width,height}:null;
 }catch{return null;}finally{if(fd!==undefined)fs.closeSync(fd);}
}
module.exports={read};
