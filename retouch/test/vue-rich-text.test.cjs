'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const adapter=require('../src/adapters/vue.cjs'),{SourceHistory}=require('../src/history.cjs');
function resolve(source,a=adapter){const elements=a.collect(source,'App.vue').elements;return {source,elements,element:elements.find(el=>el.tag==='p'),file:'/app/App.vue',relPath:'App.vue',hash:a.contentHash(source)};}
test('Vue rich text keeps attributed runs while adding formatting and exact source history',t=>{
 const text='<script setup>const count=1</script><template><main><p id="owned">Hello <em class="accent">world</em></p><div>Later</div></main></template>';
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vue-rich-')),file=path.join(root,'App.vue');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(file,text);
 const r={...resolve(text),file},info=adapter.describe(r);assert.equal(info.canSetChildren,true);assert.equal(info.mixedText,true);assert.equal(info.textDynamic,false);
 const id=info.richText.children.find(node=>node.t==='element').id,history=new SourceHistory();
 const result=history.commit(root,adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'wrap',tag:'strong',children:[{t:'text',value:'Hello {{ literal }} '}]},{t:'keep',id,children:[{t:'text',value:'changed'}]}]}));
 assert.equal(result.ok,true,result.reason);const after=fs.readFileSync(file,'utf8');assert.match(after,/<em class="accent">changed<\/em>/);assert.match(after,/<strong>Hello &#123;&#123; literal &#125;&#125; <\/strong>/);
 assert.equal(resolve(after).elements.find(el=>el.tag==='div').id,r.elements.find(el=>el.tag==='div').id);
 assert.equal(history.apply(root,'undo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),text);
 assert.equal(history.apply(root,'redo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),after);
});
test('Vue rich text supports line breaks, links and custom delimiter literals without compiling new expressions',()=>{
 const a=adapter.create({compilerOptions:{delimiters:['[[',']]']}}),r=resolve('<template><main><p>Text</p></main></template>',a);
 const result=a.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'text',value:'[[literal]]'},{t:'break'},{t:'link',href:'/docs',children:[{t:'wrap',tag:'em',children:[{t:'text',value:'Docs'}]}]}]});
 assert.equal(result.ok,true,result.reason);assert.match(result.edits[0].after,/&#91;&#91;literal\]\]/);assert.equal(a.describe(resolve(result.edits[0].after,a)).canSetChildren,true);
});
test('Vue rich text refuses dynamic content, identity-bearing styles, template boundaries and browser repairs',()=>{
 for(const content of ['{{ count }}','<span :class="kind">Text</span>','<Widget/>','<span v-if="show">Text</span>','<span v-pre>{{ x }}</span>','<span ref="label">Text</span>','<span data-rt-style="0123456789">Text</span>','<div>Invalid paragraph child</div>']){
  const r=resolve('<template><main><p>'+content+'</p></main></template>');assert.equal(adapter.describe(r).canSetChildren,false,content);
  assert.equal(adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'text',value:'Lost'}]}).refused,true,content);
 }
 const r=resolve('<template><main><p>Text</p><div>After</div></main></template>');
 assert.equal(adapter.planOp(r,{type:'setChildren',fileHash:'old',children:[]}).refused,true);
 assert.equal(adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'wrap',tag:'script',children:[]}]}).refused,true);
});

test('Vue rich-text descriptors follow compiled whitespace while retaining source-owned run IDs',()=>{
 const r=resolve('<template><main><p>Hello\n  <em class="accent">world</em>\n  again</p></main></template>');
 const info=adapter.describe(r);assert.equal(info.canSetChildren,true);
 assert.deepEqual(info.richText.children.filter(node=>node.t==='text').map(node=>node.value),['Hello ',' again']);
 const raw=require('../src/rich-text-source.cjs').describe('Hello\n  <em class="accent">world</em>\n  again',r.element.id).descriptor;
 assert.equal(info.richText.children[1].id,raw.children[1].id);
});
test('Vue plain-formatting evidence excludes authored attributes from scoped-attribute reconstruction',()=>{
 const r=resolve('<template><main><p><strong>Bare</strong><em data-v-deadbeef="">Owned</em><a href="/plain">Plain</a><a href="/owned" class="owned">Owned</a></p></main></template>');
 const info=adapter.describe(r);
 assert.deepEqual(info.plainFormattingIds,r.elements.filter(element=>element.tag==='strong').map(element=>element.id));
 assert.deepEqual(info.plainLinkIds,[r.elements.find(element=>element.tag==='a').id]);
});
