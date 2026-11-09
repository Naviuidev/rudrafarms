import path from 'node:path'

/** Vite only watches the app folder by default; admin/customer import from ../shared. */
export function watchSharedPlugin(appRoot) {
  const sharedDir = path.resolve(appRoot, '../shared')

  return {
    name: 'watch-shared-ui',
    configureServer(server) {
      server.watcher.add(sharedDir)
    },
    handleHotUpdate({ file, server }) {
      if (!file.startsWith(sharedDir)) {
        return undefined
      }
      server.moduleGraph.invalidateAll()
      server.ws.send({ type: 'full-reload', path: '*' })
      return []
    },
  }
}
