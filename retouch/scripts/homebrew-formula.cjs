#!/usr/bin/env node
'use strict';
// Render a formula for an immutable, already-published release tarball.
// No publication or global installation is performed by this script.
const [url, sha256] = process.argv.slice(2);
const pkg = require('../package.json');
if (!url || url.includes('#{') || !/^(https:\/\/|file:\/\/)[^\s"\\]+$/.test(url) || !/^[a-f0-9]{64}$/.test(sha256 || '')) {
  console.error('Usage: node scripts/homebrew-formula.cjs <https-release-url> <sha256>');
  process.exit(1);
}
process.stdout.write(`class Retouch < Formula
  desc "Edit a local web app visually and write changes back to source"
  url "${url}"
  version "${pkg.version}"
  sha256 "${sha256}"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  test do
    assert_match "${pkg.version}", shell_output("#{bin}/retouch --version")
    (testpath/"verify.cjs").write <<~JS
      const assert = require('node:assert/strict');
      const fs = require('node:fs');
      const pkg = '#{libexec}/lib/node_modules/retouch';
      const adapter = require(pkg + '/src/adapter.cjs').getAdapter('react');
      const source = 'export default () => <h1>Hello</h1>';
      const stamp = adapter.stamp(source, process.cwd() + '/page.jsx', process.cwd());
      assert.ok(stamp.code.includes('data-rt'));
      assert.ok(adapter.collect(source, 'page.jsx').elements.length);
      assert.ok(fs.readFileSync(pkg + '/shell/index.html', 'utf8').includes('__RETOUCH_TOKEN__'));
    JS
    system "node", "verify.cjs"
    system bin/"retouch", "--", "node", "-e", "process.exit(0)"
  end
end
`);
