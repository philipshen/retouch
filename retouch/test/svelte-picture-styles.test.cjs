'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),postcss=require('postcss'),source=require('../src/svelte-source.cjs'),adapter=require('../src/adapters/svelte.cjs'),styles=require('../src/svelte-picture-styles.cjs'),css=require('../src/svelte-css.cjs');
const original='<script>let count=$state(0);</script><main class="frame"><img src="/a.svg" alt="Scene"/><button onclick={()=>count++}>{count}</button></main><style>/* lead */ .frame {display:flex} .frame > img {width:40px} img + button {margin-left:8px} @media(max-width:600px){.frame > img{width:20px}} @keyframes pulse{from{opacity:0}to{opacity:1}}</style>';
function resolve(text=original){return {source:text,relPath:'App.svelte',file:'/tmp/App.svelte',hash:source.contentHash(text),element:source.collect(text,'App.svelte').elements.find(e=>e.tag==='img')};}
test('Svelte picture stylesheet plans preserve template bytes, declarations and managed model',()=>{
 const r=resolve(),managed=adapter.planOp(r,{type:'setCSS',fileHash:r.hash,width:768,property:'padding',value:'13px'});assert.equal(managed.ok,true,managed.reason);
 const before=managed.edits[0].after,result=styles.plan(resolve(before)),a=css.documentState(before,'App.svelte'),b=css.documentState(result.source,'App.svelte');assert.equal(result.changed,true);assert.ok(result.source.includes('data-rt-picture'));assert.equal(result.source.slice(0,result.source.indexOf('<style>')),before.slice(0,before.indexOf('<style>')));assert.deepEqual(b.model,a.model);assert.equal(result.source.slice(b.range.start,b.range.end),before.slice(a.range.start,a.range.end));
 const declarations=text=>{const root=postcss.parse(text);root.walkRules(rule=>{if(rule.parent.type!=='atrule'||rule.parent.name!=='keyframes')rule.selector='rule';});return root.toString();};
 assert.equal(declarations(result.source.slice(b.style.content.start,b.range.start)),declarations(before.slice(a.style.content.start,a.range.start)));
 assert.equal(styles.plan(resolve(result.source)).source,result.source);
});
test('Svelte component picture adaptation compiles after wrapping and preserves source-side history',t=>{
 const r=resolve(),wrapped=original.replace('<img','<picture data-rt-picture="" style="display:contents"><source srcset="/mobile.svg 1x"/><img').replace('/><button','/></picture><button'),result=styles.plan(r,{source:wrapped});require('svelte/compiler').compile(result.source,{filename:'App.svelte'});assert.ok(result.source.includes('> :where([data-rt-picture]) > img'));
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{SourceHistory}=require('../src/history.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-svelte-picture-css-')),file=path.join(root,'App.svelte');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(file,original);const history=new SourceHistory(),saved=history.commit(root,{ok:true,edits:[{file,before:original,after:result.source}]});assert.equal(saved.ok,true,saved.reason);assert.equal(history.apply(root,'undo',saved.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),original);assert.equal(history.apply(root,'redo',saved.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),result.source);
});
test('Svelte picture stylesheet plans refuse unsupported compiler scopes and preserve absent or generated-only styles',()=>{
 for(const text of [':global(.frame) > img{width:40px}','@import "other.css";.frame>img{width:40px}','@scope (.frame){img{width:40px}}'])assert.throws(()=>styles.plan(resolve(original.replace(/<style>[\s\S]*<\/style>/,'<style>'+text+'</style>'))));
 const bare=original.replace(/<style>[\s\S]*<\/style>/,'');assert.deepEqual(styles.plan(resolve(bare)),{source:bare,changed:false});const r=resolve(bare),managed=adapter.planOp(r,{type:'setCSS',fileHash:r.hash,width:0,property:'padding',value:'13px'}).edits[0].after;assert.equal(styles.plan(resolve(managed)).source,managed);
});

