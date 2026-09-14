'use strict';
const fs=require('node:fs'),path=require('node:path');
function validate(version){
 if(typeof version!=='string'||! /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)||version.length>32)throw Error('Use a release version with three non-negative integers, such as 0.2.0');
 return version;
}
function read(file=path.resolve(__dirname,'../Info.plist')){
 const source=fs.readFileSync(file,'utf8'),keys=[...source.matchAll(/<key>\s*CFBundleShortVersionString\s*<\/key>/g)];
 if(keys.length!==1)throw Error('Info.plist must contain exactly one CFBundleShortVersionString');
 const value=source.slice(keys[0].index+keys[0][0].length).match(/^\s*<string>([^<]*)<\/string>/);
 if(!value)throw Error('CFBundleShortVersionString must be a string');
 return validate(value[1]);
}
module.exports={validate,read};
