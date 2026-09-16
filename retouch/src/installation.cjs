'use strict';
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
function check(root=path.resolve(__dirname,'..')){
 const load=createRequire(path.join(root,'package.json'));
 try{
  for(const file of ['bin/retouch.cjs','src/preload.cjs','runtime/react-group-scale-dev.jsx','shell/index.html'])if(!fs.statSync(path.join(root,file)).isFile())throw Error('Missing '+file);
  for(const file of ['runtime/group-scale-legacy.json','runtime/react-group-scale-legacy.json'])if(!Array.isArray(JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))))throw Error('Invalid '+file);
  for(const name of Object.keys(load('./package.json').dependencies||{}))load.resolve(name);
  load('./src/group-scale-runtime.cjs').script();
  load('./src/react-group-scale-runtime.cjs').component();
 }catch(error){const failure=Error('Retouch installation is incomplete. Reinstall Retouch, then try again. Details: '+error.message);failure.code='RETOUCH_INSTALLATION_INCOMPLETE';throw failure;}
 return {ready:true,root};
}
module.exports={check};
