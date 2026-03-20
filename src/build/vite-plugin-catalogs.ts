import type { Plugin } from 'vite'
import { CatalogRegistry } from '../server/services/catalog-registry.js'

const VIRTUAL_ID = 'virtual:openclaw-catalogs'
const RESOLVED_ID = '\0virtual:openclaw-catalogs'

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_')
}

export interface CatalogPluginOptions {
  projectRoot: string
}

export function generateVirtualModule(registry: CatalogRegistry): string {
  const catalogs = registry.allCatalogs()
  if (catalogs.length === 0) {
    return 'export const catalogComponents = {};\n'
  }

  const imports: string[] = []
  const spreads: string[] = []

  for (const catalog of catalogs) {
    const entry = registry.getPackage(catalog.catalogId)
    if (!entry) continue

    const varName = `pkg_${sanitize(catalog.catalogId)}`
    imports.push(`import ${varName} from '${entry.entryPath}';`)
    spreads.push(`...registerPackage(${varName})`)
  }

  if (imports.length === 0) {
    return 'export const catalogComponents = {};\n'
  }

  return [
    ...imports,
    '',
    'function registerPackage(def) {',
    '  const map = {};',
    '  for (const c of (def.components || [])) {',
    '    map[c.name] = { component: c.component };',
    '  }',
    '  return map;',
    '}',
    '',
    `export const catalogComponents = { ${spreads.join(', ')} };`,
    '',
  ].join('\n')
}

export function catalogPlugin(options: CatalogPluginOptions): Plugin {
  const registry = new CatalogRegistry()
  let discovered = false

  return {
    name: 'openclaw-catalogs',

    async buildStart() {
      if (!discovered) {
        await registry.discover(options.projectRoot)
        discovered = true
      }
    },

    resolveId(id: string) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },

    load(id: string) {
      if (id === RESOLVED_ID) {
        return generateVirtualModule(registry)
      }
    },
  }
}
