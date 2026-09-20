'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{collect}=require('../shell/picture-style-inventory.js');
const document=()=>({documentElement:{},querySelectorAll:()=>[],styleSheets:[],adoptedStyleSheets:[]});
test('Picture style inventory reports missing, constructed and linked styles explicitly',()=>{
 assert.match(collect(null).issues[0],/unavailable/);const d=document();d.adoptedStyleSheets=[{}];assert.match(collect(d).issues[0],/Constructed/);d.adoptedStyleSheets=[];d.querySelectorAll=()=>[{tagName:'LINK'}];assert.match(collect(d).issues[0],/Document-linked/);
 d.querySelectorAll=()=>[{tagName:'STYLE',getAttribute:()=>null}];assert.match(collect(d).issues[0],/injected/);d.querySelectorAll=()=>Array(257).fill({});assert.match(collect(d).issues[0],/too many/);
});
test('Picture style inventory detects ownerless CSSOM sheets',()=>{const d=document();d.styleSheets=[{ownerNode:null}];assert.match(collect(d).issues[0],/no mapped/);});
