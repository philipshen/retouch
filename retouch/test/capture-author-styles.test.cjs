'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{collect}=require('../src/capture-stylesheets.cjs');
test('author stylesheet recovery preserves sheet boundaries/media and bounds readable CSS',async()=>{
 const page=new EventEmitter(),collector=collect(page);
 try{
  const css='@import "a.css";body{color:red}',result=await collector.resolveStyles([{css,base:'https://example.test/main.css',media:'(min-width:600px)'},{sheet:'https://example.test/unavailable.css'}]);
  assert.deepEqual(result.styleSheets,[{css,media:'(min-width:600px)',base:'https://example.test/main.css'}]);assert.equal(result.warnings.length,1);
  const oversized=await collector.resolveStyles([{css:'x'.repeat(2*1024*1024+1),base:'https://example.test/'}]);assert.equal(oversized.styleSheets.length,0);assert.match(oversized.warnings[0],/size limit/);
  const many=await collector.resolveStyles(Array.from({length:257},()=>({css:'a{}',base:'https://example.test/'})));assert.equal(many.styleSheets.length,256);assert.match(many.warnings[0],/count limit/);
 }finally{collector.stop();}assert.equal(page.listenerCount('response'),0);
});
