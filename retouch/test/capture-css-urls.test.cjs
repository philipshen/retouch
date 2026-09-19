'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{rewrite}=require('../src/capture-css-urls.cjs');
test('capture rewrites CSS resource tokens without changing literal strings or comments',()=>{
 const seen=[],value=rewrite('content:"url(fake.png)";/*url(no.png)*/background:image-set(url("a(1).png") 1x,URL(b\\20 c.png) 2x);mask:url(#clip);src:url(\'font.woff2\') format("woff2")',url=>{seen.push(url);return url.startsWith('#')?url:'https://example.test/'+url;});
 assert.deepEqual(seen,['a(1).png','b c.png','#clip','font.woff2']);assert.match(value,/content:"url\(fake.png\)"/);assert.match(value,/\/\*url\(no.png\)\*\//);assert.match(value,/url\("https:\/\/example.test\/a\(1\).png"\)/);assert.match(value,/url\("#clip"\)/);
});
test('capture handles escaped delimiters, data URLs and malformed trailing CSS without truncation',()=>{
 assert.equal(rewrite('url(a\\)b.png) url("data:image/svg+xml,a(b)")',url=>url),'url("a)b.png") url("data:image/svg+xml,a(b)")');assert.equal(rewrite('color:red;url("unfinished',()=>''),'color:red;url("unfinished');
});

test('rewritten data URLs cannot terminate an HTML style element',()=>{
 const result=rewrite('url("data:image/svg+xml,\\3c /style>\\3c script>")',url=>url);assert.doesNotMatch(result,/</);assert.match(result,/\\3c /);const urls=[];rewrite(result,url=>{urls.push(url);return url;});assert.equal(urls[0],'data:image/svg+xml,</style><script>');
});
