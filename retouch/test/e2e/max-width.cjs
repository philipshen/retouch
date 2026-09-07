'use strict';
// Real pointer drag against Moses: preview -> one class write -> CSS -> undo.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const file=path.resolve(__dirname,'../../../moses/blocks/group.liquid');
const original=fs.readFileSync(file,'utf8');
const cssFile=path.resolve(__dirname,'../../../moses/assets/tailwind.css');
const originalCSS=fs.readFileSync(cssFile,'utf8');
const id='2bedfacbbb';
function browser(...args){const r=JSON.parse(execFileSync('npx',['-y','agent-browser','--session','retouch-max-width-e2e','--json',...args],{encoding:'utf8',timeout:60000}));assert.ok(r.success,JSON.stringify(r));return r.data.result;}
const evaluate=s=>browser('eval',s);
const el=`document.querySelector('iframe').contentDocument.querySelector('[data-rt="${id}"]')`;
async function until(code){for(let i=0;i<30;i++){if(evaluate(code))return;await new Promise(r=>setTimeout(r,100));}assert.fail(code);}
async function select(){evaluate(`${el}.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))`);await until(`!document.querySelector('.max-width-handle').hidden`);}
function rect(){return evaluate(`document.querySelector('.max-width-handle').getBoundingClientRect().toJSON()`);}
(async()=>{
 try{
  browser('open',(process.env.RT_E2E_URL||'http://127.0.0.1:9400')+'/rt');
  await until(`!!${el}`);await select();
  evaluate(`window.__widthOps=[];const f=window.fetch;window.fetch=(url,o)=>{if(String(url).endsWith('/rt/__api/op'))window.__widthOps.push(JSON.parse(o.body));return f(url,o);}`);
  const originalStyle=evaluate(`${el}.getAttribute('style')`);
  const originalClass=evaluate(`${el}.className`);
  const width=evaluate(`${el}.getBoundingClientRect().width`);
  const h=rect();
  browser('mouse','move',String(h.x+8),String(h.y+14));browser('mouse','down');
  browser('mouse','move',String(h.x+8+768-width),String(h.y+14));
  assert.match(evaluate(`document.querySelector('.max-width-popup').textContent`),/Max width · 768px · max-w-3xl/);
  assert.equal(evaluate(`${el}.getBoundingClientRect().width`),768);
  assert.equal(fs.readFileSync(file,'utf8'),original,'drag preview does not write source');
  browser('screenshot','/tmp/retouch-max-width-drag.png');
  browser('mouse','up');
  await until(`window.__widthOps.length===1`);
  assert.match(fs.readFileSync(file,'utf8'),/overflow-hidden max-w-3xl/);
  await until(`getComputedStyle(${el}).maxWidth==='768px' && !${el}.style.maxWidth`);
  assert.match(fs.readFileSync(file,'utf8'),/w-full flex-col flex-nowrap overflow-hidden max-w-3xl/);
  assert.equal(evaluate(`${el}.getAttribute('style')`),originalStyle,'temporary preview removed');
  assert.equal(evaluate(`window.__widthOps[0].type`),'setClasses');
  console.log('PASS real drag snaps to max-w-3xl, labels Max width, previews locally, and writes once');
  browser('click','#undoBtn');
  await until(`${el}.className===${JSON.stringify(originalClass)}`);
  assert.equal(fs.readFileSync(file,'utf8'),original,'undo restores exact source');
  await select();
  const next=rect();browser('mouse','move',String(next.x+8),String(next.y+14));browser('mouse','down');
  browser('mouse','move',String(next.x-250),String(next.y+14));browser('press','Escape');browser('mouse','up');
  assert.equal(evaluate(`${el}.getAttribute('style')`),originalStyle);
  assert.equal(fs.readFileSync(file,'utf8'),original,'Escape cancels without writing');
  assert.equal(evaluate('window.__widthOps.length'),2,'only save and undo write');
  console.log('PASS exact undo and Escape cancellation');
  // CSS variables and compiled custom utilities must override default scale values.
  const custom=evaluate(`(()=>{const d=${el}.ownerDocument;const style=d.createElement('style');style.textContent=':root{--container-3xl:40rem;--container-card:33rem}.max-w-special{max-width:700px}';d.head.append(style);const p=RetouchMaxWidth.points(${el});style.remove();return p;})()`);
  assert.equal(custom.find(p=>p.token==='max-w-3xl').px,640); // project theme overrides the default
  assert.equal(custom.find(p=>p.token==='max-w-card').px,528);
  assert.equal(custom.find(p=>p.token==='max-w-special').px,700);
  console.log('PASS project custom Tailwind sizes are discovered');
 }finally{
  browser('close');
  if(fs.readFileSync(file,'utf8')!==original)fs.writeFileSync(file,original);
  await new Promise(resolve=>setTimeout(resolve,700));
  if(fs.readFileSync(cssFile,'utf8')!==originalCSS)fs.writeFileSync(cssFile,originalCSS);
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
