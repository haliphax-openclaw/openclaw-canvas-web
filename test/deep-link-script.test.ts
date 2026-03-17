import { describe, it, expect } from 'vitest'
import { injectDeepLinkIntoDataUrl, DEEP_LINK_SCRIPT } from '../src/server/shared/deep-link-script.js'

describe('injectDeepLinkIntoDataUrl', () => {
  it('returns non-data URLs unchanged', () => {
    expect(injectDeepLinkIntoDataUrl('https://example.com')).toBe('https://example.com')
    expect(injectDeepLinkIntoDataUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
  })

  it('returns data URL without comma unchanged', () => {
    expect(injectDeepLinkIntoDataUrl('data:text/html')).toBe('data:text/html')
  })

  it('injects before </body> in plain data URL', () => {
    const html = '<html><body></body></html>'
    const url = `data:text/html,${encodeURIComponent(html)}`
    const result = injectDeepLinkIntoDataUrl(url)
    const decoded = decodeURIComponent(result.split(',')[1])
    expect(decoded).toContain(DEEP_LINK_SCRIPT + '</body>')
  })

  it('injects before </html> when no </body>', () => {
    const html = '<html><p>hi</p></html>'
    const url = `data:text/html,${encodeURIComponent(html)}`
    const result = injectDeepLinkIntoDataUrl(url)
    const decoded = decodeURIComponent(result.split(',')[1])
    expect(decoded).toContain(DEEP_LINK_SCRIPT + '</html>')
    expect(decoded).not.toContain('</body>')
  })

  it('appends at end when no </body> or </html>', () => {
    const html = '<p>bare</p>'
    const url = `data:text/html,${encodeURIComponent(html)}`
    const result = injectDeepLinkIntoDataUrl(url)
    const decoded = decodeURIComponent(result.split(',')[1])
    expect(decoded).toBe(html + DEEP_LINK_SCRIPT)
  })

  it('handles base64 encoded data URL', () => {
    const html = '<html><body></body></html>'
    const b64 = Buffer.from(html).toString('base64')
    const url = `data:text/html;base64,${b64}`
    const result = injectDeepLinkIntoDataUrl(url)
    expect(result.startsWith('data:text/html;base64,')).toBe(true)
    const decoded = Buffer.from(result.split(',')[1], 'base64').toString('utf-8')
    expect(decoded).toContain(DEEP_LINK_SCRIPT + '</body>')
  })

  it('handles base64 with charset param', () => {
    const html = '<body>test</body>'
    const b64 = Buffer.from(html).toString('base64')
    const url = `data:text/html;charset=utf-8;base64,${b64}`
    const result = injectDeepLinkIntoDataUrl(url)
    expect(result.startsWith('data:text/html;charset=utf-8;base64,')).toBe(true)
    const decoded = Buffer.from(result.split(',')[1], 'base64').toString('utf-8')
    expect(decoded).toContain(DEEP_LINK_SCRIPT)
  })
})
