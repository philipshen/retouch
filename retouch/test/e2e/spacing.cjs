'use strict';
// Browser regression for plaintext-only's UA white-space: pre-wrap override.
// Run against a Retouch-instrumented Moses preview. No source writes expected.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const base = process.env.RT_E2E_URL || 'http://127.0.0.1:9400';
function browser(...args) {
  const r = JSON.parse(execFileSync('npx', ['-y', 'agent-browser', '--session', 'retouch-spacing-test', '--json', ...args], { encoding: 'utf8', timeout: 60000 }));
  assert.ok(r.success, JSON.stringify(r.error));
  return r.data.result;
}
const evaluate = code => browser('eval', code);
const element = `document.querySelector('iframe').contentDocument.querySelector('h1[data-rt]')`;
const measure = () => evaluate(`(() => { const e=${element}; const s=e.ownerDocument.defaultView.getComputedStyle(e);return {height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width,whiteSpace:s.whiteSpace,style:e.getAttribute('style'),text:e.textContent};})()`);
async function waitFor(code) {
  for (let i = 0; i < 20; i++) {
    if (evaluate(code)) return;
    await new Promise(r => setTimeout(r, 100));
  }
  assert.fail('Browser condition timed out: ' + code);
}
(async () => {
  try {
    browser('open', base + '/rt');
    await waitFor(`!!document.querySelector('iframe').contentDocument?.querySelector('h1[data-rt]')`);
    evaluate(`window.__spacingWrites=0; const originalFetch=window.fetch;window.fetch=(url,options)=>{if(String(url).includes('/rt/__api/op'))window.__spacingWrites++;return originalFetch(url,options);}`);
    for (const whiteSpace of [null, 'pre-line', 'pre-wrap']) {
      // The last cases verify that intentional whitespace styling is preserved.
      evaluate(`(() => {const e=${element};e.removeAttribute('style');${whiteSpace ? `e.style.setProperty('white-space', '${whiteSpace}', 'important');` : ''}})()`);
      const before = measure();
      evaluate(`${element}.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))`);
      await waitFor(`${element}.hasAttribute('contenteditable')`);
      const focused = measure();
      assert.equal(focused.height, before.height, 'focus preserves height');
      assert.equal(focused.width, before.width, 'focus preserves width');
      assert.equal(focused.whiteSpace, before.whiteSpace, 'focus preserves whitespace rules');
      assert.equal(focused.text, before.text, 'focus does not trim or rewrite text');
      const pasted = evaluate(`(() => {
        const e=${element}, d=e.ownerDocument, w=d.defaultView;
        const range=d.createRange();range.selectNodeContents(e);
        const selection=d.getSelection();selection.removeAllRanges();selection.addRange(range);
        const data=new w.DataTransfer();data.setData('text/plain','Plain pasted text');
        data.setData('text/html','<b>Rich pasted text</b>');
        e.dispatchEvent(new w.ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));
        return {text:e.textContent,markup:e.children.length};
      })()`);
      // Restore DOM before committing so this layout test never changes source.
      evaluate(`${element}.textContent=${JSON.stringify(before.text)}`);
      assert.deepEqual(pasted, {text:'Plain pasted text',markup:0}, 'paste inserts only plain text');
      evaluate(`${element}.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))`);
      await waitFor(`!${element}.hasAttribute('contenteditable')`);
      assert.deepEqual(measure(), before, 'blur restores original inline styles and layout');
      console.log(`PASS ${before.whiteSpace}: ${before.height}px before and during focus; styles restored`);
    }
    assert.equal(evaluate('window.__spacingWrites'), 0, 'focus/blur never writes to source');
  } finally { browser('close'); }
})().catch(err => { console.error(err); process.exitCode = 1; });
