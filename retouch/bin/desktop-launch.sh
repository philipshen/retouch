#!/bin/sh
# Keep the user's selected tools first, then support standard Homebrew installs
# when the app is opened from Finder without Homebrew shell configuration.
PATH="${PATH:+$PATH:}/opt/homebrew/bin:/usr/local/bin"
export PATH
exec "$@"
