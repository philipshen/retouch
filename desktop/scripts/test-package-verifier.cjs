#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{verify}=require('./verify-package.cjs');
if(!process.argv[2])throw Error('Usage: node desktop/scripts/test-package-verifier.cjs <Retouch.app>');
const original=path.resolve(process.argv[2]);verify(original);
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-package-verifier-')),app=path.join(temporary,'Retouch.app');
try{
 fs.cpSync(original,app,{recursive:true,verbatimSymlinks:true});const resources=path.join(app,'Contents/Resources'),manifestFile=path.join(resources,'build-manifest.json'),manifestBytes=fs.readFileSync(manifestFile),manifest=JSON.parse(manifestBytes),first=path.join(resources,'retouch',manifest.files[0].path),firstBytes=fs.readFileSync(first);
 assert.equal(verify(app).sourceFiles,manifest.files.length);
 fs.appendFileSync(first,'\n// changed');assert.throws(()=>verify(app),/Packaged source mismatch/);fs.writeFileSync(first,firstBytes);
 fs.writeFileSync(manifestFile,JSON.stringify({...manifest,files:manifest.files.slice(1)}));assert.throws(()=>verify(app),/complete packaged source inventory/);
 fs.writeFileSync(manifestFile,JSON.stringify({...manifest,files:[...manifest.files,manifest.files[0]]}));assert.throws(()=>verify(app),/Invalid manifest file entry/);
 fs.writeFileSync(manifestFile,JSON.stringify({...manifest,files:[{path:'../outside',sha256:'0'.repeat(64)}]}));assert.throws(()=>verify(app),/Invalid manifest file entry/);fs.writeFileSync(manifestFile,manifestBytes);
 const extra=path.join(resources,'retouch/shell/unlisted.js');fs.writeFileSync(extra,'unlisted');assert.throws(()=>verify(app),/complete packaged source inventory/);fs.rmSync(extra);
 const plist=path.join(app,'Contents/Info.plist'),plistBytes=fs.readFileSync(plist);fs.appendFileSync(plist,'\n');assert.throws(()=>verify(app),/Info.plist mismatch/);fs.writeFileSync(plist,plistBytes);
 const link=path.join(resources,'retouch/shell/linked.js');fs.symlinkSync(first,link);assert.throws(()=>verify(app),/source symlink/);fs.rmSync(link);
 verify(app);verify(original);console.log('PASS valid and relocated package, altered source, omitted/duplicate/path-traversal entries, unlisted source, plist mutation, source symlink, restored signature and unchanged original');
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
