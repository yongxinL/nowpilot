# NowPilot — Design System & Visual Language (Companion)

> **Document ID:** `NOWPILOT_DESIGN_SYSTEM.md`
> **Status:** Design companion to `PRODUCT_SPEC_v0_1.md` (the implementation contract). This document owns **visual language, brand, layout blueprints, and theming aesthetics**. Where the two ever disagree on a *functional rule*, the product spec wins.
> **Date:** 2026-08-02 (rev 2026-08-12 — annotated-mockup alignment)
> **Changelog (rev 2026-08-12):** Reconciled §8 blueprints with the annotated mockups — Side Panel exact heights (composer 44 px, input min 60 px, status bar 28 px) + composer icons (Attach · History · New chat) + **Thought process** collapsible + assistant hover-action set; Standalone Sider 240/72 px + **Add-ons** group + sider-bottom profile + top-bar global search; Notes = **four** header column toggles (incl. persistent Content) + ⋮ More + Inspector Duplicate/Print + per-column shortcuts + bottom status bar; chat-history bottom sheet ≤ ~70 % height; right drawer **320 px** + More-menu (Export/Edit title/Delete); Options menu General · Notes · Advance + Help Center, top bar 56 px, provider cards get edit + enable toggle, theme-pack preview swatch; **provider dialog model list is now a 6-column table** (Model name · Type · Context window · Source · Recommended · Enabled). Added **§8.8 Message action sets** and **§8.9 State indicators**. **(rev 2026-08-12b)** Wired the annotated mockups in `.planning/mockup/` as the §8 visual acceptance reference (new **§8.0** mockup-reference table + precedence rule); `PRODUCT_SPEC` Phase 7/7a now point here for visual acceptance.
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

### 8.0 Mockup reference (visual source of truth)

The annotated mockups in **`.planning/mockup/`** are the pinned visual ground-truth for the §8 blueprints. They are a **review + acceptance artifact**, not a model input: the text in §8 is self-sufficient for text-first implementers (Haiku / DeepSeek-Flash / Gemini-Flash), and the mockups are used at UI review/QA gates (Phase 7 / 7a) and by human reviewers.

| Blueprint | Mockup file (`.planning/mockup/`) | Key anchors |
|-----------|-----------------------------------|-------------|
| §8.1 Side Panel — Focused Chat | `00-sidepanel-chat.png` | header 52 / composer 44 / input 60 / status 28 px; Thought-process; assistant hover set (6) |
| §8.2 + §8.5 Standalone Chat | `01-standalone-chat.png` | Sider 240/72 + Add-ons group; right drawer 320 px; assistant(8)/user(4) action sets; More menu |
| §8.3 Notes — 4-column workspace | `02-standalone-note.png` | 4 column toggles (Content persistent); Inspector Duplicate/Print; status bar; ⌘1–4 |
| §8.6 + §8.7 Options + Provider modal | `03-options-general.png` | menu General·Notes·Advance; provider card edit+toggle; 6-column model table |

**Precedence (on conflict):**
- A **functional rule** always defers to `PRODUCT_SPEC_v0_1.md` (the implementation contract).
- **Visual layout intent** defers to the mockup.
- A **written measurement/description** in §8 supersedes a stale image — if they disagree, update the mockup and bump its rev.

**Frozen baseline:** mockups are versioned with this document's rev date. Re-exporting a mockup requires a design-changelog line + a rev bump; otherwise §8 text remains the acceptance baseline. *(Current uploads use a mixed `00/01` prefix; the table above uses the normalized `00–03` names — rename in `.planning/mockup/` to match, or adjust the filenames here.)*

### 8.1 Side Panel — "Focused Chat" (Ask-Gemini style, **400 px**, compact)

A single, uninterrupted chat surface. **No side nav rail.** Three stacked zones: **header**, **conversation**, **composer block** (toolbar → input → status bar). **Exact metrics (from mockup):** side-panel width **400 px** · header **52 px** · composer toolbar **44 px** · input min-height **60 px** · status bar **28 px** · chat-history bottom sheet slides up to **~70 %** of panel height.

