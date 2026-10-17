import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans-condensed/600.css';
import './styles/base.css';
import './styles/screens.css';
import './styles/machine.css';
import './styles/vending.css';
import { App } from './App';
import { discardSavedProgress } from './state/legacySave';

// Runs once per document load (never on component remounts or hot updates): every
// page load is a fresh game, so a save left by an earlier version is removed.
discardSavedProgress();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
