#!/usr/bin/env node
'use strict';
const [url, sha] = process.argv.slice(2);
if (!url || !/^(https:\/\/|file:\/\/)[A-Za-z0-9._~:/%+@?=&-]+$/.test(url) || !/^[a-f0-9]{64}$/.test(sha || '')) {
  console.error('Usage: node desktop/scripts/cask.cjs <immutable-zip-url> <sha256>'); process.exit(1);
}
process.stdout.write(`cask "retouch-studio" do
  version "0.1.0"
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
