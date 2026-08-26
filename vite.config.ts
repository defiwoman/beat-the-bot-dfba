/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  /**
   * Absolute base, for deployment at the root of a domain.
   *
   * This must not be './'. With the SPA fallback that serves index.html for any unmatched
   * path, a relative base resolves the bundle against the *requested* URL — so a visit to
   * /anything/ asks for /anything/assets/index.js, gets index.html back, and the app never
   * boots. Reproduced and fixed; see the netlify.toml redirect.
   */
  base: '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
