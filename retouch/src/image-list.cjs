'use strict';
const fs=require('node:fs'),path=require('node:path');
function list(root,assets,{query='',offset=0,limit=500}={}){
 if(!assets)throw Error('This adapter has no static asset directory.');
 if(typeof query!=='string'||query.length>256||!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>500)throw Error('Choose a valid image search and page.');
 const directory=path.join(root,assets.directory),images=[],term=query.normalize('NFC').toLowerCase();
 function scan(folder,prefix){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
  if(entry.name.startsWith('.')||entry.isSymbolicLink()||assets.excludeDirectories?.includes(entry.name))continue;
  const src=prefix+encodeURIComponent(entry.name);
  if(entry.isDirectory())scan(path.join(folder,entry.name),src+'/');
  else if(entry.isFile()&&/\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(entry.name)&&decodeURIComponent(src).normalize('NFC').toLowerCase().includes(term))images.push({src,name:entry.name});
 }}
 if(fs.existsSync(directory)){const project=fs.realpathSync(root),actual=fs.realpathSync(directory);if(actual===project||actual.startsWith(project+path.sep))scan(directory,assets.urlPrefix);}
 images.sort((a,b)=>a.src<b.src?-1:a.src>b.src?1:0);
 return {images:images.slice(offset,offset+limit),total:images.length,offset,nextOffset:offset+limit<images.length?offset+limit:null};
}
module.exports={list};
