import { describe, it, expect } from 'vitest'
import { injectSnapshotIntoDataUrl, SNAPSHOT_SCRIPT } from '../src/server/shared/snapshot-script.js'

describe('injectSnapshotIntoDataUrl', () => {
  it('returns non-data URLs unchanged', () => {
    expect(injectSnapshotIntoDataUrl('https://example.com')).toBe('https://example.com')
    expect(injectSnapshotIntoDataUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
  })

  it('returns data URL without comma unchanged', () => {
    expect(injectSnapshotIntoDataUrl('data:text/html')).toBe('data:text/html')
  })

  it('injects before </body> in plain data URL', () => {
    const html = '<html><body></body></html>'
    const url = `data:text/html,${encodeURIComponent(html)}`
    const result = injectSnapshotIntoDataUrl(url)
    const decoded = decodeURIComponent(result.split(',')[1])
    expect(decoded).toContain(SNAPSHOT_SCRIPT + '</body>')
  })

  it('injects before </html> when no </body>', () => {
    const html = '<html><p>hi</p></html>'
    const url = `data:text/html,${encodeURIComponent(html)}`
    const result = injectSnapshotIntoDataUrl(url)
    const decoded = decodeURIComponent(result.split(',')[1])
    expect(decoded).toContain(SNAPSHOT_SCRIPT + '</html>')
  })

  it('appends at end when no </body> or </html>', () => {
    const html = '<p>bare</p>'
    const url = `data:text/html,${encodeURIComponent(html)}`
    const result = injectSnapshotIntoDataUrl(url)
    const decoded = decodeURIComponent(result.split(',')[1])
    expect(decoded).toBe(html + SNAPSHOT_SCRIPT)
  })

  it('handles base64 encoded data URL', () => {
    const html = '<html><body></body></html>'
    const b64 = Buffer.from(html).toString('base64')
    const url = `data:text/html;base64,${b64}`
    const result = injectSnapshotIntoDataUrl(url)
    expect(result.startsWith('data:text/html;base64,')).toBe(true)
    const decoded = Buffer.from(result.split(',')[1], 'base64').toString('utf-8')
    expect(decoded).toContain(SNAPSHOT_SCRIPT + '</body>')
  })
})
