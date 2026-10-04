#!/bin/sh
# "Free some space" script with a bug: it also matches src/generated.
set -e
rm -rf build dist .cache
find . -name 'generated' -type d -prune -exec rm -rf {} +
find . -name '*.map' -delete
