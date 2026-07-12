import React from 'react';
import ReactDOM from 'react-dom/client';
import { OptionsApp } from './App';
import '../../core/theme/global.css';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);