import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const sharedProxy = {
  '/api': {
    target: 'http://127.0.0.1:28401',
    changeOrigin: true
  }
}

const sharedHeaders = {
  'Content-Security-Policy': 'frame-ancestors *'
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  server: {
    host: true,
    port: 28400,
    strictPort: true,
    allowedHosts: true,
    headers: sharedHeaders,
    proxy: sharedProxy
  },
  preview: {
    host: true,
    port: 28400,
    strictPort: true,
    allowedHosts: true,
    headers: sharedHeaders,
    proxy: sharedProxy
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replace(/\\/g, '/')
          if (norm.includes('node_modules/lucide-react')) return 'vendor-icons'
          if (norm.includes('node_modules/react-dom') || norm.includes('node_modules/react/')) return 'vendor-react'
        }
      }
    }
  }
})
