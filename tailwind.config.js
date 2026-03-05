/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "!./src/modules/odontogram/engine/**",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dental: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        theme: {
          primary: 'rgb(var(--color-bg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-bg-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-bg-tertiary) / <alpha-value>)',
          hover: 'rgb(var(--color-bg-hover) / <alpha-value>)',
          input: 'rgb(var(--color-bg-input) / <alpha-value>)',
          'sidebar': 'rgb(var(--color-sidebar-bg) / <alpha-value>)',
          'sidebar-active': 'rgb(var(--color-sidebar-active-bg) / <alpha-value>)',
          'sidebar-hover': 'rgb(var(--color-sidebar-hover-bg) / <alpha-value>)',
          'btn-secondary': 'rgb(var(--color-btn-secondary-bg) / <alpha-value>)',
          'btn-secondary-hover': 'rgb(var(--color-btn-secondary-hover) / <alpha-value>)',
          'ghost-hover': 'rgb(var(--color-btn-ghost-hover) / <alpha-value>)',
          'badge-gray': 'rgb(var(--color-badge-gray-bg) / <alpha-value>)',
          'badge-blue': 'rgb(var(--color-badge-blue-bg) / <alpha-value>)',
          'badge-green': 'rgb(var(--color-badge-green-bg) / <alpha-value>)',
          'badge-yellow': 'rgb(var(--color-badge-yellow-bg) / <alpha-value>)',
          'badge-red': 'rgb(var(--color-badge-red-bg) / <alpha-value>)',
        },
      },
      textColor: {
        theme: {
          primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
          'btn-secondary': 'rgb(var(--color-btn-secondary-text) / <alpha-value>)',
          'badge-gray': 'rgb(var(--color-badge-gray-text) / <alpha-value>)',
          'badge-blue': 'rgb(var(--color-badge-blue-text) / <alpha-value>)',
          'badge-green': 'rgb(var(--color-badge-green-text) / <alpha-value>)',
          'badge-yellow': 'rgb(var(--color-badge-yellow-text) / <alpha-value>)',
          'badge-red': 'rgb(var(--color-badge-red-text) / <alpha-value>)',
        },
      },
      borderColor: {
        theme: {
          primary: 'rgb(var(--color-border-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-border-secondary) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
