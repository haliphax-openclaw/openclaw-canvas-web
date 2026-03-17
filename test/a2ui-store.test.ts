import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { A2UIStore } from '../src/server/services/a2ui-store.js'
import { A2UIManager } from '../src/server/services/a2ui-manager.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

let tmpDir: string
let dbPath: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2ui-store-test-'))
  dbPath = path.join(tmpDir, 'test.db')
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('A2UIStore', () => {
  it('save and load a surface', () => {
    const store = new A2UIStore(dbPath)
    const surface = {
      surfaceId: 's1',
      components: new Map([['c1', { Text: { text: 'hi' } }]]),
      root: 'c1',
      dataModel: { count: 1 },
    }
    store.save('main', surface)
    const row = store.load('main', 's1')!
    expect(row.session).toBe('main')
    expect(row.surfaceId).toBe('s1')
    expect(JSON.parse(row.components)).toEqual({ c1: { Text: { text: 'hi' } } })
    expect(row.root).toBe('c1')
    expect(JSON.parse(row.dataModel)).toEqual({ count: 1 })
    store.close()
  })

  it('loadAll returns all surfaces', () => {
    const store = new A2UIStore(dbPath)
    store.save('main', { surfaceId: 's1', components: new Map(), root: null, dataModel: {} })
    store.save('main', { surfaceId: 's2', components: new Map(), root: 'r', dataModel: { x: 1 } })
    const rows = store.loadAll()
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.surfaceId).sort()).toEqual(['s1', 's2'])
    store.close()
  })

  it('delete removes a surface', () => {
    const store = new A2UIStore(dbPath)
    store.save('main', { surfaceId: 's1', components: new Map(), root: null, dataModel: {} })
    store.delete('main', 's1')
    expect(store.load('main', 's1')).toBeUndefined()
    store.close()
  })

  it('clear removes all surfaces', () => {
    const store = new A2UIStore(dbPath)
    store.save('main', { surfaceId: 's1', components: new Map(), root: null, dataModel: {} })
    store.save('other', { surfaceId: 's2', components: new Map(), root: null, dataModel: {} })
    store.clear()
    expect(store.loadAll()).toHaveLength(0)
    store.close()
  })

  it('save overwrites existing surface', () => {
    const store = new A2UIStore(dbPath)
    store.save('main', { surfaceId: 's1', components: new Map([['c1', { old: true }]]), root: null, dataModel: {} })
    store.save('main', { surfaceId: 's1', components: new Map([['c1', { new: true }]]), root: 'r', dataModel: { v: 2 } })
    const row = store.load('main', 's1')!
    expect(JSON.parse(row.components)).toEqual({ c1: { new: true } })
    expect(row.root).toBe('r')
    store.close()
  })

  it('same surfaceId in different sessions are independent', () => {
    const store = new A2UIStore(dbPath)
    store.save('sess-a', { surfaceId: 's1', components: new Map([['c1', { a: true }]]), root: null, dataModel: {} })
    store.save('sess-b', { surfaceId: 's1', components: new Map([['c1', { b: true }]]), root: null, dataModel: {} })
    expect(JSON.parse(store.load('sess-a', 's1')!.components)).toEqual({ c1: { a: true } })
    expect(JSON.parse(store.load('sess-b', 's1')!.components)).toEqual({ c1: { b: true } })
    store.close()
  })

  it('clearSession only removes surfaces for that session', () => {
    const store = new A2UIStore(dbPath)
    store.save('sess-a', { surfaceId: 's1', components: new Map(), root: null, dataModel: {} })
    store.save('sess-b', { surfaceId: 's1', components: new Map(), root: null, dataModel: {} })
    store.clearSession('sess-a')
    expect(store.load('sess-a', 's1')).toBeUndefined()
    expect(store.load('sess-b', 's1')).toBeTruthy()
    store.close()
  })
})

describe('A2UIManager + A2UIStore integration', () => {
  it('persists upsertSurface to store', () => {
    const store = new A2UIStore(dbPath)
    const mgr = new A2UIManager(store)
    mgr.upsertSurface('main', 's1', [{ id: 'c1', component: { Text: { text: 'hi' } } }])
    const row = store.load('main', 's1')!
    expect(JSON.parse(row.components)).toEqual({ c1: { Text: { text: 'hi' } } })
    store.close()
  })

  it('persists setRoot to store', () => {
    const store = new A2UIStore(dbPath)
    const mgr = new A2UIManager(store)
    mgr.upsertSurface('main', 's1', [{ id: 'c1', component: {} }])
    mgr.setRoot('main', 's1', 'c1')
    expect(store.load('main', 's1')!.root).toBe('c1')
    store.close()
  })

  it('persists updateDataModel to store', () => {
    const store = new A2UIStore(dbPath)
    const mgr = new A2UIManager(store)
    mgr.upsertSurface('main', 's1', [])
    mgr.updateDataModel('main', 's1', { count: 5 })
    expect(JSON.parse(store.load('main', 's1')!.dataModel)).toEqual({ count: 5 })
    store.close()
  })

  it('persists deleteSurface to store', () => {
    const store = new A2UIStore(dbPath)
    const mgr = new A2UIManager(store)
    mgr.upsertSurface('main', 's1', [])
    mgr.deleteSurface('main', 's1')
    expect(store.load('main', 's1')).toBeUndefined()
    store.close()
  })

  it('persists clearAll to store', () => {
    const store = new A2UIStore(dbPath)
    const mgr = new A2UIManager(store)
    mgr.upsertSurface('main', 's1', [])
    mgr.upsertSurface('other', 's2', [])
    mgr.clearAll()
    expect(store.loadAll()).toHaveLength(0)
    store.close()
  })

  it('loads surfaces from store on construction', () => {
    const store1 = new A2UIStore(dbPath)
    const mgr1 = new A2UIManager(store1)
    mgr1.upsertSurface('main', 's1', [{ id: 'c1', component: { Text: { text: 'persisted' } } }])
    mgr1.setRoot('main', 's1', 'c1')
    mgr1.updateDataModel('main', 's1', { key: 'val' })
    store1.close()

    // Simulate restart: new store + new manager from same db
    const store2 = new A2UIStore(dbPath)
    const mgr2 = new A2UIManager(store2)
    const surface = mgr2.getSurface('main', 's1')!
    expect(surface).toBeTruthy()
    expect(surface.components.get('c1')).toEqual({ Text: { text: 'persisted' } })
    expect(surface.root).toBe('c1')
    expect(surface.dataModel).toEqual({ key: 'val' })
    store2.close()
  })

  it('works without a store (backward compatible)', () => {
    const mgr = new A2UIManager()
    mgr.upsertSurface('main', 's1', [{ id: 'c1', component: {} }])
    expect(mgr.getSurface('main', 's1')).toBeTruthy()
    mgr.deleteSurface('main', 's1')
    expect(mgr.getSurface('main', 's1')).toBeUndefined()
  })
})
