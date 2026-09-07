'use strict';
const http = require('node:http');
function register(root) {
  const url = new URL(process.env.RETOUCH_SESSION_URL);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') throw new Error('Retouch session must be on loopback');
  return new Promise((resolve, reject) => {
    const req = http.request(new URL('/register', url), {
      method: 'POST', headers: { authorization: `Bearer ${process.env.RETOUCH_SESSION_SECRET}`, 'content-type': 'application/json' },
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (res.statusCode !== 200) throw new Error(result.error || 'registration failed');
          resolve(result);
        } catch (err) { reject(err); }
      });
    });
    req.setTimeout(5000, () => req.destroy(new Error('Retouch session registration timed out')));
    req.on('error', reject);
    req.end(JSON.stringify({ root }));
  });
}
async function connectNext(config, root) {
  const { composeNext } = require('./next.cjs');
  const registered = await register(root);
  return composeNext(config, { appRoot: registered.root, port: registered.port });
}
module.exports = { register, connectNext };
