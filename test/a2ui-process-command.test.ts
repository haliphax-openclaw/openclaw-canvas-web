import { describe, it, expect, vi } from 'vitest'
import { processA2UICommand } from '../src/server/services/a2ui-commands.js'

function makeMocks() {
  const a2uiManager = {
    upsertSurface: vi.fn(),
    setRoot: vi.fn(),
    updateDataModel: vi.fn(),
    deleteSurface: vi.fn(),
  }
  const broadcasts: any[] = []
  const gateway = {
    broadcastSpaSession: vi.fn((_s: string, msg: any) => broadcasts.push(msg)),
  }
  return { a2uiManager, gateway, broadcasts }
}

describe('processA2UICommand', () => {
  it('handles surfaceUpdate', () => {
    const { a2uiManager, gateway, broadcasts } = makeMocks()
    const result = processA2UICommand('dev', {
      surfaceUpdate: { surfaceId: 's1', components: [{ id: 'c1', component: { Text: { text: 'hi' } } }] },
    }, a2uiManager as any, gateway as any)

    expect(result).toBe(true)
    expect(a2uiManager.upsertSurface).toHaveBeenCalledWith('dev', 's1', [{ id: 'c1', component: { Text: { text: 'hi' } } }])
    expect(broadcasts[0].type).toBe('a2ui.surfaceUpdate')
  })

  it('handles beginRendering', () => {
    const { a2uiManager, gateway, broadcasts } = makeMocks()
    const result = processA2UICommand('dev', {
      beginRendering: { surfaceId: 's1', root: 'root' },
    }, a2uiManager as any, gateway as any)

    expect(result).toBe(true)
    expect(a2uiManager.setRoot).toHaveBeenCalledWith('dev', 's1', 'root')
    expect(broadcasts[0].type).toBe('a2ui.beginRendering')
  })

  it('handles dataModelUpdate', () => {
    const { a2uiManager, gateway, broadcasts } = makeMocks()
    const result = processA2UICommand('dev', {
      dataModelUpdate: { surfaceId: 's1', data: { foo: 'bar' } },
    }, a2uiManager as any, gateway as any)

    expect(result).toBe(true)
    expect(a2uiManager.updateDataModel).toHaveBeenCalledWith('dev', 's1', { foo: 'bar' })
    expect(broadcasts[0].type).toBe('a2ui.dataModelUpdate')
  })

  it('handles dataSourcePush by wrapping in $sources', () => {
    const { a2uiManager, gateway, broadcasts } = makeMocks()
    const sources = { users: { fields: ['name'], rows: [{ name: 'Alice' }] } }
    const result = processA2UICommand('dev', {
      dataSourcePush: { surfaceId: 's1', sources },
    }, a2uiManager as any, gateway as any)

    expect(result).toBe(true)
    expect(a2uiManager.updateDataModel).toHaveBeenCalledWith('dev', 's1', { $sources: sources })
    expect(broadcasts[0].type).toBe('a2ui.dataModelUpdate')
    expect(broadcasts[0].data.$sources).toEqual(sources)
  })

  it('handles deleteSurface', () => {
    const { a2uiManager, gateway, broadcasts } = makeMocks()
    const result = processA2UICommand('dev', {
      deleteSurface: { surfaceId: 's1' },
    }, a2uiManager as any, gateway as any)

    expect(result).toBe(true)
    expect(a2uiManager.deleteSurface).toHaveBeenCalledWith('dev', 's1')
    expect(broadcasts[0].type).toBe('a2ui.deleteSurface')
  })

  it('returns false for unknown commands', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processA2UICommand('dev', { unknownCommand: {} }, a2uiManager as any, gateway as any)
    expect(result).toBe(false)
  })

  it('returns false for surfaceUpdate missing surfaceId', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processA2UICommand('dev', {
      surfaceUpdate: { components: [] },
    }, a2uiManager as any, gateway as any)
    expect(result).toBe(false)
    expect(a2uiManager.upsertSurface).not.toHaveBeenCalled()
  })

  it('returns false for beginRendering missing root', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processA2UICommand('dev', {
      beginRendering: { surfaceId: 's1' },
    }, a2uiManager as any, gateway as any)
    expect(result).toBe(false)
    expect(a2uiManager.setRoot).not.toHaveBeenCalled()
  })

  it('returns false for dataSourcePush missing surfaceId', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processA2UICommand('dev', {
      dataSourcePush: { sources: {} },
    }, a2uiManager as any, gateway as any)
    expect(result).toBe(false)
    expect(a2uiManager.updateDataModel).not.toHaveBeenCalled()
  })

  it('returns false for deleteSurface missing surfaceId', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processA2UICommand('dev', {
      deleteSurface: {},
    }, a2uiManager as any, gateway as any)
    expect(result).toBe(false)
    expect(a2uiManager.deleteSurface).not.toHaveBeenCalled()
  })
})