```
┌─────────────────────────────────────────────┐
│ (N) NowPilot                    ⚙   ⤢        │  a) HEADER (52px)
├─────────────────────────────────────────────┤     name+logo (L) · Options · Switch to Full chat (R)
│                              ┌──────────┐   │
│                              │    Hi    │   │  b) CONVERSATION (fills, scrolls)
│                              └──────────┘   │     user bubble — right, colorPrimaryBg
│  🐙 NowPilot                                 │     assistant card container
│  ┌ ✦ Thought process                    › ┐ │     collapsible (collapsed by default)
│  Assistant markdown streams here …           │
│  ⧉  👍  👎  ↻  ⤴  🔊                          │     hover action panel (6 icons)
│  ┌────────────────────────────────────────┐ │
│  │ Suggested follow-up question            │ │     follow-up chips (RICH-C-05)
│  └────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ ⚡ gemma-4-2b-it ▾         📎   🕘      ▢    │  c) COMPOSER TOOLBAR (44px, above input)
│ ┌─────────────────────────────────────────┐ │     model selector (L) · attach ·
│ │ Ask anything, @ models, / prompts    ▷  │ │        history · New chat (R)
│ └─────────────────────────────────────────┘ │  d) INPUT (min 60px; send inside, bottom-right)
│ OpenAI ●                            ⓘ   ✉   │  e) STATUS BAR (28px; provider L · help · feedback R)
└─────────────────────────────────────────────┘
```

- **8.1a Header (52 px):** left = "N" mark + **NowPilot** (Project/Workspace name); right = exactly two icons: **Options** (`SettingOutlined`) and **Switch to Full chat** (`ExpandAltOutlined`, opens Standalone view, hands off via Flow 11). No provider chip, no nav rail (chat only).
- **8.1b Conversation (scrollable):** fills/scrolls, `overflow-anchor:none` tail. **User** messages right-aligned (primary bubble, `colorPrimaryBg`); **assistant** messages left-aligned in a **card container** headed by the 🐙 mascot + "NowPilot". Assistant content supports markdown, code blocks, lists, tables, links; streaming shows the typing indicator inside the bubble; citations (if any) appear at the bottom of the message. **Thought process** collapsible sits at the top of the assistant card (see 8.1f). The **hover action panel** appears on hover (see §8.8). Follow-up chips below. Empty state = centred Q-Octo + welcome cards (RICH-I-01).
- **8.1c Composer toolbar (44 px, above input, space-between):** left = **model selector** `⚡ gemma-4-2b-it ▾` (the only model control here); right = three icon-only actions: **Attach** `📎` · **Chat history** `🕘` · **New chat** `▢`. *(Per mockup, there is no screenshot/snip icon in the composer.)*
- **8.1d Input (min 60 px):** multiline text input, radius 12, `colorBgContainer`, focus ring `colorPrimary` @30%; placeholder "Ask anything, @ models, / prompts…"; **send button inside**, bottom-right, circular, `colorPrimary` when non-empty. **Enter** to send / **Shift+Enter** for newline.
- **8.1e Status bar (28 px):** caption row; left = active **provider name** + status dot (e.g. "OpenAI ●", green = healthy, `colorError` on failure); right = **Help** (`QuestionCircleOutlined`) + **Feedback** (`MailOutlined`), 14 px.
- **8.1f Thought process (collapsible):** a bordered, chevron-headed section at the top of the assistant card, **collapsed by default**. Expanding reveals the **model used** and the detailed reasoning / tool steps for that turn (in Standalone the model chip, e.g. `gemma-4-2b-it`, shows in the header — §8.2). Never animates during streaming; the response content renders below it.

### 8.2 Standalone view — "Workspace" (default density)

Persistent left Sider is the surface switcher; content area is per-page.

Persistent left Sider is the surface switcher; a top bar hosts global search; content area is per-page.

```
┌───────────┬──────────────────────────────────────────────────────┐
│ ‹ (N)NowPilot │ 🔎 Search notes, tags, or content…   ⌘K      ⋮   │  TOP BAR (56px): back · logo · global search · more
│  ─────────  ├──────────────────────────────────────────────────────┤
│  💬 Chat    │                                                      │  Sider items — MAIN group
│  ▤ Note     │            <active page content>                    │  (Chat · Note · Write · Tools)
│  ✎ Write    │                                                      │
│  🧰 Tools    │                                                      │
│  ─ Add-ons ─│                                                      │  separator + group label
│  👥 TeamGQM ᴺᵉʷ                                                    │  SECONDARY group (add-ons, flag-gated)
│  ─────────  │                                                      │
│  (G) George Li ▾                                                   │  sider bottom: user avatar/name ▾
│  ⚙ Settings │                                                      │             + Settings/Options
└───────────┴──────────────────────────────────────────────────────┘
```

