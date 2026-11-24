import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted open-source fonts (no requests to font CDNs — keeps the app fully on-device).
import '@fontsource/overpass/400.css';
import '@fontsource/overpass/700.css';
import '@fontsource/overpass/900.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './index.css';
import App from './App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
