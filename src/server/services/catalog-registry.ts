import fs from 'node:fs'
import path from 'node:path'

export interface CatalogEntry {
  packageName: string
  catalogPath: string
  entryPath: string
  componentNames: string[]
}

export class CatalogRegistry {
  private packages = new Map<string, CatalogEntry>()

  async discover(projectRoot: string): Promise<void> {
    this.packages.clear()
    const nodeModules = path.join(projectRoot, 'node_modules')
    if (!fs.existsSync(nodeModules)) return

    const entries = fs.readdirSync(nodeModules, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue

      if (entry.name.startsWith('@')) {
        // Scoped package — scan one level deeper
        const scopeDir = path.join(nodeModules, entry.name)
        const scopedEntries = fs.readdirSync(scopeDir, { withFileTypes: true })
        for (const scoped of scopedEntries) {
          if (scoped.name.startsWith('.')) continue
          const pkgName = `${entry.name}/${scoped.name}`
          this.tryRegister(nodeModules, pkgName)
        }
      } else {
        this.tryRegister(nodeModules, entry.name)
      }
    }
  }

  private tryRegister(nodeModules: string, pkgName: string): void {
    const pkgJsonPath = path.join(nodeModules, pkgName, 'package.json')
    let pkgJson: Record<string, unknown>
    try {
      pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
    } catch {
      return
    }

    const field = pkgJson['openclaw-canvas-web'] as
      | { catalog?: string; entry?: string }
      | undefined
    if (!field || typeof field !== 'object') return
    if (!field.catalog || !field.entry) return

    const pkgDir = path.join(nodeModules, pkgName)
    const catalogPath = path.resolve(pkgDir, field.catalog)
    const entryPath = path.resolve(pkgDir, field.entry)

    // Read component names from the catalog JSON
    let componentNames: string[] = []
    try {
      const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
      if (Array.isArray(catalog.components)) {
        componentNames = catalog.components
          .map((c: unknown) => {
            if (typeof c === 'string') return c
            if (c && typeof c === 'object' && 'name' in c) return (c as { name: string }).name
            return null
          })
          .filter(Boolean) as string[]
      }
    } catch {
      // Catalog file missing or malformed — register with empty components
    }

    this.packages.set(pkgName, {
      packageName: pkgName,
      catalogPath,
      entryPath,
      componentNames,
    })
  }

  getPackage(name: string): CatalogEntry | undefined {
    return this.packages.get(name)
  }

  getCatalogComponents(catalogId: string): string[] {
    return this.packages.get(catalogId)?.componentNames ?? []
  }

  allCatalogs(): { catalogId: string; components: string[] }[] {
    return Array.from(this.packages.entries()).map(([id, entry]) => ({
      catalogId: id,
      components: entry.componentNames,
    }))
  }

  getComponentMap(): Record<string, { packageName: string; importPath: string }> {
    const map: Record<string, { packageName: string; importPath: string }> = {}
    for (const [, entry] of this.packages) {
      for (const name of entry.componentNames) {
        if (!map[name]) {
          map[name] = { packageName: entry.packageName, importPath: entry.entryPath }
        }
      }
    }
    return map
  }
}
