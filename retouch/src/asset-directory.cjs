'use strict';
const fs=require('node:fs'),path=require('node:path');
// Check each existing ancestor before creating its child, including symlinks.
module.exports=function assetDirectory(appRoot,...parts){
 const root=fs.realpathSync(appRoot),target=path.resolve(root,...parts);
 const inside=value=>value===root||value.startsWith(root+path.sep);
 if(!inside(target))throw Error('Asset directory is outside the project.');
 let current=root;
 for(const part of path.relative(root,target).split(path.sep).filter(Boolean)){
  current=path.join(current,part);
  try{fs.lstatSync(current);}catch(error){if(error.code!=='ENOENT')throw error;fs.mkdirSync(current);}
  const actual=fs.realpathSync(current);
  if(!inside(actual))throw Error('Asset directory is outside the project.');
  if(!fs.statSync(current).isDirectory())throw Error('The asset path is not a directory.');
 }
 return target;
};
