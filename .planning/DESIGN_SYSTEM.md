# NowPilot — Design System & Visual Language (Companion)

> **Document ID:** `NOWPILOT_DESIGN_SYSTEM.md`
> **Status:** Design companion to `PRODUCT_SPEC_v0_1.md` (the implementation contract). This document owns **visual language, brand, layout blueprints, and theming aesthetics**. Where the two ever disagree on a *functional rule*, the product spec wins.
> **Date:** 2026-08-02
> **Applies to:** WXT + React 19 + Ant Design v6 (pure CSS-variable theming) + Ant Design X 2.x.
> **RICH alignment:** Responsive · Intuitive · Consistent · Human-centric (the visual expression of the RICH requirements in spec §17.7).

---

## 1. Purpose & Boundary

This doc keeps the product spec a lean, unambiguous implementation contract for cost-effective coding models, while the *look and feel* lives here where designers and richer models can iterate freely.

**In scope:** brand identity, mascot, colour system + token mapping, typography, spacing/radius/elevation, theme packs, light/dark, layout blueprints (Side Panel focused-chat / Standalone view workspace / Notes / Options / dialogs), component styling recipes, iconography, motion, RICH visual patterns, accessibility.

**Out of scope (see product spec):** state machines, storage, Zod schemas, agent orchestration, permissions, phase plan.

**Golden rule:** every colour, radius, and elevation is an **Ant Design v6 design token**. We never hard-code hex in components; we set tokens once and let v6's CSS-variable engine cascade them, so real-time theme switching (no remount) works across both surfaces.

---

## 2. Two Surfaces — Feature Split (authoritative)

NowPilot has two surfaces sharing one workspace. **The Side Panel is deliberately minimal; the Standalone view is the full workspace.**

| Capability | **Side Panel** (~400 px) | **Standalone view** (standalone) |
|---|---|---|
| **Chat** | ✅ the *only* surface | ✅ |
| Note (+LLM-Wiki) | ❌ | ✅ |
| Write | ❌ | ✅ |
| Tools | ❌ | ✅ |
| TeamGQM (optional) | ❌ | ✅ (optional, flag-gated) |
| Options / Settings | ❌ (opens Standalone view) | ✅ |
| Chat history | ✅ bottom sheet (§8.4) | ✅ right drawer (§8.5) |

- **Side Panel = Chat only.** No left nav rail, no mode switcher, no Note/Write/Tools. It is a single focused conversation surface (Ask-Gemini style, §8.1). Anything heavier hands off to the Standalone view via **Switch to Full chat**.
- **Standalone view = workspace.** A persistent left **Sider** lists **Chat · Note · Write · Tools** (and **TeamGQM** when enabled). This is where notes, writing, tools, options, and deep work live (§8.2).

> This supersedes the earlier "relocate modes into a New-chat switcher" idea: modes are **not** in the Side Panel at all — they live in the Standalone Sider.

---

## 3. Brand Identity

### 3.1 Product personality
NowPilot is a **calm, capable co-pilot** for support engineers — precise, privacy-first, quietly confident, never noisy. Visual language is **modern, warm, premium-SaaS**: soft neutrals, one confident blue, generous whitespace, restrained motion. A well-made cockpit instrument, not a toy.

Adjective anchors: *trustworthy · focused · friendly-but-professional · effortless · light*.

### 3.2 Logo & wordmark
- **Wordmark:** "NowPilot", weight 600, tight tracking. Two-tone lockup optional ("Now" `colorText`, "Pilot" `colorPrimary`).
- **App mark:** rounded-square **"N" avatar** (`borderRadius` 12) on a `colorPrimary`→`colorPrimaryBg` gradient; 28 px in headers.
- **Clear space:** ≥ ½ the mark's height. **Don'ts:** no wordmark shadow, no gradient text, no rotation/stretch.

---

## 4. Mascot — "Q-Octo"

A **Q-version (chibi) octopus pilot** — an approachable "knowledge co-pilot / digital memory keeper." Many arms = many tools/tabs handled at once.

### 4.1 Form language
- **Head:** large rounded dome (≈60% head / 40% body).
- **Eyes:** two large glossy eyes, single highlight each; calm default.
- **Cap:** **white pilot/aviator cap** with a small `colorPrimary` band — signature accessory. **No headset** (reads call-center, not co-pilot).
- **Arms:** 6–8 simplified tentacles; 1–2 may hold props (note card, spark).
- **Palette:** body bright blue (`colorPrimary` family), cap white, soft warm blush cheeks.

