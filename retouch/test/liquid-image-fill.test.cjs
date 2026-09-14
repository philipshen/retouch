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

test('mixed Liquid gradient edits retain image bindings and reject image targets',()=>{
 const source=edit(original,'md:').edits[0].after,variable=source.match(/--rt-image-fill-[a-f0-9]{10}/)[0],layers=['linear-gradient(0deg, red 0%, blue 100%)','var('+variable+')'];
 const op={type:'setImageFill',fileHash:liquid.contentHash(source),scope:'md:',action:'gradient',stack:{layers,index:0,value:'linear-gradient(90deg, lime 0%, blue 100%)'}};
 const result=liquid.planOp(resolved(source),op);assert.equal(result.ok,true,result.reason);assert.ok(result.edits[0].after.includes('linear-gradient(90deg,_lime_0%,_blue_100%)'));assert.ok(result.edits[0].after.includes("'rt-picture.svg' | asset_url"));assert.equal((result.edits[0].after.match(/asset_url/g)||[]).length,1);
 for(const stack of [{...op.stack,index:1},{...op.stack,value:'url("/not-a-gradient.svg")'},{...op.stack,value:'linear-gradient(red,blue);display:none'}])assert.equal(liquid.planOp(resolved(source),{...op,stack}).refused,true);
});

test('Liquid paint reordering and duplication keep image replacement attached to the correct binding',()=>{
 const gradient='linear-gradient(0deg, red 0%, blue 100%)';
 const apply=(source,layers,index,src)=>liquid.planOp(resolved(source),{type:'setImageFill',fileHash:liquid.contentHash(source),scope:'md:',src,stack:{layers,index}});
 const one=apply(original,[gradient,'url("/a.svg")','url("/b.svg")'],1,'/assets/a.svg').edits[0].after,a=one.match(/var\((--rt-image-fill-[a-f0-9]{10})\)/)[1];
 const two=apply(one,[gradient,'var('+a+')','url("/b.svg")'],2,'/assets/b.svg').edits[0].after,b=[...two.matchAll(/var\((--rt-image-fill-[a-f0-9]{10})\)/g)][1][1],layers=[gradient,'var('+a+')','var('+b+')'];
 const ordered=liquid.planOp(resolved(two),{type:'setImageFill',fileHash:liquid.contentHash(two),scope:'md:',action:'order',stack:{layers,order:[0,2,1],framing:{'background-size':'auto, 20px 30px, contain'}}});assert.equal(ordered.ok,true,ordered.reason);assert.ok(ordered.edits[0].after.includes('[background-size:auto,_contain,_20px_30px]'));
 const replaced=apply(ordered.edits[0].after,[gradient,'var('+b+')','var('+a+')'],1,'/assets/c.svg');assert.equal(replaced.ok,true,replaced.reason);assert.ok(replaced.edits[0].after.includes("'a.svg' | asset_url"));assert.ok(replaced.edits[0].after.includes("'c.svg' | asset_url"));assert.ok(!replaced.edits[0].after.includes("'b.svg' | asset_url"));
 const duplicatedLayers=[gradient,'var('+b+')','var('+b+')','var('+a+')'],duplicated=liquid.planOp(resolved(replaced.edits[0].after),{type:'setImageFill',fileHash:liquid.contentHash(replaced.edits[0].after),scope:'md:',action:'order',stack:{layers:[gradient,'var('+b+')','var('+a+')'],order:[0,1,1,2],framing:{}}});assert.equal(duplicated.ok,true,duplicated.reason);
 const separated=apply(duplicated.edits[0].after,duplicatedLayers,1,'/assets/d.svg');assert.equal(separated.ok,true,separated.reason);assert.ok(separated.edits[0].after.includes("'c.svg' | asset_url"));assert.ok(separated.edits[0].after.includes("'d.svg' | asset_url"));assert.equal((separated.edits[0].after.match(/asset_url/g)||[]).length,3);
});
