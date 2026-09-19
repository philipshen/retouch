'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{launchOptions}=require('../src/capture-browser.cjs');
test('capture browser resolves architecture-specific bundled paths and refuses version, traversal and escaping symlink mismatches',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-browser-policy-')),version='fixture',options={root,version,arch:'arm64',platform:'darwin',packaged:true};
 const manifest={version:1,playwrightVersion:version,executables:{arm64:'arm64/browser',x64:'x64/browser'}};
 const write=()=>fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest));
 try{
  for(const arch of ['arm64','x64']){fs.mkdirSync(path.join(root,arch));fs.writeFileSync(path.join(root,arch,'browser'),'fixture',{mode:0o755});}write();
  assert.equal(launchOptions(options).executablePath,fs.realpathSync(path.join(root,'arm64/browser')));assert.equal(launchOptions({...options,arch:'x64'}).executablePath,fs.realpathSync(path.join(root,'x64/browser')));
  for(const changes of [{version:'wrong'},{arch:'ia32'},{platform:'linux'}])assert.throws(()=>launchOptions({...options,...changes}),/incompatible/);
  for(const value of ['../outside','/tmp/outside','arm64/../x64/browser','arm64\\browser']){manifest.executables.arm64=value;write();assert.throws(()=>launchOptions(options),/Invalid/);}
  manifest.executables.arm64='arm64/browser';write();fs.rmSync(path.join(root,'arm64/browser'));fs.symlinkSync(process.execPath,path.join(root,'arm64/browser'));assert.throws(()=>launchOptions(options),/Invalid/);
  assert.throws(()=>launchOptions({...options,root:path.join(root,'absent')}),/missing/);assert.deepEqual(launchOptions({...options,packaged:false}),{});const link=path.join(root,'linked');fs.symlinkSync(root,link);assert.throws(()=>launchOptions({...options,root:link}),/directory/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
