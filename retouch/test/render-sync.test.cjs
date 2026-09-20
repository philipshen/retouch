'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { capture, restore, reconcile, sync } = require('../shell/render-sync.js');
for(const renderer of ['vue','svelte'])test(renderer+' compiled CSS waits for both template and enabled stylesheet revisions without fetching or mutating', async () => {
  const rendering={attribute:'data-rt-revision',hash:'a'.repeat(40),selector:'[data-rt-'+renderer+'-css="1234567890"]',property:'--retouch-css-revision',value:'b'.repeat(40)};
  let actualHash='old',actualCSS='old';
  const element={getAttribute:name=>name==='data-rt'?'1234567890':actualHash};
  const sheet={disabled:true,cssRules:[{selectorText:rendering.selector,style:{getPropertyValue:()=>actualCSS}}]};
  const document={querySelectorAll:()=>[element],styleSheets:[sheet]},frame={contentDocument:document,contentWindow:{location:{href:'http://localhost/app'}}};
  const timer=setTimeout(()=>{actualHash=rendering.hash;actualCSS=rendering.value;sheet.disabled=false;},75);
  try{const result=await require('../shell/render-sync.js').syncCSS({frame,id:'1234567890',rendering,fetcher:()=>assert.fail('Compiled CSS must not fetch server-rendered HTML')});assert.equal(result.method,'compiled-styles');assert.equal(frame.contentDocument,document);}finally{clearTimeout(timer);}
});
test('compiled CSS refuses invalid receipts and a navigated preview', async () => {
  const rendering={attribute:'data-rt-revision',hash:'a'.repeat(40),selector:'[data-rt-vue-css="1234567890"]',property:'--retouch-css-revision',value:'b'.repeat(40)};
  const document={querySelectorAll:()=>[],styleSheets:[]},frame={contentDocument:document,contentWindow:{location:{href:'http://localhost/app'}}};
  await assert.rejects(require('../shell/render-sync.js').syncCSS({frame,id:'1234567890',rendering:{...rendering,value:'invalid'}}),/revision is invalid/);
  const timer=setTimeout(()=>frame.contentDocument={},25);
  try{await assert.rejects(require('../shell/render-sync.js').syncCSS({frame,id:'1234567890',rendering}),/navigated/);}finally{clearTimeout(timer);}
});
function node(tag, children = [], values = {}) {
  const attrs = new Map(Object.entries(values));
  const n = { nodeType: tag ? 1 : 3, tagName: tag?.toUpperCase(), nodeValue: tag ? null : '', childNodes: [],
    get attributes() { return [...attrs].map(([name, value]) => ({ name, value })); },
    getAttribute: name => attrs.get(name) ?? null, hasAttribute: name => attrs.has(name),
    setAttribute: (name, value) => attrs.set(name, value), removeAttribute: name => attrs.delete(name),
    insertBefore(child, before) { child.parentNode?.removeChild(child); const at = before ? this.childNodes.indexOf(before) : this.childNodes.length; this.childNodes.splice(at, 0, child); child.parentNode = this; },
    removeChild(child) { const at = this.childNodes.indexOf(child); assert.notEqual(at, -1); this.childNodes.splice(at, 1); child.parentNode = null; },
    querySelectorAll() { return []; },
  };
  if (!tag) delete n.attributes;
  children.forEach(c => n.insertBefore(c, null)); return n;
}
function text(value) { const n = node(null); n.nodeValue = value; return n; }
test('inline-edit rollback restores retained framework nodes and original nested state', () => {
  const a = text('hello '), b = text('world'), bold = node('strong', [b], { class: 'original' }), heading = node('h1', [a, bold]);
  const snapshot = capture(heading);
  heading.removeChild(a); heading.removeChild(bold);
  heading.insertBefore(node('em', [text('replacement')]), null);
  bold.setAttribute('class', 'temporary'); b.nodeValue = 'changed'; heading.setAttribute('contenteditable', 'true');
  restore(snapshot);
  assert.equal(heading.childNodes[0], a); assert.equal(heading.childNodes[1], bold); assert.equal(bold.childNodes[0], b);
  assert.equal(b.nodeValue, 'world'); assert.equal(bold.getAttribute('class'), 'original'); assert.equal(heading.hasAttribute('contenteditable'), false);
});
test('authoritative server reconciliation retains keyed node identity while reordering', () => {
  const a = node('p', [text('A')], { 'data-rt': 'a' }), b = node('p', [text('B')], { 'data-rt': 'b' });
  const parent = node('div', [a, b]);
  reconcile(parent, node('div', [node('p', [text('B new')], { 'data-rt': 'b' }), node('p', [text('A')], { 'data-rt': 'a' })]));
  assert.equal(parent.childNodes[0], b); assert.equal(parent.childNodes[1], a); assert.equal(b.childNodes[0].nodeValue, 'B new');
});
test('React waits for every live instance without fetching or navigating', async () => {
  const d = {}, values = ['new', 'old']; let polls = 0;
  const frame = { contentDocument: d, contentWindow: { location: { href: 'http://example.test/' } } };
  const result = await sync({ frame, timeout: 1000, select: current => { assert.equal(current, d); if (++polls > 1) values[1] = 'new'; return values; }, matches: value => value === 'new', fetcher: () => { throw new Error('React must use HMR'); } });
  assert.equal(result.method, 'hmr'); assert.equal(frame.contentDocument, d); assert.equal(polls, 2);
});
test('missing HMR reports stale preview without replacing the document', async () => {
  const d = {}, frame = { contentDocument: d, contentWindow: { location: { href: 'http://example.test/' } } };
  await assert.rejects(sync({ frame, timeout: 10, select: () => ['old'], matches: value => value === 'new' }), /Source saved, but the preview did not update/);
  assert.equal(frame.contentDocument, d);
});
test('Liquid reconciliation uses fetched renderer output without a document navigation', async () => {
  const live = node('h1', [text('old')], { 'data-rt': 'title' }), fresh = node('h1', [text('new')], { 'data-rt': 'title' });
  const d = { dispatchEvent() {} }, rendered = {};
  const savedParser = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString(html) { assert.equal(html, 'authoritative response'); return rendered; } };
  const frame = { contentDocument: d, contentWindow: { location: { href: 'http://example.test/' }, CustomEvent: class {} } };
  try {
    const result = await sync({ frame, serverRendered: true, select: doc => [doc === rendered ? fresh : live], matches: el => el.childNodes[0].nodeValue === 'new', fetcher: async () => ({ ok: true, text: async () => 'authoritative response' }) });
    assert.equal(result.method, 'server'); assert.equal(live.childNodes[0].nodeValue, 'new'); assert.equal(frame.contentDocument, d);
  } finally { globalThis.DOMParser = savedParser; }
});

