#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function verify(app){
 const resources=path.join(app,'Contents/Resources'),manifest=JSON.parse(fs.readFileSync(path.join(resources,'build-manifest.json'),'utf8'));
 if(manifest.schemaVersion!==1||!Array.isArray(manifest.files)||!manifest.files.length)throw Error('Invalid build manifest');
 const expected=new Set(['package.json','package-lock.json','LICENSE','README.md']),cliRoot=path.join(resources,'retouch');
 function inventory(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())inventory(file);else if(entry.isFile())expected.add(path.relative(cliRoot,file).split(path.sep).join('/'));else throw Error('Unexpected packaged source symlink');}}
 for(const name of ['bin','src','shell'])inventory(path.join(cliRoot,name));
 const seen=new Set();
 for(const entry of manifest.files){
  if(typeof entry.path!=='string'||!entry.path||path.isAbsolute(entry.path)||entry.path.split('/').some(part=>!part||part==='.'||part==='..')||entry.path.includes('\\')||!/^[a-f0-9]{64}$/.test(entry.sha256||'')||seen.has(entry.path))throw Error('Invalid manifest file entry');
  seen.add(entry.path);const file=path.join(resources,'retouch',entry.path),real=fs.realpathSync(file),cli=fs.realpathSync(path.join(resources,'retouch'));
  if(!real.startsWith(cli+path.sep)||!fs.statSync(real).isFile()||hash(real)!==entry.sha256)throw Error('Packaged source mismatch: '+entry.path);
 }
 if(seen.size!==expected.size||[...expected].some(file=>!seen.has(file)))throw Error('Manifest does not cover the complete packaged source inventory');
 if(hash(path.join(app,'Contents/Info.plist'))!==manifest.infoPlistSha256)throw Error('Packaged Info.plist mismatch');
 const architectures=execFileSync('lipo',['-archs',path.join(app,'Contents/MacOS/Retouch')],{encoding:'utf8'}).trim().split(/\s+/).sort();
 if(JSON.stringify(architectures)!==JSON.stringify(['arm64','x86_64']))throw Error('Expected a universal arm64/x86_64 executable');
 execFileSync('codesign',['--verify','--strict',app],{stdio:'pipe'});
 return {sourceCommit:manifest.sourceCommit,sourceTreeDirty:manifest.sourceTreeDirty,sourceFiles:seen.size,architectures,signature:'strict verification passed; trust and notarization are separate checks'};
}
if(require.main===module){try{if(!process.argv[2])throw Error('Usage: node desktop/scripts/verify-package.cjs <Retouch.app>');console.log(JSON.stringify(verify(path.resolve(process.argv[2])),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={verify};
