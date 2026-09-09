'use strict';
const plain=/^[^\s"'`\\<>{}]+$/u;
function fontFamily(token){
 const match=/^(?:[^\s"'`\\<>{}]*:)?!?\[font-family:(.*)\]!?$/u.exec(token);
 return !!match&&token.length<=1000&&match[1].split(',').every(part=>/^(?:(?:[\p{L}\p{N}_-]|\\_)+|"(?:[\p{L}\p{N}_-]|\\_)+"|'(?:[\p{L}\p{N}_-]|\\_)+')$/u.test(part));
}
function fontVariations(token){
 const match=/^(?:[^\s"'`\\<>{}]*:)?!?\[font-variation-settings:(.*)\]!?$/u.exec(token);
 return !!match&&token.length<=1000&&require('../shell/html-css-values.js').parseVariations(match[1].replace(/_/g,' '))!==null;
}
const valid=token=>plain.test(token)||fontFamily(token)||fontVariations(token);
module.exports={valid,liquid:valid,fontFamily,fontVariations};
