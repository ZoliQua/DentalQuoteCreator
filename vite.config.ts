import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@odontogram-shell': path.resolve(
        __dirname,
        './test_uis/odontogram_editor_v4/src/App.tsx'
      ),
    },
  },
})