### 4.2 Expression set (RICH-R states, spec §17.7)
| State | Expression |
|---|---|
| Idle / welcome | Calm smile, eyes forward |
| Thinking / working | Eyes up, one arm to "chin", subtle spark |
| Success | Bright eyes, small cheer, one arm raised |
| Humble error | Slightly sheepish, one arm scratching cap |
| Empty state | Relaxed, holding a blank note card |

### 4.3 Usage & deliverables
Full body on onboarding (Flow 9, RICH-R-03); head-only (24–28 px) on brand headers; contextual prop on empty states. Never animates during streaming. Export **SVG** artboards `mascot/{full,head,thinking,success,error,empty}`, transparent master, low path count for crisp 16–28 px.

---

## 5. Typography

| Role | Face | Notes |
|---|---|---|
| UI / body | **Inter** (system-ui, -apple-system, Segoe UI, Roboto) | Excellent at 400 px |
| Display / wordmark | **Inter** 600–700, tight tracking | One family; weight carries hierarchy |
| Mono / code | **JetBrains Mono** (ui-monospace, SFMono, Menlo) | Code, macros, IDs |

Scale: Side Panel base **13 px** (compact); Standalone view base **14 px**. Steps 12/13/14/16/20/24/30; line-height 1.5 body, 1.3 headings. Never below 12 px; captions `colorTextTertiary`.

---

## 6. Colour System

### 6.1 Principles
One confident blue accent; everything else neutral. Semantic colours only for meaning. Warm neutrals for a premium feel. **Token-first** — values below are seed tokens; AntD v6 derives the 10-step palettes + CSS variables.

### 6.2 Seed tokens (Default theme)

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `colorPrimary` | `#3B82F6` | `#5B9BFF` | Brand blue / actions |
| `colorSuccess` | `#10B981` | `#34D399` | Confirmations |
| `colorWarning` | `#F59E0B` | `#FBBF24` | Caution |
| `colorError` | `#EF4444` | `#F87171` | Errors / destructive |
| `colorInfo` | `#3B82F6` | `#5B9BFF` | Info (tracks primary) |
| `colorTextBase` | `#1F2430` | `#E6E8ED` | Body text |
| `colorBgBase` | `#FCFCFD` | `#0E1117` | App background |
| `colorBgContainer` | `#FFFFFF` | `#161A22` | Cards, bubbles, inputs |
| `colorBorder` | `#E7E9EE` | `#252B36` | Dividers, outlines |

> Dark base is a **blue-tinted near-black** (`#0E1117`), softer than pure black — "cockpit at night."

### 6.3 Assistant vs user bubble (X `Bubble`)
- **Assistant:** `variant="filled"`, `colorBgContainer`, radius 12, 1 px `colorBorder`, left; prefixed by a small **⚡ model-id label** in `colorTextTertiary`.
- **User:** `colorPrimaryBg` (light) / `colorPrimary` @18% (dark), right.
- **Streaming tail:** X `Bubble streaming` caret in `colorPrimary` @60% — never a spinner.

### 6.4 Display Mode & Theme Packs (user-facing in v0.1)

Two **independent** appearance controls ship in v0.1 (Options → General → Appearance, §8.6):

**A. Display mode** — colour scheme: `Auto | Light | Dark`. "Auto" follows `prefers-color-scheme`. Drives `theme.darkAlgorithm` vs `theme.defaultAlgorithm`. Persists in `chrome.storage.sync.np_theme` (spec §17.1a) and applies live to **both** surfaces via `chrome.storage.onChanged` (no reload, no remount — antd v6 CSS variables).

**B. Theme pack** — the visual token overlay: `Default | Liquid Glass | Claude Warm`. Persists in `chrome.storage.sync.np_theme_pack` and cascades the same way. Every pack works in **both** Light and Dark and must pass the §12 AA contrast checks in all four combinations before shipping.

Display mode × theme pack are orthogonal (3 × 3 = 9 valid appearances). Both are seeded once through `getAntdConfig({ mode, pack, compact })` and applied through the single provider per surface (spec §5.5).

#### 6.4.1 Default pack
Clean premium SaaS: white containers, warm-neutral page, single blue accent, `E1`/`E2` shadows, radius 8/12. Baseline both surfaces render.

