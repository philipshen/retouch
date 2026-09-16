'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
test('npm packaging includes the responsive runtime and compatibility registries',()=>{
 const root=path.resolve(__dirname,'..'),[packed]=JSON.parse(execFileSync('npm',['pack','--dry-run','--json','--ignore-scripts'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']})),files=new Set(packed.files.map(entry=>entry.path));
 for(const name of fs.readdirSync(path.join(root,'runtime')))assert.ok(files.has('runtime/'+name),'Missing packaged runtime/'+name);
 for(const name of ['src/group-scale-runtime.cjs','src/react-group-scale-runtime.cjs','src/jsx-released-structure.cjs','src/loader.cjs','bin/retouch.cjs'])assert.ok(files.has(name),'Missing packaged '+name);
});
