import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import './index.css';
import { initTheme } from './lib/theme';
import App from './App';

initTheme();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.hostname.includes('localhost')) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js'); });
}
