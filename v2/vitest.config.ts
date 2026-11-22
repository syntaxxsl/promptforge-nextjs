import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    clearMocks: false,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'playwright', 'e2e', '.next']
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') }
  }
})