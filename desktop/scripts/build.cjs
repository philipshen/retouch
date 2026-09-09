#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync: run} = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist'));
const app = path.join(out, 'Retouch.app');
const macos = path.join(app, 'Contents/MacOS');
fs.mkdirSync(macos, {recursive:true});
fs.copyFileSync(path.join(root, 'Info.plist'), path.join(app, 'Contents/Info.plist'));
const binaries = [];
for (const arch of ['arm64', 'x86_64']) {
  const binary = path.join(out, 'Retouch-' + arch);
  run('xcrun', ['swiftc', '-O', '-target', arch + '-apple-macosx13.0', '-module-cache-path', path.join(out, 'module-cache'), path.join(root, 'Sources/Retouch.swift'), '-o', binary], {stdio:'inherit'});
  binaries.push(binary);
}
const executable = path.join(macos, 'Retouch');
run('lipo', ['-create', ...binaries, '-output', executable], {stdio:'inherit'});
const identity = process.env.RETOUCH_SIGN_IDENTITY;
run('codesign', ['--force', '--sign', identity || '-', ...(identity ? ['--options', 'runtime', '--timestamp'] : []), app], {stdio:'inherit'});
run(executable, ['--self-test'], {stdio:'inherit'});
run('codesign', ['--verify', '--strict', app], {stdio:'inherit'});
const zip = path.join(out, 'Retouch-0.1.0-mac.zip');
// ditto can append to an existing archive; remove only this generated output.
if (fs.existsSync(zip)) fs.unlinkSync(zip);
run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip], {stdio:'inherit'});
const sha = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
fs.writeFileSync(zip + '.sha256', sha + '\n');
console.log(JSON.stringify({app,zip,sha256:sha,signing:identity?'Developer ID (notarization still required)':'ad hoc development build'},null,2));
