import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Runtime resolves to the published npm package (built, versioned) —
      // no longer the raw submodule source. Types still come from the
      // hand-maintained shim via the tsconfig `paths` mapping of the same
      // alias (see tsconfig.json). Switching the shim to the package's own
      // types is a separate follow-up (needs a language/numbering boundary
      // adapter — the host's enums differ from the package's).
      '@odontogram-shell': 'react-odontogram-modul',
      '@dq-importer': path.resolve(__dirname, './src/modules/dq-importer/src'),
      '@dq-calendar': path.resolve(__dirname, './src/modules/dq-calendar'),
    },
  },
  server: {
    proxy: {
      '/backend': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend/, ''),
      },
      '/api/importer': {
        target: 'http://localhost:3334',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
