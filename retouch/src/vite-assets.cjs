'use strict';
const fs = require('node:fs');
const path = require('node:path');
const types = {'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.avif':'image/avif','.ico':'image/x-icon'};
// Vite inventories public files asynchronously. Serve only Retouch-generated
// uploads directly so a successful upload response means its URL is readable.
function serve(req, res, {root, publicDir, base, headers}) {
  if (!publicDir || !['GET', 'HEAD'].includes(req.method)) return false;
  const pathname = (req.url || '').split('?')[0], prefix = base + 'rt-assets/';
  if (!pathname.startsWith(prefix)) return false;
  const name = pathname.slice(prefix.length);
  if (!/^rt-[a-f0-9]{12}-[a-z0-9._-]+$/.test(name)) return false;
  try {
    const directory = fs.realpathSync(publicDir), file = fs.realpathSync(path.join(directory, 'rt-assets', name));
    if (!directory.startsWith(root + path.sep) && directory !== root || !file.startsWith(directory + path.sep) || !fs.statSync(file).isFile()) return false;
    const body = fs.readFileSync(file);
    res.writeHead(200, {...headers, 'content-type':types[path.extname(name)] || 'application/octet-stream', 'content-length':body.length, 'cache-control':'no-store', 'x-content-type-options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : body);
    return true;
  } catch { return false; }
}
module.exports = {serve};
