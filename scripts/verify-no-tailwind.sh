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
# The vocabulary has two tiers, because Tailwind's display/layout/typography
# families are ordinary CSS values and ordinary domain words as well. A
# colour/number-shaped utility (`text-emerald-500`, `p-4`, `items-center`) is
# unambiguous; a bare keyword (`hidden`, `block`, `absolute`) is not.
#
# Tier 1 — unambiguous families, matched anywhere inside any literal:
#   colour/effect   text-* bg-* border-* ring-* fill-* stroke-* from-* to-*
#                   via-* divide-* outline-* decoration-* accent-* caret-*
#                   placeholder-* shadow-*
#                   → none|full|auto|white|black|transparent|current|inherit|
#                     xs|sm|base|lg|xl|`[...]`|digit|colour-50…950
#   sizing/spacing  w-* h-* p-* px-* py-* pl-* pr-* pt-* pb-* m-* mx-* my-*
#                   ml-* mr-* mt-* mb-* gap-* space-x-* space-y-* z-*
#                   opacity-* order-* min-w-* max-w-* min-h-* max-h-* size-*
#                   basis-* inset-* inset-x-* inset-y-* top-* right-* bottom-*
#                   left-* indent-* columns-* aspect-* duration-* delay-*
#                   translate-x-* translate-y-* scale-* rotate-* skew-*-
#                   line-clamp-* tab-*
#                   → auto|full|screen|px|`[...]`|digit
#   layout          items-* justify-* content-* self-* place-* grid-cols-*
#                   grid-rows-* col-span-* col-start-* col-end-* row-span-*
#                   row-start-* row-end-* overflow-* overscroll-* object-*
#                   float-* clear-* grow-* shrink-* break-*
#                   → auto|full|screen|none|normal|center|start|end|between|
#                     around|evenly|stretch|baseline|top|bottom|left|right|
#                     hidden|visible|scroll|clip|contain|cover|fill|`[...]`|digit
#   typography      whitespace-* leading-* tracking-* list-* align-*
#                   underline-offset-* → their keyword/number values, plus the
#                   bare `truncate`, `sr-only`, `not-sr-only`, `antialiased`,
#                   `no-underline`, `normal-case`
#   interaction     cursor-* select-* pointer-events-* touch-* snap-* resize-*
#                   appearance-* will-change-* transition-* animate-* ease-*
#                   backdrop-* blur-* brightness-* contrast-* drop-shadow-*
#                   grayscale-* hue-rotate-* invert-* saturate-* sepia-*
#                   origin-* perspective-*
#   shape/layout    rounded-* (none|sm|md|lg|xl|2xl|3xl|full|`[...]`)
#                   flex-* (1|auto|initial|none|row|col|wrap|nowrap|…)
#                   font-* (thin|light|normal|medium|semibold|bold|sans|serif|…)
#   variants        dark: hover: focus: active: group-hover: peer-focus: sm:
#                   md: lg: xl: 2xl: first: last: odd: even: disabled: checked: …
#   bare markers    the whole string literal is `group` or `peer`
#
# Tier 2 — bare keywords that are also legitimate CSS values, domain words or
# component props (`flex`, `grid`, `block`, `hidden`, `absolute`, `relative`,
# `fixed`, `sticky`, `inline`, `inline-block`, `inline-flex`, `contents`,
# `visible`, `invisible`, `italic`, `underline`, `uppercase`, `lowercase`,
# `capitalize`, `transition`, `shadow`, `ring`, `border`, `isolate`). A bare
# keyword is a class signal only when the literal contains it as a
# whitespace-separated token and it is **not** in one of the non-class contexts
# below (the value-context names are an explicit allow-list; `table` is
# deliberately absent because `table` is an ordinary English word that occurs in
# fixture prose):
#
#   CSS value / prop value   display: 'flex'   overflow: 'hidden'
#                            variant="block"   variant = 'inline'
#   comparison operand       gate === 'hidden'
#   union / ternary choice   'a' | 'hidden'    cond ? 'a' : 'hidden'
#
# The context check is per occurrence, not per line: `{ display: 'flex', x:
# 'hidden' }` still reports the `'hidden'`. It runs on `grep -o` matches, whose
# text carries the context the match was found in, so only the exempt occurrence
# is dropped. A match may only open on a quote whose body up to the keyword is
# made of class-name characters (`[a-z0-9_:./!-]` and spaces), so a *closing*
# quote followed by object syntax (`'var(--card)', border: '1px …'`) cannot be
# mistaken for a literal that contains a keyword.
#
# Tier 2 scans quoted literals only: JSDoc prose quotes identifiers in backticks
# (`variant` → an AntD `Tag`), and a template literal that holds a real class
# list carries an unambiguous Tier-1 token.
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
# `className={variable}` + `color: 'text-emerald-500'` shape and on each
# display/layout/typography family.
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
SIZE_FAMILY='(w|h|p|px|py|pl|pr|pt|pb|m|mx|my|ml|mr|mt|mb|gap|gap-x|gap-y|space-x|space-y|z|opacity|order|min-w|max-w|min-h|max-h|size|basis|inset|inset-x|inset-y|top|right|bottom|left|indent|columns|duration|delay|translate-x|translate-y|scale|rotate|skew-x|skew-y|line-clamp|tab)-(auto|full|screen|px|min|max|fit|none|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|\[|[0-9])'
ASPECT_FAMILY='aspect-(auto|square|video|\[)'
LAYOUT_FAMILY='(items|justify|content|self|place-items|place-content|place-self|grid-cols|grid-rows|col-span|col-start|col-end|row-span|row-start|row-end|overflow|overscroll|object|float|clear|grow|shrink|flex-grow|flex-shrink|break)-(auto|full|screen|none|normal|center|start|end|between|around|evenly|stretch|baseline|top|bottom|left|right|hidden|visible|scroll|clip|contain|cover|fill|\[|[0-9])'
TYPO_FAMILY='(whitespace|leading|tracking|list|align|underline-offset)-(normal|nowrap|pre|pre-line|pre-wrap|break-spaces|none|tight|snug|relaxed|loose|tighter|wide|wider|widest|words|all|keep|inside|outside|disc|decimal|baseline|middle|sub|super|text-top|text-bottom|\[|[0-9])|(truncate|sr-only|not-sr-only|antialiased|subpixel-antialiased|no-underline|normal-case)'
EFFECT_FAMILY='(cursor|select|pointer-events|touch|snap|resize|appearance|will-change|transition|animate|ease|backdrop|blur|brightness|contrast|drop-shadow|grayscale|hue-rotate|invert|saturate|sepia|origin|perspective)-(none|auto|default|pointer|move|text|wait|help|not-allowed|all|x|y|colors|opacity|shadow|transform|in|out|linear|center|top|bottom|left|right|spin|ping|pulse|bounce|reverse|infinite|\[|[0-9])'
SHAPE_FAMILY='rounded-(none|sm|md|lg|xl|2xl|3xl|full|\[)|flex-(1|auto|initial|none|row|col|wrap|nowrap|row-reverse|col-reverse|wrap-reverse|\[)|font-(thin|light|normal|medium|semibold|bold|extrabold|black|sans|serif|mono|\[)'
VARIANT_FAMILY='(dark|hover|focus|active|group-hover|peer-focus|sm|md|lg|xl|2xl|first|last|odd|even|disabled|checked|focus-within|focus-visible):'

