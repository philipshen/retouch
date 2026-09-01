#!/bin/sh
# Emit the body of a standalone HTML document (everything between </head> and </html>,
# without trailing blank lines) so it can be published with Claude Code's Artifact tool,
# which wraps the content itself.
# Usage: sh scripts/artifact-body.sh docs/rfc-0001-editable-mirror.html > out.html
set -eu
sed '1,/^<\/head>$/d' "$1" | sed '$d' | sed -e :a -e '/^$/{$d;N;ba' -e '}'
