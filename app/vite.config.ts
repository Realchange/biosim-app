/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
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
})
