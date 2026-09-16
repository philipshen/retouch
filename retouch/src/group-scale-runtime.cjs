'use strict';
const fs=require('node:fs'),path=require('node:path');
const files={'./translate-values.js':'shell/translate-values.js','./flip.js':'shell/flip.js','./group-move.js':'shell/group-move.js','./group-scale.js':'runtime/group-scale.js','./bootstrap.js':'runtime/group-scale-bootstrap.js'};
let cached;
function bundle(){
 if(cached)return cached;
 const modules=Object.entries(files).map(([name,file])=>`{const module={exports:{}};(function(window,globalThis,require,module){\n${fs.readFileSync(path.join(__dirname,'..',file),'utf8')}\n})(undefined,scope,require,module);modules[${JSON.stringify(name)}]=module.exports;}`).join('\n');
 // Keep the authored site's globals private; all dependencies are embedded.
 // The lexical window/globalThis parameters route UMD exports to our registry.
 cached=`(()=>{'use strict';const host=window,scope={document:host.document,MutationObserver:host.MutationObserver,ResizeObserver:host.ResizeObserver};for(const name of ['requestAnimationFrame','cancelAnimationFrame','addEventListener','removeEventListener','matchMedia'])scope[name]=host[name].bind(host);const modules=Object.create(null),require=name=>{if(!modules[name])throw Error('Missing scale runtime dependency: '+name);return modules[name];};\n${modules}\nconst start=()=>require('./bootstrap.js').mount({document:host.document,geometry:require('./group-move.js'),controller:require('./group-scale.js')});if(host.document.readyState==='loading')host.document.addEventListener('DOMContentLoaded',start,{once:true});else start();})();`;
 return cached;
}
function script(){return '<script data-rt-scale-runtime="1">'+bundle().replace(/<\/script/gi,'<\\/script')+'</script>';}
module.exports={bundle,script};
