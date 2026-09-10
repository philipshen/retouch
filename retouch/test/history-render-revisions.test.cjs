'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const manifest=require('../src/history-render-revisions.cjs'),react=require('../src/adapters/react.cjs'),render=require('../shell/history-render.js');
const root='/project',source='export default function Page(){return <main><h1 className="text-xl">Title</h1></main>}';
const edit=(file,before,after)=>({file:path.join(root,file),before,after}),catalog=edit('.retouch/variables.json','{}','{}');
const document=rows=>({querySelectorAll:()=>rows.map(([id,hash])=>({getAttribute:name=>name==='data-rt'?id:hash}))});
test('collection restore revisions include every source file and exclude source text and catalog data',()=>{
 const changed=source.replace('text-xl','text-2xl'),edits=[catalog,edit('Page.jsx',changed,source),edit('Other.tsx',source,changed)];
 const value=manifest(root,edits,react);assert.equal(value.groups.length,2);assert.deepEqual(value.groups.map(group=>group.hash),[react.contentHash(source),react.contentHash(changed)]);assert.equal(value.groups[0].ids.length,2);assert.ok(!JSON.stringify(value).includes('Title'));
 for(const change of [edit('Page.jsx',source,'export default function Page(){return <main/>}'),edit('Page.jsx',source,null),edit('file.css','a{}','b{}')])assert.equal(manifest(root,[catalog,change],react),null);
 assert.equal(manifest(root,[edits[1]],react),null);assert.equal(manifest(root,edits,{...react,name:'liquid'}),null);
});
test('render readiness waits for every visible source and repeated instance, and refuses missing hosts',()=>{
 const value={attribute:'data-rt-revision',groups:[{ids:['first','nested'],hash:'new-a'},{ids:['second'],hash:'new-b'},{ids:['unvisited'],hash:'new-c'}]};
 const targets=render.targets(value,document([['first','old-a'],['first','old-a'],['nested','old-a'],['second','old-b'],['unrelated','other']]));
 const ready=[['first','new-a'],['first','new-a'],['nested','new-a'],['second','new-b']];assert.equal(render.matches(targets,document(ready)),true);
 assert.equal(render.matches(targets,document([...ready,['first','old-a']])),false);
 assert.equal(render.matches(targets,document(ready.slice(0,-1))),false);
 assert.equal(render.matches(targets,document(ready.map(row=>row[0]==='second'?['second','old-b']:row))),false);
 assert.equal(render.targets(null,document([])),null);
});
