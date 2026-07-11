import React from 'react';
import ReactDOM from 'react-dom/client';
import { StandaloneApp } from './App';
import '../../core/registries/registerNowPilotCorePages';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <StandaloneApp />
  </React.StrictMode>,
);
