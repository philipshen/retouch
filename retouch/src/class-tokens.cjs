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
function gridTracks(token){
 // Only Tailwind's escaped literal underscores are needed for named grid lines.
 if(token.length>4096||!/^(?:[^\s"'`\\<>{}]*:)?!?(?:grid-(?:cols|rows)-\[|\[grid-template-(?:columns|rows):)/u.test(token))return false;
 return plain.test(token.replace(/\\_/g,'_'))&&/\]!?$/.test(token);
}
const valid=token=>plain.test(token)||fontFamily(token)||fontVariations(token)||gridTracks(token);
module.exports={valid,liquid:valid,fontFamily,fontVariations};
