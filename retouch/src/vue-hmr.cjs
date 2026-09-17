'use strict';
// plugin-vue's template-only proof is sound, but its global CHANGED_FILE can
// point at a different SFC during a project-wide write. Use this module's own
// last evaluated source revision to distinguish direct edits from dependency HMR.
const MagicString=require('magic-string');
const previous='__retouch_previous_vue_source_revision';
const assignment=/export const _rerender_only = __VUE_HMR_RUNTIME__\.CHANGED_FILE === ("(?:[^"\\]|\\.)*")/g;
function transform(code,file,revision){
 if(!/^[a-f0-9]{40}$/.test(revision)||!code.includes('__VUE_HMR_RUNTIME__.createRecord(')||!code.includes('import.meta.hot.accept(')||code.includes(previous))return null;
 const out=new MagicString(code),normalized=file.split(require('node:path').sep).join('/');
 const matches=[...code.matchAll(assignment)];
 if(matches.length>1)return null;
 if(matches.length){const match=matches[0];if(JSON.parse(match[1])!==normalized)return null;out.overwrite(match.index,match.index+match[0].length,`export const _rerender_only = ${previous} !== undefined && ${previous} !== ${JSON.stringify(revision)}`);}
 out.prepend(`const ${previous} = import.meta.hot?.data.retouchVueSourceRevision;\nif (import.meta.hot) import.meta.hot.data.retouchVueSourceRevision = ${JSON.stringify(revision)};\n`);
 return {code:out.toString(),map:out.generateMap({hires:true,source:file,includeContent:true})};
}
module.exports={transform};
