'use strict';
// Disposable inspector fixture only. Tests real input -> source -> HMR without
// document navigation, including application state and exact undo/redo bytes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.env.RT_INSPECTOR_FIXTURE;
if (!root) throw Error('Set RT_INSPECTOR_FIXTURE to a disposable inspector fixture.');
const {chromium} = require(path.join(root, 'node_modules/playwright'));
const file = path.join(root,'app/page.jsx'), original = fs.readFileSync(file,'utf8');
const probe = path.join(root,'components/RetouchStateProbe.jsx');
if (fs.existsSync(probe)) throw Error('Refusing to overwrite an existing state probe.');
const url = process.env.RT_E2E_URL || 'http://localhost:3491';
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label) {for(let n=0;n<160;n++){if(await fn())return;await sleep(100);}throw Error('Timed out: '+label);}
(async()=>{
  const browser=await chromium.launch({headless:true});
  fs.writeFileSync(probe, `'use client';\nimport {useState} from 'react';\nexport default function Probe(){const [count,setCount]=useState(0);return <button id="state-probe" onClick={()=>setCount(count+1)}>Count {count}</button>;}`);
  fs.writeFileSync(file, `import Probe from '../components/RetouchStateProbe';\n`+original.replace('<main className="p-10">','<main className="p-10"><Probe /><section id="structure-list"><div className="p-2">Alpha</div><div className="p-4">Beta</div></section>'));
  const baseline=fs.readFileSync(file,'utf8');
  const page=await browser.newPage({viewport:{width:1320,height:1000}});
  const errors=[],ops=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',async r=>{if(r.url().endsWith('/rt/__api/op'))try{ops.push({request:r.request().postDataJSON(),response:await r.json()});}catch{}});
  const frame=page.frameLocator('#app');
  const idle=()=>page.waitForFunction(()=>document.querySelector('#panelBody').getAttribute('aria-busy')!=='true' && document.querySelector('#previewStatus').hidden);
  const read=()=>fs.readFileSync(file,'utf8');
  async function choose(selector){await frame.locator(selector).click({button:'right'});await page.getByRole('menu').waitFor();await page.keyboard.press('Escape');await idle();}
  async function undo(){await page.getByRole('button',{name:'Undo',exact:true}).click();await idle();}
  async function redo(){await page.getByRole('button',{name:'Redo',exact:true}).click();await idle();}
  try {
    await page.goto(url+'/rt');await frame.locator('#state-probe').waitFor();
    await page.getByRole('button',{name:'Edit mode',exact:true}).click();await frame.locator('#state-probe').click();
    await page.getByRole('button',{name:'Interact mode',exact:true}).click();
    await frame.locator('body').evaluate(()=>{window.__rtDocumentSentinel='same-document';});
    let navigations=0;page.on('request',r=>{if(r.resourceType()==='document' && r.frame().parentFrame()===page.mainFrame() && !r.url().startsWith('about:'))navigations++;});
    const stable=async()=>{
      assert.equal(await frame.locator('body').evaluate(()=>window.__rtDocumentSentinel),'same-document');
      assert.equal(await frame.locator('#state-probe').textContent(),'Count 1');
      assert.equal(navigations,0,'editor writes do not navigate the app iframe');
    };
    // Native typing stays native. A complete inline edit is one source step.
    await frame.locator('h1').click();await until(async()=>await frame.locator('h1').getAttribute('contenteditable')==='true','inline edit');
    await frame.locator('h1').press('ControlOrMeta+A');await page.keyboard.insertText('A calmer editing experience');await frame.locator('h1').press('Enter');
    await until(()=>read().includes('A calmer editing experience'),'text saved');await idle();await stable();
    const edited=read();await undo();assert.equal(read(),baseline);await stable();await redo();assert.equal(read(),edited);await stable();await undo();
    console.log('PASS inline typing, exact undo/redo, same document and React state');
    // Rich edits remove original text node identities in the browser. HMR must
    // own the real update after the editor restores those original nodes.
    await frame.locator('h1').click();await until(async()=>await frame.locator('h1').getAttribute('contenteditable')==='true','rich edit');
    await frame.locator('h1').press('ControlOrMeta+A');await frame.locator('h1').press('ControlOrMeta+B');await frame.locator('h1').press('Enter');
    await until(()=>read().includes('<strong>'),'rich source');await idle();await stable();await undo();assert.equal(read(),baseline);await stable();
    console.log('PASS rich text reconciliation without React commit errors or reload');
    // Right-click changes selection; context duplication, keyboard undo/redo,
    // sibling movement and deletion all mutate source, not a DOM-only clone.
    await frame.locator('#structure-list > div').first().click({button:'right'});await page.getByRole('menuitem',{name:'Duplicate',exact:false}).click();
    await until(async()=>await frame.locator('#structure-list > div').count()===3,'duplicate');await idle();const duplicated=read();await stable();
    await page.locator('#logo').click();await page.keyboard.press('ControlOrMeta+z');await idle();assert.equal(read(),baseline);
    await page.keyboard.press('ControlOrMeta+Shift+z');await idle();assert.equal(read(),duplicated);await undo();
    await choose('#structure-list > div:first-child');await page.locator('#logo').click();await page.keyboard.press('ControlOrMeta+]');await until(async()=>await frame.locator('#structure-list > div').first().textContent()==='Beta','reordered');await idle();
    assert.equal(await frame.locator('#structure-list > div').first().textContent(),'Beta');await stable();await undo();
    await choose('#structure-list > div:last-child');await page.locator('#logo').click();await page.keyboard.press('Backspace');await until(async()=>await frame.locator('#structure-list > div').count()===1,'deleted');await idle();
    assert.equal(await frame.locator('#structure-list > div').count(),1);await undo();assert.equal(read(),baseline);await stable();
    await choose('#structure-list > div:first-child');await page.locator('#logo').click();await page.keyboard.press('ControlOrMeta+c');
    await choose('#structure-list > div:last-child');await page.locator('#logo').click();await page.keyboard.press('ControlOrMeta+v');
    await until(async()=>await frame.locator('#structure-list > div').count()===3,'pasted sibling');await idle();
    assert.equal(await frame.locator('#structure-list > div').last().textContent(),'Alpha');await stable();await undo();assert.equal(read(),baseline);
    console.log('PASS context menu, duplicate, keyboard undo/redo, copy/paste, reorder and delete');
    // A held arrow is one gesture; source is saved at release, no confirmation.
    await choose('#anchor-target');await page.getByLabel('Positioning',{exact:true}).selectOption('relative');await idle();const beforeNudge=read();
    await page.locator('#logo').click();await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowRight');await page.keyboard.up('ArrowRight');
    await until(()=>read()!==beforeNudge,'nudge source');await idle();assert.match(read(),/left-\[3px\]/);const afterNudge=read();await stable();
    await undo();assert.equal(read(),beforeNudge);await redo();assert.equal(read(),afterNudge);await undo();await undo();assert.equal(read(),baseline);
    console.log('PASS held-arrow coalescing and exact gesture undo/redo');
    await choose('h1');const text=page.locator('#textEdit');await text.focus();await text.press('ControlOrMeta+A');await page.keyboard.insertText('Uncommitted native field');await text.press('ControlOrMeta+z');assert.equal(read(),baseline,'native field undo does not invoke source history');
    await page.screenshot({path:'/tmp/retouch-interaction-history.png'});
    assert.deepEqual(errors,[]);await stable();
    console.log('PASS native field undo preserved; no browser errors');
  } catch(err) {
    console.error('STATUS',await page.locator('#status').textContent(),'ERRORS',errors,'OPS',JSON.stringify(ops));
    await page.screenshot({path:'/tmp/retouch-interaction-history-failure.png'});throw err;
  } finally {fs.writeFileSync(file,original);fs.unlinkSync(probe);await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
