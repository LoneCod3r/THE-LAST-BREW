import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-mono/400.css';
import '../styles/base.css';
import '../styles/secret.css';
import { SecretPage } from './SecretPage';

// A page of its own: it shares the game's look but none of its state.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SecretPage />
  </StrictMode>,
);
