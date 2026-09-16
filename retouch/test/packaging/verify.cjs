'use strict';
// Exercise an already-installed artifact without resolving source from this checkout.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
if(!process.argv[2])throw Error('Usage: node test/packaging/verify.cjs <installed-retouch-directory>');
const packageRoot=fs.realpathSync(process.argv[2]),load=require('node:module').createRequire(path.join(packageRoot,'package.json'));
for(const name of ['group-scale.js','group-scale-bootstrap.js','group-scale-legacy.json','react-group-scale-dev.jsx','react-group-scale-legacy.json'])assert.ok(fs.statSync(path.join(packageRoot,'runtime',name)).isFile(),name);
assert.equal(load('./src/installation.cjs').check(packageRoot).ready,true);
const identity=load('./src/id.cjs'),adapter=load('./src/adapters/react.cjs'),transactions=load('./src/transactions.cjs'),runtime=load('./src/react-group-scale-runtime.cjs');
assert.ok(load('./src/group-scale-runtime.cjs').script().includes('data-rt-scale-runtime'));
assert.equal(runtime.recognized(runtime.component()),true);
assert.equal(typeof load('./src/loader.cjs'),'function');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-installed-source-')),file=path.join(root,'Page.jsx'),original='export default function Page(){return <main><div className="contents" data-rt-frame="" data-rt-group=""><h1><span>First</span><em>Second</em></h1><p>Text</p></div><footer>After</footer></main>}';
try{
 fs.writeFileSync(file,original);const history=[],read=tag=>{const source=fs.readFileSync(file,'utf8'),collected=identity.collectElements(source,'Page.jsx');return {...collected,source,file,relPath:'Page.jsx',appRoot:root,hash:identity.contentHash(source),element:collected.elements.find(e=>e.node.openingElement.name.name===tag)};};
 const apply=(state,op)=>{const plan=adapter.planOp(state,{...op,fileHash:state.hash});assert.equal(plan.ok,true,plan.reason);assert.equal(transactions.applyPlan(root,plan).ok,true);history.push(plan);return plan;};
 apply(read('div'),{type:'scaleGroup',width:0,factor:1.5});apply(read('div'),{type:'scaleGroup',width:1100,factor:2});apply(read('div'),{type:'removeFrame'});const copy=apply(read('span'),{type:'duplicateElement'}),state=read('span');state.element=state.elements.find(e=>e.id===copy.createdId);apply(state,{type:'moveElement',direction:'last'});apply(read('em'),{type:'deleteElement'});
 const released=read('h1'),claim=load('./src/jsx-group-regroup.cjs').claim(released);apply(released,{type:'groupSelection',ids:claim.roots.map(e=>e.id)});apply(read('div'),{type:'scaleGroup',width:0,factor:.5});
 for(const plan of history.reverse())assert.equal(transactions.applyPlan(root,{ok:true,edits:plan.edits.map(e=>({...e,before:e.after,after:e.before}))}).ok,true);assert.equal(fs.readFileSync(file,'utf8'),original);assert.equal(fs.existsSync(path.join(root,'.retouch-group-scale.jsx')),false);
 console.log('INSTALLED RUNTIME, REACT EDIT LIFECYCLE AND EXACT UNDO PASS',packageRoot);
}finally{fs.rmSync(root,{recursive:true,force:true});}
