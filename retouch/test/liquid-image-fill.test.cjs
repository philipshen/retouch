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

test('Liquid remove and reset clean only the selected screen asset reference',()=>{
 const base=edit(original).edits[0].after,tablet=edit(base,'md:','/assets/tablet.svg').edits[0].after;
 const change=(source,action)=>liquid.planOp(resolved(source),{type:'setImageFill',fileHash:liquid.contentHash(source),scope:'md:',action});
 const removed=change(tablet,'remove');assert.equal(removed.ok,true,removed.reason);const source=removed.edits[0].after;assert.match(source,/md:!bg-none/);assert.ok(!source.includes('tablet.svg'));assert.ok(source.includes('rt-picture.svg'));
 const reset=change(source,'reset');assert.equal(reset.ok,true,reset.reason);assert.ok(!reset.edits[0].after.includes('md:'));assert.ok(reset.edits[0].after.includes('rt-picture.svg'));
 const changed=tablet.replace('tablet.svg','tablet/subpath.svg');assert.equal(change(changed,'reset').refused,true);
});

test('mixed Liquid paint replacement preserves other asset references and gradient order',()=>{
 const replace=(source,layers,index)=>liquid.planOp(resolved(source),{type:'setImageFill',fileHash:liquid.contentHash(source),scope:'md:',src:'/assets/paint-'+index+'.svg',stack:{layers,index}});
 const gradient='linear-gradient(90deg, red 0%, blue 100%)',first=replace(original,[gradient,'url("/first.svg")','url("/second.svg")'],1);assert.equal(first.ok,true,first.reason);
 const source=first.edits[0].after,variable=source.match(/--rt-image-fill-[a-f0-9]{10}/)[0],second=replace(source,[gradient,'var('+variable+')','url("/second.svg")'],2);assert.equal(second.ok,true,second.reason);
 assert.match(second.edits[0].after,/paint-1.svg/);assert.match(second.edits[0].after,/paint-2.svg/);assert.equal((second.edits[0].after.match(/asset_url/g)||[]).length,2);assert.ok(second.edits[0].after.includes('linear-gradient(90deg,_red_0%,_blue_100%),_var('));
 assert.equal(replace(original,[gradient,'var(--rt-image-fill-0000000000)'],1).refused,true);assert.equal(replace(original,[gradient,'url("/first.svg")'],0).refused,true);
});
