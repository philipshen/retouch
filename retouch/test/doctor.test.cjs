'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
function fixture(t,packages={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-doctor-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'package.json'),'{}');
 for(const [name,version] of Object.entries(packages)){const directory=path.join(root,'node_modules',name);fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify({name,version}));}
 return root;
}
function inspect(root){const result=spawnSync(process.execPath,[path.resolve(__dirname,'../bin/retouch.cjs'),'doctor',root],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);return result.stdout;}
test('doctor gives explicit Vite React setup without evaluating project configuration',t=>{
 const root=fixture(t,{vite:'8.3.0',react:'19.2.0'}),marker=path.join(root,'config-executed');
 fs.writeFileSync(path.join(root,'vite.config.ts'),`require('node:fs').writeFileSync(${JSON.stringify(marker)},'bad');throw Error('Never evaluate this configuration');`);
 const output=inspect(root);assert.match(output,/Vite: 8\.3\.0/);assert.match(output,/React: 19\.2\.0/);assert.match(output,/Vite configuration: vite.config.ts/);assert.match(output,/retouch\/vite/);assert.match(output,/wrapper does not inject/);assert.match(output,/does not confirm/);assert.equal(fs.existsSync(marker),false);
});
test('doctor distinguishes unverified Vite and absent React from working integration',t=>{
 const old=inspect(fixture(t,{vite:'7.3.0'}));assert.match(old,/this version is not verified/);assert.doesNotMatch(old,/Vite setup:/);
 const noReact=inspect(fixture(t,{vite:'8.3.0'}));assert.match(noReact,/React: not found/);assert.match(noReact,/no default config file found/);
});
test('doctor retains Next diagnostics and reports malformed Vite metadata accurately',t=>{
 const root=fixture(t,{next:'16.2.5',vite:'8.3.0'});fs.writeFileSync(path.join(root,'node_modules/vite/package.json'),'broken');
 const output=inspect(root);assert.match(output,/Next: 16\.2\.5/);assert.match(output,/Automatic hook: supported release line/);assert.match(output,/Vite: could not inspect its package metadata/);
});
test('doctor distinguishes Vue dependencies from an enabled editor and reports current editing limits',t=>{
 const root=fixture(t,{vite:'8.3.0',vue:'3.5.42','@vitejs/plugin-vue':'6.0.9'});
 const output=inspect(root);assert.match(output,/Vue: 3\.5\.42/);assert.match(output,/Vue Vite plugin: 6\.0\.9/);assert.match(output,/Computed inline styles, other structural operations and linked style libraries remain incomplete/);assert.match(output,/does not confirm that the plugin is enabled/);
 const missing=inspect(fixture(t,{vite:'8.3.0',vue:'3.5.42'}));assert.match(missing,/install @vitejs\/plugin-vue/);
});
