'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{parse,rewrite,sanitize}=require('../src/capture-srcset.cjs');
test('srcset parsing preserves commas in image URLs and data URLs with width/density descriptors',()=>{
 assert.deepEqual(parse(',, a,b.svg 1x, data:image/png;base64,AAAA 2x, small.svg 320w, large.svg 640w 480h'),[
  {url:'a,b.svg',descriptors:['1x']},{url:'data:image/png;base64,AAAA',descriptors:['2x']},{url:'small.svg',descriptors:['320w']},{url:'large.svg',descriptors:['640w','480h']}]);
 assert.equal(rewrite('a.png, b.png 2x',url=>'./local/'+url),'./local/a.png, ./local/b.png 2x');assert.equal(rewrite('a.png 1e0x, b.png .5x, c.png 0x',url=>url),'a.png 1e0x, b.png .5x, c.png 0x');
});
test('srcset discards invalid descriptors without mistaking nested commas for new candidates',()=>{
 assert.deepEqual(parse('a 0w, b -1x, c 1w 2x, d 1x 2x, e 10h, f calc(1, 2)x, g 2x').map(entry=>entry.url),['g']);
 assert.equal(sanitize('javascript:bad 1x, file:///secret 2x, good.svg 3x, data:text/html,bad 4x','https://example.test/images/'),'https://example.test/images/good.svg 3x');
 assert.equal(sanitize('data:image/svg+xml,%3Csvg%3E 1x, //cdn.test/image.png 2x','https://example.test/'),'data:image/svg+xml,%3Csvg%3E 1x, https://cdn.test/image.png 2x');
});
test('capture sanitizer resolves safe srcset candidates only on images and sources',()=>{
 const {sanitize:html}=require('../src/capture-sanitize.cjs'),value=html('<picture><source media="(max-width:600px)" srcset="a.svg 1x, javascript:bad 2x"><img srcset="a,b.svg 1x, high.svg 2x" sizes="50vw"></picture><div srcset="evil.svg 1x"></div>',{baseURL:'https://example.test/images/'});
 assert.match(value,/srcset="https:\/\/example.test\/images\/a.svg 1x"/);assert.match(value,/a,b.svg 1x, https:\/\/example.test\/images\/high.svg 2x/);assert.doesNotMatch(value,/javascript|evil.svg/);assert.match(value,/sizes="50vw"/);
});
