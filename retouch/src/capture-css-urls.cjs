'use strict';
const decode=value=>value.replace(/\\([0-9a-f]{1,6})(?:\r\n|[\t\n\f\r ])?|\\(?:\r\n|[\n\r\f])|\\(.)/gi,(all,hex,char)=>hex?String.fromCodePoint(Math.min(0x10ffff,parseInt(hex,16))||0xfffd):char||'');
const quote=value=>'"'+value.replace(/[\\"\x00-\x1f\x7f<]/g,char=>char==='\\'||char==='"'?'\\'+char:'\\'+char.charCodeAt(0).toString(16)+' ')+'"';
function rewrite(text,replace){
 let result='',start=0,index=0;
 const quoted=position=>{const quote=text[position++];while(position<text.length){if(text[position]==='\\'){position+=2;continue;}if(text[position++]===quote)return position;}return position;};
 while(index<text.length){
  if(text.startsWith('/*',index)){const end=text.indexOf('*/',index+2);index=end<0?text.length:end+2;continue;}
  if(text[index]==='"'||text[index]==="'"){index=quoted(index);continue;}
  if(!/[\w-]/.test(text[index-1]||'')&&text.slice(index,index+4).toLowerCase()==='url('){
   const begin=index;let cursor=index+4;while(/\s/.test(text[cursor]||'')&&cursor<text.length)cursor++;
   let value,end;if(text[cursor]==='"'||text[cursor]==="'"){end=quoted(cursor);if(text[end-1]!==text[cursor])break;value=text.slice(cursor+1,end-1);while(/\s/.test(text[end]||'')&&end<text.length)end++;if(text[end]!==')'){index=end;continue;}}
   else{end=cursor;while(end<text.length&&text[end]!==')'){if(text[end]==='\\')end++;end++;}if(end>=text.length)break;value=text.slice(cursor,end).trim();}
   const next=replace(decode(value));result+=text.slice(start,begin)+'url('+quote(next)+')';start=index=end+1;
  }else index++;
 }
 return result+text.slice(start);
}
module.exports={rewrite};
