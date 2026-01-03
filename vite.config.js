import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use your exact repo name here
export default defineConfig({
  plugins: [react()],
  base: '/NexusPlan/', 
})
