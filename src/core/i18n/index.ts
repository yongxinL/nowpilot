// src/core/i18n/index.ts — thin i18n wrapper over STR (01-02, Appendix B
// verbatim). Phase 1 ships NO i18n framework (CONTEXT the agent's Discretion —
// plain constants). This wrapper is the single access point so a real i18n
// layer can replace it later without touching consumers.
//
// STR is a nested constant (chat.*, notes.*, …), so keys are dotted paths into
// string leaves — e.g. 'chat.errorRetry', 'options.noProvider'.
import { STR } from '@/core/i18n/strings';

/** Dotted-path key that resolves to a string leaf of T (e.g. 'chat.errorRetry'). */
export type StringKey<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends object
      ? `${K}.${StringKey<T[K]>}`
      : never;
}[keyof T & string];

function resolveString(key: StringKey<typeof STR>): string {
  const value = key.split('.').reduce<unknown>((acc, part) => {
    if (typeof acc === 'object' && acc !== null && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, STR);
  return typeof value === 'string' ? value : '';
}

/** Resolve a canonical STR key to its string. */
export function getString(key: StringKey<typeof STR>): string {
  return resolveString(key);
}

/** Substitute {placeholder} tokens in a template with the given params. */
export function formatString(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : token,
  );
}

/** Brevity alias resolving the same dotted STR paths. */
export function t(key: StringKey<typeof STR>): string {
  return resolveString(key);
}

// --- Locale stubs ---
// No i18n framework in Phase 1; locale is fixed to 'en'. These stubs keep the
// surface stable so a real i18n layer can land without touching consumers.
export function getLocale(): string {
  return 'en';
}

export function setLocale(_locale: string): void {
  // no-op stub: locale is fixed to 'en' until an i18n framework lands
}
