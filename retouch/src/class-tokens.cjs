'use strict';
const plain=/^[^\s"'`\\<>{}]+$/u;
function fontFamily(token){
 const match=/^(?:[^\s"'`\\<>{}]*:)?!?\[font-family:(.*)\]!?$/u.exec(token);
 return !!match&&token.length<=1000&&match[1].split(',').every(part=>/^(?:(?:[\p{L}\p{N}_-]|\\_)+|"(?:[\p{L}\p{N}_-]|\\_)+"|'(?:[\p{L}\p{N}_-]|\\_)+')$/u.test(part));
}
const valid=token=>plain.test(token)||fontFamily(token);
module.exports={valid,liquid:valid,fontFamily};