#### 6.4.2 Liquid Glass pack
Translucent, layered aesthetic (best on Standalone view panes).
- Frosted containers: `colorBgContainer` at 60–72% alpha + `backdrop-filter: blur(20px) saturate(140%)` + a 1 px inner top highlight (`rgba(255,255,255,.5)` light / `rgba(255,255,255,.06)` dark).
- Elevation shifts from drop-shadow to layered translucency + hairline borders.
- **Guardrails:** chat/message **text always sits on a solid surface** (glass is for chrome/panels, not paragraphs); provide a non-glass fallback when `backdrop-filter` is unsupported; honour `prefers-reduced-transparency`.

#### 6.4.3 Claude Warm pack
Warmer, paper-like reading mode (best on Notes / "Ask your notes").
- Page base warms to ivory (`#FAF7F2` light / `#1A1714` dark); primary may warm toward terracotta while semantic colours stay intact.
- Larger reading measure, slightly taller line-height for long RAG answers.

---

## 7. Spacing, Radius, Elevation

- **Spacing (px):** 2·4·8·12·16·20·24·32 (`sizeUnit` = 4). Compact leans 8/12; standalone view 16/20.
- **Radius:** base 8; cards/bubbles/panels 12; pills/chips 999.
- **Elevation:** `E0` flat · `E1` card `0 1px 2px rgba(16,24,40,.06)` · `E2` popover `0 4px 12px rgba(16,24,40,.10)` · `E3` modal/drawer `0 12px 32px rgba(16,24,40,.16)`. Dark: lean on hairline `colorBorder` + lower-opacity shadow.

---

## 8. Layout Blueprints

Two surfaces, one workspace. This section gives the visual grid; the spec owns behaviour.

### 8.1 Side Panel — "Focused Chat" (Ask-Gemini style, ≈400 px, compact)

A single, uninterrupted chat surface. **No side nav rail.** Three stacked zones: **header**, **conversation**, **composer block** (toolbar → input → status bar).

```
┌─────────────────────────────────────────────┐
│ (N) NowPilot                    ⚙   ⤢        │  a) HEADER (~52px)
├─────────────────────────────────────────────┤     name+logo (L) · Options · Switch to Full chat (R)
│                              ┌──────────┐   │
│                              │    Hi    │   │  b) CONVERSATION (fills, scrolls)
│                              └──────────┘   │     user bubble — right, colorPrimaryBg
│  ⚡ gemma-4-2b-it-4bit                        │     model label on assistant turn
│  Assistant markdown streams here …           │
│  ⧉  ⤢  ↻  ❝  ⤴  🔊                            │     per-message action toolbar
│  ┌────────────────────────────────────────┐ │
│  │ Suggested follow-up question            │ │     follow-up chips (RICH-C-05)
│  └────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ ⚡ gemma-4-2b-it ▾      ✂   📎   🕘      ▢    │  c) COMPOSER TOOLBAR (above input)
│ ┌─────────────────────────────────────────┐ │     model selector (L) · snip · attach ·
│ │ Ask anything, @ models, / prompts    ▷  │ │        history · New chat (R)
│ └─────────────────────────────────────────┘ │  d) INPUT (send inside, bottom-right)
│ OpenAI                              ⓘ   ✉   │  e) STATUS BAR (provider L · help · feedback R)
└─────────────────────────────────────────────┘
```

- **8.1a Header (~52 px):** left = "N" mark + **NowPilot**; right = exactly two icons: **Options** (`SettingOutlined`) and **Switch to Full chat** (`ExpandAltOutlined`, hands off via Flow 11). No provider chip, no nav.
- **8.1b Conversation:** fills/scrolls, `overflow-anchor:none` tail. User right; assistant left with ⚡ model label; per-message toolbar (Copy · Expand · Regenerate · Quote/save-note · Share · Read-aloud, 16 px). Follow-up chips below. Empty state = centred Q-Octo + welcome cards (RICH-I-01).
- **8.1c Composer toolbar (above input, space-between):** left = **model selector** `⚡ gemma-4-2b-it… ▾` (the only model control here); right = **Screenshot/snip** ✂ · **Attach** 📎 · **Chat history** 🕘 · **New chat** ▢.
- **8.1d Input:** radius 12, `colorBgContainer`, focus ring `colorPrimary` @30%; placeholder "Ask anything, @ models, / prompts"; **send button inside**, bottom-right, circular, `colorPrimary` when non-empty.
- **8.1e Status bar:** caption row; left = active **provider name** (e.g. "OpenAI", `colorError` on failure); right = **Help** (`QuestionCircleOutlined`) + **Feedback** (`MailOutlined`), 14 px.

