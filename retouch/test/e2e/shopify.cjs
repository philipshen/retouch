'use strict';
// Opt-in live Moses test: requires Retouch + Shopify theme dev + dev:css.
// Browser gestures must write real source, survive a reload, and undo.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const liquid = require('../../src/adapters/liquid.cjs');
const root = path.resolve(process.env.RT_THEME_DIR || path.join(__dirname, '../../../moses'));
const file = path.join(root, 'snippets/dev-toolbar.liquid');
const original = fs.readFileSync(file, 'utf8');
const el = liquid.collect(original, 'snippets/dev-toolbar.liquid').elements.find(e => original.slice(e.childrenStart, e.childrenEnd).trim() === 'Grid');
assert.ok(el, 'Moses Grid label fixture exists');
const selector = `[data-rt="${el.id}"]`;
const base = process.env.RT_E2E_URL || 'http://127.0.0.1:9400';
function browser(...args) {
  const result = JSON.parse(execFileSync('npx', ['-y', 'agent-browser', '--session', 'retouch-shopify-e2e', '--json', ...args], { encoding: 'utf8', timeout: 60000 }));
  assert.ok(result.success, result.error);
  return result.data.result;
}
const evaluate = code => browser('eval', code);
const delay = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, message) {
  for (let i = 0; i < 40; i++) { if (await fn()) return; await delay(250); }
  assert.fail(message);
}
async function select() {
  await until(() => evaluate(`(() => {const el=document.querySelector('iframe').contentDocument?.querySelector(${JSON.stringify(selector)});if(!el)return false;if(el.hasAttribute('contenteditable'))return true;el.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));return false;})()`), 'inline editing enabled');
}
async function reload() {
  browser('open', base + '/rt');
  await until(() => evaluate(`!!document.querySelector('iframe').contentDocument?.querySelector(${JSON.stringify(selector)})`), 'same-origin stamped preview loaded');
  assert.equal(evaluate('location.pathname'), '/rt', 'about:blank never becomes a route');
}
(async () => {
  try {
    await reload();
    await select();
    evaluate(`(() => {const el=document.querySelector('iframe').contentDocument.querySelector(${JSON.stringify(selector)});el.textContent='Retouch verification';el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));})()`);
    await until(() => fs.readFileSync(file, 'utf8').includes('>Retouch verification</span>'), 'inline edit written to original Liquid');
    browser('click', '#undoBtn');
    await until(() => fs.readFileSync(file, 'utf8') === original, 'inline undo restores original source');
    console.log('PASS inline text gesture -> source -> undo');

    await reload();
    await select();
    // Commit unchanged text, then add a class through the real inspector.
    evaluate(`document.querySelector('iframe').contentDocument.querySelector(${JSON.stringify(selector)}).dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))`);
    evaluate(`document.querySelector('details.advanced').open=true`);
    browser('fill', '#addClass', 'p-[13px]');
    browser('press', 'Enter');
    await until(() => fs.readFileSync(file, 'utf8').includes('class="t-trim p-[13px]">Grid'), 'class gesture written to source');
    await until(async () => {
      const css = fs.readFileSync(path.join(root, 'assets/tailwind.css'), 'utf8');
      if (!css.includes('padding:13px')) return false;
      return evaluate(`(async()=>{const d=document.querySelector('iframe').contentDocument;const links=[...d.querySelectorAll('link[rel="stylesheet"]')];for(const link of links){if(link.href.includes('tailwind.css')){const text=await fetch(link.href).then(r=>r.text());if(text.includes('padding:13px'))return true;}}return false;})()`);
    }, 'compiled Tailwind CSS reaches the Shopify proxy');
    evaluate(`document.querySelector('iframe').contentWindow.location.reload()`);
    await until(() => evaluate(`(() => {const el=document.querySelector('iframe').contentDocument?.querySelector(${JSON.stringify(selector)});return !!el && el.ownerDocument.defaultView.getComputedStyle(el).paddingTop === '13px';})()`), 'new Tailwind style survives a real iframe reload');
    // The outer shell stays loaded so its undo stack survives.

    browser('click', '#undoBtn');
    await until(() => fs.readFileSync(file, 'utf8') === original, 'class undo restores source');
    console.log('PASS class gesture -> source -> CSS build -> proxy -> undo');
    await reload();
    assert.equal(evaluate(`document.querySelector('iframe').contentDocument.querySelector(${JSON.stringify(selector)}).textContent`), 'Grid');
    console.log('PASS reloaded Shopify preview and original source restored');
  } finally {
    if (fs.readFileSync(file, 'utf8') !== original) fs.writeFileSync(file, original);
    browser('close');
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
