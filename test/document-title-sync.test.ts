import { describe, it, expect } from 'vitest'
import {
  SPA_DOCUMENT_TITLE,
  resolveCanvasDocumentTitle,
} from '../src/client/utils/document-title-sync.js'

describe('resolveCanvasDocumentTitle', () => {
  it('uses SPA title when A2UI surface is active', () => {
    expect(
      resolveCanvasDocumentTitle({
        hasA2UISurface: true,
        iframeContentDocument: { title: 'Ignored Iframe Title' },
      }),
    ).toBe(SPA_DOCUMENT_TITLE)
  })

  it('uses trimmed iframe title in iframe mode', () => {
    expect(
      resolveCanvasDocumentTitle({
        hasA2UISurface: false,
        iframeContentDocument: { title: '  My Dashboard  ' },
      }),
    ).toBe('My Dashboard')
  })

  it('falls back to SPA title when iframe title is empty', () => {
    expect(
      resolveCanvasDocumentTitle({
        hasA2UISurface: false,
        iframeContentDocument: { title: '' },
      }),
    ).toBe(SPA_DOCUMENT_TITLE)
  })

  it('falls back to SPA title when iframe title is whitespace only', () => {
    expect(
      resolveCanvasDocumentTitle({
        hasA2UISurface: false,
        iframeContentDocument: { title: '   \t  ' },
      }),
    ).toBe(SPA_DOCUMENT_TITLE)
  })

  it('falls back to SPA title when there is no iframe document', () => {
    expect(
      resolveCanvasDocumentTitle({
        hasA2UISurface: false,
        iframeContentDocument: undefined,
      }),
    ).toBe(SPA_DOCUMENT_TITLE)
    expect(
      resolveCanvasDocumentTitle({
        hasA2UISurface: false,
        iframeContentDocument: null,
      }),
    ).toBe(SPA_DOCUMENT_TITLE)
  })

  it('falls back to SPA title when reading iframe title throws (e.g. cross-origin)', () => {
    const hostile = {} as Document
    Object.defineProperty(hostile, 'title', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    expect(
      resolveCanvasDocumentTitle({
        hasA2UISurface: false,
        iframeContentDocument: hostile,
      }),
    ).toBe(SPA_DOCUMENT_TITLE)
  })
})

describe('SPA_DOCUMENT_TITLE', () => {
  it('matches index.html title', () => {
    expect(SPA_DOCUMENT_TITLE).toBe('OpenClaw Canvas')
  })
})