- **Sider width:** **expanded 240 px / collapsed 72 px** (icons only), toggled by the collapse chevron; collapsed state shows tooltips on hover. Active item uses `colorPrimaryBg` pill + `colorPrimary` text/icon.
- **Grouped items:** a **Main group** (Chat · Note · Write · Tools) and a **Secondary "Add-ons" group** (e.g. **TeamGQM**, optional/flag-gated, may carry a `New` badge), separated by a labelled divider.
- **Sider bottom area:** **user avatar + name** with a dropdown chevron (account menu), and **Settings/Options** below it. *(No user info is shown in the Side Panel; it lives only here.)*
- **Standalone top bar (56 px):** a back chevron `‹` + "N" mark/NowPilot, a **centred global search** ("Search notes, tags, or content…", `⌘K`), and a **⋮ More** menu on the right.
- **Chat page** in Standalone view reuses the §8.1 composer/bubble recipes at default density (incl. the **Thought process** collapsible, whose header shows the model chip); **Chat history** opens as a **right drawer** here (§8.5), not a bottom sheet. Assistant/user hover-action sets per §8.8.
- Min viewport 1024 px → below shows an `Alert` (spec §17.2). All panels are resizable via drag handles; minimum column widths are enforced.

### 8.3 Notes page — **4-column workspace** (Standalone view only)

Four independently collapsible columns: **Directory · Notes · Note content · Inspector**. The Notes page renders inside the Standalone shell (Sider + 56 px top bar, §8.2). A workspace header row hosts the global search, the **four** column toggle buttons, and note actions. Responsive width **1200–1920 px+**, full-window height. All columns are resizable via drag handles; minimum widths are enforced.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ (N) NowPilot   🔎 Search notes, tags, or content…  ⌘K   [▢][≣][▤][ⓘ]  +New Note Import Backup ⋮ │  HEADER
├───────────────┬───────────────────┬───────────────────────────┬──────────────────────┤
│ DIRECTORY   « │ NOTES  Sort:Updated▾│ ServiceNow / Incident ▾ ★ │ INSPECTOR           » │
│ (col 1)       │ 🔽 ▦               │  INC Lifecycle Flow …     │ (col 4)               │
│ All Notes 128 │ ┌───────────────┐  │  Created/Updated · tags + │ ✨ AI Summary  ↻Regen │
│ Recently Upd  │ │ Note card ★   │  │  ┌── formatting toolbar ─┐│──────────────────────│
│ Favorites   8 │ │ snippet…      │  │  │ Body▾ ↶↷ B I <> ≣ ▦ ⛓ ⯐│ │ ⓘ Note Details        │
│ Uncategorized │ │ tags   10m ago│  │  └───────────────────────┘│  Word Count    1,234  │
│ ▾ Work KB   3 │ ├───────────────┤  │  # Heading                │  Est. Read Time  5 min│
│   ▾ ServiceN24│ │ Note card     │  │  <body: diagrams,         │  Created/Modified     │
│     Incident12│ │ …             │  │   callouts, tables>       │  Links 8 · Backlinks12│
│   Technical 32│ └───────────────┘  │                           │ Quick Actions         │
│ … TAGS …      │ Total 128 notes    │                           │  Copy Link · Exp MD/PDF│
│ #ServiceNow36 │                    │                           │  Move to… · Duplicate  │
│ (col 2 list)  │                    │  (col 3 editor/viewer)    │  Print                 │
├───────────────┴───────────────────┴───────────────────────────┴──────────────────────┤
│ Total 128 notes            Word count: 1,234 · Last saved: 2 mins ago · Auto-saved ●    │  STATUS BAR
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Column definitions**
1. **Directory (col 1):** hierarchical folder tree — All Notes (with count), Recently Updated, Favorites, Uncategorized, then category hierarchy (e.g. Work Knowledge Base ▸ ServiceNow ▸ Incident/Problem/Change), plus a **TAGS** list with counts and "More tags…". Count badges; expand/collapse folders; **drag & drop to organize**; **right-click for context menu**. Header `DIRECTORY` + collapse `«`.
2. **Notes (col 2):** the note **list** for the current scope. `NOTES` header + **Sort: Updated ▾** + filter + grid/list toggle, collapse `«`. Cards: title + star, 2-line snippet clamp, tag chips, relative timestamp. Footer "Total N notes".
3. **Note content (col 3) — persistent centre:** the note **editor/viewer**. Breadcrumb scope + `▾` + star; Created/Updated + tag chips (+add). Formatting toolbar (`Body▾`, undo/redo, **B** *I* `<>`, bullet/number lists, table, checkbox, link, image). Body renders headings, diagrams, callouts, tables via `XMarkdown`; auto-save indicator; breadcrumb shows location. Wikilinks + unresolved-link styling per spec §27.7a.
4. **Inspector (col 4):** **AI Summary** card (with **Regenerate**, LLM-WIKI-03/04) → **Note Details** (Word Count, Est. Read Time, Created, Last Modified, **Links Count**, **Backlinks**) → **Quick Actions** (Copy Link, Export as Markdown, Export as PDF, Move to…, **Duplicate**, **Print**). Header `INSPECTOR` + collapse `»`.