### 8.2 Standalone view — "Workspace" (default density)

Persistent left Sider is the surface switcher; content area is per-page.

```
┌───────────┬──────────────────────────────────────────────┐
│ (N)NowPilot ✕│                                            │  top: logo + collapse (‹›)
│  ─────────  │           <active page content>            │
│  ▣ Chat     │   Chat · Note · Write · Tools               │  Sider items (Standalone view only)
│  ▤ Note     │   (TeamGQM optional)                        │
│  ✎ Write    │                                             │
│  🧰 Tools    │                                             │
│  ─────────  │                                             │
│  (⌘K)  ⚙ 👤 │                                             │  footer: search · settings · profile
└───────────┴──────────────────────────────────────────────┘
```

- Sider ~240 px, collapsible to icon-only via the top collapse chevron. Active item uses `colorPrimaryBg` pill + `colorPrimary` text/icon (see the Note screenshot).
- Footer: profile avatar, settings gear, `⌘K` hint.
- **Chat page** in Standalone view reuses the §8.1 composer/bubble recipes at default density; **Chat history** opens as a **right drawer** here (§8.5), not a bottom sheet.
- Min viewport 1024 px → below shows an `Alert` (spec §17.2).

### 8.3 Notes page — **4-column workspace** (Standalone view only)

Four independently collapsible columns: **Directory · Notes · Note content · Inspector**. A top header hosts search, the three toggle buttons, and note actions.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔎 Search notes, tags, or content…  ⌘K   [▢ Directory][≣ Notes][ⓘ Inspector]   │  HEADER
│                                                          + New Note  Import  Backup│
├───────────────┬───────────────────┬───────────────────────────┬──────────────┤
│ DIRECTORY   « │ ServiceNow/Incident▾│ INC Lifecycle Flow …      │ INSPECTOR  » │
│ (col 1)       │ 🔽 ↕ ▦  «          │  Edit  Share  ⋮           │ (col 4)      │
│ All Notes 128 │ ┌───────────────┐  │  Created/Updated · tags + │ ✨ AI Summary │
│ Recently Upd  │ │ Note card ★   │  │  ┌── formatting toolbar ─┐│  … Regenerate│
│ Favorites   8 │ │ snippet…      │  │  │ Body▾ ↶↷ B I <> ≣ ▦ ⛓ ⯐│ │──────────────│
│ Uncategorized │ │ tags   10m ago│  │  └───────────────────────┘│ ⓘ Note Details│
│ ▾ Work KB   3 │ ├───────────────┤  │  # Heading                │  Word Count   │
│   ▸ ServiceN24│ │ Note card     │  │  <body: text, diagrams,   │  Read Time    │
│     Incident12│ │ …             │  │   callouts, tables>       │  Created      │
│   Technical 32│ └───────────────┘  │                           │  Links / Backl│
│ … TAGS …      │ Total 5 notes      │                           │ Quick Actions │
│ #ServiceNow36 │                    │                           │  Copy Link    │
│ #Incident  22 │                    │                           │  Export MD/PDF│
│ (col 2 list)  │                    │  (col 3 editor/viewer)    │  Move to…     │
└───────────────┴───────────────────┴───────────────────────────┴──────────────┘
```

**Column definitions**
1. **Directory (col 1):** folder tree — All Notes (with count), Recently Updated, Favorites, Uncategorized, then category hierarchy (e.g. Work Knowledge Base ▸ ServiceNow ▸ Incident/Problem/Change), plus a **TAGS** list with counts and "More tags…". Header `DIRECTORY` + collapse `«`.
2. **Notes (col 2):** the note **list** for the current scope. Breadcrumb + `▾` scope selector, filter/sort/grid icons, collapse `«`. Cards: title + star, 2-line snippet clamp, tag chips, relative timestamp. Footer "Total N notes".
3. **Note content (col 3):** the note **editor/viewer**. Title + star, **Edit / Share / ⋮**. Created/Updated + tag chips (+add). Formatting toolbar (`Body▾`, undo/redo, **B** *I* `<>`, bullet/number lists, table, checkbox, link, image). Body renders headings, diagrams, callouts, tables via `XMarkdown`. Wikilinks + unresolved-link styling per spec §27.7a.
4. **Inspector (col 4):** **AI Summary** card (with **Regenerate**, LLM-WIKI-03/04) → **Note Details** (Word Count, Est. Read Time, Created, Last Modified, **Links Count**, **Backlinks**) → **Quick Actions** (Copy Link, Export as Markdown, Export as PDF, Move to…). Header `INSPECTOR` + collapse `»`.

**Show/hide behaviour (NOTES-COL-01…03)**
- **NOTES-COL-01** The header carries three **toggle buttons — Directory · Notes · Inspector** (segmented, `colorPrimary` when active) that show/hide columns 1, 2, and 4 respectively. Column 3 (Note content) is the persistent centre and cannot be hidden.
- **NOTES-COL-02** Each collapsible column also has an inline **collapse chevron** in its own header (`«` for left columns, `»` for the Inspector) as a second affordance; toggling it stays in sync with the header buttons.
- **NOTES-COL-03** Collapsed columns animate width→0 (150–200 ms) and the centre editor reflows to fill. State persists per surface. At narrow Standalone widths, auto-collapse Directory first, then Inspector, keeping Notes + content.

### 8.4 Chat history — **bottom sheet** (Side Panel)

Triggered by the 🕘 **Chat history** icon in the composer toolbar (§8.1c). A **bottom sheet slides up** over a dimmed conversation.

```
        (conversation dimmed behind, E-overlay scrim)
