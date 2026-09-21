import React from 'react';

/** The two Phase-1 backing literals. See the GREEN commit for the convention. */
export type Phase1Backing = 'fixture' | 'deferred';

export interface DeferredNoticeProps {
  backing?: Phase1Backing;
  variant?: 'inline' | 'block';
  phase?: number;
  tooltip?: string;
  style?: React.CSSProperties;
}

/**
 * RED skeleton (plan `01-12` Task 1): declaration only, so the suite collects
 * and each case fails on its own assertion rather than on a module-load crash.
 * The GREEN commit replaces this with the implementation.
 */
export const DeferredNotice: React.FC<DeferredNoticeProps> = () => null;
