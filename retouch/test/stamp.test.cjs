'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { stampMod } = require('./helpers.cjs');
const { stamp } = stampMod;

const ROOT = '/app';
const file = path.join(ROOT, 'C.tsx');

test('stamps host elements with data-rt and instances with data-rt-i', () => {
  const src = `export const C = () => <div><h2>x</h2><Button>y</Button></div>;`;
  const out = stamp(src, file, ROOT);
  assert.strictEqual((out.code.match(/data-rt="/g) || []).length, 2); // div, h2
  assert.strictEqual((out.code.match(/data-rt-i="/g) || []).length, 1); // Button
});

test('never stamps a fragment', () => {
  const src = `export const C = () => <><span>x</span></>;`;
  const out = stamp(src, file, ROOT);
  assert.ok(!/<>\s*data-rt/.test(out.code));
  assert.strictEqual((out.code.match(/data-rt="/g) || []).length, 1); // span only
});

test('returns null for files with no JSX', () => {
  assert.strictEqual(stamp('export const x = 1;', file, ROOT), null);
});

test('skips node_modules', () => {
  const nm = path.join(ROOT, 'node_modules', 'pkg', 'C.tsx');
  assert.strictEqual(stamp('export const C = () => <div/>;', nm, ROOT), null);
});

test('skips non-tsx/jsx files', () => {
  assert.strictEqual(stamp('<div/>', path.join(ROOT, 'x.ts'), ROOT), null);
});

test('is idempotent on IDs: stamping twice yields the same IDs', () => {
  const src = `export const C = () => <div><h2>x</h2></div>;`;
  const a = stamp(src, file, ROOT).code.match(/data-rt="([0-9a-f]{10})"/g);
  const b = stamp(src, file, ROOT).code.match(/data-rt="([0-9a-f]{10})"/g);
  assert.deepStrictEqual(a, b);
});

test('produces a source map', () => {
  const out = stamp(`export const C = () => <div/>;`, file, ROOT);
  assert.ok(out.map && out.map.mappings);
});

test('compiled host revisions change with source while structural IDs remain stable',()=>{
 const {contentHash,collectElements}=require('../src/id.cjs'),src='export const C=()=> <svg {...props}><rect width={10}/><Icon/></svg>;',next=src.replace('10','20'),a=stamp(src,file,ROOT),b=stamp(next,file,ROOT);
 assert.equal((a.code.match(/data-rt-revision=/g)||[]).length,2);assert.ok(a.code.includes('data-rt-revision="'+contentHash(src)+'"'));assert.ok(b.code.includes('data-rt-revision="'+contentHash(next)+'"'));assert.deepEqual(a.code.match(/data-rt="[^"]+"/g),b.code.match(/data-rt="[^"]+"/g));
 const hosts=collectElements(a.code,'C.tsx').elements.filter(e=>e.kind==='host');for(const host of hosts)assert.equal(host.node.openingElement.attributes.at(-1).name.name,'data-rt-revision');assert.ok(!src.includes('data-rt-revision'));
});


test('explicitly created component roots forward instance identity only in compiled output',()=>{
 const src='export default function Page(){return <Card/>}\n/** @retouch-component */\nfunction Card(){return <article><span>Hi</span></article>}';
 const output=stamp(src,file,ROOT).code;assert.ok(output.includes('data-rt-i={arguments[0]?.["data-rt-i"]}'));assert.strictEqual((output.match(/arguments\[0\]/g)||[]).length,1);assert.ok(!src.includes('arguments[0]'));assert.doesNotThrow(()=>require('../src/id.cjs').parseSource(output));
 const unmarked=stamp(src.replace('/** @retouch-component */',''),file,ROOT).code;assert.ok(!unmarked.includes('arguments[0]'));
});
test('exported function component roots forward their incoming instance marker without changing nested hosts',()=>{
 for(const src of ['export function Card({label}){return <article><span>{label}</span></article>}','function Card(){return <article/>} export {Card as PublicCard};','export default function Card(){return <article/>}']){
  const output=stamp(src,file,ROOT).code,{elements}=require('../src/id.cjs').collectElements(output,'C.tsx'),root=elements.find(element=>element.node.openingElement.name.name==='article');assert.ok(root.node.openingElement.attributes.some(attr=>attr.name?.name==='data-rt-i'));assert.equal((output.match(/arguments\[0\]/g)||[]).length,1);assert.ok(!src.includes('data-rt-i'));const nested=elements.find(element=>element.node.openingElement.name.name==='span');if(nested)assert.equal(nested.node.openingElement.attributes.some(attr=>attr.name?.name==='data-rt-i'),false);
 }
 const existing='export function Card(){return <article data-rt-i="authored"/>}';assert.equal((stamp(existing,file,ROOT).code.match(/arguments\[0\]/g)||[]).length,0);
});
