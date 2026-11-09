import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { sharedDepsPlugin } from '../shared/resolveSharedDeps.mjs'
import { monorepoEnvPlugin } from '../shared/vite/monorepoEnv.mjs'
import { watchSharedPlugin } from '../shared/vite/watchShared.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [react(), sharedDepsPlugin(root), watchSharedPlugin(root), monorepoEnvPlugin(mode, root)],
  resolve: {
    alias: {
      '@brand': path.resolve(root, '../shared/ui'),
      '@shared': path.resolve(root, '../shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    fs: {
      allow: [path.resolve(root, '..')],
    },
    hmr: {
      host: '127.0.0.1',
      clientPort: 5173,
    },
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
}))
