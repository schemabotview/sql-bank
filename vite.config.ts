import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ported from python-expense-tracker. `dedupe` keeps one React across this app and both packages
// (they declare it as a peer). `base` is `/<repo-slug>/` for the production build only: the app
// deploys under graphl.in/sql-bank/; dev stays at `/` for the capture and record scripts.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/sql-bank/' : '/',
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5173 },
}))
