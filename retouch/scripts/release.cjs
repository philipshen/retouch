#!/usr/bin/env node
'use strict';
// Assemble a globally installable tarball with a pinned dependency closure.
// Work in a disposable directory so release assembly cannot alter source locks.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, 'artifacts'));
fs.mkdirSync(output, { recursive: true });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-release-'));
try {
  for (const name of ['bin', 'src', 'shell', 'scripts', 'README.md', 'LICENSE', 'package.json', 'package-lock.json']) {
    fs.cpSync(path.join(root, name), path.join(temp, name), { recursive: true });
  }
  execFileSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: temp, stdio: 'inherit' });
  execFileSync('npm', ['shrinkwrap'], { cwd: temp, stdio: 'inherit' });
  execFileSync('npm', ['pack', '--pack-destination', output], { cwd: temp, stdio: 'inherit' });
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
