'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),compiler=require('svelte/compiler'),adapter=require('../src/adapters/svelte.cjs'),rich=require('../src/svelte-rich-text.cjs');
function resolve(source,tag='p'){const relPath='App.svelte',elements=adapter.collect(source,relPath).elements;return {source,relPath,file:'/app/App.svelte',elements,element:elements.find(e=>e.tag===tag),hash:adapter.contentHash(source)};}
function apply(r,children){const result=rich.plan(r,{type:'setChildren',fileHash:r.hash,children});assert.equal(result.ok,true,result.reason);const after=result.edits[0]?.after||r.source;compiler.compile(after,{filename:'App.svelte',generate:'client'});return after;}
const text=value=>({t:'text',value}),keep=(id,children)=>({t:'keep',id,...(children?{children}:{})});
test('Svelte rich text preserves live expressions, bound attributes and authored events',()=>{
 const r=resolve('<script>let name=$state("Ada");</script><p>Hello <strong class={name} onclick={()=>name="Lin"}>world</strong> {name}!</p><aside>Outside</aside>'),info=rich.describe(r);assert.equal(info.canSetChildren,true,info.richTextReason);const nodes=info.richText.children,token=nodes[2].parts.find(p=>p.t==='token');
 const after=apply(r,[text('Welcome {literal} '),keep(nodes[1].id,[{t:'wrap',tag:'em',children:[text('friend')]}]),text(' '),keep(token.id),text('!')]);
 assert.match(after,/Welcome &#123;literal&#125;/);assert.match(after,/class=\{name\} onclick=\{\(\)=>name="Lin"\}/);assert.match(after,/<em>friend<\/em>/);assert.match(after,/\{name\}!<\/p><aside>Outside<\/aside>/);
 for(const children of [[text('Deleted')],[keep(token.id),keep(token.id)]])assert.equal(rich.plan(r,{fileHash:r.hash,children}).refused,true);
 assert.equal(rich.plan(r,{fileHash:'stale',children:[]}).refused,true);
});
test('Svelte rich text preserves comments and adjacent expression groups exactly once',()=>{
 const r=resolve('<script>let a="A",b="B";</script><p>Hi <!--note--> {a} / {b}!</p>'),info=rich.describe(r);assert.equal(info.canSetChildren,true,info.richTextReason);const tokens=info.richText.children[0].parts.filter(p=>p.t==='token');const after=apply(r,[text('Hello '),keep(tokens[0].id),text(' '),keep(tokens[1].id),text('?')]);assert.match(after,/<!--note--> \{a\} \/ \{b\}\?/);
 const comment=rich.describe(resolve('<p>A<!--keep-->B</p>'));assert.equal(comment.richText.children[0].parts.find(p=>p.t==='token').empty,true);
});
test('Svelte rich text retains surviving styles, clones independent style owners and supports exact history',t=>{
 let source='<main><p><span>First</span> <span>Second</span></p><aside>Outside</aside></main>';
 for(const [tag,index,value]of [['span',0,'17px'],['span',1,'23px'],['aside',0,'31px']]){const r=resolve(source),element=r.elements.filter(e=>e.tag===tag)[index],plan=adapter.planOp({...r,element},{type:'setCSS',fileHash:r.hash,width:768,property:'font-size',value});assert.equal(plan.ok,true,plan.reason);source=plan.edits[0].after;}
 const r=resolve(source),spans=rich.describe(r).richText.children.filter(n=>n.t==='element'),after=apply(r,[keep(spans[1].id,[text('Edited')]),{t:'copy',id:spans[1].id,children:[text('Copy')]}]);assert.doesNotMatch(after,/17px/);assert.match(after,/23px/);assert.match(after,/31px/);const next=resolve(after),runs=next.elements.filter(e=>e.tag==='span');assert.equal(runs.length,2);assert.notEqual(runs[0].attributes.find(a=>a.name==='data-rt-style').value,runs[1].attributes.find(a=>a.name==='data-rt-style').value);for(const element of runs)assert.equal(adapter.describe({...next,element}).cssRules[768]['font-size'],'23px');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-svelte-rich-')),file=path.join(root,'App.svelte');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(file,source);const history=new(require('../src/history.cjs').SourceHistory)(),result=history.commit(root,{ok:true,edits:[{file,before:source,after}]});assert.equal(result.ok,true,result.reason);assert.equal(history.apply(root,'undo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),source);assert.equal(history.apply(root,'redo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),after);
});
test('Svelte rich text refuses browser repairs, special markup and nested live content bindings',()=>{
 for(const source of ['<p><div>Repaired</div></p>','<p><Widget/></p>','<p>{#if show}Conditional{/if}</p>','<p>{@html content}</p>','<p><span bind:textContent={value}>Bound</span></p>','<p><span {...props}>Spread</span></p>']){try{assert.equal(rich.describe(resolve(source)).canSetChildren,false,source);}catch(error){if(error.name==='AssertionError')throw error;}}
});
test('Svelte rich text protects bound link destinations and generated literal values',()=>{
 const r=resolve('<script>let destination="/old";</script><p><a href={destination}>Visit</a></p>'),info=rich.describe(r),link=info.richText.children[0];assert.equal(link.editableLink,false);
 assert.equal(rich.plan(r,{fileHash:r.hash,children:[{t:'keep',id:link.id,href:'/new'}]}).refused,true);
 const after=apply(r,[keep(link.id,[text('Go')]),{t:'link',href:'/literal/{path}',children:[text('Literal {text}')]}]);assert.match(after,/href=\{destination\}/);assert.match(after,/href="\/literal\/&#123;path&#125;"/);
 const data=rich.context(r);assert.equal(rich.plan(r,{fileHash:r.hash,children:[text(data.attributes[0].marker)]}).refused,true);
 const plain=resolve('<p>Text</p>');assert.equal(rich.plan(plain,{fileHash:plain.hash,children:[{t:'style',property:'font-family',value:'{danger()}',children:[text('Text')]}]}).refused,true);
});
test('Svelte split text copies bound appearance without duplicating event behavior',()=>{
 const r=resolve('<script>let theme="accent";function click(){}</script><p><span class={theme} onclick={click}>First</span></p>'),node=rich.describe(r).richText.children[0];
 const after=apply(r,[keep(node.id),{t:'copy',id:node.id,children:[text('Second')]}]);assert.equal(after.split('class={theme}').length,3);assert.equal(after.split('onclick={click}').length,2);assert.match(after,/<span class=\{theme\}>Second<\/span>/);
});
test('Svelte rendered descriptors normalize compiler whitespace while preserving comments and nonbreaking spaces',()=>{
 const r=resolve('<p>\n <!--before-->\n Hello<!--middle--> <em> world </em>!\n</p>'),info=rich.describe(r);assert.equal(info.canSetChildren,true,info.richTextReason);const first=info.richText.children[0];assert.equal(first.parts.filter(p=>p.t==='text').map(p=>p.value).join(''),'Hello ');assert.equal(first.parts.filter(p=>p.t==='token'&&p.empty).length,2);assert.equal(info.richText.children[1].children[0].value,'world');assert.equal(info.richText.children[2].value,'!');
 const preserved=rich.describe(resolve('<svelte:options preserveWhitespace/><p>  Hello <em> world </em> </p>'));assert.equal(preserved.richText.children[0].value,'  Hello ');assert.equal(preserved.richText.children[1].children[0].value,' world ');
 assert.equal(rich.describe(resolve('<p>&nbsp;Hello&nbsp;</p>')).richText.children[0].value,'\u00a0Hello\u00a0');
 assert.equal(rich.describe(resolve('<p>A\r\nB</p>')).richText.children[0].value,'A\nB');
 const dynamic=rich.describe(resolve('<p>A\r\n{count} C</p>'));assert.equal(dynamic.richText.children[0].parts[0].value,'A\r\n');
});
test('Svelte rich text edits retain computed styles on the container',()=>{
 const r=resolve('<script>let color="red";</script><p style:color={color}><em>Text</em></p>'),info=rich.describe(r);assert.equal(info.canSetChildren,true,info.richTextReason);const after=apply(r,[keep(info.richText.children[0].id,[text('Edited')])]);assert.match(after,/<p style:color=\{color\}><em>Edited<\/em><\/p>/);
});
