import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // Local-first stores hydrate browser state after mount; this is intentional.
      'react-hooks/set-state-in-effect': 'off',
      // Apostrophes in UI text are harmless and do not affect rendered content.
      'react/no-unescaped-entities': 'off'
    }
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**'
  ])
])
