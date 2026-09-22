#!/bin/bash
# Phase 1 gate — fail if a Tailwind utility string has crept back into `src/`.
# Spec §0.2 forbids tailwind/shadcn/@radix-ui/framer-motion.
#
# The gate scans **string values**, not `className=` attributes. A class held in
# a variable is still a live Tailwind string that an attribute-shaped pattern
# cannot see:
#
#   { name: 'ServiceNow', color: 'text-emerald-500' }   // data
#   <TagOutlined className={tag.color} />               // render site
#
# Every single-quoted, double-quoted and backtick string literal in
# `src/**/*.{ts,tsx}` is matched against the vocabulary below. A token counts
# only when it is not preceded by a word character, `-` or `_`, so a CSS custom
# property (`var(--font-sans)`) or an identifier (`fixture-wh-1`) is not a false
# positive, and `border-color` / `space-between` / `to-do` are excluded by the
# Tailwind-shaped suffix each family requires.
#
# Vocabulary (families and the suffixes they must be followed by):
#   colour/effect   text-* bg-* border-* ring-* fill-* stroke-* from-* to-*
#                   via-* divide-* outline-* decoration-* accent-* caret-*
#                   placeholder-* shadow-*
#                   → none|full|auto|white|black|transparent|current|inherit|
#                     xs|sm|base|lg|xl|`[...]`|digit|colour-50…950
#   sizing/spacing  w-* h-* p-* px-* py-* pl-* pr-* pt-* pb-* m-* mx-* my-*
#                   ml-* mr-* mt-* mb-* gap-* space-x-* space-y-* z-* opacity-*
#                   order-*
#                   → auto|full|screen|px|`[...]`|digit
#   shape/layout    rounded-* (none|sm|md|lg|xl|2xl|3xl|full|`[...]`)
#                   flex-* (1|auto|initial|none|row|col|wrap|nowrap|…)
#                   font-* (thin|light|normal|medium|semibold|bold|…)
#   variants        dark: hover: focus: active: group-hover: peer-focus: sm:
#                   md: lg: xl: 2xl:
#   bare tokens     the whole string literal is `group` or `peer`
#
# Legitimate non-Tailwind class names (`np-fade-in`, `np-scale-up`,
# `message-font-small`, `chat-history-drawer`, `custom-scrollbar`, …) are not
# Tailwind vocabulary and are not matched, so no allow-list is needed.
#
# Scope: string literals in `src/**/*.{ts,tsx}` only. `src/index.css` and the
# entrypoint HTML are not read by this gate and are not claimed to be.
#
# Usage: `bash scripts/verify-no-tailwind.sh [scan-root]` — the optional root
# exists so `tests/isolation/no-tailwind-gate.test.ts` can run the real gate
# against a fixture tree and prove it still fails on the
# `className={variable}` + `color: 'text-emerald-500'` shape.
#
# This gate is appended to `verify:phase-1` so every phase-1 test run proves the
# spec-mandated Tailwind absence.

set -e

cd "$(dirname "$0")/.."

SCAN_ROOT="${1:-src}"

# A missing scan target must be a loud failure, never a silent pass: the gate
# must not report success for a path it did not read.
if [ ! -d "$SCAN_ROOT" ]; then
  echo "✗ verify-no-tailwind: $SCAN_ROOT does not exist — refusing to report a false pass"
  exit 1
fi

COLOR_FAMILY='(text|bg|border|ring|fill|stroke|from|to|via|divide|outline|decoration|accent|caret|placeholder|shadow)-(none|full|auto|white|black|transparent|current|inherit|xs|sm|base|lg|xl|\[|[0-9]|[a-z]+-(50|100|200|300|400|500|600|700|800|900|950))'
SIZE_FAMILY='(w|h|p|px|py|pl|pr|pt|pb|m|mx|my|ml|mr|mt|mb|gap|space-x|space-y|z|opacity|order)-(auto|full|screen|px|\[|[0-9])'
SHAPE_FAMILY='rounded-(none|sm|md|lg|xl|2xl|3xl|full|\[)|flex-(1|auto|initial|none|row|col|wrap|nowrap|row-reverse|col-reverse|wrap-reverse)|font-(thin|light|normal|medium|semibold|bold|extrabold|black|\[)'
VARIANT_FAMILY='(dark|hover|focus|active|group-hover|peer-focus|sm|md|lg|xl|2xl):'

UTILITY="${COLOR_FAMILY}|${SIZE_FAMILY}|${SHAPE_FAMILY}|${VARIANT_FAMILY}"

# Token boundary: not preceded by a word character, `-` or `_`.
BOUNDARY='[^A-Za-z0-9_-]'

# A match must sit inside a quoted string literal — at its start or after the
# boundary character.
UTILITY_PATTERN="'(${UTILITY})[^']*'|'[^']*${BOUNDARY}(${UTILITY})[^']*'|\"(${UTILITY})[^\"]*\"|\"[^\"]*${BOUNDARY}(${UTILITY})[^\"]*\"|\`(${UTILITY})[^\`]*\`|\`[^\`]*${BOUNDARY}(${UTILITY})[^\`]*\`"

# A bare utility is only a Tailwind signal when it is the whole class string.
BARE_PATTERN="[\"'\`](group|peer)[\"'\`]"

UTILITY_LINES=$(grep -rEn "$UTILITY_PATTERN" --include="*.ts" --include="*.tsx" "$SCAN_ROOT" || true)
BARE_LINES=$(grep -rEn "$BARE_PATTERN" --include="*.ts" --include="*.tsx" "$SCAN_ROOT" || true)

TOTAL=0
if [ -n "$UTILITY_LINES" ]; then
  TOTAL=$((TOTAL + $(printf '%s\n' "$UTILITY_LINES" | grep -c .)))
fi
if [ -n "$BARE_LINES" ]; then
  TOTAL=$((TOTAL + $(printf '%s\n' "$BARE_LINES" | grep -c .)))
fi

if [ "$TOTAL" -gt 0 ]; then
  echo "✗ Tailwind utility strings detected: $TOTAL occurrence(s)"
  echo ""
  if [ -n "$UTILITY_LINES" ]; then
    echo "=== Utility tokens inside string literals ==="
    printf '%s\n' "$UTILITY_LINES"
    echo ""
  fi
  if [ -n "$BARE_LINES" ]; then
    echo "=== Bare group/peer class strings ==="
    printf '%s\n' "$BARE_LINES"
    echo ""
  fi
  exit 1
fi

echo "✓ verify-no-tailwind: 0 Tailwind utility strings in $SCAN_ROOT (string-literal scan)"
