import '../../core/utils/chromePolyfill';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { PopupApp } from './App';
import '../../core/theme/global.css';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
);