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
 const runtime=path.join(resources,'retouch/runtime'),runtimeFile=path.join(runtime,'group-scale.js'),runtimeBytes=fs.readFileSync(runtimeFile);assert.ok(manifest.files.some(entry=>entry.path==='runtime/group-scale.js'));fs.appendFileSync(runtimeFile,'\n// changed runtime');assert.throws(()=>verify(app),/Packaged source mismatch/);fs.writeFileSync(runtimeFile,runtimeBytes);
 const runtimeBackup=path.join(temporary,'runtime-backup');fs.renameSync(runtime,runtimeBackup);assert.throws(()=>verify(app),/ENOENT/);fs.renameSync(runtimeBackup,runtime);
 const plist=path.join(app,'Contents/Info.plist'),plistBytes=fs.readFileSync(plist);fs.appendFileSync(plist,'\n');assert.throws(()=>verify(app),/Info.plist mismatch/);fs.writeFileSync(plist,plistBytes);
 const link=path.join(resources,'retouch/shell/linked.js');fs.symlinkSync(first,link);assert.throws(()=>verify(app),/source symlink/);fs.rmSync(link);
 if(manifest.captureBrowser){
  const browserRoot=path.join(resources,'capture-browser'),browserManifest=path.join(browserRoot,'manifest.json'),browserBytes=fs.readFileSync(browserManifest),browser=JSON.parse(browserBytes),resource=path.join(browserRoot,browser.files.find(entry=>entry.path.endsWith('/ABOUT')).path),bytes=fs.readFileSync(resource);
  fs.appendFileSync(resource,'changed');assert.throws(()=>verify(app),/browser resource inventory mismatch/);fs.writeFileSync(resource,bytes);
  fs.writeFileSync(path.join(browserRoot,'unexpected'),'extra');assert.throws(()=>verify(app),/browser resource inventory mismatch/);fs.rmSync(path.join(browserRoot,'unexpected'));
  fs.writeFileSync(browserManifest,JSON.stringify({...browser,playwrightVersion:'invalid'}));assert.throws(()=>verify(app),/browser manifest mismatch/);fs.writeFileSync(browserManifest,browserBytes);
  const executable=path.join(browserRoot,browser.executables.arm64),mode=fs.statSync(executable).mode;fs.chmodSync(executable,0o644);assert.throws(()=>verify(app),/browser resource inventory mismatch/);fs.chmodSync(executable,mode);
  const backup=path.join(temporary,'browser-backup');fs.renameSync(browserRoot,backup);assert.throws(()=>verify(app),/ENOENT/);fs.renameSync(backup,browserRoot);
 }
 verify(app);verify(original);console.log('PASS valid and relocated package, altered source and runtime, missing runtime directory, omitted/duplicate/path-traversal entries, unlisted source, plist mutation, source symlink, restored signature and unchanged original');
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
