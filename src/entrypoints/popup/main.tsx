import React from 'react';
import ReactDOM from 'react-dom/client';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <p>NowPilot</p>
    <button onClick={() => chrome.sidePanel.open()}>Open Side Panel</button>
  </React.StrictMode>,
);
