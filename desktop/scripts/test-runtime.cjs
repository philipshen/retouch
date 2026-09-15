#!/usr/bin/env node
'use strict';
// Test dependencies are installed in a disposable staging tree. Packaged files
// are never exposed to npm, and production packages always win name collisions.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {verify: verifyPackage} = require('./verify-package.cjs');
const copy = (from, to) => fs.cpSync(from, to, {recursive: true, verbatimSymlinks: true});
function inventory(root) {
  const entries = {};
  function walk(relative) {
    const file = path.join(root, relative), stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(file), resolved = fs.realpathSync(file);
      if (!resolved.startsWith(fs.realpathSync(root) + path.sep)) throw Error('External symlink: ' + relative);
      entries[relative] = {type: 'symlink', target};
    } else if (stat.isDirectory()) {
      if (relative) entries[relative] = {type: 'directory'};
      for (const name of fs.readdirSync(file).sort()) walk(relative ? relative + '/' + name : name);
    } else if (stat.isFile()) {
      entries[relative] = {type: 'file', mode: stat.mode & 0o777, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
    } else throw Error('Unsupported runtime entry: ' + relative);
  }
  walk('');
  return entries;
}
function dependencyRoots(runtime) {
  const directory = path.join(runtime, 'node_modules'), roots = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const relative = 'node_modules/' + name;
    if ((name.startsWith('@') || name === '.bin') && fs.lstatSync(path.join(runtime, relative)).isDirectory()) {
      for (const child of fs.readdirSync(path.join(runtime, relative)).sort()) roots.push(relative + '/' + child);
    } else roots.push(relative);
  }
  return roots;
}
function verifyRuntime(original, candidate) {
  const expected = inventory(original), actual = inventory(candidate), roots = dependencyRoots(original);
  for (const [name, value] of Object.entries(expected)) {
    if (JSON.stringify(actual[name]) !== JSON.stringify(value)) throw Error('Packaged runtime mismatch: ' + name);
  }
  const added = Object.keys(actual).filter(name => !Object.hasOwn(expected, name));
  for (const name of added) {
    const test = name === 'test' || name.startsWith('test/');
    const dependency = name.startsWith('node_modules/') && !roots.some(root => name === root || name.startsWith(root + '/'));
    if (!test && !dependency) throw Error('Unexpected runtime addition: ' + name);
  }
  return {packagedFiles: Object.values(expected).filter(entry => entry.type === 'file').length,
    packagedSymlinks: Object.values(expected).filter(entry => entry.type === 'symlink').length,
    addedDependencyRoots: dependencyRoots(candidate).filter(root => !roots.includes(root)),
    integrity: 'Packaged bytes, modes, symlink targets and inventories match'};
}
function prepare(original, destination, tests, install = directory => execFileSync('npm',
  ['ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund'], {cwd: directory, stdio: 'pipe'})) {
  original = fs.realpathSync(original);
  tests = fs.realpathSync(tests);
  // Resolve the existing parent to catch destinations reached through symlinks.
  destination = path.join(fs.realpathSync(path.dirname(path.resolve(destination))), path.basename(destination));
  if (destination === original || destination.startsWith(original + path.sep) || original.startsWith(destination + path.sep)) throw Error('Test destination overlaps packaged runtime');
  if (destination === tests || destination.startsWith(tests + path.sep) || tests.startsWith(destination + path.sep)) throw Error('Test destination overlaps test sources');
  if (fs.existsSync(destination)) throw Error('Test destination already exists');
  const before = JSON.stringify(inventory(original));
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-test-deps-'));
  let created = false;
  try {
    for (const name of ['package.json', 'package-lock.json']) copy(path.join(original, name), path.join(stage, name));
    install(stage);
    inventory(stage); // Refuse dependency symlinks outside the staging tree.
    fs.mkdirSync(destination); created = true;
    copy(original, destination);
    for (const root of dependencyRoots(stage)) {
      const target = path.join(destination, root);
      // lstat also recognizes dangling links; never replace any packaged entry.
      if (!fs.existsSync(target) && !fs.lstatSync(target, {throwIfNoEntry: false})) {
        fs.mkdirSync(path.dirname(target), {recursive: true});
        copy(path.join(stage, root), target);
      }
    }
    copy(tests, path.join(destination, 'test'));
    const result = verifyRuntime(original, destination);
    if (JSON.stringify(inventory(original)) !== before) throw Error('Original runtime changed during preparation');
    return result;
  } catch (error) {
    if (created) fs.rmSync(destination, {recursive: true, force: true});
    throw error;
  } finally { fs.rmSync(stage, {recursive: true, force: true}); }
}
if (require.main === module) {
  try {
    const [command, app, destination, tests] = process.argv.slice(2);
    if (!['prepare', 'verify'].includes(command) || !app || !destination || (command === 'prepare' && !tests)) throw Error('Usage: node desktop/scripts/test-runtime.cjs prepare <Retouch.app> <new-runtime-dir> <test-dir> | verify <Retouch.app> <runtime-dir>');
    const appRoot = fs.realpathSync(app);
    const target = path.join(fs.realpathSync(path.dirname(path.resolve(destination))), path.basename(destination));
    if (target === appRoot || target.startsWith(appRoot + path.sep) || appRoot.startsWith(target + path.sep)) throw Error('Test destination overlaps app bundle');
    const packageResult = verifyPackage(appRoot);
    const original = path.resolve(app, 'Contents/Resources/retouch');
    const runtime = command === 'prepare' ? prepare(original, destination, tests) : verifyRuntime(original, path.resolve(destination));
    verifyPackage(path.resolve(app));
    console.log(JSON.stringify({package: packageResult, runtime}, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {inventory, verifyRuntime, prepare};
