import { describe, it, expect } from 'vitest'
import { parseOpenClawUrl } from '../src/client/utils/url-schemes.js'

describe('parseOpenClawUrl', () => {
  describe('openclaw-canvas://', () => {
    it('parses session and path', () => {
      const r = parseOpenClawUrl('openclaw-canvas://my-project/images/logo.png')
      expect(r!.type).toBe('canvas')
      expect(r!.path).toBe('my-project/images/logo.png')
    })

    it('handles session-only (no path)', () => {
      const r = parseOpenClawUrl('openclaw-canvas://dash')
      expect(r!.type).toBe('canvas')
      expect(r!.path).toBe('dash')
    })
  })

  describe('openclaw://', () => {
    it('parses agent URL with params', () => {
      const r = parseOpenClawUrl('openclaw://agent?message=hello&sessionKey=sk1')
      expect(r!.type).toBe('agent')
      expect(r!.path).toBe('agent')
      expect(r!.params).toEqual({ message: 'hello', sessionKey: 'sk1' })
    })

    it('parses agent URL with no params', () => {
      const r = parseOpenClawUrl('openclaw://agent')
      expect(r!.type).toBe('agent')
      expect(r!.path).toBe('agent')
      expect(r!.params).toEqual({})
    })
  })

  describe('openclaw-fileprompt://', () => {
    it('parses fileprompt URL with params', () => {
      const r = parseOpenClawUrl('openclaw-fileprompt://prompts/deploy.md?agentId=dev')
      expect(r!.type).toBe('fileprompt')
      expect(r!.path).toBe('prompts/deploy.md')
      expect(r!.params).toEqual({ agentId: 'dev' })
    })

    it('parses fileprompt URL with file only', () => {
      const r = parseOpenClawUrl('openclaw-fileprompt://task.txt')
      expect(r!.type).toBe('fileprompt')
      expect(r!.path).toBe('task.txt')
      expect(r!.params).toEqual({})
    })
  })

  it('returns null for https URLs', () => {
    expect(parseOpenClawUrl('https://example.com')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseOpenClawUrl('')).toBeNull()
  })

  it('returns null for plain text', () => {
    expect(parseOpenClawUrl('hello world')).toBeNull()
  })
})