UTILITY="${COLOR_FAMILY}|${SIZE_FAMILY}|${ASPECT_FAMILY}|${LAYOUT_FAMILY}|${TYPO_FAMILY}|${EFFECT_FAMILY}|${SHAPE_FAMILY}|${VARIANT_FAMILY}"

# Token boundary: not preceded by a word character, `-` or `_`.
BOUNDARY='[^A-Za-z0-9_-]'

# A Tier-1 match must sit inside a quoted string literal — at its start or after
# the boundary character.
UTILITY_PATTERN="'(${UTILITY})[^']*'|'[^']*${BOUNDARY}(${UTILITY})[^']*'|\"(${UTILITY})[^\"]*\"|\"[^\"]*${BOUNDARY}(${UTILITY})[^\"]*\"|\`(${UTILITY})[^\`]*\`|\`[^\`]*${BOUNDARY}(${UTILITY})[^\`]*\`"

# A bare utility is only a Tailwind signal when it is the whole class string.
BARE_PATTERN="[\"'\`](group|peer)[\"'\`]"

# --- Tier 2: bare keywords and their non-class contexts ----------------------
BARE_KEYWORD='(flex|grid|block|hidden|absolute|relative|fixed|sticky|static|inline|inline-block|inline-flex|inline-grid|contents|visible|invisible|italic|underline|overline|line-through|uppercase|lowercase|capitalize|transition|shadow|ring|border|isolate)'

