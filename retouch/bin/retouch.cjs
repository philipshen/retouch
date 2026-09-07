#!/usr/bin/env node
'use strict';
const path = require('node:path');

const [, , cmd, arg] = process.argv;

if (cmd === '--') {
  require('../src/session.cjs').run(arg, process.argv.slice(4)).then(
    code => { process.exitCode = code; },
    err => { console.error(`[retouch] ${err.message}`); process.exitCode = 1; }
  );
} else if (cmd === 'doctor') {
  try { require('../src/doctor.cjs').doctor(arg); }
  catch (err) { console.error(err.message); process.exitCode = 1; }
} else if (cmd === '--version' || cmd === '-v') {
  console.log(require('../package.json').version);
} else if (cmd === 'shopify') {
  const themeDir = path.resolve(arg || process.cwd());
  const extraArgs = process.argv.slice(4);
  try {
    require('../src/shopify.cjs').start({ themeDir, extraArgs });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
} else {
  console.log(`retouch — an editable mirror of your running site at /rt

Usage:
  retouch -- <command> [args]  Run your usual startup command with Retouch.
                              Local Next.js 16.2.x apps connect automatically.
  retouch -- make everything
  retouch -- npm run dev
  retouch --version
  retouch doctor [app-dir]     Inspect local toolchain and integration limits.

  retouch shopify <theme-dir>   Mirror a Shopify Liquid theme. Serves an
                                isolated development theme (never the live one)
                                through the local proxy, and mounts the editor
                                at http://localhost:9400/rt.

Optional project-pinned Next.js config mode:
  import { withRetouch } from 'retouch/next'  in next.config, then npm run dev.
`);
  process.exit(cmd && cmd !== '--help' && cmd !== '-h' ? 1 : 0);
}