┌─────────────────────────────────────────────┐
│ Chat history (1)                        ✕    │  title + count · close
│ All   Starred                          🗑     │  tabs (underline active) · clear/delete
│ 🔎 Search                                     │  search field
│ Today                                         │  date group label
│ ┌─────────────────────────────────────────┐ │
│ │ Hi                              …    ☆    │ │  item: title · overflow menu · star
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```
- Slides from the **bottom**; rounded top corners (radius 16), `E3`, drag-down or ✕ to dismiss; tap scrim to close.
- **All / Starred** tabs (underline active), trash icon = clear history. Search filters. Items grouped by day ("Today", "Yesterday", dates); each item shows title, `…` overflow (rename/delete/star), and a star toggle. Tapping loads the conversation.

### 8.5 Chat history — **right drawer** (Standalone view)

Same content model, but a **right-side drawer slides in** over a dimmed canvas; the left Sider stays visible.

```
┌───────────┬───────────────────────────┬──────────────────────────┐
│  Sider    │  (canvas dimmed)          │ Chat history (1)      ✕   │
│  (visible)│                           │ All   Starred        🗑    │
│           │                           │ 🔎 Search                 │
│           │                           │ Today                     │
│           │                           │ ┌──────────────────────┐  │
│           │                           │ │ Hi           …   ☆   │  │
│           │                           │ └──────────────────────┘  │
└───────────┴───────────────────────────┴──────────────────────────┘
```
- Slides from the **right**, ~360–400 px, `E3`, scrim over the content area (not the Sider). Identical tabs/search/grouping/item affordances as §8.4. Consistent behaviour, surface-appropriate motion (bottom vs right).

### 8.6 Options / Settings (Standalone view)

A settings shell: **left settings menu** + **card-based right content**.

```
┌───────────────┬──────────────────────────────────────────────────┐
│ (N) NowPilot  │  Account                                          │
│ ▣ General     │  ┌──────────────────────────────────────────────┐ │
│ ⇄ Translate   │  │ (U) George Li · email             [Log out]  │ │
│ ✎ Prompts     │  └──────────────────────────────────────────────┘ │
│ ─────────     │  AI access                                        │
│ ? Help Center↗│  ┌──────────────────────────────────────────────┐ │
│               │  │ Service provider           [Custom API Key ▾]│ │
│               │  │ "API key stored locally, never sent elsewhere"│ │
│               │  │ ┌ OpenAI      Set up ┐ ┌ Google (Gemini) Set up┐│ │
│               │  │ ┌ Ollama      Set up ┐ ┌ Anthropic(Claude)Set up┐│ │
│               │  └──────────────────────────────────────────────┘ │
│               │  Appearance                                       │
│               │  ┌ Display mode ……………………… [Auto ▾] ┐             │
│               │  │ Theme …………………………………… [Liquid Glass ▾] │        │
│               │  └───────────────────────────────────┘            │
│               │  Display language [English ▾]                     │
│               │  Font size for message [Auto ▾]                   │
│               │  Side panel position (browser setting) ↗          │
└───────────────┴──────────────────────────────────────────────────┘
```

- **Left menu:** General (default), Translate, Prompts, then a divided **Help Center ↗** (external). Active item = `colorPrimaryBg` pill. *(The product spec defines additional Options sections — Providers, Models, MCP, Memory, Diagnostics, Notes, Persona, Import/Export, Feature Flags, Add-on Settings — which live under this same shell; General is the concrete visual example here.)*
- **Account card:** avatar, name, email, **Log out**.
- **AI access card:** **Service provider** select (e.g. "Custom API Key"), the privacy line *"Your API key is stored locally in your browser and is never sent elsewhere,"* and a **2×2 provider grid** (OpenAI, Google (Gemini), Ollama, Anthropic (Claude)) each with a **Set up** link that opens the provider dialog (§8.7).
- **Appearance card:** **Display mode** (Auto/Light/Dark → spec §17.1a APPR) and **Theme** (pack selector: Default / **Liquid Glass** / Claude Warm → §6.4 theme packs). Then **Display language**, **Font size for message**, and **Side panel position** (Chrome-114+ browser setting, external ↗).
- Cards: `colorBgContainer`, radius 12, `E1`, generous 20 px padding, hairline dividers between rows.

### 8.7 Provider configuration dialog (modal)

Opened by **Set up** on a provider card. A centred `Modal` (`E3`, radius 16).

```
┌───────────────────────────────────────────┐
│ OpenAI                                 ✕   │
│ API key                                    │
│ [ Enter your API key                  👁 ] │
│ API proxy URL (optional)            ( ○— ) │  toggle to reveal proxy field
│ Check connection                           │
│ "Check if your API key and proxy … valid." │  [ Check ]
│ ──────────────────────────────────────────│
│ Model list (3 models available)  ↻ Update list  + │
│ ┌ gemma-4-2b-it-4bit ……………………………… ( —● ) ┐ │  per-model enable toggle
│ ┌ gpt-4o ………………………………………………………… ( ○— ) ┐ │
│ ┌ gpt-4o-mini ………………………………………………… ( ○— ) ┐ │
│                          [ Cancel ] [ Save ]│
└───────────────────────────────────────────┘
```

- **Title** = provider name + ✕ close.
- **API key:** password input with **eye toggle** (`EyeInvisibleOutlined`/`EyeOutlined`); stored AES-encrypted per spec §15.2 — the field never shows the stored key in plaintext on reload.
- **API proxy URL (optional):** a `Switch`; when on, reveals a URL input for a custom base/proxy endpoint (maps to `ProviderConfig.customBaseURL`, spec §10.3).
- **Check connection:** helper text + **Check** button → validates key/proxy (`validateConfig`), shows success/error inline (`colorSuccess`/`colorError`).
- **Model list:** count label + **↻ Update list** (refetch models, `getModels`) + **+** (add a **custom model** id). Each row = model id + **enable/disable `Switch`**. Enabled models appear in the composer model selector.
- **Footer:** **Cancel** (ghost) / **Save** (primary). Save persists `ProviderConfigSchema` (spec §10.3).

---

## 9. Component Styling Recipes

Styled via AntD tokens + `XProvider` config (spec §5.5). Never inline hex.

- **Standalone Sider:** items 40 px, radius 8; active = `colorPrimaryBg` pill + `colorPrimary` icon/text; collapse chevron top-right; footer avatar/gear/`⌘K`.
- **Side-panel header:** hairline bar, `colorBgContainer`, no shadow; left mark+wordmark; right two 20 px icon buttons (Options, Switch to Full chat).
- **Bubble (X):** radius 12, `variant="filled"`; assistant prefixed by ⚡ model label; code blocks JetBrains Mono on `colorFillTertiary` with inline **Copy** / **Save as macro** (RICH-H-04, clipboard-only insert in v0.1).
- **Per-message toolbar:** 16 px icons (Copy · Expand · Regenerate · Quote · Share · Read-aloud), `colorTextSecondary`→hover `colorPrimary`, 8 px gaps.
- **Model selector:** left-aligned pill, ⚡ + truncated id + chevron; opens searchable `Select`/`Dropdown` of provider→models (`colorBgElevated`, `E2`); full id in tooltip.
- **Composer toolbar icons:** 18 px, evenly spaced, space-between vs the model selector.
- **Sender / input (X):** pill radius 12; send inside bottom-right, circular, `colorPrimary` when non-empty; slash overlay = `colorBgElevated` popover, `E2`.
- **Status bar:** caption row; provider name left (turns `colorError` on failure), Help + Feedback right (14 px).
- **Notes columns:** each column header = uppercase label + collapse chevron; header segmented toggles (Directory/Notes/Inspector) `colorPrimary` when active; note cards `E1`, radius 12, hover `E2`; Inspector cards stacked with 16 px gaps.
- **Bottom sheet / right drawer (chat history):** `E3`, radius 16 (top for sheet, left edge for drawer); scrim `rgba(16,24,40,.45)`; **All/Starred** underline tabs; day-grouped list; item = title + `…` overflow + star toggle.
- **Settings cards:** `colorBgContainer`, radius 12, `E1`, 20 px padding, hairline row dividers; **Set up** and section actions in `colorPrimary` text.
- **Provider dialog:** `Modal` `E3` radius 16; password input eye toggle; proxy `Switch`; per-model `Switch`; primary **Save** / ghost **Cancel**.
- **Skeletons over spinners** everywhere (spec §17.4). **Empty states:** centred Q-Octo + one-line copy + single primary action.

---

## 10. Iconography

- **Base set:** Ant Design Icons v6 (match `antd` major); no second icon library. Canonical map: Options `SettingOutlined` · Switch-to-Full `ExpandAltOutlined` · Snip `ScissorOutlined` · Attach `PaperClipOutlined` · History `HistoryOutlined` · New chat `FormOutlined` · Help `QuestionCircleOutlined` · Feedback `MailOutlined` · Copy `CopyOutlined` · Regenerate `ReloadOutlined` · Quote/save-note `HighlightOutlined` · Share `ShareAltOutlined` · Read-aloud `SoundOutlined` · New Note `PlusOutlined` · Import `ImportOutlined` · Backup `CloudUploadOutlined` · Collapse `DoubleLeftOutlined`/`DoubleRightOutlined` · Filter `FilterOutlined` · Sort `SortAscendingOutlined` · Grid `AppstoreOutlined` · Password reveal `EyeOutlined`/`EyeInvisibleOutlined` · Update list `ReloadOutlined` · Add custom `PlusOutlined` · Delete/clear `DeleteOutlined` · Star `StarOutlined`/`StarFilled` · Overflow `MoreOutlined`.
- **Brand/custom:** mascot marks (§4.3) + NowPilot glyphs (pinned-tab, note, wiki-link, macro). **SVG**, `currentColor` fills so they theme automatically.
- **Sizes:** 16/20/24/32 px optical; per-message toolbar 16, composer 18, header 20, Sider 20, mascot head 24–28, app icon 16/32/48/128.
- **Style:** rounded joins, 1.75–2 px stroke @24 px; no filled/outlined mixing in one context. **Transparent** backgrounds for all assets.

---

## 11. Motion

`motion` (Framer Motion v12) per the spec.

| Interaction | Motion |
|---|---|
| Panel/page transition | 150–200 ms ease-out fade+slide (8 px) |
| Column collapse (Notes) | 150–200 ms width ease-out; centre reflows |
| Bottom sheet (side panel) | 220 ms ease-out slide-up + scrim fade; drag-to-dismiss |
| Right drawer (standalone view) | 200 ms ease-out slide-from-right + scrim fade |
| Modal (provider dialog) | 160 ms fade+scale from 0.98 |
| Card hover lift | 120 ms `E1`→`E2` |
| Chip / button press | 80 ms scale 0.98 |
| Model-selector open | 120 ms fade+slide from anchor |
| Streaming text | X `Bubble`/`XMarkdown` — **no** extra typewriter (spec §12.6) |
| Mascot moments | ≤ 400 ms; greet/success/error/empty only |
| Theme switch | Instant (CSS variables) |

Respect `prefers-reduced-motion`: drop slides/scales, keep opacity.

---

## 12. Accessibility (visual)

- **Contrast:** WCAG **AA** minimum in **every** pack × light/dark. Verify text on `colorBgContainer` and on user-bubble fills before shipping a pack.
- **Focus:** visible 2 px `colorPrimary` ring on all interactive elements.
- **Icon-only controls need labels:** every header/composer/status-bar/notes-toolbar/dialog icon carries an `aria-label` + tooltip (Options, Switch to Full chat, Snip, Attach, History, New chat, Help, Feedback, column toggles, password reveal, model toggles).
- **Overlays:** bottom sheet + right drawer trap focus, restore focus on close, dismiss on Escape, and announce open/close; scrim is click-to-close but never the only affordance.
- **Colour is never the only signal:** unresolved wikilinks dashed + muted; provider-error state colour + tooltip; active nav pill uses fill + weight, not colour alone.
- **Hit targets:** ≥ 32 px (compact) / 36 px (standalone view); space composer/notes icons so touch targets don't overlap at 400 px.
- **aria-live:** message list announces politely (spec §17.6).

---

## 13. Token Reference (implementation handoff)

Feed into `getAntdConfig()` (spec Appendix F). Design system supplies **values**; spec supplies **wiring**.

```ts
export const NOWPILOT_SEED = {
  colorPrimary: '#3B82F6', colorSuccess: '#10B981', colorWarning: '#F59E0B',
  colorError: '#EF4444', colorInfo: '#3B82F6',
  colorTextBase: '#1F2430', colorBgBase: '#FCFCFD',
  borderRadius: 8, wireframe: false,
} as const;

