'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const launcher=path.resolve(__dirname,'../../retouch/bin/desktop-launch.sh');
test('desktop launcher preserves argument boundaries, working directory and exit status',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-launch-path-'));
 try{const literal="a file; $(false) 'quoted'",result=spawnSync(launcher,['/bin/sh','-c','printf "%s\\n%s" "$PWD" "$1"; exit 7','test',literal],{cwd:root,env:{PATH:'/usr/bin:/bin'},encoding:'utf8'});assert.equal(result.status,7,result.stderr);assert.equal(result.stdout,fs.realpathSync(root)+'\n'+literal);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('desktop launcher preserves user-selected tools before Homebrew fallback paths',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-launch-node-'));
 try{const tool=path.join(root,'node');fs.writeFileSync(tool,'#!/bin/sh\nprintf selected-node\n',{mode:0o755});const result=spawnSync(launcher,['node'],{env:{PATH:root},encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'selected-node');const empty=spawnSync(launcher,['/bin/sh','-c','printf %s "$PATH"'],{env:{PATH:''},encoding:'utf8'});assert.equal(empty.stdout,'/opt/homebrew/bin:/usr/local/bin');}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('desktop launcher finds installed Homebrew Node with a Finder-like PATH',t=>{
 if(process.platform!=='darwin')return t.skip('macOS only');
 const brewNode=['/opt/homebrew/bin/node','/usr/local/bin/node'].find(file=>fs.existsSync(file));if(!brewNode)return t.skip('Homebrew Node is not installed');
 const result=spawnSync(launcher,['node','-p','process.execPath'],{env:{PATH:'/usr/bin:/bin:/usr/sbin:/sbin'},encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(fs.realpathSync(result.stdout.trim()),fs.realpathSync(brewNode));
});
