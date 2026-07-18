import '../../core/utils/chromePolyfill';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { PopupApp } from './App';
import '../../core/theme/global.css';
import { initProviderSync } from '../../core/stores/providerStore';

initProviderSync();

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
);