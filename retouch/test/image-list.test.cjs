'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{list}=require('../src/image-list.cjs');
test('image search reaches beyond the first page and pages cover the catalog exactly',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-image-list-')),assets={directory:'public',urlPrefix:'/',excludeDirectories:['excluded']};
 try{fs.mkdirSync(path.join(root,'public'));for(let i=0;i<650;i++)fs.writeFileSync(path.join(root,'public','image-'+String(i).padStart(3,'0')+'.svg'),'<svg/>');
  fs.mkdirSync(path.join(root,'public','excluded'));fs.writeFileSync(path.join(root,'public','excluded','hidden.svg'),'<svg/>');
  const first=list(root,assets);assert.equal(first.images.length,500);assert.equal(first.total,650);assert.equal(first.nextOffset,500);
  const last=list(root,assets,{query:'IMAGE-649',limit:60});assert.equal(last.total,1);assert.equal(last.images[0].src,'/image-649.svg');assert.equal(last.nextOffset,null);
  const all=[];let offset=0;do{const page=list(root,assets,{offset,limit:60});all.push(...page.images.map(image=>image.src));offset=page.nextOffset;}while(offset!==null);assert.equal(all.length,650);assert.equal(new Set(all).size,650);
  fs.writeFileSync(path.join(root,'public','e\u0301cran.svg'),'<svg/>');assert.equal(list(root,assets,{query:'ÉCRAN'}).total,1);
  for(const options of [{limit:0},{offset:-1},{limit:501},{query:'x'.repeat(257)}])assert.throws(()=>list(root,assets,options));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
