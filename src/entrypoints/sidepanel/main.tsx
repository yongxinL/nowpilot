import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidePanelApp } from './App';
import '../../core/theme/global.css';
import '../../core/registries/registerNowPilotCorePages';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <SidePanelApp />
  </React.StrictMode>,
);