#!/usr/bin/env node
'use strict';
const path = require('node:path');

const [, , cmd, arg] = process.argv;

if (cmd === 'shopify') {
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
  retouch shopify <theme-dir>   Mirror a Shopify Liquid theme. Serves an
                                isolated development theme (never the live one)
                                through the local proxy, and mounts the editor
                                at http://localhost:9400/rt.

Next.js/React projects use config mode instead:
  import { withRetouch } from 'retouch/next'  in next.config, then npm run dev.
`);
  process.exit(cmd ? 1 : 0);
}
