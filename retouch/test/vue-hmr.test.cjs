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
test('Vue script fingerprints prevent template-only classification from retaining old script state',()=>{
 const {scriptHash}=require('../src/vue-hmr.cjs'),zero='<script setup>const count=ref(0)</script><template><h1>Hello</h1></template>',four=zero.replace('ref(0)','ref(4)'),a=scriptHash(zero,file),b=scriptHash(four,file),hot={data:{},accept(){}};
 assert.notEqual(a,b);assert.equal(scriptHash(zero.replace('Hello','Edited'),file),a);
 assert.equal(scriptHash(zero+'<style>h1{color:red}</style>',file),a);
 evaluate(transform(head+accept,file,revision('a'),a).code,hot);
 assert.equal(evaluate(transform(head+flag+accept,file,revision('b'),a).code,hot),true,'template-only edits retain state');
 assert.equal(evaluate(transform(head+flag+accept,file,revision('c'),b).code,hot),false,'script changes override a stale template-only decision');
 assert.equal(evaluate(transform(head+flag+accept,file,revision('a'),a).code,hot),false,'exact script restores must recreate state too');
 assert.notEqual(scriptHash(zero.replace('<script setup>','<script setup lang="ts">'),file),a);
 assert.notEqual(scriptHash(zero.replace('const count=ref(0)','const count=ref(0);defineProps(["value"])'),file),a);
 assert.equal(transform(head+flag+accept,file,revision('a'),'invalid'),null);
});
