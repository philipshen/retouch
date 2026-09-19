'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{read}=require('../src/capture-viewport.cjs');
test('capture viewport accepts only bounded dimensions from a regular capture manifest',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-capture-viewport-')),file=path.join(root,'capture.json'),valid={version:1,kind:'rendered-page-capture',viewport:{width:1100,height:850},title:'</script>untrusted'};
 const write=value=>fs.writeFileSync(file,JSON.stringify(value));
 try{
  assert.equal(read(root),null);write(valid);assert.deepEqual(read(root),{width:1100,height:850});
  for(const invalid of [null,{}, {...valid,version:2},{...valid,kind:'other'},...['1100',239,7681,1.5,null].map(width=>({...valid,viewport:{width,height:850}}))]){write(invalid);assert.equal(read(root),null);}
  fs.writeFileSync(file,'{broken');assert.equal(read(root),null);fs.writeFileSync(file,' '.repeat(1024*1024+1));assert.equal(read(root),null);
  fs.rmSync(file);const other=path.join(root,'other.json');fs.writeFileSync(other,JSON.stringify(valid));fs.symlinkSync(other,file);assert.equal(read(root),null);fs.rmSync(file);fs.mkdirSync(file);assert.equal(read(root),null);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
