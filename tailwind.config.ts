import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cyber-cyan': '#00f5ff',
        'neon-blue': '#0099ff',
        'electric-blue': '#3b82f6',
        'obsidian': '#030303',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient': 'linear-gradient(rgba(0, 245, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 245, 255, 0.02) 1px, transparent 1px)',
      },
      animation: {
        'float': 'float 20s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'gradient-flow': 'gradient-flow 3s linear infinite',
        'typing': 'typing 2s steps(40, end)',
        'spin': 'spin 1s linear infinite',
        'highlight-pulse': 'highlight-pulse 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-in': 'slideIn 0.5s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(50px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-30px, 30px) scale(0.9)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 245, 255, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(0, 245, 255, 0.6)' },
        },
        'gradient-flow': {
          '0%': { backgroundPosition: '0% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        typing: {
          'from': { width: '0' },
          'to': { width: '100%' },
        },
        'highlight-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        fadeIn: {
          'from': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          'to': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        slideIn: {
          'from': {
            opacity: '0',
            transform: 'translateX(-30px)',
          },
          'to': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      scale: {
        '102': '1.02',
      },
    },
  },
  plugins: [],
}

export default config
