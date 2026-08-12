import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    host: true,
  },
  build: {
    target: 'es2020',
  },
  test: {
    exclude: ['tests/**', '**/node_modules/**', '**/dist/**'],
  },
})
