'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
function doctor(root = process.cwd()) {
  root = fs.realpathSync(root);
  console.log(`Retouch ${require('../package.json').version}\nRoot: ${root}\nNode: ${process.version} (${process.execPath})`);
  console.log(`Preload: ${require.resolve('./preload.cjs')}`);
  const local = createRequire(path.join(root, 'package.json'));
  try {
    const filename = local.resolve('next/package.json');
    const version = local(filename).version;
    console.log(`Next: ${version} (${filename})`);
    console.log(/^16\.2\.\d+$/.test(version) ? 'Automatic hook: supported release line; verified on 16.2.5' : 'Automatic hook: unsupported version; use explicit config mode');
  } catch { console.log('Next: not found at this root. For a monorepo, pass an app directory.'); }
  console.log('Wrap the existing command: retouch -- <command> [args...]');
  console.log('Startup scripts must pass NODE_OPTIONS and RETOUCH_SESSION_* to Node children. Containers/remote hosts need Retouch inside that environment.');
}
module.exports = { doctor };
