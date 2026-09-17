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
test('Vue rich text refuses directives, component boundaries and browser repairs',()=>{
 for(const content of ['<span :innerHTML="content">Text</span>','<Widget/>','<span v-if="show">Text</span>','<span v-pre>{{ x }}</span>','<span ref="label">Text</span>','<div>Invalid paragraph child</div>']){
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
test('Vue rich text preserves surviving responsive style owners and prunes only deleted runs with exact undo',t=>{
 let text='<template><main><p><span>First</span> <span>Second</span></p><div>Outside</div></main></template>';
 for(const [tag,index,value]of [['span',0,'17px'],['span',1,'23px'],['div',0,'31px']]){
  const r=resolve(text),element=r.elements.filter(element=>element.tag===tag)[index];
  const result=adapter.planOp({...r,element},{type:'setCSS',fileHash:r.hash,width:768,property:'font-size',value});assert.equal(result.ok,true,result.reason);text=result.edits[0].after;
 }
 const block=text.match(/<style data-rt-vue-css[\s\S]*?<\/style>/)[0];text=block+text.replace(block,'');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vue-rich-styles-')),file=path.join(root,'App.vue');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(file,text);
 const r={...resolve(text),file},info=adapter.describe(r);assert.equal(info.canSetChildren,true);
 const spans=info.richText.children.filter(node=>node.t==='element'),history=new SourceHistory();
 const result=history.commit(root,adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'keep',id:spans[1].id,children:[{t:'wrap',tag:'strong',children:[{t:'text',value:'Edited'}]}]}]}));
 assert.equal(result.ok,true,result.reason);const after=fs.readFileSync(file,'utf8');assert.doesNotMatch(after,/17px/);assert.match(after,/23px/);assert.match(after,/31px/);
 const next=resolve(after),span=next.elements.find(element=>element.tag==='span');assert.equal(adapter.describe({...next,element:span}).cssRules[768]['font-size'],'23px');
 assert.equal(history.apply(root,'undo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),text);
 assert.equal(history.apply(root,'redo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),after);
 const duplicate=adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'keep',id:spans[0].id},{t:'copy',id:spans[0].id,children:[{t:'text',value:'Duplicate'}]}]});assert.equal(duplicate.ok,true,duplicate.reason);const duplicated=resolve(duplicate.edits[0].after),runs=duplicated.elements.filter(element=>element.tag==='span');assert.equal(runs.length,2);assert.notEqual(runs[0].attributes.find(attr=>attr.name==='data-rt-style').value,runs[1].attributes.find(attr=>attr.name==='data-rt-style').value);for(const element of runs)assert.equal(adapter.describe({...duplicated,element}).cssRules[768]['font-size'],'17px');
 const independent=adapter.planOp({...duplicated,element:runs[1]},{type:'setCSS',fileHash:duplicated.hash,width:768,property:'font-size',value:'41px'});assert.equal(independent.ok,true,independent.reason);const separate=resolve(independent.edits[0].after),first=separate.elements.find(element=>element.tag==='span');assert.equal(adapter.describe({...separate,element:first}).cssRules[768]['font-size'],'17px');
});

