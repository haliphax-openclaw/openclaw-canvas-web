import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { CatalogRegistry } from '../src/server/services/catalog-registry.js'
import { generateVirtualModule } from '../src/build/vite-plugin-catalogs.js'

let tmpDir: string

function setupMockPackage(
  nodeModules: string,
  pkgName: string,
  opts: {
    canvasField?: Record<string, string>
    catalogComponents?: (string | { name: string })[]
    skipCatalogFile?: boolean
  } = {},
) {
  const pkgDir = path.join(nodeModules, pkgName)
  fs.mkdirSync(pkgDir, { recursive: true })

  const pkgJson: Record<string, unknown> = {
    name: pkgName,
    version: '1.0.0',
  }
  if (opts.canvasField) {
    pkgJson['openclaw-canvas-web'] = opts.canvasField
  }
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify(pkgJson))

  if (opts.canvasField?.catalog && !opts.skipCatalogFile) {
    const catalogPath = path.resolve(pkgDir, opts.canvasField.catalog)
    fs.mkdirSync(path.dirname(catalogPath), { recursive: true })
    fs.writeFileSync(
      catalogPath,
      JSON.stringify({ components: opts.catalogComponents ?? [] }),
    )
  }

  if (opts.canvasField?.entry) {
    const entryPath = path.resolve(pkgDir, opts.canvasField.entry)
    fs.mkdirSync(path.dirname(entryPath), { recursive: true })
    fs.writeFileSync(entryPath, 'export default { components: [] }')
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-plugin-test-'))
  fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true })
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('generateVirtualModule', () => {
  it('generates empty map when no catalogs discovered', async () => {
    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    const code = generateVirtualModule(registry)
    expect(code).toBe('export const catalogComponents = {};\n')
  })

  it('generates imports and registrations for discovered catalogs', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, 'test-charts', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['BarChart', 'LineChart'],
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    const code = generateVirtualModule(registry)

    // Should have an import statement with the entry path
    expect(code).toContain('import pkg_test_charts from')
    expect(code).toContain('dist/index.js')

    // Should have the registerPackage helper
    expect(code).toContain('function registerPackage(def)')

    // Should export catalogComponents with spread
    expect(code).toContain('export const catalogComponents = { ...registerPackage(pkg_test_charts) }')
  })

  it('generates imports for multiple catalog packages', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, 'cat-alpha', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['Alpha'],
    })
    setupMockPackage(nm, 'cat-beta', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['Beta'],
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    const code = generateVirtualModule(registry)

    expect(code).toContain('import pkg_cat_alpha from')
    expect(code).toContain('import pkg_cat_beta from')
    expect(code).toContain('...registerPackage(pkg_cat_alpha)')
    expect(code).toContain('...registerPackage(pkg_cat_beta)')
  })

  it('handles scoped package names in variable sanitization', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, '@example/a2ui-charts', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['Chart'],
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    const code = generateVirtualModule(registry)

    // Scoped name should be sanitized to valid JS identifier
    expect(code).toContain('import pkg__example_a2ui_charts from')
    expect(code).toContain('...registerPackage(pkg__example_a2ui_charts)')
  })

  it('generates valid registerPackage helper that handles empty components', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, 'empty-pkg', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: [],
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    const code = generateVirtualModule(registry)

    // Should still generate code (the package was discovered, just has no components in catalog.json)
    expect(code).toContain('registerPackage')
    // The helper should handle def.components being empty or missing
    expect(code).toContain('(def.components || [])')
  })
})
