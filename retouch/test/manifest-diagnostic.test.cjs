'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('manifest probe reports malformed manifest metadata without contents and preserves parsing failures',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-manifest-probe-'));
 try{
  fs.mkdirSync(path.join(root,'.next'));fs.writeFileSync(path.join(root,'.next','app-paths-manifest.json'),'{"private":"DO_NOT_LOG"');fs.writeFileSync(path.join(root,'ordinary.json'),'bad ordinary content');
  const result=spawnSync(process.execPath,['--require',path.resolve(__dirname,'e2e/diagnostics/manifest-reads.cjs'),'-e',`const fs=require('node:fs'),assert=require('node:assert/strict');assert.deepEqual(JSON.parse('{"valid":1}'),{valid:1});for(const file of ['.next/app-paths-manifest.json','ordinary.json'])assert.throws(()=>JSON.parse(fs.readFileSync(file,'utf8')),SyntaxError);console.log('unchanged');`],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'unchanged');assert.equal(result.stderr.trim().split('\n').length,1);assert.match(result.stderr,/app-paths-manifest\.json/);assert.doesNotMatch(result.stderr,/DO_NOT_LOG|bad ordinary content/);assert.match(result.stderr,/"bytes":23/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