export const NOWPILOT_COMPONENTS = {
  Card:   { borderRadiusLG: 12 },
  Button: { borderRadius: 8, controlHeight: 32 },
  Layout: { headerHeight: 52 },   // side panel; Standalone view uses 56
  Menu:   { itemBorderRadius: 8 },
  Modal:  { borderRadiusLG: 16 },
  Drawer: { /* right drawer + bottom sheet share E3 + radius 16 */ },
} as const;

// Theme packs are token overlays merged on top of the seed (spec §17.1a APPR-06).
export type ThemePack = 'default' | 'liquid-glass' | 'claude-warm';
export const NOWPILOT_PACK_OVERLAYS: Record<ThemePack, { token?: object; components?: object }> = {
  'default':      {},                                              // seed as-is
  'liquid-glass': { token: { colorBgContainer: 'rgba(255,255,255,0.68)' } }, // + backdrop-filter via CSS layer
  'claude-warm':  { token: { colorBgBase: '#FAF7F2' } },
} as const;
// getAntdConfig({ mode, pack, compact }) merges: seed → pack overlay → algorithm(mode, compact).
```

> **Appearance controls (Options → General, both v0.1):** *Display mode* (Auto/Light/Dark) writes to `chrome.storage.sync.np_theme`; *Theme pack* (Default/Liquid Glass/Claude Warm) writes to `chrome.storage.sync.np_theme_pack` (spec §17.1a). Both cascade live to both surfaces via `chrome.storage.onChanged`.

---

## 14. Layout Change Log (design intent)

1. **Surface split (authoritative, §2):** Side Panel = **Chat only** (no rail, no modes). Standalone Sider hosts **Chat · Note · Write · Tools · [TeamGQM optional]**.
2. **Side Panel (§8.1):** three-element header (name · Options · Switch to Full chat); composer toolbar above input (model selector + Screenshot/Attach/History/New chat); status bar below input (provider · Help · Feedback).
3. **Notes page (§8.3):** 4 columns — **Directory · Notes · Note content · Inspector** — each show/hide via header toggle buttons + column collapse chevrons; centre content column is persistent.
4. **Chat history:** **bottom sheet** in Side Panel (§8.4), **right drawer** in Standalone view (§8.5); shared All/Starred + search + day-grouped items.
5. **Options (§8.6):** left settings menu + card content (Account · AI access with 2×2 provider grid · Appearance with Display mode + Theme pack (both v0.1) · language/font/side-panel-position).
6. **Provider dialog (§8.7):** modal with API key (eye toggle), optional proxy switch, Check connection, model list with per-model enable toggles + Update list + add custom, Cancel/Save.

---

*Companion to `PRODUCT_SPEC_v0_1.md`. This document governs visual language only; all functional behaviour is defined by the product specification.*