# Names whose value is legitimately one of the bare keywords above: CSS
# properties written camelCase in inline-style objects, plus component props and
# option names (`variant="block"`).
VALUE_CONTEXT='(display|position|overflow|overflowX|overflowY|visibility|whiteSpace|textTransform|textDecoration|fontStyle|textAlign|alignItems|alignContent|alignSelf|justifyContent|flexDirection|flexWrap|flexGrow|flexShrink|flexBasis|cursor|pointerEvents|userSelect|resize|objectFit|objectPosition|listStyle|listStyleType|float|clear|verticalAlign|boxSizing|isolation|mixBlendMode|wordBreak|textOverflow|outlineStyle|borderStyle|borderWidth|borderRadius|gridTemplateColumns|gridTemplateRows|gridAutoFlow|columnGap|rowGap|aspectRatio|transitionProperty|tableLayout|writingMode|fontSmoothing|direction|unicodeBidi|appearance|variant|backing|placement|orientation|side|shape|theme|layout|trigger|arrow|state|phase|mode|kind|status|role|type|as|size|align|justify|wrap|fit|target|method)'

# A bare keyword is not a class signal when it is the value of one of those
# names, an operand of a comparison, or an alternative of a union/ternary.
NON_CLASS_CONTEXT="(${VALUE_CONTEXT})[[:space:]]*[=:][[:space:]]*\{?[[:space:]]*|(===|!==|==|!=)[[:space:]]*|\|[[:space:]]*|\?[[:space:]]*|[^A-Za-z0-9_][[:space:]]*:[[:space:]]*"

# Class-name characters only: a class list cannot contain `,`, `;`, `=`, `(` or
# a quote, so object syntax between two quotes never looks like a class string.
CLASS_CHARS='[A-Za-z0-9_:./!-]'

# The match carries the context it was found in, so the exempt occurrence can be
# dropped without dropping a sibling leak on the same line.
KEYWORD_PATTERN="(${NON_CLASS_CONTEXT})?['\"](${CLASS_CHARS}*[[:space:]])?(${BARE_KEYWORD})${BOUNDARY}"

UTILITY_LINES=$(grep -rEn "$UTILITY_PATTERN" --include="*.ts" --include="*.tsx" "$SCAN_ROOT" || true)
BARE_LINES=$(grep -rEn "$BARE_PATTERN" --include="*.ts" --include="*.tsx" "$SCAN_ROOT" || true)

KEYWORD_MATCHES=$(grep -rEon "$KEYWORD_PATTERN" --include="*.ts" --include="*.tsx" "$SCAN_ROOT" || true)
KEYWORD_LINES=''
if [ -n "$KEYWORD_MATCHES" ]; then
  KEYWORD_LINES=$(printf '%s\n' "$KEYWORD_MATCHES" | grep -vE "^[^:]+:[0-9]+:(${NON_CLASS_CONTEXT})" || true)
fi

TOTAL=0
for LINES in "$UTILITY_LINES" "$BARE_LINES" "$KEYWORD_LINES"; do
  if [ -n "$LINES" ]; then
    TOTAL=$((TOTAL + $(printf '%s\n' "$LINES" | grep -c .)))
  fi
done

if [ "$TOTAL" -gt 0 ]; then
  echo "✗ Tailwind utility strings detected: $TOTAL occurrence(s)"
  echo ""
  if [ -n "$UTILITY_LINES" ]; then
    echo "=== Utility tokens inside string literals ==="
    printf '%s\n' "$UTILITY_LINES"
    echo ""
  fi
  if [ -n "$KEYWORD_LINES" ]; then
    echo "=== Bare class keywords inside string literals ==="
    printf '%s\n' "$KEYWORD_LINES"
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
