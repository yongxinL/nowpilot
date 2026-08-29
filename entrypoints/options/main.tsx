import React from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { OptionsPage } from '../../src/components/options/OptionsPage';
import { ThemeProvider } from '../../src/components/ThemeProvider';
import {
  migrateProviderSecrets,
  hydrateProviderSecrets,
} from '../../src/store/useExtensionStore';
import { ProviderRegistry } from '../../src/core/ai/ProviderRegistry';
import { debugLog } from '../../src/core/log/debugLog';
import '../../src/index.css';

/**
 * Options boot — mirrors the sidepanel/standalone provider boot (D-51):
 * the Options surface configures providers, so it MUST decrypt the saved
 * keys into the in-memory store (`hydrateProviderSecrets`) and hydrate the
 * ProviderRegistry (`np_providers` + `np_endpoint_overrides`) before the
 * UI is used. Without these, "Check connection" fails (no decrypted key),
 * a re-save without retyping wipes the saved key, and "Discover models"
 * sees zero enabled providers (registry stays at module-load defaults).
 */
async function bootOptions(): Promise<void> {
  try {
    await migrateProviderSecrets();
    await hydrateProviderSecrets();
    await ProviderRegistry.hydrate();
  } catch (err) {
    debugLog(
      'OPTIONS_BOOT_FAILED',
      err instanceof Error ? err.message : String(err),
    );
  }
}

void bootOptions();

const OptionsApp = () => {
  return (
    <ThemeProvider>
      <AntdApp style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <OptionsPage />
      </AntdApp>
    </ThemeProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<OptionsApp />);
}
