'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
function doctor(root = process.cwd()) {
  root = fs.realpathSync(root);
  console.log(`Retouch ${require('../package.json').version}\nRoot: ${root}\nNode: ${process.version} (${process.execPath})`);
  console.log(`Preload: ${require.resolve('./preload.cjs')}`);
  console.log('Installation: ready');
  const local = createRequire(path.join(root, 'package.json'));
  try {
    const filename = local.resolve('next/package.json');
    const version = local(filename).version;
    console.log(`Next: ${version} (${filename})`);
    console.log(/^16\.2\.\d+$/.test(version) ? 'Automatic hook: supported release line; verified on 16.2.5' : 'Automatic hook: unsupported version; use explicit config mode');
  } catch { console.log('Next: not found at this root. For a monorepo, pass an app directory.'); }
  let vite;
  try {
    const filename = local.resolve('vite/package.json');
    vite = JSON.parse(fs.readFileSync(filename, 'utf8'));
    console.log(`Vite: ${vite.version} (${filename})`);
    if (!/^8\.\d+\.\d+(?:[-+].*)?$/.test(vite.version)) {
      console.log('Vite integration: this version is not verified; the explicit plugin requires Vite 8 (verified on 8.3.0).');
    } else {
      let react, vue, vuePlugin;
      try { react = JSON.parse(fs.readFileSync(local.resolve('react/package.json'), 'utf8')); } catch {}
      try { vue = JSON.parse(fs.readFileSync(local.resolve('vue/package.json'), 'utf8')); } catch {}
      try { vuePlugin = JSON.parse(fs.readFileSync(local.resolve('@vitejs/plugin-vue/package.json'), 'utf8')); } catch {}
      console.log(react ? `React: ${react.version}` : 'React: not found at this root.');
      console.log(vue ? `Vue: ${vue.version}` : 'Vue: not found at this root.');
      if(vue)console.log(vuePlugin ? `Vue Vite plugin: ${vuePlugin.version}; SFC text, image, tag, layer-name and responsive CSS editing is available. Computed inline styles, structural operations and linked style libraries remain incomplete.` : 'Vue setup: install @vitejs/plugin-vue and include vue() in the Vite configuration.');
      const configs = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'].map(ext => 'vite.config.' + ext).filter(file => fs.existsSync(path.join(root, file)));
      console.log(configs.length ? `Vite configuration: ${configs.join(', ')}` : 'Vite configuration: no default config file found; a custom config may be selected by the startup command.');
      console.log('Vite setup: install Retouch as a project dependency, then add retouch() from "retouch/vite" alongside your React or Vue Vite plugin, then run your usual dev command.');
      console.log('The wrapper does not inject the Vite plugin. Finding a config file does not confirm that the plugin is enabled.');
      console.log('Open the announced /rt URL. Public base paths and custom public directories are supported; keep the dev server on localhost or 127.0.0.1.');
    }
  } catch (error) {
    console.log(error.code === 'MODULE_NOT_FOUND' ? 'Vite: not found at this root.' : `Vite: could not inspect its package metadata (${error.message}).`);
  }
  console.log('Wrap the existing command: retouch -- <command> [args...]');
  console.log('Startup scripts must pass NODE_OPTIONS and RETOUCH_SESSION_* to Node children. Containers/remote hosts need Retouch inside that environment.');
}
module.exports = { doctor };
