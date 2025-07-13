import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    https: false // Keep false for development
  },
  build: {
    // Ensure assets use relative paths
    assetsDir: 'assets',
  },
  base: '/', // Make sure this is set correctly
})