test('Vue nested rich-text copies allocate independent base and breakpoint styles with exact history',t=>{
 let text='<template><main><div><p><span title="Run">Split here</span></p></div><aside>Outside</aside></main></template>';
 for(const [tag,width,value]of [['p',0,'21px'],['span',0,'19px'],['span',768,'27px'],['aside',0,'33px']]){
  const r=resolve(text),element=r.elements.find(el=>el.tag===tag),result=adapter.planOp({...r,element},{type:'setCSS',fileHash:r.hash,width,property:'font-size',value});
  assert.equal(result.ok,true,result.reason);text=result.edits[0].after;
 }
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vue-split-')),file=path.join(root,'App.vue');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(file,text);
 const r={...resolve(text),file};r.element=r.elements.find(el=>el.tag==='div');
 const paragraph=adapter.describe(r).richText.children[0],span=paragraph.children[0],history=new SourceHistory();
 const segment=(t,value)=>({t,id:paragraph.id,children:[{t,id:span.id,children:[{t:'text',value}]}]});
 const result=history.commit(root,adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:[segment('keep','Split'),segment('copy','here'),segment('copy','again')]}));
 assert.equal(result.ok,true,result.reason);const after=fs.readFileSync(file,'utf8'),next=resolve(after),owners=next.elements.flatMap(el=>el.attributes.filter(a=>a.name==='data-rt-style').map(a=>a.value));
 assert.equal(owners.length,7);assert.equal(new Set(owners).size,7);
 for(const element of next.elements.filter(el=>el.tag==='span')){const info=adapter.describe({...next,element});assert.equal(info.cssRules[0]['font-size'],'19px');assert.equal(info.cssRules[768]['font-size'],'27px');}
 for(const element of next.elements.filter(el=>el.tag==='p'))assert.equal(adapter.describe({...next,element}).cssRules[0]['font-size'],'21px');
 const outside=next.elements.find(el=>el.tag==='aside');assert.equal(adapter.describe({...next,element:outside}).cssRules[0]['font-size'],'33px');
 assert.equal(history.apply(root,'undo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),text);
 assert.equal(history.apply(root,'redo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),after);
});

test('Vue rich-text copies replace reset style markers even when they have no active rules',()=>{
 const r=resolve('<template><main><p><span data-rt-style="0123456789">Reset</span></p></main></template>'),span=adapter.describe(r).richText.children[0];
 const result=adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'keep',id:span.id},{t:'copy',id:span.id,children:[{t:'text',value:'Copy'}]}]});
 assert.equal(result.ok,true,result.reason);const next=resolve(result.edits[0].after),owners=next.elements.filter(el=>el.tag==='span').map(el=>el.attributes.find(a=>a.name==='data-rt-style').value);
 assert.equal(owners[0],'0123456789');assert.notEqual(owners[0],owners[1]);assert.match(owners[1],/^[a-f0-9]{10}$/);
 assert.deepEqual(require('../src/vue-css.cjs').documentState(next.source,'App.vue').model.layers,{});
});

test('Vue literal formatting preserves live expressions and exact source history',t=>{
 const text='<script setup>const count=2</script><template><main><p>Hello\n {{ count < 4 ? "<four>" : "&more" }} <em>people {{ count }}</em>!</p><div>Outside</div></main></template>';
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vue-live-text-')),file=path.join(root,'App.vue');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(file,text);
 const r={...resolve(text),file},info=adapter.describe(r);assert.equal(info.canSetChildren,true);assert.equal(info.mixedText,true);
 const [greeting,em,ending]=info.richText.children,token=greeting.parts.find(part=>part.t==='token');assert.equal(greeting.parts[0].value,'Hello ');assert.ok(token.id);assert.equal(em.children[0].parts.filter(part=>part.t==='token').length,1);
 const history=new SourceHistory(),result=history.commit(root,adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'wrap',tag:'strong',children:[{t:'text',value:'Welcome '}]},{t:'keep',id:token.id},{t:'text',value:' '},{t:'keep',id:em.id},{t:'text',value:ending.value}]}));
 assert.equal(result.ok,true,result.reason);const after=fs.readFileSync(file,'utf8');assert.match(after,/<strong>Welcome <\/strong>{{ count < 4 \? "<four>" : "&more" }} <em>people {{ count }}<\/em>!/);assert.equal(adapter.describe(resolve(after)).canSetChildren,true);
 assert.equal(history.apply(root,'undo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),text);assert.equal(history.apply(root,'redo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),after);
 for(const children of [[{t:'text',value:'Flattened'}],[{t:'keep',id:token.id},{t:'keep',id:token.id}],[{t:'keep',id:token.id,children:[{t:'text',value:'Changed'}]}]])assert.equal(adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children}).refused,true);
});

test('Vue adjacent expressions preserve one unambiguous dynamic portion with custom delimiters',()=>{
 const a=adapter.create({compilerOptions:{delimiters:['[[',']]']}}),r=resolve('<template><main><p>Before [[ first ]] / [[ second ]] after</p></main></template>',a),info=a.describe(r);assert.equal(info.canSetChildren,true);
 const parts=info.richText.children[0].parts;assert.equal(parts.length,3);assert.equal(parts[0].value,'Before ');assert.equal(parts[2].value,' after');const token=parts[1];assert.equal(token.t,'token');
 const result=a.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'text',value:'Literal [[ notCode ]] '},{t:'keep',id:token.id},{t:'text',value:' finished'}]});assert.equal(result.ok,true,result.reason);assert.match(result.edits[0].after,/Literal &#91;&#91; notCode \]\] \[\[ first \]\] \/ \[\[ second \]\] finished/);
});

