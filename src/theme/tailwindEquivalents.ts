/**
 * Phase 1b — Tailwind-className → inline-style token mapping.
 *
 * Use these constants when converting Tailwind utility strings to inline
 * style props or `theme.useToken()` references. Centralizing the mapping here
 * keeps every conversion consistent (same color = same token, same radius =
 * same px value) and gives us a single file to grep when we want to verify
 * nothing has drifted from the spec.
 *
 * Conventions
 * -----------
 * Colors come from AntD `theme.useToken()` — never hardcode a hex. Pass the
 * token into a `style={{ color: token.colorText }}` or merge via a helper.
 *
 * Spacing uses the 2·4·8·12·16·20·24·32 scale from DESIGN_SYSTEM §7.
 * AntD's `paddingXXS/XS/SM/MD/LG/XL/XXL` map to {4,8,12,16,20,24,32}. For
 * the half-step values (2/6/10) we use literal numbers since AntD has no
 * token for them and they appear only at hairline/detail positions.
 *
 * Radii use AntD's `borderRadiusXS/SM/MD/LG` for {2,6,8,12}; full pills are
 * `9999` per DESIGN_SYSTEM §7 ("pills/chips 999"). Arbitrary radii (e.g. the
 * 20px options sidebar) are literal.
 *
 * Anything not listed here should be looked up against the reference
 * conversions in src/components/standalone/StandaloneShell.tsx and
 * WorkspaceSidebar.tsx (Plan 01-03's spec-compliant pattern).
 */

export const RADIUS = {
  /** Tailwind `rounded-sm` (2px) — checkboxes, tiny chips */
  SM: 2,
  /** Tailwind `rounded` / `rounded-md` (6px) — buttons, inputs */
  MD: 6,
  /** Tailwind `rounded-lg` (8px) — base radius per DESIGN_SYSTEM §7 */
  LG: 8,
  /** Tailwind `rounded-xl` (12px) — cards/bubbles/panels per DESIGN_SYSTEM §7 */
  XL: 12,
  /** Tailwind `rounded-2xl` (16px) — modal/dialog surfaces */
  XXL: 16,
  /** Tailwind `rounded-3xl` (24px) — Option cards, hero cards */
  XXXL: 24,
  /** Tailwind `rounded-full` — pills, chips, avatars */
  PILL: 9999,
} as const;

export const SPACE = {
  /** Tailwind `p-0.5` / `gap-0.5` (2px) — DESIGN_SYSTEM §7 spacing step */
  HALF: 2,
  /** Tailwind `p-1` / `gap-1` (4px) — DESIGN_SYSTEM §7 */
  XS: 4,
  /** Tailwind `p-1.5` / `gap-1.5` (6px) — halfway step (no AntD token) */
  XSPLUS: 6,
  /** Tailwind `p-2` / `gap-2` (8px) — DESIGN_SYSTEM §7; AntD paddingXXS */
  SM: 8,
  /** Tailwind `p-2.5` / `gap-2.5` (10px) — halfway step (no AntD token) */
  SMPLUS: 10,
  /** Tailwind `p-3` / `gap-3` (12px) — DESIGN_SYSTEM §7; AntD paddingXS */
  MD: 12,
  /** Tailwind `p-3.5` / `gap-3.5` (14px) — halfway step */
  MDPLUS: 14,
  /** Tailwind `p-4` / `gap-4` (16px) — DESIGN_SYSTEM §7; AntD paddingSM */
  LG: 16,
  /** Tailwind `p-5` / `gap-5` (20px) — DESIGN_SYSTEM §7; AntD padding */
  XL: 20,
  /** Tailwind `p-6` / `gap-6` (24px) — DESIGN_SYSTEM §7; AntD paddingMD */
  XXL: 24,
  /** Tailwind `p-8` / `gap-8` (32px) — DESIGN_SYSTEM §7; AntD paddingLG */
  XXXL: 32,
  /** Tailwind `p-16` / `gap-16` (64px) — hero / hero spacing */
  HUGE: 64,
} as const;

export const FONT_SIZE = {
  /** Tailwind `text-xs` (12px) */
  XS: 12,
  /** Tailwind `text-sm` (14px) */
  SM: 14,
  /** Tailwind `text-base` (16px) */
  BASE: 16,
  /** Tailwind `text-lg` (18px) */
  LG: 18,
  /** Tailwind `text-xl` (20px) */
  XL: 20,
  /** Tailwind `text-2xl` (24px) */
  XXL: 24,
  /** Tailwind `text-3xl` (30px) */
  XXXL: 30,
  /** Tailwind `text-4xl` (36px) */
  HUGE: 36,
} as const;

/**
 * Convert a Tailwind `z-N` class to its px z-index value.
 * Maps: z-10→10, z-20→20, z-30→30, z-40→40, z-50→50.
 */
export function twZ(cls: string): number | undefined {
  const m = /(?:^|\s)z-(\d+)/.exec(cls);
  return m ? Number(m[1]) : undefined;
}

