#!/usr/bin/env node
'use strict';
const [url, sha, requestedVersion] = process.argv.slice(2);
let version;
try { version=requestedVersion===undefined?require('./release-version.cjs').read():require('./release-version.cjs').validate(requestedVersion); } catch(error) { console.error(error.message);process.exit(1); }
if (process.argv.length>5 || !url || !/^(https:\/\/|file:\/\/)[A-Za-z0-9._~:/%+@?=&-]+$/.test(url) || !/^[a-f0-9]{64}$/.test(sha || '')) {
  console.error('Usage: node desktop/scripts/cask.cjs <immutable-zip-url> <sha256> [archive-version]'); process.exit(1);
}
process.stdout.write(`cask "retouch-studio" do
  version "${version}"
  sha256 "${sha}"
  url "${url}"
  name "Retouch"
  desc "Visual design editor for websites connected to local source"
  homepage "https://github.com/philipshen/retouch"
  depends_on formula: "node"
  depends_on macos: :ventura
  app "Retouch.app"
  zap trash: "~/Library/Preferences/design.retouch.studio.plist"
end
`);
