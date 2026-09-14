'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),liquid=require('../src/adapters/liquid.cjs');
function resolved(source){return {source,file:'/tmp/sections/main.liquid',relPath:'sections/main.liquid',hash:liquid.contentHash(source),element:liquid.collect(source,'sections/main.liquid').elements.find(el=>el.tag==='h1')};}
const original='<h1 class="bg-cover text-red-500" style="width:100%;height:120px">Headline</h1>';
const edit=(source,scope='',src='/assets/rt-picture.svg')=>liquid.planOp(resolved(source),{type:'setImageFill',fileHash:liquid.contentHash(source),src,scope});
test('Liquid image fills retain asset_url and isolate each screen variable in one source edit',()=>{
 const base=edit(original);assert.equal(base.ok,true,base.reason);assert.equal(base.edits.length,1);const source=base.edits[0].after;assert.match(source,/\{\{ 'rt-picture.svg' \| asset_url \}\}/);assert.match(source,/bg-cover text-red-500/);
 const tablet=edit(source,'md:','/assets/rt-tablet.svg');assert.equal(tablet.ok,true,tablet.reason);const changed=tablet.edits[0].after;assert.match(changed,/md:!bg-\[image:var\(--rt-image-fill-/);assert.equal((changed.match(/asset_url/g)||[]).length,2);
 const replacement=edit(changed,'md:','/assets/rt-new.svg');assert.equal(replacement.ok,true,replacement.reason);assert.equal((replacement.edits[0].after.match(/asset_url/g)||[]).length,2);assert.ok(!replacement.edits[0].after.includes('rt-tablet.svg'));assert.match(replacement.edits[0].after,/width:100%;height:120px/);
});
test('Liquid refuses ambiguous attributes, stale source and unsupported asset paths before edits',()=>{
 for(const source of [original.replace('class="bg-cover text-red-500"','class="{{ classes }}"'),original.replace('style="','style="color:red" style="'),original.replace('style="width:100%;height:120px"','style=none')])assert.equal(edit(source).refused,true);
 for(const src of ['/assets/../bad.svg','https://example.com/image.png','/assets/image\'bad.svg'])assert.equal(edit(original,'',src).refused,true);
 assert.equal(liquid.planOp(resolved(original),{type:'setImageFill',fileHash:'old',src:'/assets/good.svg'}).refused,true);
});
