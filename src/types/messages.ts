// src/types/messages.ts — Source: PRODUCT_SPEC Appendix C (lines 4611-4626,
// verbatim) — the PROXY_FETCH wire contract between the panel-side Requester
// (src/core/http/Requester.ts) and the background SW's proxy entry (R-3: the SW
// executes the real fetch; panels only send the request). The spec's own
// type-block comment declares this file as the canonical home (R-1: types from
// Appendix C, file path from the spec — never invented).
//
// `retrySafe` is a Phase-2 02-10 addition (plan-mandated): Appendix C states
// "PROXY_FETCH | Never retried unless caller marks request retry-safe" — the
// opt-in flag lives on the request so the Requester's bounded retry is explicit
// (T-2-10-02).
export interface ProxyFetchRequest {
  type: 'PROXY_FETCH';
  addonId: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  credentials?: 'include' | 'omit';
  /** 02-10 addition — opt-in bounded retry (Appendix C retry-safe contract). */
  retrySafe?: boolean;
}
export interface ProxyFetchResponse {
  ok: boolean;
  status: number;
  body: string;
  error?: string;
}
