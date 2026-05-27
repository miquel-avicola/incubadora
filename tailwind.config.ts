import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        'accent-dim': 'var(--accent-dim)',
        text: 'var(--text)',
        'text-dim': 'var(--text-dim)',
        success: 'var(--success)',
        danger: 'var(--danger)',
      }
    },
  },
  plugins: [],
}
export default config
