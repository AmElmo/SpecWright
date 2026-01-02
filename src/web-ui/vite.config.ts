import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Enable tracing in development when SPECWRIGHT_TRACE is set
const enableTrace = process.env.SPECWRIGHT_TRACE === 'true'

export default defineConfig({
  plugins: [
    react({
      babel: enableTrace
        ? {
            plugins: [path.resolve(__dirname, '../../babel-plugin-auto-trace.cjs')],
          }
        : undefined,
    }),
  ],
  define: {
    // Pass trace env to client
    'process.env.SPECWRIGHT_TRACE': JSON.stringify(process.env.SPECWRIGHT_TRACE || 'false'),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
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

