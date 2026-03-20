import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'virtual:openclaw-catalogs': path.resolve(__dirname, 'test/__stubs__/virtual-openclaw-catalogs.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
})
