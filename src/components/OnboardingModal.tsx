// src/components/OnboardingModal.tsx — Flow 9 first-run onboarding, Phase-1
// Step 1 (D-06): welcome (STR.onboarding.* from 01-02) + the E7 persona card
// + a provider-choice UI skeleton (four provider buttons disabled with a
// 'coming in settings phase' note — the full provider configure flow lands in
// the settings phase, D-06). The 'Configure provider' CTA deep-links to
// Standalone Options (D-09) via WorkspaceRouter + navigateToPage. The
// the configure-later escape (D-06) marks onboarding done in AddonSettingsStore
// (np_addon_settings key 'onboarding'.done — D-18 forbids widening
// WorkspaceState, 01-06 precedent) so the SidePanelRouter exits to the DISABLED
// surface (D-07: no provider configured ⇒ disabled shell), NOT the chat shell.
// ONBOARDING_WRITE / ONBOARDING_DONE codes on failure/success; never throws
// (Golden Rule 9). Wrapped in ErrorBoundary. No chrome API calls (Pitfall 4).
import { Button, Card, Space, Typography } from 'antd';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { STR } from '@/core/i18n/strings';
import { useAddonSettingsStore } from '@/core/registry/AddonSettingsStore';
import { navigateToPage } from '@/components/standalone/standaloneNav';
import { WorkspaceRouter } from '@/core/workspace/WorkspaceRouter';
import type { ProviderId } from '@/types/workspace';

// Golden Rule 2: provider ids are exactly the canonical enum (Appendix C).
const PROVIDER_IDS: ProviderId[] = ['openai', 'anthropic', 'gemini', 'ollama'];

const ONBOARDING_ADDON_ID = 'onboarding';

// UI-SPEC Copywriting Contract — persona card secondary CTA (verbatim; = STR.onboarding.configureLater).
const CONFIGURE_LATER_LABEL = 'Configure later';

export function OnboardingModal() {
  const handleConfigureProvider = (): void => {
    // D-09: deep-link to Standalone Options. Router errors are logged inside
    // WorkspaceRouter (WORKSPACE_ROUTER/TABS_QUERY) — never thrown.
    void WorkspaceRouter.openStandalone();
    navigateToPage('options');
  };

  const handleConfigureLater = (): void => {
    try {
      useAddonSettingsStore.getState().setSetting(ONBOARDING_ADDON_ID, 'done', true);
      debugLog(ERROR_CODES.ONBOARDING_DONE, 'onboarding marked done via the configure-later CTA', {
        silent: true,
        module: 'OnboardingModal',
      });
    } catch (err) {
      debugLog(ERROR_CODES.ONBOARDING_WRITE, 'failed to mark onboarding done', {
        error: err instanceof Error ? err : undefined,
        module: 'OnboardingModal',
      });
    }
  };

  return (
    <ErrorBoundary>
      <Card style={{ maxWidth: 420, margin: '0 auto' }}>
        <Typography.Title level={1}>{STR.onboarding.heading}</Typography.Title>
        <Typography.Paragraph>{STR.onboarding.body}</Typography.Paragraph>

        <Space orientation="vertical" style={{ width: '100%' }}>
          <Button type="primary" onClick={handleConfigureProvider}>
            {STR.onboarding.configureProvider}
          </Button>
          <Space wrap>
            {PROVIDER_IDS.map((id) => (
              <Button key={id} disabled>
                {id}
              </Button>
            ))}
          </Space>
          <Typography.Text type="secondary">
            Provider setup is coming in the settings phase
          </Typography.Text>
          <Button onClick={handleConfigureLater}>{CONFIGURE_LATER_LABEL}</Button>
        </Space>
      </Card>
    </ErrorBoundary>
  );
}
