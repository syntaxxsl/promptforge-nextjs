import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Theme tokens — driven by CSS variables (see globals.css)
        background: 'var(--pf-bg)',
        foreground: 'var(--pf-fg)',
        muted: 'var(--pf-muted)',
        border: 'var(--pf-border)',
        primary: 'var(--pf-primary)',
        'primary-foreground': 'var(--pf-primary-fg)',
        surface: 'var(--pf-surface)',
        'surface-2': 'var(--pf-surface-2)',
        danger: 'var(--pf-danger)',
        success: 'var(--pf-success)',
        warning: 'var(--pf-warning)'
      },
      borderRadius: {
        sm: 'var(--pf-radius-sm)',
        md: 'var(--pf-radius-md)',
        lg: 'var(--pf-radius-lg)'
      },
      fontFamily: {
        sans: ['var(--pf-font-sans)'],
        mono: ['var(--pf-font-mono)']
      }
    }
  },
  plugins: []
}
export default config