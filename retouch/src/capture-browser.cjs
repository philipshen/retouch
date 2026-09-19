'use strict';
const fs=require('node:fs'),path=require('node:path');
// A packaged app owns its browser location. Do not fall back to a user's cache
// if that installation is damaged or has a mismatched browser revision.
function launchOptions({root=path.resolve(__dirname,'../../capture-browser'),arch=process.arch,platform=process.platform,version=require('playwright/package.json').version,packaged=fs.existsSync(path.resolve(__dirname,'../../build-manifest.json'))}={}){
 if(!packaged)return {};
 if(!fs.existsSync(root))throw Error('The bundled capture browser is missing. Reinstall Retouch.');
 if(fs.lstatSync(root).isSymbolicLink())throw Error('Invalid bundled capture browser directory.');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 if(platform!=='darwin'||!['arm64','x64'].includes(arch)||manifest.version!==1||manifest.playwrightVersion!==version)throw Error('The bundled capture browser is incompatible. Reinstall Retouch.');
 const relative=manifest.executables?.[arch];
 if(typeof relative!=='string'||path.isAbsolute(relative)||relative.includes('\\')||relative.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Invalid bundled capture browser path.');
 const executable=fs.realpathSync(path.join(root,relative)),base=fs.realpathSync(root);
 if(!executable.startsWith(base+path.sep)||!fs.statSync(executable).isFile())throw Error('Invalid bundled capture browser executable.');
 fs.accessSync(executable,fs.constants.X_OK);
 return {executablePath:executable};
}
module.exports={launchOptions};
