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
      updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text', text: 'hi' }] },
    }, a2uiManager as any, gateway as any)

    expect(result).toBe(true)
    expect(a2uiManager.upsertSurface).toHaveBeenCalledWith('dev', 's1', [{ id: 'c1', component: 'Text', text: 'hi' }])
    expect(broadcasts[0].type).toBe('a2ui.updateComponents')
  })

  it('handles beginRendering', () => {
    const { a2uiManager, gateway, broadcasts } = makeMocks()
    const result = processA2UICommand('dev', {
      createSurface: { surfaceId: 's1', root: 'root' },
    }, a2uiManager as any, gateway as any)

    expect(result).toBe(true)
    expect(a2uiManager.setRoot).toHaveBeenCalledWith('dev', 's1', 'root', { catalogId: undefined, theme: undefined })
    expect(broadcasts[0].type).toBe('a2ui.createSurface')
  })

  it('handles dataModelUpdate', () => {
    const { a2uiManager, gateway, broadcasts } = makeMocks()
    const result = processA2UICommand('dev', {
      updateDataModel: { surfaceId: 's1', data: { foo: 'bar' } },
    }, a2uiManager as any, gateway as any)

    expect(result).toBe(true)
    expect(a2uiManager.updateDataModel).toHaveBeenCalledWith('dev', 's1', { foo: 'bar' })
    expect(broadcasts[0].type).toBe('a2ui.updateDataModel')
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
      updateComponents: { components: [] },
    }, a2uiManager as any, gateway as any)
    expect(result).toBe(false)
    expect(a2uiManager.upsertSurface).not.toHaveBeenCalled()
  })

  it('returns false for beginRendering missing root', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processA2UICommand('dev', {
      createSurface: { surfaceId: 's1' },
    }, a2uiManager as any, gateway as any)
    // v0.9: root defaults to "root" when omitted, so this now succeeds
    expect(result).toBe(true)
    expect(a2uiManager.setRoot).toHaveBeenCalledWith('dev', 's1', 'root', { catalogId: undefined, theme: undefined })
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

describe('v0.8 → v0.9 backward-compat normalization', () => {
  it('accepts v0.8 command name surfaceUpdate and normalizes to updateComponents', () => {
    const { a2uiManager, gateway, broadcasts } = makeMocks()
    const result = processA2UICommand('dev', {
      surfaceUpdate: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text', text: 'hi' }] },
    }, a2uiManager as any, gateway as any)
    expect(result).toBe(true)
    expect(a2uiManager.upsertSurface).toHaveBeenCalled()
    expect(broadcasts[0].type).toBe('a2ui.updateComponents')
  })

  it('accepts v0.8 command name beginRendering and normalizes to createSurface', () => {
    const { a2uiManager, gateway, broadcasts } = makeMocks()
    const result = processA2UICommand('dev', {
      beginRendering: { surfaceId: 's1', root: 'root' },
    }, a2uiManager as any, gateway as any)
    expect(result).toBe(true)
    expect(a2uiManager.setRoot).toHaveBeenCalled()
    expect(broadcasts[0].type).toBe('a2ui.createSurface')
  })

  it('accepts v0.8 command name dataModelUpdate and normalizes to updateDataModel', () => {
    const { a2uiManager, gateway, broadcasts } = makeMocks()
    const result = processA2UICommand('dev', {
      dataModelUpdate: { surfaceId: 's1', data: { x: 1 } },
    }, a2uiManager as any, gateway as any)
    expect(result).toBe(true)
    expect(a2uiManager.updateDataModel).toHaveBeenCalled()
    expect(broadcasts[0].type).toBe('a2ui.updateDataModel')
  })

  it('accepts v0.8 wrapped component shape and normalizes to v0.9 flat', () => {
    const { a2uiManager, gateway } = makeMocks()
    processA2UICommand('dev', {
      updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: { Text: { text: 'wrapped' } } }] },
    }, a2uiManager as any, gateway as any)
    expect(a2uiManager.upsertSurface).toHaveBeenCalledWith('dev', 's1', [{ id: 'c1', component: 'Text', text: 'wrapped' }])
  })

  it('normalizes usageHint to variant', () => {
    const { a2uiManager, gateway } = makeMocks()
    processA2UICommand('dev', {
      updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text', text: 'hi', usageHint: 'h1' }] },
    }, a2uiManager as any, gateway as any)
    const args = a2uiManager.upsertSurface.mock.calls[0][2]
    expect(args[0].variant).toBe('h1')
    expect(args[0].usageHint).toBeUndefined()
  })

  it('normalizes usageHint inside v0.8 wrapped component', () => {
    const { a2uiManager, gateway } = makeMocks()
    processA2UICommand('dev', {
      updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: { Text: { text: 'hi', usageHint: 'label' } } }] },
    }, a2uiManager as any, gateway as any)
    const args = a2uiManager.upsertSurface.mock.calls[0][2]
    expect(args[0].variant).toBe('label')
    expect(args[0].usageHint).toBeUndefined()
  })

  it('createSurface defaults root to "root" when omitted', () => {
    const { a2uiManager, gateway, broadcasts } = makeMocks()
    processA2UICommand('dev', {
      createSurface: { surfaceId: 's1' },
    }, a2uiManager as any, gateway as any)
    expect(a2uiManager.setRoot).toHaveBeenCalledWith('dev', 's1', 'root', { catalogId: undefined, theme: undefined })
    expect(broadcasts[0].root).toBe('root')
  })

  it('createSurface uses explicit root when provided', () => {
    const { a2uiManager, gateway, broadcasts } = makeMocks()
    processA2UICommand('dev', {
      createSurface: { surfaceId: 's1', root: 'myRoot' },
    }, a2uiManager as any, gateway as any)
    expect(a2uiManager.setRoot).toHaveBeenCalledWith('dev', 's1', 'myRoot', { catalogId: undefined, theme: undefined })
    expect(broadcasts[0].root).toBe('myRoot')
  })

  it('createSurface passes theme, catalogId, and sendDataModel', () => {
    const { a2uiManager, gateway, broadcasts } = makeMocks()
    processA2UICommand('dev', {
      createSurface: { surfaceId: 's1', theme: { primaryColor: '#ff0000' }, catalogId: 'urn:test', sendDataModel: true },
    }, a2uiManager as any, gateway as any)
    expect(a2uiManager.setRoot).toHaveBeenCalledWith('dev', 's1', 'root', { catalogId: 'urn:test', theme: { primaryColor: '#ff0000' } })
    expect(broadcasts[0].theme).toEqual({ primaryColor: '#ff0000' })
    expect(broadcasts[0].catalogId).toBe('urn:test')
    expect(broadcasts[0].sendDataModel).toBe(true)
  })
})
