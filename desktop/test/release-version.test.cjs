'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process'),version=require('../scripts/release-version.cjs');
const cask=path.resolve(__dirname,'../scripts/cask.cjs'),sha='a'.repeat(64),generate=(...args)=>spawnSync(process.execPath,[cask,...args],{encoding:'utf8'});
test('cask release metadata follows the app version and supports archived versions',()=>{
 const current=version.read(),result=generate('https://example.com/Retouch-'+current+'-mac.zip',sha);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,new RegExp('version "'+current.replaceAll('.','\\.')+'"'));assert.ok(result.stdout.includes('sha256 "'+sha+'"'));
 for(const v of ['0.1.0','0.2.0','1.12.34']){const url='https://example.com/releases/'+v+'/Retouch.zip',result=generate(url,sha,v);assert.equal(result.status,0,result.stderr);assert.ok(result.stdout.includes('version "'+v+'"'));assert.ok(result.stdout.includes('url "'+url+'"'));const ruby=spawnSync('ruby',['-c'],{input:result.stdout,encoding:'utf8'});assert.equal(ruby.status,0,ruby.stderr);}
});
test('invalid release metadata cannot emit executable cask content',()=>{
 for(const v of ['', '1.2','1.2.3-beta','01.2.3','-1.2.3','1.2.3\n','1.2.3";system("id")','1'.repeat(40)+'.0.0']){assert.throws(()=>version.validate(v));const result=generate('https://example.com/app.zip',sha,v);assert.notEqual(result.status,0);assert.equal(result.stdout,'');}
 for(const args of [['http://example.com/app.zip',sha,'1.0.0'],['https://example.com/app.zip','no','1.0.0'],['https://example.com/app.zip',sha,'1.0.0','extra']]){const result=generate(...args);assert.notEqual(result.status,0);assert.equal(result.stdout,'');}
});
test('bundle version extraction rejects duplicate, missing and incorrectly typed keys',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-version-')),file=path.join(root,'Info.plist'),key='<key>CFBundleShortVersionString</key>';
 try{for(const body of ['',key+'<integer>1</integer>',key+'<string>0.2</string>',key+'<string>0.2.0</string>'+key+'<string>0.3.0</string>']){fs.writeFileSync(file,'<plist><dict>'+body+'</dict></plist>');assert.throws(()=>version.read(file));}fs.writeFileSync(file,'<plist><dict>'+key+'\n<string>0.2.0</string></dict></plist>');assert.equal(version.read(file),'0.2.0');}finally{fs.rmSync(root,{recursive:true,force:true});}
});
