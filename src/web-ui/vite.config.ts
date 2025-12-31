import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5174',
      '/ws': {
        target: 'ws://localhost:5174',
        ws: true
      }
    }
  },
  build: {
    outDir: '../../dist/web-ui',
    emptyOutDir: true
  }
})

