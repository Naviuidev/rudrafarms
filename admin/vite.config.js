import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { sharedDepsPlugin } from '../shared/resolveSharedDeps.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), sharedDepsPlugin(root)],
  resolve: {
    alias: {
      '@brand': path.resolve(root, '../shared/ui'),
    },
  },
  server: {
    port: 5174,
    fs: {
      allow: [path.resolve(root, '..')],
    },
  },
})
