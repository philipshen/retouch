'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{rewrite}=require('../src/stylesheet-integrity.cjs');
const hash=(algorithm,text)=>algorithm+'-'+crypto.createHash(algorithm).update(text).digest('base64');
test('rewrites verified digest algorithms without removing integrity or metadata formatting',()=>{
 const before='img{width:20px}',after='img{width:30px}',value=' \t'+hash('sha256',before)+'\n'+hash('sha384',before)+'?option=keep\r\n'+hash('sha512',before)+'  unknown-x ';assert.equal(rewrite(value,before,after),' \t'+hash('sha256',after)+'\n'+hash('sha384',after)+'?option=keep\r\n'+hash('sha512',after)+'  unknown-x ');assert.equal(rewrite(value,before,before),value);
});
test('requires a strongest-algorithm match and preserves alternative allowed digests',()=>{
 const before='before',after='after',alternative=hash('sha512','alternate');assert.throws(()=>rewrite(hash('sha256',before)+' '+alternative,before,after),/strongest/);assert.equal(rewrite(alternative+' '+hash('sha512',before),before,after),alternative+' '+hash('sha512',after));for(const value of ['sha512-invalid','sha512','unsupported-only',hash('sha256',before)+' sha512-???'])assert.throws(()=>rewrite(value,before,after),/strongest/);
});
test('validates UTF-8 bytes, unpadded digest encodings and bounded metadata',()=>{
 const before='\ufeffimg{--label:"你好"}\r\n',after=before+'/* next */';assert.equal(rewrite(hash('sha256',before).replace(/=+$/,''),before,after),hash('sha256',after));assert.equal(rewrite('',before,after),'');assert.throws(()=>rewrite('x'.repeat(16385),before,after),/too large/);assert.throws(()=>rewrite(hash('sha384',before),'different',after),/strongest/);
});