/**
 * Inert Tailwind animations whose corresponding @keyframes were removed when
 * Tailwind was uninstalled. The conversion pass replaces these with the
 * NowPilot motion utility classes (`.np-fade-in`, `.np-zoom-fade-in`,
 * `.np-scale-up`, `.np-pulse`, `.np-spin`) defined in `src/index.css`.
 */
export const ANIMATION_MAP: Readonly<Record<string, string>> = {
  'animate-fade-in': 'np-fade-in',
  'animate-scale-up': 'np-scale-up',
  'animate-in': 'np-fade-in',
  'fade-in': 'np-fade-in',
  'zoom-in-95': 'np-zoom-fade-in',
  'animate-pulse': 'np-pulse',
  'animate-spin': 'np-spin',
} as const;

/**
 * Tailwind-to-px size tables. Tailwind defaults are 4-px scale starting from
 * 0; `text-xs=12`, `text-sm=14`, `w-1=4`, `p-1=4`, etc. We list the literal
 * values here because they show up hundreds of times across the codebase
 * and we want a single authoritative source.
 */
export const SIZE_PX: Readonly<Record<string, number>> = {
  // Width
  'w-0': 0, 'w-px': 1, 'w-0.5': 2, 'w-1': 4, 'w-1.5': 6, 'w-2': 8, 'w-2.5': 10,
  'w-3': 12, 'w-3.5': 14, 'w-4': 16, 'w-5': 20, 'w-6': 24, 'w-7': 28, 'w-8': 32,
  'w-9': 36, 'w-10': 40, 'w-11': 44, 'w-12': 48, 'w-14': 56, 'w-16': 64,
  'w-20': 80, 'w-24': 96, 'w-28': 112, 'w-32': 128, 'w-36': 144, 'w-40': 160,
  'w-44': 176, 'w-48': 192, 'w-52': 208, 'w-56': 224, 'w-60': 240, 'w-64': 256,
  'w-72': 288, 'w-80': 320,
  // Height
  'h-0': 0, 'h-px': 1, 'h-0.5': 2, 'h-1': 4, 'h-1.5': 6, 'h-2': 8, 'h-2.5': 10,
  'h-3': 12, 'h-3.5': 14, 'h-4': 16, 'h-5': 20, 'h-6': 24, 'h-7': 28, 'h-8': 32,
  'h-9': 36, 'h-10': 40, 'h-11': 44, 'h-12': 48, 'h-14': 56, 'h-16': 64,
  'h-20': 80, 'h-24': 96, 'h-28': 112, 'h-32': 128,
  // Font sizes
  'text-xs': 12, 'text-sm': 14, 'text-base': 16, 'text-lg': 18,
  'text-xl': 20, 'text-2xl': 24, 'text-3xl': 30, 'text-4xl': 36,
  // Spacing
  'p-0': 0, 'p-px': 1, 'p-0.5': 2, 'p-1': 4, 'p-1.5': 6, 'p-2': 8,
  'p-2.5': 10, 'p-3': 12, 'p-3.5': 14, 'p-4': 16, 'p-5': 20, 'p-6': 24,
  'p-7': 28, 'p-8': 32, 'p-10': 40, 'p-12': 48, 'p-16': 64,
  'px-0': 0, 'px-px': 1, 'px-0.5': 2, 'px-1': 4, 'px-1.5': 6, 'px-2': 8,
  'px-2.5': 10, 'px-3': 12, 'px-3.5': 14, 'px-4': 16, 'px-5': 20, 'px-6': 24,
  'px-7': 28, 'px-8': 32,
  'py-0': 0, 'py-px': 1, 'py-0.5': 2, 'py-1': 4, 'py-1.5': 6, 'py-2': 8,
  'py-2.5': 10, 'py-3': 12, 'py-3.5': 14, 'py-4': 16, 'py-5': 20, 'py-6': 24,
  'py-7': 28, 'py-8': 32, 'py-16': 64,
  'pt-0': 0, 'pt-px': 1, 'pt-0.5': 2, 'pt-1': 4, 'pt-1.5': 6, 'pt-2': 8,
  'pt-2.5': 10, 'pt-3': 12, 'pt-3.5': 14, 'pt-4': 16, 'pt-5': 20, 'pt-6': 24,
  'pt-7': 28, 'pt-8': 32, 'pt-10': 40, 'pt-16': 64, 'pt-20': 80,
  'pb-0': 0, 'pb-px': 1, 'pb-0.5': 2, 'pb-1': 4, 'pb-1.5': 6, 'pb-2': 8,
  'pb-2.5': 10, 'pb-3': 12, 'pb-3.5': 14, 'pb-4': 16, 'pb-5': 20, 'pb-6': 24,
  'pb-7': 28, 'pb-8': 32,
  'pl-0': 0, 'pl-px': 1, 'pl-0.5': 2, 'pl-1': 4, 'pl-1.5': 6, 'pl-2': 8,
  'pl-2.5': 10, 'pl-3': 12, 'pl-4': 16, 'pl-5': 20, 'pl-6': 24, 'pl-7': 28,
  'pl-8': 32,
  'pr-0': 0, 'pr-px': 1, 'pr-0.5': 2, 'pr-1': 4, 'pr-1.5': 6, 'pr-2': 8,
  'pr-2.5': 10, 'pr-3': 12, 'pr-4': 16, 'pr-5': 20, 'pr-6': 24, 'pr-7': 28,
  'pr-8': 32, 'pr-14': 56,
  'm-0': 0, 'm-px': 1, 'm-0.5': 2, 'm-1': 4, 'm-1.5': 6, 'm-2': 8,
  'm-2.5': 10, 'm-3': 12, 'm-3.5': 14, 'm-4': 16, 'm-5': 20, 'm-6': 24,
  'm-7': 28, 'm-8': 32,
  'mb-0': 0, 'mb-px': 1, 'mb-0.5': 2, 'mb-1': 4, 'mb-1.5': 6, 'mb-2': 8,
  'mb-2.5': 10, 'mb-3': 12, 'mb-3.5': 14, 'mb-4': 16, 'mb-5': 20, 'mb-6': 24,
  'mb-7': 28, 'mb-8': 32,
  'mt-0': 0, 'mt-px': 1, 'mt-0.5': 2, 'mt-1': 4, 'mt-1.5': 6, 'mt-2': 8,
  'mt-2.5': 10, 'mt-3': 12, 'mt-3.5': 14, 'mt-4': 16, 'mt-5': 20, 'mt-6': 24,
  'mt-7': 28, 'mt-8': 32,
  'ml-0': 0, 'ml-px': 1, 'ml-0.5': 2, 'ml-1': 4, 'ml-1.5': 6, 'ml-2': 8,
  'ml-2.5': 10, 'ml-3': 12, 'ml-4': 16,
  'mr-0': 0, 'mr-px': 1, 'mr-0.5': 2, 'mr-1': 4, 'mr-1.5': 6, 'mr-2': 8,
  'mr-2.5': 10, 'mr-3': 12, 'mr-4': 16,
  'mx-0': 0, 'mx-px': 1, 'mx-0.5': 2, 'mx-1': 4, 'mx-1.5': 6, 'mx-2': 8,
  'mx-2.5': 10, 'mx-3': 12, 'mx-4': 16,
  'my-0': 0, 'my-px': 1, 'my-0.5': 2, 'my-1': 4, 'my-1.5': 6, 'my-2': 8,
  'my-2.5': 10, 'my-3': 12, 'my-4': 16,
  'gap-0': 0, 'gap-px': 1, 'gap-0.5': 2, 'gap-1': 4, 'gap-1.5': 6,
  'gap-2': 8, 'gap-2.5': 10, 'gap-3': 12, 'gap-3.5': 14, 'gap-4': 16,
  'gap-5': 20, 'gap-6': 24, 'gap-7': 28, 'gap-8': 32,
  'space-y-0': 0, 'space-y-px': 1, 'space-y-0.5': 2, 'space-y-1': 4,
  'space-y-1.5': 6, 'space-y-2': 8, 'space-y-2.5': 10, 'space-y-3': 12,
  'space-y-3.5': 14, 'space-y-4': 16, 'space-y-5': 20, 'space-y-6': 24,
  'space-y-7': 28, 'space-y-8': 32,
  'top-0': 0, 'top-px': 1, 'top-0.5': 2, 'top-1': 4, 'top-1.5': 6,
  'top-2': 8, 'top-2.5': 10, 'top-3': 12, 'top-3.5': 14, 'top-4': 16,
  'top-5': 20, 'top-6': 24,
  'bottom-0': 0, 'bottom-px': 1, 'bottom-0.5': 2, 'bottom-1': 4,
  'bottom-1.5': 6, 'bottom-2': 8, 'bottom-2.5': 10, 'bottom-3': 12,
  'bottom-3.5': 14, 'bottom-4': 16,
  'left-0': 0, 'left-px': 1, 'left-0.5': 2, 'left-1': 4, 'left-1.5': 6,
  'left-2': 8,
  'right-0': 0, 'right-px': 1, 'right-0.5': 2, 'right-1': 4, 'right-1.5': 6,
  'right-2': 8, 'right-2.5': 10, 'right-3': 12, 'right-3.5': 14, 'right-4': 16,
  'inset-0': 0,
  'max-w-xs': 320, 'max-w-sm': 384, 'max-w-md': 448, 'max-w-lg': 512,
  'max-w-xl': 576, 'max-w-2xl': 672, 'max-w-3xl': 768, 'max-w-4xl': 896,
  'max-w-5xl': 1024,
  'max-h-48': 192, 'max-h-60': 240, 'max-h-64': 256, 'max-h-80': 320,
  'min-h-0': 0, 'min-w-0': 0,
  // Radius
  'rounded-none': 0, 'rounded-sm': 2, 'rounded': 4, 'rounded-md': 6,
  'rounded-lg': 8, 'rounded-xl': 12, 'rounded-2xl': 16, 'rounded-3xl': 24,
  'rounded-full': 9999,
} as const;
