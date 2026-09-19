#!/usr/bin/env node
'use strict';
const path = require('node:path');

const [, , cmd, arg] = process.argv;

if (['--','html','capture','shopify','doctor'].includes(cmd)) {
  try { require('../src/installation.cjs').check(); }
  catch (error) { console.error('[retouch] ' + error.message); process.exit(78); }
}

if (cmd === '--') {
  require('../src/session.cjs').run(arg, process.argv.slice(4)).then(
    code => { process.exitCode = code; },
    err => { console.error(`[retouch] ${err.message}`); process.exitCode = 1; }
  );
} else if (cmd === 'capture') {
  const options=process.argv.slice(4),values={};let invalid;
  for(let i=0;i<options.length;i++){const match=/^--(out|width|height|wait)(?:=(.*))?$/.exec(options[i]);if(!match||Object.hasOwn(values,match[1])){invalid='Unknown or duplicate capture option: '+options[i];break;}const value=match[2]??options[++i];if(value===undefined||value.startsWith('--')){invalid='Missing value for --'+match[1];break;}values[match[1]]=value;}
  if(invalid){console.error('[retouch] '+invalid);process.exitCode=1;}
  else require('../src/site-capture.cjs').capture({url:arg,directory:values.out,...Object.fromEntries(['width','height','wait'].filter(key=>Object.hasOwn(values,key)).map(key=>[key,Number(values[key])]))}).then(result=>{
    console.log('Captured editable page: '+result.directory);console.log('Open with: retouch html '+JSON.stringify(result.directory));
    for(const message of [...result.limitations,...result.warnings])console.log('  '+message);
  },error=>{console.error('[retouch] '+error.message);process.exitCode=1;});
} else if (cmd === 'html') {
  try {
    const options=process.argv.slice(4),raw=options.find(v=>v.startsWith('--port='))?.slice(7) || (options.includes('--port')?options[options.indexOf('--port')+1]:undefined);
    const server=require('../src/html-site.cjs').start({root:path.resolve(arg||process.cwd()),port:raw===undefined?9400:Number(raw)});
    const stop=()=>{server.retouchIndex.close();server.closeAllConnections();server.close();};
    process.once('SIGTERM',stop);process.once('SIGINT',stop);
  } catch(err) { console.error(err.message);process.exitCode=1; }
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
  retouch html <web-directory> [--port=9400]
                              Edit literal HTML text, tags and image sources.
                              Includes source-backed CSS layout editing.
  retouch capture <url> --out <new-directory> [--width=1440] [--height=900]
                              Capture a rendered page as an editable HTML copy.
                              Optional --wait=1000 delays capture in milliseconds.
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
