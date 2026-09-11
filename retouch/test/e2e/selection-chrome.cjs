'use strict';
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
function browser(...args){const r=JSON.parse(execFileSync(process.env.RT_AGENT_BROWSER_BIN||'npx',[...(process.env.RT_AGENT_BROWSER_BIN?[]:['-y','agent-browser']),'--session','retouch-selection-test','--json',...args],{encoding:'utf8',timeout:60000}));assert.ok(r.success,JSON.stringify(r));return r.data.result;}
(async()=>{try{
 browser('open','http://127.0.0.1:9400/rt');
 const result=browser('eval',`(async()=>{
  const wait=async f=>{for(let i=0;i<100;i++){if(f())return;await new Promise(r=>setTimeout(r,100));}throw Error('UI timed out');};
  await wait(()=>document.querySelector('iframe').contentDocument.querySelector('h1'));
  const d=document.querySelector('iframe').contentDocument,h=d.querySelector('h1');
  const inline=d.querySelector('[data-rt-i="a50053884c"]');
  const one=await classifyNode(inline);
  if(one.instanceId!==null || one.info.kind!=='host')throw Error('Single usage still treated as a component');
  const text=await classifyNode(h);
  if(text.info.kind!=='host'||!text.info.textLeaf)throw Error('Standalone text was classified as a component');
  await select(h);await new Promise(r=>requestAnimationFrame(r));
  if(!document.querySelector('.component-badge').hidden)throw Error('Standalone text has a component badge');
  clearSelection();h.dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));
  await wait(()=>hoverDescription(h)?.textLeaf);
  await new Promise(r=>requestAnimationFrame(r));
  if(!document.querySelector('.component-badge').hidden)throw Error('Hover labels standalone text as a component');
  // An explicit request for the shared renderer still exposes component scope.
  const shared=await api('GET',resolveUrl(h.dataset.rtI,renderContext(h)));
  hoverEl=null;
  sel={hostId:h.dataset.rt,instanceId:h.dataset.rtI,scope:'instance',info:shared.element};
  renderPanel();await wait(()=>!document.querySelector('.component-badge').hidden);
  const badge=document.querySelector('.component-badge'),button=badge.querySelector('button');
  if(badge.querySelector('span').textContent!==(shared.element.tag||'Component')||button.title!=='detach')throw Error('Incorrect component badge');
  if(document.querySelector('.tagchip'))throw Error('Old source label remains');
  const purple=getComputedStyle(document.querySelector('.box.instance')).borderColor;
  drawBox(inline,'sel','editable');const blue=getComputedStyle(overlayLayer.lastChild).borderColor;
  drawBox(inline,'sel','readonly');const red=getComputedStyle(overlayLayer.lastChild).borderColor;
  const original=detachInstance;let detached=null;
  detachInstance=async(id,component,button,context)=>{detached={id,context};};
  try{button.click();await wait(()=>detached);}finally{detachInstance=original;}
  if(detached.id!==h.dataset.rtI)throw Error('Detach targeted the wrong component');
  const cursors=Object.fromEntries([...document.querySelectorAll('.max-width-edge')].map(e=>[e.dataset.edge,getComputedStyle(e).cursor]));
  return {inlineFile:one.info.file,purple,blue,red,cursors};
 })()`);
 assert.equal(result.purple,'rgb(181, 138, 255)');assert.equal(result.blue,'rgb(77, 163, 238)');assert.equal(result.red,'rgb(224, 113, 107)');
 assert.deepEqual(result.cursors,{left:'ew-resize',right:'ew-resize',top:'ns-resize',bottom:'ns-resize'});
 console.log('PASS standalone text has no component badge on selection or hover; single-use Liquid source selection, component badge and detach target, three outline colors, and directional cursors');
}finally{browser('close');}})().catch(e=>{console.error(e);process.exitCode=1;});
