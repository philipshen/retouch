'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{capture}=require('../src/site-capture.cjs'),{sanitize}=require('../src/capture-sanitize.cjs');
test('capture refuses unsafe URLs, invalid dimensions and existing destinations before launching',async()=>{
 let launched=false;const browserType={launch(){launched=true;throw Error('must not launch');}},root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-capture-check-'));try{
 const valid={url:'https://example.com',directory:path.join(root,'new'),browserType};
 for(const url of ['file:///tmp/test','javascript:alert(1)','https://user:pass@example.com'])await assert.rejects(capture({...valid,url}),/http or https/);
 for(const width of [0,239,7681,1.5,NaN])await assert.rejects(capture({...valid,width}),/dimensions/);
 await assert.rejects(capture({...valid,wait:30001}),/wait/);fs.writeFileSync(path.join(root,'keep'),'unchanged');await assert.rejects(capture({...valid,directory:root}),/already exists/);assert.equal(fs.readFileSync(path.join(root,'keep'),'utf8'),'unchanged');assert.equal(launched,false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('capture HTML is sanitized independently of the remote page serializer',()=>{
 const result=sanitize('<html><head><meta http-equiv="refresh" content="0;url=https://evil.test"><script>alert(1)</script></head><body onload="bad()"><iframe srcdoc="bad"></iframe><svg><foreignObject><script>bad()</script></foreignObject><use href="https://assets.test/a.svg#x"/><rect onclick="bad()"/></svg><a href="java&#10;script:bad()" ping="https://evil.test">Link</a><form action="https://evil.test"><button formaction="https://evil.test">Submit</button></form><img src="data:image/png;base64,AA" onerror="bad()"><div data-rt="forged">Safe</div></body></html>');
 assert.doesNotMatch(result,/script|onload|onerror|onclick|iframe|foreignObject|formaction|http-equiv|data-rt|evil\.test/);assert.match(result,/https:\/\/assets.test\/a.svg#x/);assert.match(result,/<form method="dialog">/);assert.match(result,/data:image\/png;base64,AA/);assert.match(result,/>Safe</);assert.equal(sanitize(result),result);
});
