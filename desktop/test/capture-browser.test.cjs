'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{inventory}=require('../scripts/capture-browser.cjs');
test('browser inventory binds contents and executable modes, detects native code and refuses links',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-browser-inventory-'));
 try{
  fs.mkdirSync(path.join(root,'arm64'));fs.writeFileSync(path.join(root,'arm64/browser'),Buffer.from('cffaedfe00000000','hex'),{mode:0o755});fs.writeFileSync(path.join(root,'LICENSE'),'license');fs.writeFileSync(path.join(root,'manifest.json'),'not inventoried');
  const original=inventory(root);assert.equal(original.length,2);assert.equal(original.find(entry=>entry.path==='arm64/browser').native,true);assert.equal(original.find(entry=>entry.path==='LICENSE').native,false);
  fs.chmodSync(path.join(root,'arm64/browser'),0o644);assert.notDeepEqual(inventory(root),original);fs.chmodSync(path.join(root,'arm64/browser'),0o755);assert.deepEqual(inventory(root),original);
  fs.appendFileSync(path.join(root,'LICENSE'),'changed');assert.notDeepEqual(inventory(root),original);
  fs.symlinkSync(path.join(root,'LICENSE'),path.join(root,'link'));assert.throws(()=>inventory(root),/symlink/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
