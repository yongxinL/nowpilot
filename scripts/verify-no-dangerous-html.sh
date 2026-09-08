#!/usr/bin/env bash
set -euo pipefail

if grep -rnE 'innerHTML|dangerouslySetInnerHTML' src/; then
  echo "FAIL: dangerous HTML usage (innerHTML/dangerouslySetInnerHTML) found in src/"
  exit 1
fi

echo "OK: no innerHTML/dangerouslySetInnerHTML in src/"