**Header actions (top right):** **+ New Note** (primary, create in current location) · **Import** (import files to current directory) · **Backup** (backup workspace + notes) · **⋮ More** (more options & settings). Hover any icon/button for a tooltip.

**Show/hide behaviour (NOTES-COL-01…03)**
- **NOTES-COL-01** The header carries **four segmented column toggles — Directory · Notes · Content · Inspector** (`colorPrimary` when active). Directory / Notes / Inspector show-hide columns 1, 2, 4. **Content (col 3) is the persistent centre**: its toggle is present for parity but is always-on and cannot be hidden (it "maintains context"). State is persisted per workspace.
- **NOTES-COL-02** Each collapsible column also has an inline **collapse chevron** in its own header (`«` for left columns, `»` for the Inspector) as a second affordance; toggling it stays in sync with the header buttons.
- **NOTES-COL-03** Collapsed columns animate width→0 (150–200 ms) and the centre editor reflows to fill. State persists per surface. At narrow Standalone widths, auto-collapse Directory first, then Inspector, keeping Notes + content.

**Bottom status bar:** total note count (left) and, for the open note, **Word count · Last saved · save-state indicator** (see §8.9).

**Keyboard shortcuts (Notes / global):** `⌘N` New note · `⌘K` Global search · `⌘/` Command palette · `⌘B` Toggle left Sider · `⌘1` Toggle Directory · `⌘2` Toggle Notes list · `⌘3` Toggle Content · `⌘4` Toggle Inspector · `Esc` Close panels/drawers.

### 8.4 Chat history — **bottom sheet** (Side Panel)

Triggered by the 🕘 **Chat history** icon in the composer toolbar (§8.1c). A **bottom sheet slides up** over a dimmed conversation.

```
        (conversation dimmed behind, E-overlay scrim)
┌─────────────────────────────────────────────┐
│                  ▁▁▁▁                         │  drag handle
│ Chat history                            🗑    │  title · Delete all (right)
│ All   Starred                                 │  tabs (underline active)
│ 🔎 Search conversations                        │  search field
│ Today                                         │  date group label
│ ┌─────────────────────────────────────────┐ │
│ │ Summarize INC001234 …      11:20 AM …  ☆ │ │  item: title · time · overflow · star
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```
- Slides up from the **bottom** to **~70 %** of panel height; rounded top corners (radius 16), `E3`, with a **drag handle**; drag-down or ✕/tap-scrim to dismiss.
- **All / Starred** tabs (underline active); **Delete all** (trash) on the right clears all conversations. Search filters. Items grouped by day ("Today", "Yesterday", dates); each item shows **title, time**, a `…` **overflow** menu, and a **star** toggle. Tapping loads the conversation. (Per-item More menu mirrors §8.5: Export conversation · Edit title · Delete conversation.)

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
- Slides in from the **right**, **320 px**, `E3`, scrim over the content area (not the Sider). Identical tabs/search/day-grouping as §8.4; **Delete all** clears all conversations. Consistent behaviour, surface-appropriate motion (bottom vs right).
- **Item affordances (on hover):** the right side reveals the `…` **More** menu and the **Star** icon (star toggles filled/outline). Each item shows title + time; click to load the conversation.
- **More menu actions:** **Export conversation** · **Edit title** · **Delete conversation** (confirm before delete).

