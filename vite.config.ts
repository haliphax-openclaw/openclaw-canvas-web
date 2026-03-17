import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: process.env.VITE_BASE || '/',
  root: 'src/client',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/canvas': 'http://127.0.0.1:3000',
      '/scaffold': 'http://127.0.0.1:3000',
      '/api': 'http://127.0.0.1:3000',
      '/ws': { target: 'ws://127.0.0.1:3000', ws: true },
      '/gateway': { target: 'ws://127.0.0.1:3000', ws: true },
    },
  },
})
