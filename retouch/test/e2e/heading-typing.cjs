'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const json=require('../../src/json-source.cjs');
const file=path.resolve(__dirname,'../../../moses/templates/index.json'),original=fs.readFileSync(file,'utf8');
const keys=['sections','hero_BxCeEh','blocks','content','blocks','title','settings','text'];
const before=json.at(json.parse(original),keys).value;
function browser(...args){const r=JSON.parse(execFileSync(process.env.RT_AGENT_BROWSER_BIN||'npx',[...(process.env.RT_AGENT_BROWSER_BIN?[]:['-y','agent-browser']),'--session','retouch-heading-typing','--json',...args],{encoding:'utf8',timeout:60000}));assert.ok(r.success,JSON.stringify(r));return r.data.result;}
const evaluate=code=>browser('eval',code),h=`document.querySelector('iframe').contentDocument.querySelector('h1')`;
async function until(fn){for(let i=0;i<50;i++){if(fn())return;await new Promise(r=>setTimeout(r,150));}assert.fail('Condition timed out');}
(async()=>{try{
 browser('open','http://127.0.0.1:9400/rt');await until(()=>evaluate(`!!${h}`));
 const rect=evaluate(`(()=>{const r=${h}.getBoundingClientRect(),f=document.querySelector('iframe').getBoundingClientRect();return{x:r.x+f.x+30,y:r.y+f.y+18,height:r.height}})()`);
 browser('mouse','move',String(Math.round(rect.x)),String(Math.round(rect.y)));browser('mouse','down');browser('mouse','up');
 await until(()=>evaluate(`${h}.contentEditable==='true'`));
 assert.equal(evaluate(`${h}.ownerDocument.activeElement===${h}`),true);
 assert.equal(evaluate(`${h}.getBoundingClientRect().height`),rect.height,'focus preserves layout');
 assert.equal(fs.readFileSync(file,'utf8'),original,'focus does not write');
 evaluate(`(()=>{const e=${h},d=e.ownerDocument,r=d.createRange();r.selectNodeContents(e);const s=d.getSelection();s.removeAllRanges();s.addRange(r)})()`);browser('keyboard','type','Retouch typing regression');assert.equal(evaluate(`${h}.textContent.trim()`),'Retouch typing regression','native typing replaces selected text');browser('press','Enter');
 await until(()=>json.at(json.parse(fs.readFileSync(file,'utf8')),keys).value==='Retouch typing regression');
 assert.equal(fs.readFileSync(file,'utf8'),original.replace(JSON.stringify(before),JSON.stringify('Retouch typing regression')));
 await until(()=>evaluate(`${h}?.textContent.trim()==='Retouch typing regression' && !${h}.hasAttribute('contenteditable')`));
 browser('click','#undoBtn');await until(()=>fs.readFileSync(file,'utf8')===original);
 await until(()=>evaluate(`${h}?.textContent.trim()===${JSON.stringify(before)}`));
 console.log('PASS real click -> focused editor -> native typing -> exact JSON write -> rendered change -> exact undo');
}finally{browser('close');if(fs.readFileSync(file,'utf8')!==original)fs.writeFileSync(file,original);}})().catch(e=>{console.error(e);process.exitCode=1;});
