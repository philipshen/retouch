'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../shell/color-styles.js'),'utf8'),{window});const {normalize}=window.RetouchColorStyles;
test('palette color entry expands shorthand and retains explicit alpha exactly',()=>{
 for(const [input,expected]of [['#abc','#aabbccff'],['#AbC8','#aabbcc88'],['#ABCDEF','#abcdefff'],['#12345600','#12345600'],['#0000','#00000000']])assert.equal(normalize(input),expected);
 for(const input of ['',null,42,'red','#12','#12345','#123456789','var(--color)','#123;bad'])assert.throws(()=>normalize(input),/hex color/);
});
