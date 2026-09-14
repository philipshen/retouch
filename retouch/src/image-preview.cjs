'use strict';
const fs=require('node:fs'),path=require('node:path');
const types={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.ico':'image/x-icon'};
function read(root,assets,src){
 if(!assets||typeof src!=='string'||!src.startsWith(assets.urlPrefix))throw Error('Choose a project image.');
 let relative;try{relative=decodeURIComponent(src.slice(assets.urlPrefix.length));}catch{throw Error('Invalid image path.');}
 const parts=relative.split('/');if(!parts.length||parts.some(part=>!part||part==='.'||part==='..'||part.startsWith('.')||part.includes('\\')||/[\x00-\x1f]/.test(part)||assets.excludeDirectories?.includes(part)))throw Error('Choose a project image.');
 const type=types[path.extname(relative).toLowerCase()];if(!type)throw Error('Choose a supported image file.');
 const project=fs.realpathSync(root),directory=fs.realpathSync(path.join(project,assets.directory));if(directory!==project&&!directory.startsWith(project+path.sep))throw Error('The image directory is outside the project.');
 const file=fs.realpathSync(path.join(directory,...parts));if(!file.startsWith(directory+path.sep))throw Error('The image is outside the asset directory.');
 const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try{const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.size>10000000)throw Error('Preview supports image files up to 10 MB.');return {type,data:fs.readFileSync(fd)};}finally{fs.closeSync(fd);}
}
module.exports={read};