### 8.6 Options / Settings (Standalone view)

A settings shell: **left settings menu** + **card-based right content**.

The Options page renders in the Standalone shell with a **56 px top bar** (global search + Help) above a **left settings menu** + **card-based right content**. Settings sidebar: **expanded 240 px / collapsed 72 px** (icons only), no user info shown here. Content area is flexible-width, scrollable, **max-width 1200 px+**. All settings are **auto-saved**.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹  🔎 Search notes, tags, or content…            ⌘K                    ?   │  TOP BAR (56px)
├───────────────┬──────────────────────────────────────────────────────────┤
│ (N) NowPilot  │  Account                                                  │
│ ⚙ General     │  ┌──────────────────────────────────────────────────────┐ │
│ ▤ Notes       │  │ (N) NowPilot · You are signed in         [Log out]   │ │
│ ⚙ Advance     │  └──────────────────────────────────────────────────────┘ │
│ ─────────     │  Service provider                    [ Custom API Key ▾ ] │
│ ? Help Center↗│  "API key stored locally … never sent elsewhere.          │
│               │   Note: some features are limited to Side Panel mode."     │
│               │  ┌ OpenAI        ✎ ●| Set up ┐ ┌ Google (Gemini) ✎ |○ Set up┐│
│               │  ┌ Ollama        ✎ |○ Set up ┐ ┌ Anthropic (Claude) ✎ ●| Set up┐│
│               │  Appearance                                               │
│               │  Theme pack ……… [ Liquid Glass ▾ ] [▨ preview]           │
│               │  Display mode …… [ Auto ▾ ]                               │
│               │  Display language [ English (US) ▾ ]                       │
│               │  Font size for messages [ Auto ▾ ]                        │
│               │  Side panel position (Chrome-114+ browser setting)     ↗  │
└───────────────┴──────────────────────────────────────────────────────────┘
```

- **Left menu:** **General** (default), **Notes**, **Advance**, then a divided **Help Center ↗** (external). Active item = `colorPrimaryBg` pill; collapsible 240/72 px. *(The product spec defines additional Options sections — Providers, Models, MCP, Memory, Diagnostics, Persona, Import/Export, Feature Flags, Add-on Settings — which live under this same shell; the mockup shows the General page concretely.)*
- **Account card:** avatar, name, **"You are signed in"** status, **Log out**.
- **Service provider (AI access):** a **Service provider** select (e.g. "Custom API Key"), the privacy line *"Your API key is stored locally in your browser and is never sent elsewhere,"* plus a note *"Some features are limited to Side Panel mode for technical reasons."* A **2×2 provider grid** — OpenAI, Google (Gemini), Ollama, Anthropic (Claude). **Each provider card carries: an inline edit (`✎` pencil) icon, an enable/disable Switch, and a `Set up` link** that opens the provider dialog (§8.7). The Switch reflects enabled state (e.g. OpenAI + Anthropic on, Gemini + Ollama off in the mockup).
- **Appearance card (order per mockup):** **Theme pack** (Default / **Liquid Glass** / Claude Warm → §6.4; "applies to Side Panel and Standalone", shown with a **preview swatch** thumbnail) → **Display mode** (Auto/Light/Dark → spec §17.1a APPR) → **Display language** (e.g. English (US)) → **Font size for messages** (Auto = auto-adjust to sidebar width) → **Side panel position** (Chrome-114+ browser setting, external ↗).
- Cards: `colorBgContainer`, radius 12, `E1`, generous 20 px padding, 8 px spacing grid, hairline dividers between rows.
- **Options keyboard shortcuts:** `⌘,` Open Options · `⌘K` Global search · `Esc` Close dialogs/modals.

### 8.7 Provider configuration dialog (modal)

Opened by **Set up** on a provider card. A centred `Modal` (`E3`, radius 16).

```
┌──────────────────────────────────────────────────────────────────┐
│ OpenAI                                                        ✕   │
│ API key                                                          │
│ [ •••••••••••••••••••••••••••••                            👁 ]  │
│ API proxy URL (optional)                                  ( ●— ) │  enable-proxy switch (on → field editable)
│ [ http://localhost:12380/v1                                    ] │
│ Check connection      [ Check ]        ✓ Connection successful   │
│ ─────────────────────────────────────────────────────────────── │
│ Model list (5 models available)        ↻ Update list   + Add model│
│ ┌───────────────────┬───────┬──────────┬────────┬──────────┬──────┐│
│ │ Model name        │ Type  │ Context  │ Source │ Recomm.  │Enabled││
│ ├───────────────────┼───────┼──────────┼────────┼──────────┼──────┤│
│ │ gpt-4o            │ Chat  │ 128K     │ OpenAI │  —       │  ●|  ││
│ │ gpt-4o-mini       │ Chat  │ 128K     │ OpenAI │Recommended│ ●|  ││
│ │ o3-mini           │ Chat  │ 200K     │ OpenAI │  —       │  |○  ││
│ │ text-embedding-3-small │ Embedding │ 8K │ OpenAI │ — │  |○  ││
│ │ text-embedding-3-large │ Embedding │ 8K │ OpenAI │ — │  |○  ││
│ └───────────────────┴───────┴──────────┴────────┴──────────┴──────┘│
│                                             [ Cancel ]  [ Save ]  │
└──────────────────────────────────────────────────────────────────┘
```

- **Title** = provider name + ✕ close.
- **API key:** password input with **eye toggle** (`EyeInvisibleOutlined`/`EyeOutlined`); stored AES-encrypted per spec §15.2 (chrome.storage.local, encrypted) — the field never shows the stored key in plaintext on reload.
- **API proxy URL (optional):** an **enable-proxy `Switch`**; when on, the URL input becomes editable for a custom base/proxy endpoint (e.g. `http://localhost:12380/v1`, maps to `ProviderConfig.customBaseURL`, spec §10.3).
- **Check connection:** **Check** button → validates key + proxy (`validateConfig`); result shows inline, e.g. **✓ "Connection successful"** (`colorSuccess`) or an error (`colorError`).
- **Model list — a 6-column table** (per mockup), headed by the count ("N models available") plus **↻ Update list** (refetch from provider, `getModels`) and **+ Add custom model** (define model manually). Columns:

  | Column | Meaning |
  |---|---|
  | **Model name** | Display name / id of the model |
  | **Type** | `Chat` · `Embedding` · `Other` |
  | **Context window** | Maximum tokens supported (e.g. 128K, 200K, 8K) |
  | **Source** | `Provider` (e.g. OpenAI) or `Custom` |
  | **Recommended** | Provider-suggested badge (`Recommended`) or `—` |
  | **Enabled** | Per-model enable/disable `Switch` |

  **Add custom model** defines model **name + type + context window**. **Only enabled models appear in the composer model selector**; changes apply in real-time across Side Panel and Standalone views.
- **Footer:** **Cancel** (ghost) / **Save** (primary). Save persists `ProviderConfigSchema` (spec §10.3).
- **How it works (flow):** ① Set up provider (enter API key + optional proxy) → ② Check connection (validate credentials) → ③ Manage models (enable desired models or add custom) → ④ Use in chat (enabled models appear in the model selector).

### 8.8 Message action sets (hover)

Per-message actions appear **on hover**, 16 px icons, `colorTextSecondary` → hover `colorPrimary`, each with an aria-label + tooltip. The set differs by surface and by author, per the mockups:

| Context | Position | Actions (left → right) |
|---|---|---|
| **Side Panel — assistant** | below the message | **Copy · Like · Dislike · Regenerate · Share · Read aloud** (6) |
| **Standalone — assistant** | bottom-left of response | **Copy · Save to note · Regenerate · Quote · Share · Like · Dislike · Read aloud** (8) |
| **Standalone — user** | right of the user message | **Edit · Copy · Share · Read aloud** (4) |

- **Why the Side Panel set is smaller:** the Side Panel is chat-only (no Notes surface), so **Save to note** and **Quote** are omitted there; they appear only in the Standalone assistant set.
- **Tooltips (verbatim):** Copy "Copy" (copy content to clipboard) · Save to note "Save response to a note" · Regenerate "Regenerate response" · Quote "Insert as quote in input" · Share "Share this response" · Like "Mark as useful" · Dislike "Mark as not useful" · Read aloud "Listen to this response" · Edit "Edit your message".

### 8.9 State & status indicators

A shared save/sync state vocabulary (used by the Notes status bar §8.3 and Sync indicators across surfaces):

| State | Dot colour | Meaning |
|---|---|---|
| **Auto-saved** | `colorSuccess` (green) | All changes saved |
| **Saving…** | `colorPrimary`/blue (or `colorWarning` amber while in-flight) | Changes in progress |
| **Unsaved changes** | `colorWarning` (amber) | There are unsaved changes |
| **Sync / error** | `colorError` (red) | Sync failed or error occurred |

Provider status in the composer status bar uses the same green (healthy) / red (error) dot next to the provider name (§8.1e). Colour is never the only signal — pair with a label/tooltip (§12).

---

## 9. Component Styling Recipes

Styled via AntD tokens + `XProvider` config (spec §5.5). Never inline hex.

- **Standalone Sider:** items 40 px, radius 8; active = `colorPrimaryBg` pill + `colorPrimary` icon/text; collapse chevron top-right; footer avatar/gear/`⌘K`.
- **Side-panel header:** hairline bar, `colorBgContainer`, no shadow; left mark+wordmark; right two 20 px icon buttons (Options, Switch to Full chat).
- **Bubble (X):** radius 12, `variant="filled"`; assistant prefixed by ⚡ model label; code blocks JetBrains Mono on `colorFillTertiary` with inline **Copy** / **Save as macro** (RICH-H-04, clipboard-only insert in v0.1).
- **Per-message toolbar:** 16 px icons, `colorTextSecondary`→hover `colorPrimary`, 8 px gaps; **on-hover**. The set is surface/author-specific (§8.8): Side-Panel assistant = Copy · Like · Dislike · Regenerate · Share · Read-aloud; Standalone assistant = Copy · Save-to-note · Regenerate · Quote · Share · Like · Dislike · Read-aloud; Standalone user = Edit · Copy · Share · Read-aloud.
- **Thought process (collapsible):** bordered section with a chevron header at the top of the assistant card, collapsed by default; in Standalone the header shows the **model chip** (e.g. `gemma-4-2b-it`). Expands to reveal model + reasoning/tool steps (§8.1f). `colorBgContainer`, radius 12, hairline border; no motion during streaming.
- **Model selector:** left-aligned pill, ⚡ + truncated id + chevron; opens searchable `Select`/`Dropdown` of provider→models (`colorBgElevated`, `E2`); full id in tooltip.
- **Composer toolbar icons (44 px bar):** 18 px, right-aligned, space-between vs the model selector — **Attach · Chat history · New chat** (no snip icon).
- **Sender / input (X):** pill radius 12; send inside bottom-right, circular, `colorPrimary` when non-empty; slash overlay = `colorBgElevated` popover, `E2`.
- **Status bar:** caption row; provider name left (turns `colorError` on failure), Help + Feedback right (14 px).
- **Notes columns:** each column header = uppercase label + collapse chevron; header segmented toggles (Directory/Notes/Inspector) `colorPrimary` when active; note cards `E1`, radius 12, hover `E2`; Inspector cards stacked with 16 px gaps.
- **Bottom sheet / right drawer (chat history):** `E3`, radius 16 (top for sheet, left edge for drawer); bottom sheet ≤ ~70 % panel height with a drag handle; right drawer **320 px**; scrim `rgba(16,24,40,.45)`; **All/Starred** underline tabs; **Delete all** (trash) on the right; day-grouped list; item = title + time + `…` overflow (Export · Edit title · Delete) + star toggle (hover-revealed).
- **Provider model table:** AntD `Table`, dense; columns Model name · Type · Context window · Source · Recommended (`Tag` when suggested) · Enabled (`Switch`); header row `colorFillTertiary`; scrolls within the modal body.
- **Provider card (Options):** `colorBgContainer`, radius 12, `E1`; brand glyph + name, inline **edit** (`EditOutlined`) + enable `Switch` top-right, **Set up** link (`colorPrimary`) bottom.
- **Settings cards:** `colorBgContainer`, radius 12, `E1`, 20 px padding, hairline row dividers; **Set up** and section actions in `colorPrimary` text.
- **Provider dialog:** `Modal` `E3` radius 16; password input eye toggle; proxy `Switch`; per-model `Switch`; primary **Save** / ghost **Cancel**.
- **Skeletons over spinners** everywhere (spec §17.4). **Empty states:** centred Q-Octo + one-line copy + single primary action.

---

## 10. Iconography

- **Base set:** Ant Design Icons v6 (match `antd` major); no second icon library. Canonical map: Options `SettingOutlined` · Switch-to-Full `ExpandAltOutlined` · Snip `ScissorOutlined` · Attach `PaperClipOutlined` · History `HistoryOutlined` · New chat `FormOutlined` · Help `QuestionCircleOutlined` · Feedback `MailOutlined` · Copy `CopyOutlined` · Regenerate `ReloadOutlined` · Quote/save-note `HighlightOutlined` · Share `ShareAltOutlined` · Read-aloud `SoundOutlined` · New Note `PlusOutlined` · Import `ImportOutlined` · Backup `CloudUploadOutlined` · Collapse `DoubleLeftOutlined`/`DoubleRightOutlined` · Filter `FilterOutlined` · Sort `SortAscendingOutlined` · Grid `AppstoreOutlined` · Password reveal `EyeOutlined`/`EyeInvisibleOutlined` · Update list `ReloadOutlined` · Add custom `PlusOutlined` · Delete/clear `DeleteOutlined` · Star `StarOutlined`/`StarFilled` · Overflow `MoreOutlined` · **Like `LikeOutlined` · Dislike `DislikeOutlined` · Save-to-note `FileAddOutlined` · Edit `EditOutlined` · Quote `HighlightOutlined` · Duplicate `BlockOutlined` · Print `PrinterOutlined` · Move-to `FolderOpenOutlined` · Back `LeftOutlined` · Enable toggle `Switch` · Content-column toggle `FileTextOutlined` · Provider check `CheckCircleOutlined`**. *(Per the mockups the composer has no snip icon; `ScissorOutlined` is retained in the set for future use but is not placed in the composer toolbar.)*
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
| Right drawer (standalone view, 320 px) | 200 ms ease-out slide-from-right + scrim fade |
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

1. **Surface split (authoritative, §2):** Side Panel = **Chat only** (no rail, no modes). Standalone Sider hosts a **Main group** (Chat · Note · Write · Tools) + an **Add-ons group** (TeamGQM optional), separator between; Sider **240 px expanded / 72 px collapsed**; sider-bottom profile + Settings.
2. **Side Panel (§8.1):** exact metrics — width 400 · header 52 · composer 44 · input min 60 · status bar 28 px; three-element header (name · Options · Switch to Full chat); composer toolbar above input (model selector + **Attach · History · New chat**, no snip); **Thought process** collapsible on assistant turns; status bar below input (provider ● · Help · Feedback).
3. **Notes page (§8.3):** 4 columns — **Directory · Notes · Note content · Inspector** — show/hide via **four** header toggles (Content persistent) + column chevrons; header actions **+ New Note · Import · Backup · ⋮ More**; Inspector Quick Actions add **Duplicate · Print**; bottom status bar (word count · last saved · save-state); per-column keyboard shortcuts.
4. **Chat history:** **bottom sheet** (≤ ~70 % height + drag handle) in Side Panel (§8.4), **right drawer 320 px** in Standalone (§8.5); shared All/Starred + search + Delete-all + day-grouped items; per-item More menu = Export · Edit title · Delete (confirm).
5. **Options (§8.6):** 56 px top bar (global search + Help); left menu **General · Notes · Advance + Help Center** (240/72 px); card content — Account · Service provider (2×2 grid, each card = **edit + enable toggle + Set up**) · Appearance (**Theme pack + preview swatch**, Display mode, language, font, side-panel-position); content max-width 1200 px; `⌘,` opens Options.
6. **Provider dialog (§8.7):** modal with API key (eye toggle), optional proxy switch + URL, Check connection (inline ✓), and a **6-column model table** (Model name · Type · Context window · Source · Recommended · Enabled) + Update list + Add custom model; Cancel/Save; how-it-works flow.
7. **New references:** **§8.8** message action sets (Side-Panel assistant 6 · Standalone assistant 8 · Standalone user 4) and **§8.9** save/sync state indicators.

---

*Companion to `PRODUCT_SPEC_v0_1.md`. This document governs visual language only; all functional behaviour is defined by the product specification.*