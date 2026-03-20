import { describe, it, expect, vi } from 'vitest'
import { processPipelineCommand, processBatch, processA2UICommand, type ValidationResult } from '../../src/server/services/a2ui-pipeline.js'

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

describe('processPipelineCommand', () => {
  it('returns ok:true for valid updateComponents', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processPipelineCommand('dev', {
      updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text', text: 'hi' }] },
    }, 0, a2uiManager as any, gateway as any)
    expect(result).toEqual({ ok: true, command: 'updateComponents', index: 0 })
    expect(a2uiManager.upsertSurface).toHaveBeenCalled()
  })

  it('returns validation error for updateComponents missing surfaceId', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processPipelineCommand('dev', {
      updateComponents: { components: [] },
    }, 3, a2uiManager as any, gateway as any)
    expect(result.ok).toBe(false)
    expect(result.command).toBe('updateComponents')
    expect(result.index).toBe(3)
    expect(result.error).toMatch(/missing surfaceId/)
    expect(a2uiManager.upsertSurface).not.toHaveBeenCalled()
  })

  it('returns validation error for updateComponents with non-array components', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processPipelineCommand('dev', {
      updateComponents: { surfaceId: 's1', components: 'not-array' },
    }, 0, a2uiManager as any, gateway as any)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/components must be an array/)
  })

  it('returns ok:true for valid createSurface', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processPipelineCommand('dev', {
      createSurface: { surfaceId: 's1', root: 'myRoot' },
    }, 1, a2uiManager as any, gateway as any)
    expect(result).toEqual({ ok: true, command: 'createSurface', index: 1 })
  })

  it('returns validation error for createSurface missing surfaceId', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processPipelineCommand('dev', {
      createSurface: {},
    }, 0, a2uiManager as any, gateway as any)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/missing surfaceId/)
  })

  it('returns validation error for deleteSurface missing surfaceId', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processPipelineCommand('dev', {
      deleteSurface: {},
    }, 0, a2uiManager as any, gateway as any)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/missing surfaceId/)
  })

  it('returns error for unrecognized command', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processPipelineCommand('dev', { bogus: {} }, 5, a2uiManager as any, gateway as any)
    expect(result).toEqual({ ok: false, command: 'unknown', index: 5, error: 'Unrecognized command' })
  })

  it('preserves index in result', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processPipelineCommand('dev', {
      updateDataModel: { surfaceId: 's1', data: { x: 1 } },
    }, 42, a2uiManager as any, gateway as any)
    expect(result.index).toBe(42)
  })
})

describe('processBatch', () => {
  it('returns per-command results for a multi-line batch', () => {
    const { a2uiManager, gateway } = makeMocks()
    const jsonl = [
      JSON.stringify({ updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text' }] } }),
      JSON.stringify({ createSurface: { surfaceId: 's1' } }),
      JSON.stringify({ updateDataModel: { surfaceId: 's1', data: { count: 5 } } }),
    ].join('\n')

    const results = processBatch('main', jsonl, a2uiManager as any, gateway as any)
    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({ ok: true, command: 'updateComponents', index: 0 })
    expect(results[1]).toEqual({ ok: true, command: 'createSurface', index: 1 })
    expect(results[2]).toEqual({ ok: true, command: 'updateDataModel', index: 2 })
  })

  it('returns parse error for invalid JSON lines', () => {
    const { a2uiManager, gateway } = makeMocks()
    const jsonl = [
      'not valid json',
      JSON.stringify({ updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text' }] } }),
    ].join('\n')

    const results = processBatch('main', jsonl, a2uiManager as any, gateway as any)
    expect(results).toHaveLength(2)
    expect(results[0].ok).toBe(false)
    expect(results[0].command).toBe('parse')
    expect(results[0].index).toBe(0)
    expect(results[0].error).toMatch(/Invalid JSON/)
    expect(results[1].ok).toBe(true)
  })

  it('returns mixed success and validation errors', () => {
    const { a2uiManager, gateway } = makeMocks()
    const jsonl = [
      JSON.stringify({ updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text' }] } }),
      JSON.stringify({ updateComponents: { components: [] } }), // missing surfaceId
      JSON.stringify({ deleteSurface: { surfaceId: 's1' } }),
    ].join('\n')

    const results = processBatch('main', jsonl, a2uiManager as any, gateway as any)
    expect(results[0].ok).toBe(true)
    expect(results[1].ok).toBe(false)
    expect(results[1].error).toMatch(/missing surfaceId/)
    expect(results[2].ok).toBe(true)
  })

  it('skips blank lines', () => {
    const { a2uiManager, gateway } = makeMocks()
    const jsonl = '\n' + JSON.stringify({ createSurface: { surfaceId: 's1' } }) + '\n\n'
    const results = processBatch('main', jsonl, a2uiManager as any, gateway as any)
    expect(results).toHaveLength(1)
    expect(results[0].ok).toBe(true)
  })

  it('returns empty array for empty input', () => {
    const { a2uiManager, gateway } = makeMocks()
    const results = processBatch('main', '', a2uiManager as any, gateway as any)
    expect(results).toEqual([])
  })
})

describe('processA2UICommand backward compat', () => {
  it('returns true for valid commands', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processA2UICommand('dev', {
      updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text' }] },
    }, a2uiManager as any, gateway as any)
    expect(result).toBe(true)
  })

  it('returns false for invalid commands', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processA2UICommand('dev', { bogus: {} }, a2uiManager as any, gateway as any)
    expect(result).toBe(false)
  })
})
