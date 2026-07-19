import '../../core/utils/chromePolyfill';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { StandaloneApp } from './App';
import '../../core/theme/global.css';
import '../../core/registries/registerNowPilotCorePages';
import { initProviderSync } from '../../core/stores/providerStore';

// Phase 8: Register add-ons before React mount
import { registerWriteAddon } from '../../addons/write/registerWriteAddon';
import { registerServiceNowAddon } from '../../addons/servicenow/registerServiceNowAddon';
import { registerTeamGQMAddon } from '../../addons/teamgqm/registerTeamGQMAddon';
import { registerGlobalAddons } from '../../addons/global/registerGlobalAddons';

initProviderSync();

// Execute add-on registration before React mount
registerWriteAddon();
registerServiceNowAddon();
registerTeamGQMAddon();
registerGlobalAddons();

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <StandaloneApp />
  </React.StrictMode>,
);