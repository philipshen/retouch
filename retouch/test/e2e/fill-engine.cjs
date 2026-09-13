'use strict';
// Isolate browser sizing from the editor, source adapters, and generated CSS.
// Unsupported engines must fail this gate; do not turn their result into a skip.
const assert = require('node:assert/strict');
const path = require('node:path');
const fixture = process.env.RT_INSPECTOR_FIXTURE;
if (!fixture) throw Error('Set RT_INSPECTOR_FIXTURE to a Playwright installation');
const engine = process.env.RT_E2E_BROWSER || 'chromium';

(async () => {
  const browser = await require(process.env.RT_E2E_PLAYWRIGHT_ROOT || path.join(fixture, 'node_modules/playwright'))[engine].launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="parent"><div id="child">Text</div></div>');
    const results = await page.evaluate(() => {
      const parent = document.querySelector('#parent'), child = document.querySelector('#child');
      const results = [];
      for (const writingMode of ['horizontal-tb', 'vertical-rl', 'vertical-lr']) {
        for (const display of ['flow-root', 'flex', 'grid']) {
          for (const boxSizing of ['content-box', 'border-box']) {
            for (const axis of ['width', 'height']) {
              for (const size of [180, 260]) {
                parent.style.cssText = `display:${display};writing-mode:${writingMode};width:${size}px;height:${size}px;padding:11px;border:3px solid;box-sizing:content-box`;
                child.style.cssText = `box-sizing:${boxSizing};width:60px;height:60px;min-width:0;min-height:0;margin:5px;padding:10px;border:2px solid`;
                const inline = writingMode === 'horizontal-tb' ? 'width' : 'height';
                if (display === 'flow-root') {
                  child.style.setProperty(axis, '-webkit-fill-available');
                  // Mirrors the fallback-first cascade emitted by Retouch.
                  if (CSS.supports(axis, 'stretch')) child.style.setProperty(axis, 'stretch');
                } else {
                  child.style.setProperty(axis, 'auto');
                  if (display === 'flex' && axis === inline) child.style.flex = '1';
                  else child.style.setProperty(display === 'grid' && axis === inline ? 'justify-self' : 'align-self', 'stretch');
                }
                const actual = child.getBoundingClientRect()[axis];
                results.push({writingMode, display, boxSizing, axis, size, expected:size - 10, actual});
              }
            }
          }
        }
      }
      return {stretch:CSS.supports('height', 'stretch'), cases:results};
    });
    const failures = results.cases.filter(row => Math.abs(row.actual - row.expected) > 0.1);
    console.log(JSON.stringify({engine, version:browser.version(), stretch:results.stretch,
      total:results.cases.length, passed:results.cases.length - failures.length, failures}, null, 2));
    assert.equal(failures.length, 0, 'Fill must fit the margin box at both parent sizes');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
