'use strict';
// Live Moses regression: indirect strings -> original JSON/locale -> reload -> undo.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const json = require('../../src/json-source.cjs');
const root = path.resolve(process.env.RT_THEME_DIR || path.join(__dirname, '../../../moses'));
const base = process.env.RT_E2E_URL || 'http://127.0.0.1:9400';
const files = ['templates/index.json', 'locales/en.default.json', 'snippets/text-styled.liquid'];
const originals = new Map(files.map(f => [f, fs.readFileSync(path.join(root, f), 'utf8')]));
function browser(...args) {
  const result = JSON.parse(execFileSync('npx', ['-y', 'agent-browser', '--session', 'retouch-source-e2e', '--json', ...args], { encoding: 'utf8', timeout: 60000 }));
  assert.ok(result.success, JSON.stringify(result.error));
  return result.data.result;
}
const evaluate = code => browser('eval', code);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const value = (rel, keys) => json.at(json.parse(read(rel)), keys).value;
async function until(fn, message) {
  for (let i = 0; i < 40; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 250)); }
  assert.fail(message);
}
const headline = 'h1[data-rt]';
const account = 'span[data-rt-origin]';
async function open() {
  browser('open', base + '/rt');
  await until(() => evaluate(`!!document.querySelector('iframe').contentDocument?.querySelector(${JSON.stringify(headline)})`), 'headline loaded');
}
async function select(selector, text) {
  await until(() => evaluate(`(() => {const d=document.querySelector('iframe').contentDocument;const el=[...d.querySelectorAll(${JSON.stringify(selector)})].find(e=>${text ? 'e.textContent.trim()===' + JSON.stringify(text) : 'true'});if(!el)return false;if(el.hasAttribute('contenteditable'))return true;el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return false;})()`), 'source-backed text becomes editable');
}
(async () => {
  try {
    await open();
    await select(headline);
    assert.ok(evaluate(`document.querySelector('#panelBody').textContent.includes('templates/index.json')`));
    const second = evaluate(`document.querySelector('iframe').contentDocument.querySelector('h2[data-rt]').textContent.trim()`);
    const keys = ['sections', 'hero_BxCeEh', 'blocks', 'content', 'blocks', 'title', 'settings', 'text'];
    const initial = value('templates/index.json', keys);
    evaluate(`document.querySelector('iframe').contentDocument.__rtTestDocument=true`);
    evaluate(`(() => {const el=document.querySelector('iframe').contentDocument.querySelector(${JSON.stringify(headline)});el.textContent='Retouch source tracing check';el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));})()`);
    await until(() => value('templates/index.json', keys) === 'Retouch source tracing check', 'heading writes to JSON');
    assert.equal(read('templates/index.json'), originals.get('templates/index.json').replace(JSON.stringify(initial), JSON.stringify('Retouch source tracing check')));
    assert.equal(read('snippets/text-styled.liquid'), originals.get('snippets/text-styled.liquid'));
    await until(() => evaluate(`!document.querySelector('iframe').contentDocument?.__rtTestDocument && document.querySelector('iframe').contentDocument?.querySelector(${JSON.stringify(headline)})?.textContent.trim()==='Retouch source tracing check'`), 'edited JSON heading renders');
    assert.equal(evaluate(`document.querySelector('iframe').contentDocument.querySelector('h2[data-rt]').textContent.trim()`), second);
    browser('click', '#undoBtn');
    await until(() => read('templates/index.json') === originals.get('templates/index.json'), 'heading undo restores exact JSON');
    console.log('PASS dynamic-tag heading -> correct nested JSON setting; sibling unchanged; undo');

    await open();
    await select(account, 'Account');
    assert.ok(evaluate(`document.querySelector('#panelBody').textContent.includes('Shared translation: locales/en.default.json')`));
    browser('fill', '#textEdit', 'Profile');
    browser('click', '#textApply');
    await until(() => value('locales/en.default.json', ['header', 'account']) === 'Profile', 'translation writes to locale file');
    assert.equal(read('locales/en.default.json'), originals.get('locales/en.default.json').replace('"account": "Account"', '"account": "Profile"'));
    await until(() => evaluate(`Array.from(document.querySelector('iframe').contentDocument?.querySelectorAll('span[data-rt-origin]') || []).some(el=>el.textContent.trim()==='Profile')`), 'changed locale value renders in the preview');
    browser('click', '#undoBtn');
    await until(() => read('locales/en.default.json') === originals.get('locales/en.default.json'), 'locale undo restores exact file');
    console.log('PASS localized label -> locale key; shared-source disclosure; undo');

    await open();
    const rich = evaluate(`(() => {const d=document.querySelector('iframe').contentDocument;const el=[...d.querySelectorAll('div[data-rt-origin]')].find(e=>e.querySelector('p')&&e.dataset.rtBlock?.endsWith('__body'));el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return !!el;})()`);
    assert.ok(rich);
    await until(() => evaluate(`!!document.querySelector('#textEdit')?.value.startsWith('<p>')`), 'stored richtext HTML is editable in inspector');
    const originalHTML = evaluate(`document.querySelector('#textEdit').value`);
    browser('fill', '#textEdit', '<p>Retouch richtext check</p>');
    browser('click', '#textApply');
    await until(() => read('templates/index.json').includes('<p>Retouch richtext check</p>'), 'richtext writes to JSON');
    await until(() => evaluate(`document.querySelector('iframe').contentDocument?.body.textContent.includes('Retouch richtext check')`), 'changed richtext renders in the preview');
    browser('click', '#undoBtn');
    await until(() => read('templates/index.json') === originals.get('templates/index.json'), 'richtext undo restores exact JSON');
    assert.ok(originalHTML.startsWith('<p>'));
    console.log('PASS JSON richtext inspector -> stored HTML -> undo');
  } finally {
    for (const [rel, content] of originals) if (read(rel) !== content) fs.writeFileSync(path.join(root, rel), content);
    browser('close');
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
