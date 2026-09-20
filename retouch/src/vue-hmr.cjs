'use strict';
// CHANGED_FILE can point at another SFC during a project-wide write. Compiler
// descriptor caches can also classify a rapid script restore as template-only.
// Keep per-module source and script proofs before preserving component state.
const MagicString=require('magic-string');
const previous='__retouch_previous_vue_source_revision';
const assignment=/export const _rerender_only = __VUE_HMR_RUNTIME__\.CHANGED_FILE === ("(?:[^"\\]|\\.)*")/g;
function scriptHash(text,file){
 const parsed=require('@vue/compiler-sfc').parse(text,{filename:file});
 if(parsed.errors.length)throw Error('Invalid Vue component script.');
 return require('./vue-source.cjs').contentHash(JSON.stringify([parsed.descriptor.script,parsed.descriptor.scriptSetup].map(block=>block?{content:block.content,attrs:block.attrs}:null)));
}
function transform(code,file,revision,scriptRevision){
 if(scriptRevision!==undefined&&!/^[a-f0-9]{40}$/.test(scriptRevision))return null;
 if(!/^[a-f0-9]{40}$/.test(revision)||!code.includes('__VUE_HMR_RUNTIME__.createRecord(')||!code.includes('import.meta.hot.accept(')||code.includes(previous))return null;
 const out=new MagicString(code),normalized=file.split(require('node:path').sep).join('/');
 const matches=[...code.matchAll(assignment)];
 if(matches.length>1)return null;
 if(matches.length){const match=matches[0];if(JSON.parse(match[1])!==normalized)return null;out.overwrite(match.index,match.index+match[0].length,`export const _rerender_only = ${previous} !== undefined && ${previous} !== ${JSON.stringify(revision)}${scriptRevision===undefined?'':` && __retouch_previous_vue_script_revision === ${JSON.stringify(scriptRevision)}`}`);}
 if(scriptRevision!==undefined)out.prepend(`const __retouch_previous_vue_script_revision = import.meta.hot?.data.retouchVueScriptRevision;\nif (import.meta.hot) import.meta.hot.data.retouchVueScriptRevision = ${JSON.stringify(scriptRevision)};\n`);
 out.prepend(`const ${previous} = import.meta.hot?.data.retouchVueSourceRevision;\nif (import.meta.hot) import.meta.hot.data.retouchVueSourceRevision = ${JSON.stringify(revision)};\n`);
 return {code:out.toString(),map:out.generateMap({hires:true,source:file,includeContent:true})};
}
module.exports={transform,scriptHash};
