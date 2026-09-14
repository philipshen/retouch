'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),directory=require('../src/asset-directory.cjs');
test('first upload creates nested asset directories and reuses internal symlinks',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-asset-dir-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const target=directory(root,'public','rt-assets');assert.ok(fs.statSync(target).isDirectory());assert.equal(directory(root,'public','rt-assets'),target);
 fs.symlinkSync(path.join(root,'public'),path.join(root,'linked'));assert.ok(fs.statSync(directory(root,'linked','more')).isDirectory());
});
test('asset directory refuses traversal, external and dangling symlinks before creating children',t=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'rt-asset-boundary-')),root=path.join(base,'project'),outside=path.join(base,'outside');fs.mkdirSync(root);fs.mkdirSync(outside);t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 assert.throws(()=>directory(root,'../outside','new'),/outside the project/);fs.symlinkSync(outside,path.join(root,'public'));assert.throws(()=>directory(root,'public','new'),/outside the project/);assert.deepEqual(fs.readdirSync(outside),[]);
 fs.symlinkSync(path.join(outside,'missing'),path.join(root,'dangling'));assert.throws(()=>directory(root,'dangling','new'));assert.deepEqual(fs.readdirSync(outside),[]);
 fs.writeFileSync(path.join(root,'file'),'keep');assert.throws(()=>directory(root,'file','new'),/not a directory/);
});
