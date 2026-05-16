/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-deep':    '#0d0f14',
        'bg-surface': '#1a1d26',
        'bg-card':    '#141720',
        'bg-raised':  '#1c1f2e',
        'accent':     '#FF5E3A',
        'teal':       '#FF5E3A',
        'amber':      '#FFB347',
        'blue':       '#4f8ef7',
        'text-pri':   '#ffffff',
        'text-sec':   '#9aa0b0',
        'text-dim':   '#6b6b6b',
        // Legacy compat mappings
        'cyan':       '#00c9b1',
        'gold':       '#e8b84b',
        'purple':     '#e8b84b', // mapped away
        'pink':       '#4f8ef7', // mapped away
        'green':      '#FF5E3A',
        'red':        '#FF5E3A',
        'primary-dark':   '#0d0f14',
        'gen-teal':       '#FF5E3A',
        'intel-blue':     '#4f8ef7',
        'authority-gold': '#FFB347',
        'novelty-purple': '#FF5E3A',
        'alert-red':      '#FF5E3A',
        'text-primary':   '#ffffff',
        'text-muted':     '#9aa0b0',
        'graph-accent':   '#FF5E3A',
      },
      fontFamily: {
        mono:    ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        display: ['"Space Grotesk"', 'sans-serif'],
        body:    ['"Inter"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        sans:    ['"Inter"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float':       'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-6px)' },
        }
      },
    },
  },
  plugins: [],
};
