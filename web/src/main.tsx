import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Registers the app-shell service worker so Health OS can be installed to a
// phone home screen and opens instantly. Failure here is non-fatal — the app
// works fine without it.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
