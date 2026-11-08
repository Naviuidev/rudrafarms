import path from 'node:path'

export function sharedDepsPlugin(appRoot) {
  const sharedDir = path.resolve(appRoot, '../shared')
  const importer = path.resolve(appRoot, 'index.html')

  return {
    name: 'resolve-shared-dependencies',
    async resolveId(source, importedBy, options) {
      if (!importedBy?.startsWith(sharedDir)) return null
      if (source.startsWith('.') || source.startsWith('/') || source.startsWith('\0')) return null
      return this.resolve(source, importer, { ...options, skipSelf: true })
    },
  }
}
