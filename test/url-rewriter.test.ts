import { describe, it, expect, vi } from 'vitest'

vi.stubGlobal('location', { origin: 'http://localhost:3456' })

const { rewriteCanvasUrl } = await import('../src/client/services/url-rewriter')

describe('rewriteCanvasUrl', () => {
  it('rewrites openclaw-canvas:// to http origin', () => {
    expect(rewriteCanvasUrl('openclaw-canvas://my-project/logo.png'))
      .toBe('http://localhost:3456/_c/my-project/logo.png')
  })

  it('returns non-canvas URLs unchanged', () => {
    expect(rewriteCanvasUrl('https://example.com/foo')).toBe('https://example.com/foo')
  })

  it('handles session-only path', () => {
    expect(rewriteCanvasUrl('openclaw-canvas://dash/index.html'))
      .toBe('http://localhost:3456/_c/dash/index.html')
  })
})
