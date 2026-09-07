'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {makeApp,cleanup,Index}=require('./helpers.cjs');
const components=require('../src/components.cjs');
const {parseSource}=require('../src/id.cjs');
const card=`import { helper } from './helper';\nexport function Card({ title, tone = 'quiet', ...props }) { return <article {...props} className="p-4"><h2>{title}</h2></article>; }\n`;
const page=`import { Card } from './components';\nexport default function Page() { return <main><Card title="First" tone="bright"/><Card title="Second"/></main>; }\n`;
function setup(files={}) {
  const root=fs.realpathSync(makeApp({'page.jsx':page,'components/Card.jsx':card,'components/index.ts':`export { Card } from './Card';`,'components/helper.js':'export const helper = 1;',...files}));
  const index=new Index(root);index.scanAll();
  const usage=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(r=>r.relPath==='page.jsx'&&r.element.kind==='instance');
  return {root,index,usage};
}
test('component inspection follows named barrel exports and lists definition defaults and usage props',()=>{
  const {root,usage}=setup();try{
    const c=components.describe(usage);assert.ok(c.ok,c.reason);
    assert.equal(c.file,'components/Card.jsx');assert.ok(c.definitionId);
    assert.equal(c.props.find(p=>p.name==='title').value,'"First"');
    assert.equal(c.props.find(p=>p.name==='tone').default,"'quiet'");
    assert.match(c.source,/function Card/);
  }finally{cleanup(root);}
});
test('detach copies the module alongside dependencies and changes exactly one usage',()=>{
  const {root,index,usage}=setup();try{
    const c=components.describe(usage);
    const result=components.detach(usage,{fileHash:usage.hash,definitionHash:c.hash});assert.ok(result.ok,result.reason);
    assert.equal(fs.readFileSync(path.join(root,'components/Card.jsx'),'utf8'),card);
    assert.equal(fs.readFileSync(result.createdFile,'utf8'),card);
    const updated=fs.readFileSync(usage.file,'utf8');
    assert.match(updated,/<CardDetached_[0-9a-f]+ title="First" tone="bright"/);
    assert.match(updated,/<Card title="Second"/);
    assert.match(updated,/import \{ Card as CardDetached_[0-9a-f]+ \} from "\.\/components\/Card\.retouch-[0-9a-f]+\.jsx"/);
    assert.doesNotThrow(()=>parseSource(updated));
    index.scanAll();const next=index.resolve(usage.element.id);assert.ok(next,'usage id is stable');
    assert.equal(components.describe(next).file,result.detachedFile);
  }finally{cleanup(root);}
});
test('detach validates both source hashes and never overwrites an existing copied file',()=>{
  const {root,usage}=setup();try{
    const c=components.describe(usage);
    assert.ok(components.detach(usage,{fileHash:'stale',definitionHash:c.hash}).refused);
    fs.appendFileSync(path.join(root,'components/Card.jsx'),'// external\n');
    assert.ok(components.detach(usage,{fileHash:usage.hash,definitionHash:c.hash}).refused);
    const copy=path.join(root,'components',`Card.retouch-${usage.element.id}.jsx`);fs.writeFileSync(copy,'existing');
    const fresh=components.describe(usage);
    assert.ok(components.detach(usage,{fileHash:usage.hash,definitionHash:fresh.hash}).refused);
    assert.equal(fs.readFileSync(copy,'utf8'),'existing');
    assert.equal(fs.readFileSync(usage.file,'utf8'),page);
  }finally{cleanup(root);}
});
test('default exports, configured aliases and same-file declarations resolve and detach',()=>{
  for(const files of [
    {'page.jsx':`import Card from '@/Card'; export default () => <Card title="Hi"/>;`,'tsconfig.json':`{ // local aliases\n "compilerOptions": {"paths": {"@/*": ["components/*"],},},}`,'components/Card.jsx':`export default ({title,...props}) => <article {...props}>{title}</article>;`},
    {'page.jsx':`const Card = ({title,...props}) => <article {...props}>{title}</article>; export default () => <Card title="Hi"/>;`},
    {'page.jsx':`import * as cards from './components/Card'; export default () => <cards.Card title="Hi"/>;`},
  ]){
    const {root,usage}=setup(files);try{
      const c=components.describe(usage);assert.ok(c.ok,c.reason);
      const result=components.detach(usage,{fileHash:usage.hash,definitionHash:c.hash});assert.ok(result.ok,result.reason);
      assert.doesNotThrow(()=>parseSource(fs.readFileSync(result.createdFile,'utf8')));
    }finally{cleanup(root);}
  }
});
test('unresolved packages and nested captured components explain their boundary',()=>{
  for(const source of [
    `import {Button} from 'package'; export default () => <Button/>;`,
    `export default function Page(){ const title='Local'; const Card=()=><p>{title}</p>; return <Card/>; }`,
  ]){const {root,usage}=setup({'page.jsx':source});try{assert.ok(components.describe(usage).refused);}finally{cleanup(root);}}
});

