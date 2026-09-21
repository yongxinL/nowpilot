import React from 'react';
import { SidePanelShell, type SidePanelShellProps } from './SidePanelShell';

/**
 * The Side Panel's single surface-routing decision point (D-06): onboarding
 * versus the Chat shell, with no navigation rail.
 *
 * Phase 1 lands the shell branch. The onboarding branch landed in plan `01-09`
 * in the **surface root** (`src/entrypoints/sidepanel/main.tsx`) rather than
 * here: the shared flow is a modal presented over whichever surface the user
 * opened, so it does not replace this router's branch. The router keeps its one
 * responsibility — which shell content renders — and the surface root owns the
 * completion-record gate. The flow controller itself is surface-independent and
 * is never reached from a surface root directly; both surfaces render the same
 * module with their own adapters.
 */
export type SidePanelRouterProps = SidePanelShellProps;

export const SidePanelRouter: React.FC<SidePanelRouterProps> = (props) => (
  <SidePanelShell {...props} />
);
