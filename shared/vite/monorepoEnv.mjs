import path from 'node:path'
import { loadEnv } from 'vite'

const DEFAULT_LOCAL = 'http://localhost:8000'
const DEFAULT_PROD = 'https://api.rudrasfarmfresh.in'

/**
 * Same idea as backend APP_ENV + LOCAL_/PROD_APP_URL: one root .env, two profiles.
 * App-level VITE_API_URL in customer/.env.* still overrides.
 */
export function resolveViteApiUrl(mode, appRoot) {
  const repoRoot = path.resolve(appRoot, '..')
  const appEnv = loadEnv(mode, appRoot, '')
  const override = appEnv.VITE_API_URL?.trim()
  if (override) return override.replace(/\/$/, '')

  const rootEnv = loadEnv(mode, repoRoot, '')
  const prefix = mode === 'production' ? 'PROD_' : 'LOCAL_'
  const fromRoot = rootEnv[`${prefix}APP_URL`]?.trim()
  if (fromRoot) return fromRoot.replace(/\/$/, '')

  return mode === 'production' ? DEFAULT_PROD : DEFAULT_LOCAL
}

export function monorepoEnvPlugin(mode, appRoot) {
  const apiUrl = resolveViteApiUrl(mode, appRoot)
  const repoRoot = path.resolve(appRoot, '..')

  return {
    name: 'rudras-monorepo-env',
    config() {
      return {
        envDir: repoRoot,
        define: {
          'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
        },
      }
    },
  }
}
