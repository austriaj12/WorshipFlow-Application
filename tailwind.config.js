/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Inter for global interface text, system-ui fallback for instant execution
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        // JetBrains Mono for clean data display (BPM, Keys, Structure labels)
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      colors: {
        // Map to dynamic CSS custom properties set by React theme engine
        appBg: 'var(--bg-app)',
        appPanel: 'var(--bg-panel)',
        appBorder: 'var(--border-app)',
        
        // Soft, highly readable text values
        textMain: 'var(--text-main)',
        textMuted: 'var(--text-muted)',
        
        // Action accent token
        brand: 'var(--brand)',
        
        // Strict operational statuses
        liveDanger: '#EF4444', // Red 500: High-visibility indicator for Blackout/Clear canvas functions
      },
    },
  },
  plugins: [],
}
