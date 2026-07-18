import '../../core/utils/chromePolyfill';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidePanelApp } from './App';
import '../../core/theme/global.css';
import '../../core/registries/registerNowPilotCorePages';
import { initProviderSync } from '../../core/stores/providerStore';

initProviderSync();

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <SidePanelApp />
  </React.StrictMode>,
);