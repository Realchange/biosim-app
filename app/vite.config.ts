/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
// `base` is applied only to the production build: GitHub Pages serves the app under the
// repo subpath /biosim-app/. Local dev (`vite serve`) and tests keep base '/', so
// `npm run dev` stays at http://localhost:5173/ and cloning + running locally is unaffected.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/biosim-app/' : '/',
  plugins: [react()],
  // Resolve the workspace core to its TypeScript source so the frontend uses a
  // single source of truth with no separate build step (mirrors tsconfig paths).
  resolve: {
    alias: {
      '@biosim/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    passWithNoTests: true,
  },
  worker: {
    format: 'es',
  },
}))
