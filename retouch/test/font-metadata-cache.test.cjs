'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function fixture(){
 let now=0,fail=false,calls=0;
 const axes=[{tag:'opsz',name:'Optical Size',min:8,default:14,max:144,hidden:false}];
 const window={crypto:webcrypto,__RT_TOKEN:'test-token',fetch:async()=>{calls++;return Response.json(fail?{ok:false,reason:'Changed file is invalid'}:{ok:true,axes},{status:fail?422:200});}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../shell/font-metadata.js'),'utf8'),{window,TextEncoder,Uint8Array,Blob,AbortController,URL,setTimeout,clearTimeout,Date:{now:()=>now}});
 const document=origin=>({location:{origin},defaultView:{fetch:async()=>new Response(new Uint8Array([1]))}});
 return {api:window.RetouchFontMetadata,document,axes,calls:()=>calls,fail:()=>{fail=true;},expire:()=>{now=300001;}};
}
test('large font URL metadata survives document replacement, isolates URLs/origins and expires',async()=>{
 const f=fixture(),url='data:font/ttf;base64,'+'A'.repeat(3*1024*1024),d=f.document('http://localhost:4000');
 await f.api.inspect(d,url);
 assert.deepEqual((await f.api.peek(f.document('http://localhost:4000'),url)).axes,f.axes);
 assert.equal(f.calls(),1);
 assert.equal(await f.api.peek(d,url+'B'),undefined);
 assert.equal(await f.api.peek(f.document('http://localhost:5000'),url),undefined);
 f.expire();assert.equal(await f.api.peek(d,url),undefined);
});
test('failed reinspection invalidates cached metadata for a hashed font URL',async()=>{
 const f=fixture(),d=f.document('http://localhost:4000'),url='https://fonts.test/font.ttf?'+ 'x'.repeat(4096);
 await f.api.inspect(d,url);assert.deepEqual((await f.api.peek(d,url)).axes,f.axes);
 f.fail();await assert.rejects(f.api.inspect(d,url),/Changed file is invalid/);
 assert.equal(await f.api.peek(d,url),undefined);
});
