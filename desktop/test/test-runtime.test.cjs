'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {prepare, verifyRuntime, inventory} = require('../scripts/test-runtime.cjs');
function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-runtime-test-'));
  const original = path.join(root, 'original'), destination = path.join(root, 'runtime'), tests = path.join(root, 'tests');
  const put = (base, name, value = name) => {const file = path.join(base, name); fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, value);};
  for (const name of ['package.json', 'package-lock.json', 'src/index.cjs', 'node_modules/prod/index.js', 'node_modules/@scope/prod/index.js', 'node_modules/.package-lock.json']) put(original, name);
  put(tests, 'example.test.cjs');
  fs.mkdirSync(path.join(original, 'node_modules/.bin'));
  fs.symlinkSync('../prod/index.js', path.join(original, 'node_modules/.bin/prod'));
  const install = stage => {
    for (const name of ['node_modules/prod/index.js', 'node_modules/@scope/prod/index.js', 'node_modules/dev/index.js', 'node_modules/@scope/dev/index.js', 'node_modules/.package-lock.json']) put(stage, name, 'installed replacement');
    fs.mkdirSync(path.join(stage, 'node_modules/.bin'));
    fs.symlinkSync('../dev/index.js', path.join(stage, 'node_modules/.bin/dev'));
  };
  try {run({root, original, destination, tests, install, put});} finally {fs.rmSync(root, {recursive: true, force: true});}
}
test('production bytes and symlinks win npm collisions while scoped and executable test dependencies are added', () => fixture(({original, destination, tests, install}) => {
  const before = inventory(original), result = prepare(original, destination, tests, install);
  assert.deepEqual(inventory(original), before);
  assert.deepEqual(result.addedDependencyRoots, ['node_modules/.bin/dev', 'node_modules/@scope/dev', 'node_modules/dev']);
  assert.equal(fs.readFileSync(path.join(destination, 'node_modules/prod/index.js'), 'utf8'), 'node_modules/prod/index.js');
  assert.equal(fs.readlinkSync(path.join(destination, 'node_modules/.bin/prod')), '../prod/index.js');
  assert.equal(fs.readFileSync(path.join(destination, 'node_modules/.bin/dev'), 'utf8'), 'installed replacement');
  assert.deepEqual(verifyRuntime(original, destination), result);
}));
test('verification detects changed, missing and additional production content, modes and symlink targets', () => {
  for (const mutate of [
    (d,p) => p(d, 'node_modules/prod/index.js', 'upgraded'),
    d => fs.rmSync(path.join(d, 'src/index.cjs')),
    (d,p) => p(d, 'node_modules/prod/injected.js'),
    (d,p) => p(d, 'shell/injected.js'),
    d => fs.chmodSync(path.join(d, 'node_modules/prod/index.js'), 0o700),
    d => {fs.unlinkSync(path.join(d, 'node_modules/.bin/prod')); fs.symlinkSync('../dev/index.js', path.join(d, 'node_modules/.bin/prod'));}
  ]) fixture(({original, destination, tests, install, put}) => {
    prepare(original, destination, tests, install); mutate(destination, put);
    assert.throws(() => verifyRuntime(original, destination), /mismatch|Unexpected runtime addition/);
  });
});
test('preparation refuses existing and overlapping destinations without changing their contents', () => fixture(({original, destination, tests, install, root}) => {
  const before = inventory(original);
  for (const target of [original, path.join(original, 'new'), tests, path.join(tests, 'new'), root]) assert.throws(() => prepare(original, target, tests, install), /overlaps/);
  fs.mkdirSync(destination); fs.writeFileSync(path.join(destination, 'keep'), 'keep');
  assert.throws(() => prepare(original, destination, tests, install), /already exists/);
  assert.equal(fs.readFileSync(path.join(destination, 'keep'), 'utf8'), 'keep');
  assert.deepEqual(inventory(original), before);
}));
test('failed installation and escaping symlinks leave the original untouched and no test runtime', () => fixture(({original, destination, tests, root}) => {
  const before = inventory(original);
  assert.throws(() => prepare(original, destination, tests, () => {throw Error('offline');}), /offline/);
  assert.equal(fs.existsSync(destination), false);
  assert.throws(() => prepare(original, destination, tests, stage => fs.symlinkSync(original, path.join(stage, 'escape'))), /External symlink/);
  assert.equal(fs.existsSync(destination), false);
  assert.deepEqual(inventory(original), before);
}));
