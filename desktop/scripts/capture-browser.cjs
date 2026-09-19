'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{createRequire}=require('node:module'),{execFileSync:run}=require('node:child_process');
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function native(file){const fd=fs.openSync(file,'r'),bytes=Buffer.alloc(4);try{fs.readSync(fd,bytes,0,4,0);}finally{fs.closeSync(fd);}return ['cffaedfe','cefaedfe','feedfacf','feedface','cafebabe','bebafeca'].includes(bytes.toString('hex'));}
function inventory(root){const entries=[];function walk(folder){for(const item of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(folder,item.name),relative=path.relative(root,file).split(path.sep).join('/');if(relative==='manifest.json')continue;if(item.isDirectory())walk(file);else if(item.isFile())entries.push({path:relative,sha256:digest(file),mode:fs.statSync(file).mode&0o777,native:native(file)});else throw Error('Unexpected browser resource symlink: '+relative);}}walk(root);return entries;}
function install({cli,root,identity}){
 fs.mkdirSync(root);const load=createRequire(path.join(cli,'package.json')),sdk=path.dirname(load.resolve('playwright/package.json')),core=path.dirname(load.resolve('playwright-core/package.json')),version=load('playwright/package.json').version,revision=JSON.parse(fs.readFileSync(path.join(core,'browsers.json'))).browsers.find(browser=>browser.name==='chromium-headless-shell').revision;
 if(process.versions.node==='26.8.2'&&version==='1.59.1')throw Error('Playwright 1.59.1 archive extraction stalls under Node 26.8.2. Run the desktop build with Node 25.2.1.');
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-browsers-')),executables={};
 try{
  for(const arch of ['arm64','x64']){
   const cache=path.join(temporary,arch),platform=arch==='arm64'?'mac13-arm64':'mac13';
   run(process.execPath,[path.join(sdk,'cli.js'),'install','chromium-headless-shell'],{env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:cache,PLAYWRIGHT_HOST_PLATFORM_OVERRIDE:platform},stdio:'inherit',timeout:300000});
   const folder='chrome-headless-shell-mac-'+arch,source=path.join(cache,'chromium_headless_shell-'+revision,folder),target=path.join(root,arch);
   fs.cpSync(source,target,{recursive:true,verbatimSymlinks:true});executables[arch]=arch+'/chrome-headless-shell';
  }
  const entitlements=path.join(temporary,'jit.plist');fs.writeFileSync(entitlements,'<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.security.cs.allow-jit</key><true/></dict></plist>');
  for(const entry of inventory(root).filter(entry=>entry.native))run('codesign',['--force','--sign',identity||'-',...(identity?['--options','runtime','--timestamp']:[]),...(entry.path.endsWith('/chrome-headless-shell')?['--entitlements',entitlements]:[]),path.join(root,entry.path)],{stdio:'inherit'});
  const manifest={version:1,playwrightVersion:version,revision,executables,files:inventory(root)};fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return {sha256:digest(path.join(root,'manifest.json')),playwrightVersion:version,revision};
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
function verify({cli,root,receipt}){
 if(!receipt||digest(path.join(root,'manifest.json'))!==receipt.sha256)throw Error('Capture browser manifest mismatch');
 const load=createRequire(path.join(cli,'package.json')),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 if(manifest.version!==1||manifest.playwrightVersion!==load('playwright/package.json').version||manifest.playwrightVersion!==receipt.playwrightVersion||manifest.revision!==receipt.revision)throw Error('Capture browser runtime version mismatch');
 const revision=JSON.parse(fs.readFileSync(path.join(path.dirname(load.resolve('playwright-core/package.json')),'browsers.json'))).browsers.find(browser=>browser.name==='chromium-headless-shell').revision;
 if(manifest.revision!==revision||JSON.stringify(inventory(root))!==JSON.stringify(manifest.files))throw Error('Capture browser resource inventory mismatch');
 for(const arch of ['arm64','x64']){
  if(manifest.executables?.[arch]!==arch+'/chrome-headless-shell')throw Error('Invalid capture browser executable');
  const executable=path.join(root,manifest.executables[arch]);fs.accessSync(executable,fs.constants.X_OK);
  const actual=run('lipo',['-archs',executable],{encoding:'utf8'}).trim();if(actual!==(arch==='x64'?'x86_64':arch))throw Error('Capture browser architecture mismatch');
 }
 for(const entry of manifest.files.filter(entry=>entry.native))run('codesign',['--verify','--strict',path.join(root,entry.path)],{stdio:'pipe'});
 return {playwrightVersion:manifest.playwrightVersion,revision:manifest.revision,architectures:['arm64','x64'],files:manifest.files.length};
}
module.exports={install,verify,inventory};
