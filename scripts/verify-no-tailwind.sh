#!/bin/bash
# Phase 1b gate — fail if any Tailwind utility class string has crept back into
# a className= JSX attribute. Spec §0.2 forbids tailwind/shadcn/@radix-ui/framer-motion.
#
# Allowed exceptions (legitimate non-Tailwind CSS classes defined in
# src/index.css or imported CSS):
#   - message-font-small / message-font-regular / message-font-large
#   - np-fade-in / np-scale-up / np-zoom-fade-in / np-pulse / np-spin
#   - np-reveal-on-hover / np-prompt-actions
#   - chat-history-drawer / custom-scrollbar
#
# This gate is appended to `verify:phase-1` so every phase-1 test run
# proves the spec-mandated Tailwind absence.

set -e

cd "$(dirname "$0")/.."

LEAK_COUNT=$(grep -rE 'className="[^"]*\b(flex |grid |w-[0-9]|h-[0-9]|p-[0-9]|m-[0-9]|rounded-(none|sm|md|lg|xl|2xl|3xl|full)|text-(xs|sm|base|lg|xl|2xl)|bg-(white|black|zinc-|slate-|blue-|red-|emerald-|amber-)|border-(zinc-|slate-|blue-)|shadow-(xs|sm|md|lg|xl|2xl))' \
  --include="*.tsx" src/ entrypoints/ 2>&1 | wc -l | tr -d ' ')

LEAK_DYNAMIC=$(grep -rEn 'className=\{[^}]*\b(flex |grid |w-[0-9]|h-[0-9]|p-[0-9]|m-[0-9]|rounded-(none|sm|md|lg|xl|2xl|3xl|full))' \
  --include="*.tsx" src/ entrypoints/ 2>&1 | wc -l | tr -d ' ')

TOTAL=$((LEAK_COUNT + LEAK_DYNAMIC))

if [ "$TOTAL" -gt 0 ]; then
  echo "✗ Tailwind className leakage detected: $TOTAL occurrences"
  echo ""
  echo "=== Static className strings ==="
  grep -rE 'className="[^"]*\b(flex |grid |w-[0-9]|h-[0-9]|p-[0-9]|m-[0-9]|rounded-(none|sm|md|lg|xl|2xl|3xl|full)|text-(xs|sm|base|lg|xl|2xl)|bg-(white|black|zinc-|slate-|blue-|red-|emerald-|amber-)|border-(zinc-|slate-|blue-)|shadow-(xs|sm|md|lg|xl|2xl))' \
    --include="*.tsx" src/ entrypoints/ 2>&1
  echo ""
  echo "=== Dynamic className={...} strings ==="
  grep -rEn 'className=\{[^}]*\b(flex |grid |w-[0-9]|h-[0-9]|p-[0-9]|m-[0-9]|rounded-(none|sm|md|lg|xl|2xl|3xl|full))' \
    --include="*.tsx" src/ entrypoints/ 2>&1
  exit 1
fi

echo "✓ verify-no-tailwind: 0 Tailwind className strings in src/ and entrypoints/"
