// src/components/sidepanel/SidePanelRouter.tsx — surface selector for the side
// panel (entry root mounted in 01-09). Gates on ProviderRegistry presence per
// D-07 (NOT an onboarding-done flag — W-10, T-1-18: single sources, no cached
// UI flag): no provider + onboarding pending → Onboarding (Flow 9); no provider
// + onboarding done ('Configure later') → the disabled SidePanelShell (D-07
// disabled surface); provider present → the enabled chat shell. onboarding-done
// lives in AddonSettingsStore (np_addon_settings 'onboarding'.done — D-18
// forbids widening WorkspaceState, 01-06 precedent). Pure store/registry-driven
// selector — no extension API calls (Pitfall 4/P5). The Cmd+K visibility state
// is lifted at the 01-09 entrypoint and threaded through to the shell (controlled
// CmdKPicker — the picker stops self-capturing when a parent owns the mod+k
// capture).
import { useSyncExternalStore } from 'react';
import { OnboardingModal } from '@/components/OnboardingModal';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';
import { getProviderRegistry } from '@/core/ai/ProviderRegistry';
import { useAddonSettingsStore } from '@/core/registry/AddonSettingsStore';

export interface SidePanelRouterProps {
  /** Controlled Cmd+K palette visibility (lifted at the 01-09 entrypoint). */
  pickerOpen?: boolean;
  /** Controlled Cmd+K palette visibility change callback. */
  onPickerOpenChange?: (open: boolean) => void;
}

export function SidePanelRouter({ pickerOpen, onPickerOpenChange }: SidePanelRouterProps = {}) {
  // T-1-18: re-evaluate on every registry/store change — the gate reads the
  // provider live via useSyncExternalStore (no cached UI flag), and onboarding
  // completion subscribes through the addon settings store.
  const hasProvider = useSyncExternalStore(
    (onChange) => getProviderRegistry().subscribe(onChange),
    () => getProviderRegistry().hasActiveProvider(),
  );
  const onboardingDone = useAddonSettingsStore((s) => s.settings.onboarding?.done) === true;

  if (!hasProvider && !onboardingDone) {
    return <OnboardingModal />;
  }
  return <SidePanelShell pickerOpen={pickerOpen} onPickerOpenChange={onPickerOpenChange} />;
}