test('a failed usage write rolls back the copied module',()=>{
  const {root,usage}=setup();const rename=fs.renameSync;
  try{
    const c=components.describe(usage);
    fs.renameSync=(from,to)=>{if(to===usage.file)throw new Error('simulated write failure');return rename(from,to);};
    const result=components.detach(usage,{fileHash:usage.hash,definitionHash:c.hash});assert.ok(result.refused);
    assert.equal(fs.readFileSync(usage.file,'utf8'),page);
    assert.ok(!fs.readdirSync(path.join(root,'components')).some(n=>n.includes('.retouch-')));
  }finally{fs.renameSync=rename;cleanup(root);}
});

test('component API undo checks the copied module and new references before restoring both files',async()=>{
  const {startServer}=require('../src/server.cjs');
  const {once}=require('node:events');
  const {root,usage}=setup();const server=startServer({appRoot:root,port:0,quiet:true});await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  const shell=await(await fetch(base+'/rt')).text();const token=/__RT_TOKEN = "([a-f0-9]+)"/.exec(shell)[1];
  const headers={'x-retouch-token':token,'content-type':'application/json'};
  const post=async body=>(await fetch(base+'/rt/__api/op',{method:'POST',headers,body:JSON.stringify(body)})).json();
  try{
    assert.equal((await fetch(base+'/rt/__api/component?id='+usage.element.id)).status,401);
    const info=await(await fetch(base+'/rt/__api/component?id='+usage.element.id,{headers})).json();assert.ok(info.ok);
    const result=await post({type:'detachComponent',id:usage.element.id,fileHash:usage.hash,definitionHash:info.hash});assert.ok(result.ok,result.reason);
    const copy=path.join(root,result.detachedFile),contents=fs.readFileSync(copy,'utf8'),edited=fs.readFileSync(usage.file,'utf8');
    fs.appendFileSync(copy,'// another edit\n');
    assert.equal((await post({type:'undo',undoId:result.undoId})).ok,false);
    assert.equal(fs.readFileSync(usage.file,'utf8'),edited);
    fs.writeFileSync(copy,contents);
    const barrel=path.join(root,'another.ts');fs.writeFileSync(barrel,`export * from './${result.detachedFile}';`);
    assert.equal((await post({type:'undo',undoId:result.undoId})).ok,false);
    assert.equal(fs.readFileSync(usage.file,'utf8'),edited);fs.unlinkSync(barrel);
    const unlink=fs.unlinkSync;
    try {
      fs.unlinkSync=file=>{if(file===copy)throw new Error('simulated delete failure');return unlink(file);};
      assert.equal((await post({type:'undo',undoId:result.undoId})).ok,false);
      assert.equal(fs.readFileSync(usage.file,'utf8'),edited,'failed deletion rolls back usage restoration');
      assert.ok(fs.existsSync(copy));
    } finally { fs.unlinkSync=unlink; }
    assert.ok((await post({type:'undo',undoId:result.undoId})).ok);
    assert.equal(fs.readFileSync(usage.file,'utf8'),page);assert.equal(fs.existsSync(copy),false);
  }finally{server.retouchIndex.close();server.close();cleanup(root);}
});
