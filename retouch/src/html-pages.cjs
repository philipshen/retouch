'use strict';
const fs=require('node:fs'),path=require('node:path');
function list(root){
 const pages=[];let truncated=false;
 function scan(folder,segments){
  for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
   if(pages.length>=1000){truncated=true;return;}
   if(entry.name.startsWith('.')||entry.isSymbolicLink()||entry.name==='node_modules'||(!segments.length&&entry.name==='rt'))continue;
   const parts=[...segments,entry.name],file=path.join(folder,entry.name);
   if(entry.isDirectory())scan(file,parts);
   else if(entry.isFile()&&/\.html?$/i.test(entry.name)){
    let url='/'+parts.map(encodeURIComponent).join('/');
    if(entry.name==='index.html'||entry.name==='index.htm'&&!fs.existsSync(path.join(folder,'index.html')))url='/'+segments.map(encodeURIComponent).join('/')+(segments.length?'/':'');
    pages.push({path:parts.join('/'),url});
   }
  }
 }
 scan(root,[]);pages.sort((a,b)=>a.path.localeCompare(b.path));return {pages,truncated};
}
module.exports={list};
