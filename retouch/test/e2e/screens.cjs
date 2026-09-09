'use strict';
// Self-contained real-browser verification of the shipped shell and viewport controller.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const shell = path.resolve(__dirname, '../../shell');
async function browser(...args) {
  const { stdout } = await exec(process.env.RT_AGENT_BROWSER_BIN || 'npx', [
    ...(process.env.RT_AGENT_BROWSER_BIN ? [] : ['-y', 'agent-browser']),
    '--session', 'retouch-screens-test', '--json', ...args,
  ], { timeout: 60000 });
  const result = JSON.parse(stdout); assert.ok(result.success, stdout); return result.data;
}
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/rt/__assets/')) {
    const file = path.basename(req.url);
    res.setHeader('content-type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
    res.end(fs.readFileSync(path.join(shell, file))); return;
  }
  res.setHeader('content-type', 'text/html');
  if (req.url === '/rt') {
    res.end(fs.readFileSync(path.join(shell, 'index.html'), 'utf8').replace('__RETOUCH_RENDERING__', '{}'));
  } else {
    res.end('<style>body{margin:0}h1{height:100vh;margin:0;background:skyblue}@media(max-width:600px){h1{background:coral}}</style><h1>Responsive preview</h1>');
  }
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    await browser('open', `http://127.0.0.1:${server.address().port}/rt`);
    const result = (await browser('eval', `(async()=>{
      const f=document.querySelector('#app'),preset=document.querySelector('#screenPreset');
      const wait=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out');};
      await wait(()=>f.contentDocument?.querySelector('h1'));
      const initial=f.contentWindow.innerWidth;
      const choose=value=>{preset.value=value;preset.dispatchEvent(new Event('change'));};
      choose('390x844');
      await wait(()=>f.contentWindow.innerWidth===390 && f.contentWindow.innerHeight===844);
      const phoneColor=f.contentWindow.getComputedStyle(f.contentDocument.querySelector('h1')).backgroundColor;
      const c=document.querySelector('#frameWrap');
      c.dispatchEvent(new WheelEvent('wheel',{deltaY:100000,bubbles:true,cancelable:true}));
      const fullScreenVisible=f.getBoundingClientRect().bottom<=c.getBoundingClientRect().bottom;
      c.scrollTop=96;
      const canvas=document.querySelector('#frameWrap');
      canvas.dispatchEvent(new WheelEvent('wheel',{ctrlKey:true,deltaY:Math.log(2)/.005,bubbles:true,cancelable:true}));
      await new Promise(r=>requestAnimationFrame(r));
      const zoomed={width:f.contentWindow.innerWidth,height:f.contentWindow.innerHeight,hero:f.contentDocument.querySelector('h1').getBoundingClientRect().height,visual:f.getBoundingClientRect().width};
      document.querySelector('#screenRotate').click();
      await wait(()=>f.contentWindow.innerWidth===844);
      const rotated=f.contentWindow.innerHeight;
      choose('1440x900');await wait(()=>f.contentWindow.innerWidth===1440);
      const desktopColor=f.contentWindow.getComputedStyle(f.contentDocument.querySelector('h1')).backgroundColor;
      const input=document.querySelector('#screenWidth');input.value='1234';input.dispatchEvent(new Event('change'));
      await wait(()=>f.contentWindow.innerWidth===1234);
      input.value='-2';input.dispatchEvent(new Event('change'));
      const invalid={width:f.contentWindow.innerWidth,valid:input.checkValidity()};
      choose('390x844');
      return {initial,fullScreenVisible,phoneColor,zoomed,rotated,desktopColor,invalid};
    })()`)).result;
    assert.equal(result.fullScreenVisible,true,'bottom of tall fixed screen is reachable');
    assert.equal(result.phoneColor, 'rgb(255, 127, 80)');
    assert.deepEqual(result.zoomed, {width:390,height:844,hero:844,visual:195});
    assert.equal(result.rotated,390);
    assert.equal(result.desktopColor,'rgb(135, 206, 235)');
    assert.deepEqual(result.invalid,{width:1234,valid:false});
    await browser('reload');
    const restored = (await browser('eval', `(async()=>{for(let i=0;i<100;i++){const f=document.querySelector('#app');if(f.contentWindow.innerWidth===390)return true;await new Promise(r=>setTimeout(r,20));}return false})()`)).result;
    assert.equal(restored,true,'screen dimensions persist across reload');
    await browser('screenshot','/tmp/retouch-screen-preview.png');
    await browser('eval', `(()=>{const p=document.querySelector('#screenPreset');p.value='fluid';p.dispatchEvent(new Event('change'));})()`);
    const fluid = (await browser('eval', `(async()=>{await new Promise(r=>requestAnimationFrame(r));return document.querySelector('#app').contentWindow.innerWidth===document.querySelector('#frameWrap').clientWidth})()`)).result;
    assert.equal(fluid,true,'fit workspace restores fluid viewport');
    console.log('PASS real media queries, exact dimensions, rotation, custom width, validation, persistence, fit workspace and zoom-independent vh');
  } finally { await browser('close').catch(()=>{}); server.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