test('Vue live text rejects forged placeholders and implicit duplicate expressions but supports a preserved split',()=>{
 const r=resolve('<template><main><p><span title="Run">Before {{ count }}</span></p><div>Outside</div></main></template>'),span=adapter.describe(r).richText.children[0],token=span.children[0].parts.find(part=>part.t==='token');
 const expression=r.element.node.children[0].children.find(node=>node.type===5),marker='RTVUE'+adapter.contentHash(r.source+'|expression|'+expression.loc.start.offset).slice(0,20)+'TOKEN';
 for(const children of [[{t:'keep',id:span.id},{t:'keep',id:token.id}],[{t:'text',value:marker},{t:'keep',id:span.id}]])assert.equal(adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children}).refused,true);
 const result=adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'keep',id:span.id,children:[{t:'text',value:'Before'}]},{t:'copy',id:span.id,children:[{t:'keep',id:token.id}]}]});
 assert.equal(result.ok,true,result.reason);assert.match(result.edits[0].after,/<span title="Run">Before<\/span><span title="Run">{{ count }}<\/span>/);
});

test('Vue rich-text formatting preserves native presentation bindings and event handlers byte for byte',t=>{
 const opening='<span :class="kind" v-bind:style="appearance" :aria-label="label" @click.stop="count++" v-on:mouseenter="hover = true" @[eventName]="handler" v-on="handlers">',text='<template><main><p>Hello '+opening+'world {{ count }}</span>!</p><div>Outside</div></main></template>';
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vue-bound-run-')),file=path.join(root,'App.vue');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(file,text);
 const r={...resolve(text),file},info=adapter.describe(r);assert.equal(info.canSetChildren,true);const span=info.richText.children[1],token=span.children[0].parts.find(part=>part.t==='token'),history=new SourceHistory();
 const result=history.commit(root,adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'text',value:'Hello '},{t:'keep',id:span.id,children:[{t:'wrap',tag:'strong',children:[{t:'text',value:'people'}]},{t:'text',value:' '},{t:'keep',id:token.id}]},{t:'text',value:'!'}]}));
 assert.equal(result.ok,true,result.reason);const after=fs.readFileSync(file,'utf8');assert.ok(after.includes(opening+'<strong>people</strong> {{ count }}</span>'));assert.equal(adapter.describe(resolve(after)).canSetChildren,true);
 assert.equal(history.apply(root,'undo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),text);assert.equal(history.apply(root,'redo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),after);
 const copy=adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'copy',id:span.id,children:[{t:'keep',id:token.id}]}]});assert.equal(copy.refused,true,'splits must not drop or duplicate the bound run behavior');
});

test('Vue rich text keeps structural, marker, URL and content-changing bindings guarded',()=>{
 for(const attribute of ['v-if="show"','v-for="item in items"','v-html="content"','v-text="content"',':innerHTML="content"',':textContent="content"','v-bind="props"',':[name]="value"',':data-rt="id"',':data-rt-style="id"',':href="url"','v-model="value"','v-custom="value"']){
  const r=resolve('<template><main><p>Before <span '+attribute+'>Text</span> after</p></main></template>');assert.equal(adapter.describe(r).canSetChildren,false,attribute);
 }
});

