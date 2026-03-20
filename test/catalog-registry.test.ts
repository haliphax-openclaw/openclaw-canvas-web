import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { CatalogRegistry } from '../src/server/services/catalog-registry.js'

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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-test-'))
  fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true })
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('CatalogRegistry', () => {
  it('discovers packages with openclaw-canvas-web field', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, 'test-catalog', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['Chart', 'Graph'],
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    const entry = registry.getPackage('test-catalog')
    expect(entry).toBeTruthy()
    expect(entry!.packageName).toBe('test-catalog')
    expect(entry!.componentNames).toEqual(['Chart', 'Graph'])
  })

  it('discovers scoped packages', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, '@example/a2ui-charts', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['BarChart', 'LineChart'],
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    const entry = registry.getPackage('@example/a2ui-charts')
    expect(entry).toBeTruthy()
    expect(entry!.componentNames).toEqual(['BarChart', 'LineChart'])
  })

  it('skips packages without openclaw-canvas-web field', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, 'regular-package', {})
    setupMockPackage(nm, 'catalog-pkg', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['Widget'],
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    expect(registry.getPackage('regular-package')).toBeUndefined()
    expect(registry.getPackage('catalog-pkg')).toBeTruthy()
  })

  it('handles missing catalog file gracefully', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, 'broken-catalog', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      skipCatalogFile: true,
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    const entry = registry.getPackage('broken-catalog')
    expect(entry).toBeTruthy()
    expect(entry!.componentNames).toEqual([])
  })

  it('handles missing node_modules gracefully', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-empty-'))
    const registry = new CatalogRegistry()
    await registry.discover(emptyDir)
    expect(registry.allCatalogs()).toEqual([])
    fs.rmSync(emptyDir, { recursive: true, force: true })
  })

  it('allCatalogs returns all discovered catalogs', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, 'cat-a', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['A1', 'A2'],
    })
    setupMockPackage(nm, 'cat-b', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['B1'],
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    const all = registry.allCatalogs()
    expect(all).toHaveLength(2)
    const ids = all.map((c) => c.catalogId).sort()
    expect(ids).toEqual(['cat-a', 'cat-b'])
  })

  it('getCatalogComponents returns components for a catalog', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, 'my-catalog', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['Foo', 'Bar'],
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    expect(registry.getCatalogComponents('my-catalog')).toEqual(['Foo', 'Bar'])
    expect(registry.getCatalogComponents('nonexistent')).toEqual([])
  })

  it('getComponentMap builds a flat component-to-package map', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, 'pkg-a', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['Alpha', 'Beta'],
    })
    setupMockPackage(nm, 'pkg-b', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['Gamma'],
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    const map = registry.getComponentMap()
    expect(map['Alpha'].packageName).toBe('pkg-a')
    expect(map['Beta'].packageName).toBe('pkg-a')
    expect(map['Gamma'].packageName).toBe('pkg-b')
  })

  it('first package wins on component name collision', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, 'aaa-first', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['Shared'],
    })
    setupMockPackage(nm, 'zzz-second', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['Shared'],
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    const map = registry.getComponentMap()
    expect(map['Shared'].packageName).toBe('aaa-first')
  })

  it('supports catalog components as objects with name field', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, 'obj-catalog', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: [{ name: 'ObjComp' }],
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    expect(registry.getCatalogComponents('obj-catalog')).toEqual(['ObjComp'])
  })

  it('clears previous results on re-discover', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, 'old-pkg', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['Old'],
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)
    expect(registry.getPackage('old-pkg')).toBeTruthy()

    // Remove the package and re-discover
    fs.rmSync(path.join(nm, 'old-pkg'), { recursive: true, force: true })
    await registry.discover(tmpDir)
    expect(registry.getPackage('old-pkg')).toBeUndefined()
  })
})

describe('/api/catalogs endpoint', () => {
  it('returns catalog list in expected format', async () => {
    const nm = path.join(tmpDir, 'node_modules')
    setupMockPackage(nm, '@test/catalog-one', {
      canvasField: { catalog: './catalog.json', entry: './dist/index.js' },
      catalogComponents: ['Comp1', 'Comp2'],
    })

    const registry = new CatalogRegistry()
    await registry.discover(tmpDir)

    // Import the route factory and create a mini Express app
    const { catalogsRoute } = await import('../src/server/routes/catalogs.js')
    const express = (await import('express')).default
    const app = express()
    app.use(catalogsRoute(registry))

    // Use a simple supertest-like approach with node http
    const http = await import('node:http')
    const server = app.listen(0)
    const addr = server.address() as { port: number }

    try {
      const res = await fetch(`http://127.0.0.1:${addr.port}/api/catalogs`)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toHaveProperty('catalogs')
      expect(Array.isArray(body.catalogs)).toBe(true)
      expect(body.catalogs).toHaveLength(1)
      expect(body.catalogs[0]).toEqual({
        catalogId: '@test/catalog-one',
        components: ['Comp1', 'Comp2'],
      })
    } finally {
      server.close()
    }
  })

  it('returns empty array when no catalogs discovered', async () => {
    const registry = new CatalogRegistry()

    const { catalogsRoute } = await import('../src/server/routes/catalogs.js')
    const express = (await import('express')).default
    const app = express()
    app.use(catalogsRoute(registry))

    const server = app.listen(0)
    const addr = server.address() as { port: number }

    try {
      const res = await fetch(`http://127.0.0.1:${addr.port}/api/catalogs`)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual({ catalogs: [] })
    } finally {
      server.close()
    }
  })
})
