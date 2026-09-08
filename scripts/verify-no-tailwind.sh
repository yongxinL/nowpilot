#!/usr/bin/env bash
set -euo pipefail

if node -e "
  const pkg = require('./package.json');
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const banned = Object.keys(deps).filter((k) => /tailwind|shadcn|\@radix-ui/.test(k));
  if (banned.length) {
    console.log('FAIL: banned UI dependency found in package.json: ' + banned.join(', '));
    process.exit(1);
  }
  console.log('OK: no tailwind/shadcn/@radix-ui dependencies in package.json');
"; then
  exit 0
else
  exit 1
fi
