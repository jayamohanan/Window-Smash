#!/bin/sh
# Build the game into build/ (and window-smash-poki.zip). See tools/build.js.
set -e
cd "$(dirname "$0")"
node tools/build.js "$@"
