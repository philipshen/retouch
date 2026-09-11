#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync: run} = require('node:child_process');
const crypto = require('node:crypto');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist'));
const app = path.join(out, 'Retouch.app');
const macos = path.join(app, 'Contents/MacOS');
fs.mkdirSync(macos, {recursive:true});
fs.copyFileSync(path.join(root, 'Info.plist'), path.join(app, 'Contents/Info.plist'));
// Install a locked, production-only CLI into app resources. Build from source
// files, never the developer's node_modules or workspace symlinks.
const resources = path.join(app, 'Contents/Resources');
const cli = path.join(resources, 'retouch');
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'retouch-desktop-cli-'));
try {
  const source = path.resolve(root, '../retouch');
  for (const name of ['bin', 'src', 'shell', 'package.json', 'package-lock.json', 'LICENSE', 'README.md']) {
    fs.cpSync(path.join(source, name), path.join(staging, name), {recursive:true});
  }
  run('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], {cwd:staging,stdio:'inherit'});
  fs.mkdirSync(resources, {recursive:true});
  fs.rmSync(cli, {recursive:true,force:true});
  fs.cpSync(staging, cli, {recursive:true,verbatimSymlinks:true});
} finally { fs.rmSync(staging, {recursive:true,force:true}); }
const binaries = [];
for (const arch of ['arm64', 'x86_64']) {
  const binary = path.join(out, 'Retouch-' + arch);
  run('xcrun', ['swiftc', '-O', '-target', arch + '-apple-macosx13.0', '-module-cache-path', path.join(out, 'module-cache'), path.join(root, 'Sources/Retouch.swift'), '-o', binary], {stdio:'inherit'});
  binaries.push(binary);
}
const executable = path.join(macos, 'Retouch');
run('lipo', ['-create', ...binaries, '-output', executable], {stdio:'inherit'});
// Bind the copied source snapshot into the signed resources. This manifest is
// an integrity receipt, not a Developer ID or notarization attestation.
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = [];
function record(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())record(file);
    else if(entry.isFile())files.push({path:path.relative(cli,file).split(path.sep).join('/'),sha256:digest(file)});
    else throw Error('Unexpected source symlink in package: '+path.relative(cli,file));
  }
}
for(const name of ['bin','src','shell'])record(path.join(cli,name));
for(const name of ['package.json','package-lock.json','LICENSE','README.md'])files.push({path:name,sha256:digest(path.join(cli,name))});
let sourceCommit=null,sourceTreeDirty=null;
try {
  sourceCommit=run('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  sourceTreeDirty=!!run('git',['status','--porcelain','--','desktop','retouch'],{cwd:path.dirname(root),encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
} catch { /* Source archives need not be Git checkouts. File hashes remain authoritative. */ }
fs.writeFileSync(path.join(resources,'build-manifest.json'),JSON.stringify({schemaVersion:1,sourceCommit,sourceTreeDirty,infoPlistSha256:digest(path.join(app,'Contents/Info.plist')),nativeSourceSha256:digest(path.join(root,'Sources/Retouch.swift')),buildScriptSha256:digest(__filename),verifierScriptSha256:digest(path.join(__dirname,'verify-package.cjs')),files},null,2)+'\n');
const identity = process.env.RETOUCH_SIGN_IDENTITY;
run('codesign', ['--force', '--sign', identity || '-', ...(identity ? ['--options', 'runtime', '--timestamp'] : []), app], {stdio:'inherit'});
const nativeTests = process.env.RETOUCH_RUN_NATIVE_TESTS === '1';
if (nativeTests) run(executable, ['--self-test', '--launch-bundled'], {stdio:'inherit'});
else console.log('SKIP native launch tests (set RETOUCH_RUN_NATIVE_TESTS=1 only when desktop launch testing is explicitly enabled)');
const verification = require('./verify-package.cjs').verify(app);
console.log(JSON.stringify({packageVerification:verification}));
const zip = path.join(out, 'Retouch-0.1.0-mac.zip');
// ditto can append to an existing archive; remove only this generated output.
if (fs.existsSync(zip)) fs.unlinkSync(zip);
run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip], {stdio:'inherit'});
const sha = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
fs.writeFileSync(zip + '.sha256', sha + '\n');
console.log(JSON.stringify({app,zip,sha256:sha,nativeSelfTests:nativeTests?'passed':'not run',signing:identity?'Developer ID (notarization still required)':'ad hoc development build'},null,2));