test('superseded image refresh cannot overwrite a newer edit with a delayed response', async () => {
  const live = node('img', [], { src: 'newest.svg' }), fresh = node('img', [], { src: 'older.svg' });
  const d = { dispatchEvent() { assert.fail('superseded refresh must not dispatch'); } }, rendered = {};
  const savedParser = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString() { return rendered; } };
  const frame = { contentDocument: d, contentWindow: { location: { href: 'http://example.test/' } } };
  let active = true, release;
  const response = new Promise(resolve => { release = resolve; });
  try {
    const pending = sync({ frame, serverRendered: true, current: () => active, select: doc => [doc === rendered ? fresh : live], fetcher: () => response });
    active = false;
    release({ ok: true, text: async () => 'older response' });
    await assert.rejects(pending, /synchronizing the saved edit/);
    assert.equal(live.getAttribute('src'), 'newest.svg');
    assert.equal(frame.contentDocument, d);
  } finally { globalThis.DOMParser = savedParser; }
});
test('compiled style verification requests a source snapshot when the live revision is behind', async () => {
 const rendering={attribute:'data-rt-revision',hash:'a'.repeat(40),selector:'[data-rt-svelte-css="1234567890"]',property:'--retouch-css-revision',value:'b'.repeat(40)};
 let hash='old',css='old';const events=[];
 const document={querySelectorAll:()=>[{getAttribute:name=>name==='data-rt'?'1234567890':hash}],styleSheets:[{cssRules:[{selectorText:rendering.selector,style:{getPropertyValue:()=>css}}]}]};
 const frame={contentDocument:document,contentWindow:{location:{href:'http://localhost/'},CustomEvent:class{constructor(type){this.type=type;}},dispatchEvent(event){events.push(event.type);hash=rendering.hash;css=rendering.value;}}};
 const result=await require('../shell/render-sync.js').syncCSS({frame,id:'1234567890',rendering});assert.equal(result.method,'compiled-styles');assert.deepEqual(events,['retouch:source-sync']);
});
test('structural preview fallback requires the saved server revision before reload and verifies the new document',async()=>{
 const {recoverStructure}=require('../shell/render-sync.js'),initial={readyState:'complete',revision:'old'},fresh={readyState:'complete',revision:'saved'};let reloads=0,scroll=null;const frame={contentDocument:initial,contentWindow:{scrollX:12,scrollY:34,scrollTo:(x,y)=>scroll=[x,y],location:{href:'http://localhost/page',reload(){reloads++;frame.contentDocument=fresh;}}}},options={frame,select:d=>[d],matches:d=>d.revision==='saved',parseHTML:()=>fresh,fetcher:async()=>({ok:true,text:async()=>''})};
 await recoverStructure(options);assert.equal(reloads,1);assert.deepEqual(scroll,[12,34]);
 frame.contentDocument=initial;await assert.rejects(recoverStructure({...options,parseHTML:()=>initial}),/server has not rendered/);assert.equal(reloads,1);
});
test('structural preview fallback cancels on navigation or supersession and refuses stale reloads',async()=>{
 const {recoverStructure}=require('../shell/render-sync.js'),initial={readyState:'complete',revision:'old'},fresh={readyState:'complete',revision:'saved'};let reloads=0,active=true;const frame={contentDocument:initial,contentWindow:{scrollX:0,scrollY:0,scrollTo(){},location:{href:'http://localhost/page',reload(){reloads++;frame.contentDocument={readyState:'complete',revision:'wrong'};}}}},options={frame,select:d=>[d],matches:d=>d.revision==='saved',parseHTML:()=>fresh,current:()=>active,timeout:5,fetcher:async()=>({ok:true,text:async()=>''})};
 await assert.rejects(recoverStructure({...options,fetcher:async()=>{active=false;return {ok:true,text:async()=>''};}}),/Preview changed/);assert.equal(reloads,0);active=true;
 await assert.rejects(recoverStructure({...options,fetcher:async()=>{frame.contentWindow.location.href='http://localhost/other';return {ok:true,text:async()=>''};}}),/Preview changed/);assert.equal(reloads,0);frame.contentWindow.location.href='http://localhost/page';
 await assert.rejects(recoverStructure(options),/reloaded preview did not show/);assert.equal(reloads,1);
});