test('Vue bound link destinations survive rich-text formatting and cannot be rewritten as literal URLs',t=>{
 for(const binding of [':href="destination"','v-bind:href="destination"','.href="destination"',':href.prop="destination"',':href.attr="destination"']){
  const text='<template><main><p>Read <a '+binding+' class="link">the docs</a> now</p></main></template>',r=resolve(text),info=adapter.describe(r);assert.equal(info.canSetChildren,true,binding);const link=info.richText.children[1];assert.equal(link.editableLink,false);assert.equal(link.plainLink,false);
  const result=adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'text',value:'Read '},{t:'keep',id:link.id,children:[{t:'wrap',tag:'strong',children:[{t:'text',value:'the guide'}]}]},{t:'text',value:' now'}]});assert.equal(result.ok,true,result.reason);assert.ok(result.edits[0].after.includes('<a '+binding+' class="link"><strong>the guide</strong></a>'));
  for(const href of ['/literal',null])assert.equal(adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'keep',id:link.id,href}]}).refused,true);
 }
 const text='<template><main><p><a href="/fallback" :href="destination">Docs</a></p></main></template>',r=resolve(text),link=adapter.describe(r).richText.children[0];assert.equal(link.editableLink,false);assert.equal(adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:[{t:'keep',id:link.id,href:'/changed'}]}).refused,true);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vue-bound-link-')),file=path.join(root,'App.vue');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(file,text);const history=new SourceHistory(),result=history.commit(root,adapter.planOp({...r,file},{type:'setChildren',fileHash:r.hash,children:[{t:'keep',id:link.id,children:[{t:'wrap',tag:'em',children:[{t:'text',value:'Guide'}]}]}]}));assert.equal(result.ok,true,result.reason);const after=fs.readFileSync(file,'utf8');assert.equal(history.apply(root,'undo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),text);assert.equal(history.apply(root,'redo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),after);
});

test('Vue comment boundaries preserve adjacent live values, nested formatting and exact history',t=>{
 const text='<script setup>const count=1</script><template><main><p>Before<!-- keep <tag> & {{ raw }} \r\n second line -->{{ count }}<em title="owned">inside<!-- nested -->tail</em><!-- final -->after</p><aside>Outside</aside></main></template>';
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-vue-comments-')),file=path.join(root,'App.vue');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(file,text);
 const r={...resolve(text),file},info=adapter.describe(r);assert.equal(info.canSetChildren,true);
 const [literal,comment,dynamic,em,last,tail]=info.richText.children;
 assert.equal(comment.t,'comment');assert.equal(last.t,'comment');assert.equal(em.children[1].t,'comment');
 const token=dynamic.parts.find(part=>part.t==='token');assert.ok(token);
 const children=[{t:'wrap',tag:'strong',children:[{t:'text',value:literal.value}]},{t:'keep',id:comment.id},{t:'keep',id:token.id},{t:'keep',id:em.id,children:[{t:'text',value:'Changed'},{t:'keep',id:em.children[1].id},{t:'text',value:' tail'}]},{t:'keep',id:last.id},{t:'text',value:tail.value}];
 const history=new SourceHistory(),result=history.commit(root,adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children}));assert.equal(result.ok,true,result.reason);
 const after=fs.readFileSync(file,'utf8');assert.match(after,/<strong>Before<\/strong><!-- keep <tag> & \{\{ raw \}\} \r\n second line -->\{\{ count \}\}<em title="owned">Changed<!-- nested --> tail<\/em><!-- final -->after/);
 assert.equal(adapter.describe(resolve(after)).canSetChildren,true);
 assert.equal(history.apply(root,'undo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),text);assert.equal(history.apply(root,'redo',result.undoId,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),after);
 for(const invalid of [[{t:'keep',id:comment.id,children:[{t:'text',value:'changed'}]}],[{t:'keep',id:comment.id},{t:'keep',id:comment.id}],[{t:'copy',id:comment.id,children:[]}]])assert.equal(adapter.planOp(r,{type:'setChildren',fileHash:r.hash,children:invalid}).refused,true);
});

test('Vue comments follow compiler whitespace normalization without changing source identities',()=>{
 const r=resolve('<template><main><p>\n  <!-- before -->\n  Hello\n  <!-- between -->\n  <em>World<!-- inside --></em>\n  <!-- after -->\n</p></main></template>');
 const info=adapter.describe(r);assert.equal(info.canSetChildren,true);
 assert.equal(info.richText.children.filter(item=>item.t==='comment').length,3);
 const preserve=adapter.create({compilerOptions:{whitespace:'preserve'}}).describe(r);assert.equal(preserve.canSetChildren,true);
 assert.deepEqual(info.richText.children.filter(item=>item.t==='comment').map(item=>item.id),preserve.richText.children.filter(item=>item.t==='comment').map(item=>item.id));
 assert.equal(info.richText.children.find(item=>item.t==='element').children[1].t,'comment');
});
