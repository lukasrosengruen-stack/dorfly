import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Die *.db.test.ts starten in beforeEach ein komplettes Postgres (PGlite/WASM).
    // Laufen mehrere davon parallel, dauert das unter Last länger als die
    // Standard-10-Sekunden.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
})
