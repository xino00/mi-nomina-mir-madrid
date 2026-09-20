import React from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import App from './App';
import './styles.css';
import {isNative} from './platform/device';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);

// Only the separate web build manages an offline cache. Android keeps its bundled assets.
if (import.meta.env.MODE === 'webapp' && !isNative() && 'serviceWorker' in navigator) {
  const register = () => {
    const base = new URL(import.meta.env.BASE_URL, window.location.href);
    void navigator.serviceWorker.register(new URL('sw.js', base), {scope: base.pathname, updateViaCache: 'none'})
      .catch(() => console.warn('No se pudo preparar el inicio sin conexión. Vuelve a abrir la WebApp con conexión.'));
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, {once: true});
}
