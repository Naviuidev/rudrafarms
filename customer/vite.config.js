import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { sharedDepsPlugin } from '../shared/resolveSharedDeps.mjs'
import { monorepoEnvPlugin } from '../shared/vite/monorepoEnv.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [react(), sharedDepsPlugin(root), monorepoEnvPlugin(mode, root)],
  resolve: {
    alias: {
      '@brand': path.resolve(root, '../shared/ui'),
      '@shared': path.resolve(root, '../shared'),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [path.resolve(root, '..')],
    },
  },
}))
