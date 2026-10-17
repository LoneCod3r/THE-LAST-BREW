import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    // Two pages: the game, and the secret page its QR code leads to (served at last-drop/).
    rolldownOptions: {
      input: {
        main: page('./index.html'),
        lastDrop: page('./last-drop/index.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