test('Svelte whole-selector globals retain global scope across picture alternatives',()=>{
 const text=original.replace('.frame > img {width:40px}',':global(.frame > img) {width:40px}').replace('img + button {margin-left:8px}',':global(img + button)/* keep global */, .unrelated {margin-left:8px}');
 const wrapped=text.replace('<img','<picture data-rt-picture="" style="display:contents"><img').replace('/><button','/></picture><button');
 const result=styles.plan(resolve(wrapped));
 const compiled=require('svelte/compiler').compile(result.source,{filename:'App.svelte',cssHash:()=> 'svelte-scope-test'});
 const rules=[];postcss.parse(compiled.css.code).walkRules(rule=>{if(rule.nodes.some(node=>node.type==='decl'&&node.prop==='margin-left'))rules.push(rule.selector);});
 assert.equal(rules.length,1);assert.match(rules[0],/data-rt-picture/);assert.doesNotMatch(rules[0],/svelte-scope-test/);assert.match(result.source,/keep global/);
 assert.equal(styles.plan(resolve(result.source)).source,result.source);
 for(const selector of ['.frame + :global(img)', ':global(.frame) > img', ':global(:global(img))'])assert.throws(()=>styles.plan(resolve(original.replace('.frame > img',selector))));
});

test('Svelte global blocks retain keyframe scope, media rules and nested selector order',()=>{
 const globalCSS='/* before */ :global { /* inside */ .frame { > img {width:40px; animation:pulse 1s} > img + button {margin-left:8px} } @media(max-width:600px){.frame > img{width:20px}} @keyframes pulse{from{opacity:0}to{opacity:1}} } /* after */';
 const text=original.replace(/<style>[\s\S]*<\/style>/,'<style>'+globalCSS+'</style>');
 const wrapped=text.replace('<img','<picture data-rt-picture="" style="display:contents"><img').replace('/><button','/></picture><button');
 const result=styles.plan(resolve(wrapped));
 const compiled=require('svelte/compiler').compile(result.source,{filename:'App.svelte',cssHash:()=> 'svelte-scope-test'});
 assert.match(result.source,/:global\s*\{/);assert.match(result.source,/inside/);assert.match(result.source,/before/);assert.match(result.source,/after/);
 assert.match(compiled.css.code,/@keyframes pulse/);assert.match(compiled.css.code,/animation:pulse 1s/);assert.doesNotMatch(compiled.css.code,/svelte-scope-test/);assert.match(compiled.css.code,/data-rt-picture/);assert.match(compiled.css.code,/@media/);
 assert.equal(styles.plan(resolve(result.source)).source,result.source);
 assert.throws(()=>styles.plan(resolve(text.replace(':global {','.frame { :global {').replace('/* after */','} /* after */'))),/Nested global/);
});

test('Svelte scoped ancestors keep global suffixes free of component scope classes',()=>{
 const text=original.replace('img + button {margin-left:8px}', '.frame > :global(img + button) {margin-left:8px}');
 const wrapped=text.replace('<img','<picture data-rt-picture="" style="display:contents"><img').replace('/><button','/></picture><button');
 const result=styles.plan(resolve(wrapped));
 const compiled=require('svelte/compiler').compile(result.source,{filename:'App.svelte',cssHash:()=> 'svelte-scope-test'});
 const rules=[];postcss.parse(compiled.css.code).walkRules(rule=>{if(rule.nodes.some(node=>node.type==='decl'&&node.prop==='margin-left'))rules.push(rule.selector);});
 assert.equal(rules.length,1);assert.match(rules[0],/data-rt-picture/);assert.doesNotMatch(result.source,/rt-scope-anchor/);
 for(const selector of require('postcss-selector-parser')().astSync(rules[0]).nodes){const scopes=[];selector.walkClasses(node=>{if(node.value==='svelte-scope-test')scopes.push(node);});assert.equal(scopes.length,1);assert.equal(selector.first.value,'frame');}
 assert.equal(styles.plan(resolve(result.source)).source,result.source);
});
