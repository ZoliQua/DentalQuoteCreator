import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@odontogram-shell': path.resolve(
        __dirname,
        './src/modules/odontogram/engine/src/App.tsx'
      ),
      '@flexi-importer': path.resolve(
        __dirname,
        './submodules/dq-flexi-importer/src'
      ),
    },
  },
  server: {
    proxy: {
      '/backend': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend/, ''),
      },
      '/api/flexi': {
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
