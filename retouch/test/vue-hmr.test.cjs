'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{transform}=require('../src/vue-hmr.cjs');
const file='/app/App.vue',head='__VUE_HMR_RUNTIME__.createRecord("id", {});\n',accept='\nimport.meta.hot.accept(() => {});',flag='export const _rerender_only = __VUE_HMR_RUNTIME__.CHANGED_FILE === "/app/App.vue";',revision=letter=>letter.repeat(40);
function evaluate(code,hot){return Function('hot','__VUE_HMR_RUNTIME__',code.replaceAll('import.meta.hot','hot').replace('export const','const')+'\nreturn typeof _rerender_only === "undefined" ? undefined : _rerender_only;')(hot,{CHANGED_FILE:'/app/Unvisited.vue',createRecord(){}});}
test('Vue template-only HMR uses the component revision during simultaneous file changes',()=>{
 const hot={data:{},accept(){}};assert.equal(evaluate(transform(head+accept,file,revision('a')).code,hot),undefined);
 assert.equal(evaluate(transform(head+flag+accept,file,revision('b')).code,hot),true);
 // A dependency-triggered reevaluation of the same source must still reload.
 assert.equal(evaluate(transform(head+flag+accept,file,revision('b')).code,hot),false);
 assert.equal(evaluate(transform(head+flag+accept,file,revision('a')).code,hot),true);
});
test('Vue HMR preserves the compiler decision for script/style changes and rejects unmatched output',()=>{
 const hot={data:{retouchVueSourceRevision:revision('a')},accept(){}};
 assert.equal(evaluate(transform(head+accept,file,revision('b')).code,hot),undefined);
 assert.equal(transform(head+flag+accept,'/app/Other.vue',revision('b')),null);
 assert.equal(transform(head+flag+flag+accept,file,revision('b')),null);
 assert.equal(transform('export default {}',file,revision('b')),null);
 assert.equal(transform(head+flag+accept,file,'invalid'),null);
 const transformed=transform(head+flag+accept,file,revision('b'));assert.equal(transform(transformed.code,file,revision('c')),null);assert.ok(transformed.map.toString().includes('sourcesContent'));
});
