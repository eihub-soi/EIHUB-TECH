/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        mint: {
          primary: '#20B8A5',
          light: '#DDF7F3',
          bg: '#F2FBFA',
          border: '#D9E8E7',
        },
        navy: {
          dark: '#102044',
          secondary: '#64748B',
          800: '#1C2541',
          900: '#0B132B',
          950: '#070B19',
        },
        brand: {
          50: '#F0F3FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
        indigo: {
          DEFAULT: '#4338CA',
          dark: '#3A506B',
          light: '#6366F1',
        },
        gold: {
          300: '#FDE047',
          400: '#FACC15',
          500: '#D4AF37',
          600: '#CA8A04',
          700: '#A16207',
        },
        emerald: {
          500: '#10B981',
          600: '#059669',
        },
        amber: {
          500: '#F59E0B',
          600: '#D97706',
        },
        rose: {
          500: '#EF4444',
          600: '#DC2626',
        },
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(11, 19, 43, 0.37)',
        'glass-sm': '0 4px 16px 0 rgba(11, 19, 43, 0.2)',
        'gold-glow': '0 0 20px 2px rgba(212, 175, 55, 0.25)',
        'indigo-glow': '0 0 25px 3px rgba(67, 56, 202, 0.3)',
      },
      animation: {
        'float-slow': 'float 6s ease-in-out infinite',
        'float-medium': 'float 4s ease-in-out infinite',
        pulse_slow: 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-12px) rotate(2deg)' },
        },
      },
    },
  },
  plugins: [],
};
