import { describe, it, expect, beforeEach } from 'vitest'
import { A2UIManager } from '../src/server/services/a2ui-manager.js'

let mgr: A2UIManager

beforeEach(() => { mgr = new A2UIManager() })

describe('A2UIManager', () => {
  it('creates surface on first upsert', () => {
    mgr.upsertSurface('main', 's1', [{ id: 'c1', component: { Text: { text: 'hi' } } }])
    const s = mgr.getSurface('main', 's1')
    expect(s).toBeTruthy()
    expect(s!.components.get('c1')).toEqual({ Text: { text: 'hi' } })
    expect(s!.root).toBeNull()
  })

  it('merges components on subsequent upserts', () => {
    mgr.upsertSurface('main', 's1', [{ id: 'c1', component: { Text: { text: 'a' } } }])
    mgr.upsertSurface('main', 's1', [{ id: 'c2', component: { Button: { label: 'b' } } }])
    const s = mgr.getSurface('main', 's1')!
    expect(s.components.size).toBe(2)
    expect(s.components.get('c1')).toEqual({ Text: { text: 'a' } })
    expect(s.components.get('c2')).toEqual({ Button: { label: 'b' } })
  })

  it('overwrites component with same id', () => {
    mgr.upsertSurface('main', 's1', [{ id: 'c1', component: { Text: { text: 'old' } } }])
    mgr.upsertSurface('main', 's1', [{ id: 'c1', component: { Text: { text: 'new' } } }])
    expect(mgr.getSurface('main', 's1')!.components.get('c1')).toEqual({ Text: { text: 'new' } })
  })

  it('sets root on existing surface', () => {
    mgr.upsertSurface('main', 's1', [{ id: 'c1', component: {} }])
    mgr.setRoot('main', 's1', 'c1')
    expect(mgr.getSurface('main', 's1')!.root).toBe('c1')
  })

  it('setRoot is no-op for missing surface', () => {
    mgr.setRoot('main', 'nope', 'c1') // should not throw
    expect(mgr.getSurface('main', 'nope')).toBeUndefined()
  })

  it('updates data model', () => {
    mgr.upsertSurface('main', 's1', [])
    mgr.updateDataModel('main', 's1', { count: 1 })
    mgr.updateDataModel('main', 's1', { name: 'test' })
    expect(mgr.getSurface('main', 's1')!.dataModel).toEqual({ count: 1, name: 'test' })
  })

  it('deletes surface', () => {
    mgr.upsertSurface('main', 's1', [])
    mgr.deleteSurface('main', 's1')
    expect(mgr.getSurface('main', 's1')).toBeUndefined()
  })

  it('clearAll removes all surfaces', () => {
    mgr.upsertSurface('main', 's1', [])
    mgr.upsertSurface('main', 's2', [])
    mgr.clearAll()
    expect(mgr.getSurface('main', 's1')).toBeUndefined()
    expect(mgr.getSurface('main', 's2')).toBeUndefined()
  })

  it('serialize returns null for missing surface', () => {
    expect(mgr.serialize('main', 'nope')).toBeNull()
  })

  it('serialize returns flat object with components as record', () => {
    mgr.upsertSurface('main', 's1', [
      { id: 'c1', component: { Text: { text: 'hi' } } },
      { id: 'c2', component: { Button: { label: 'ok' } } },
    ])
    mgr.setRoot('main', 's1', 'c1')
    mgr.updateDataModel('main', 's1', { x: 42 })
    const out = mgr.serialize('main', 's1')!
    expect(out.surfaceId).toBe('s1')
    expect(out.root).toBe('c1')
    expect(out.dataModel).toEqual({ x: 42 })
    expect((out.components as any).c1).toEqual({ Text: { text: 'hi' } })
    expect((out.components as any).c2).toEqual({ Button: { label: 'ok' } })
  })

  it('isolates surfaces across sessions', () => {
    mgr.upsertSurface('sess-a', 's1', [{ id: 'c1', component: { Text: { text: 'a' } } }])
    mgr.upsertSurface('sess-b', 's1', [{ id: 'c1', component: { Text: { text: 'b' } } }])
    expect(mgr.getSurface('sess-a', 's1')!.components.get('c1')).toEqual({ Text: { text: 'a' } })
    expect(mgr.getSurface('sess-b', 's1')!.components.get('c1')).toEqual({ Text: { text: 'b' } })
  })

  it('clearSession only removes surfaces for that session', () => {
    mgr.upsertSurface('sess-a', 's1', [])
    mgr.upsertSurface('sess-b', 's1', [])
    mgr.clearSession('sess-a')
    expect(mgr.getSurface('sess-a', 's1')).toBeUndefined()
    expect(mgr.getSurface('sess-b', 's1')).toBeTruthy()
  })

  it('surfacesForSession returns only matching surfaces', () => {
    mgr.upsertSurface('sess-a', 's1', [])
    mgr.upsertSurface('sess-a', 's2', [])
    mgr.upsertSurface('sess-b', 's3', [])
    const result = mgr.surfacesForSession('sess-a')
    expect(result).toHaveLength(2)
    expect(result.map(s => s.surfaceId).sort()).toEqual(['s1', 's2'])
  })
})
