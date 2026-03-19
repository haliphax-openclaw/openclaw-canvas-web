import { describe, it, expect } from 'vitest'
import { parseOpenclawUrl, isOpenclawDeepLink, truncateMessage } from '../src/client/services/deep-link'

describe('parseOpenclawUrl', () => {
  it('parses direct form: openclaw://message=hello', () => {
    const req = parseOpenclawUrl('openclaw://message=hello')
    expect(req).toEqual({ message: 'hello' })
  })

  it('parses all optional params', () => {
    const url = 'openclaw://message=hi&sessionKey=sk&thinking=stream&deliver=d&to=t&channel=ch&timeoutSeconds=30&key=k&agentId=a1&model=m1'
    const req = parseOpenclawUrl(url)!
    expect(req.message).toBe('hi')
    expect(req.sessionKey).toBe('sk')
    expect(req.thinking).toBe('stream')
    expect(req.deliver).toBe('d')
    expect(req.to).toBe('t')
    expect(req.channel).toBe('ch')
    expect(req.timeoutSeconds).toBe(30)
    expect(req.key).toBe('k')
    expect(req.agentId).toBe('a1')
    expect(req.model).toBe('m1')
  })

  it('returns null for non-openclaw URLs', () => {
    expect(parseOpenclawUrl('https://example.com')).toBeNull()
  })

  it('returns null when message param is missing', () => {
    expect(parseOpenclawUrl('openclaw://foo=bar')).toBeNull()
  })
})

describe('isOpenclawDeepLink', () => {
  it('returns true for openclaw:// URLs', () => {
    expect(isOpenclawDeepLink('openclaw://message=hi')).toBe(true)
  })
  it('returns false for other URLs', () => {
    expect(isOpenclawDeepLink('https://example.com')).toBe(false)
  })
})

describe('truncateMessage', () => {
  it('returns short messages unchanged', () => {
    expect(truncateMessage('hello')).toBe('hello')
  })
  it('truncates long messages with ellipsis', () => {
    const long = 'a'.repeat(300)
    const result = truncateMessage(long, 200)
    expect(result.length).toBe(201) // 200 + '…'
    expect(result.endsWith('…')).toBe(true)
  })
})
