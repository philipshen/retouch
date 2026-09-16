'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),parse5=require('parse5'),MagicString=require('magic-string');
const files={'./translate-values.js':'shell/translate-values.js','./flip.js':'shell/flip.js','./group-move.js':'shell/group-move.js','./group-scale.js':'runtime/group-scale.js','./bootstrap.js':'runtime/group-scale-bootstrap.js'};
let cached,currentRevision;
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function moduleSource(){return Object.entries(files).map(([name,file])=>`{const module={exports:{}};(function(window,globalThis,require,module){\n${fs.readFileSync(path.join(__dirname,'..',file),'utf8')}\n})(undefined,scope,require,module);modules[${JSON.stringify(name)}]=module.exports;}`).join('\n');}
function bundle(){
 if(cached)return cached;
 const modules=moduleSource();
 currentRevision=hash(modules);
 // Keep the authored site's globals private; all dependencies are embedded.
 // The lexical window/globalThis parameters route UMD exports to our registry.
 cached=`(()=>{'use strict';const host=window,scope={document:host.document,MutationObserver:host.MutationObserver,ResizeObserver:host.ResizeObserver};for(const name of ['requestAnimationFrame','cancelAnimationFrame','addEventListener','removeEventListener','matchMedia'])scope[name]=host[name].bind(host);const modules=Object.create(null),require=name=>{if(!modules[name])throw Error('Missing scale runtime dependency: '+name);return modules[name];};\n${modules}\nconst start=()=>{const key=Symbol.for('retouch.group-scale.runtime');host.document[key]?.dispose();host.document[key]=require('./bootstrap.js').mount({document:host.document,geometry:require('./group-move.js'),controller:require('./group-scale.js')});host.document[key].revision=${JSON.stringify(currentRevision)};};if(host.document.readyState==='loading')host.document.addEventListener('DOMContentLoaded',start,{once:true});else start();})();`;
 return cached;
}
function script(){return '<script data-rt-scale-runtime="1" data-rt-scale-revision="'+revision()+'">'+bundle().replace(/<\/script/gi,'<\\/script')+'</script>';}
function revision(){bundle();return currentRevision;}
function upgrade(source){
 const scripts=[],tree=parse5.parse(source,{sourceCodeLocationInfo:true});
 function walk(node){if(node.attrs?.some(a=>a.name==='data-rt-scale-runtime'))scripts.push(node);for(const child of node.childNodes||[])walk(child);}walk(tree);
 if(!scripts.length)return source;
 if(scripts.length!==1||scripts[0].tagName!=='script'||!scripts[0].sourceCodeLocation?.endTag)throw Error('The saved scale runtime changed outside the editor.');
 const location=scripts[0].sourceCodeLocation,value=source.slice(location.startOffset,location.endOffset),latest=script();if(value===latest)return source;
 if(!require('../runtime/group-scale-legacy.json').some(entry=>entry.sha256===hash(value)))throw Error('The saved scale runtime changed outside the editor.');
 return new MagicString(source).overwrite(location.startOffset,location.endOffset,latest).toString();
}
module.exports={bundle,script,revision,upgrade,moduleSource};
