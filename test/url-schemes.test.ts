import { describe, it, expect } from 'vitest'
import { parseOpenClawUrl } from '../src/client/utils/url-schemes'

describe('parseOpenClawUrl', () => {
  describe('openclaw-canvas://', () => {
    it('parses session and path', () => {
      const r = parseOpenClawUrl('openclaw-canvas://my-project/images/logo.png')
      expect(r).toEqual({ type: 'canvas', params: {}, session: 'my-project', path: 'images/logo.png' })
    })

    it('handles session-only (no path)', () => {
      const r = parseOpenClawUrl('openclaw-canvas://dash')
      expect(r).toEqual({ type: 'canvas', params: {}, session: 'dash', path: '' })
    })
  })

  describe('openclaw://', () => {
    it('parses agent URL with params', () => {
      const r = parseOpenClawUrl('openclaw://_?message=hello&sessionKey=sk1')
      expect(r).toEqual({ type: 'agent', params: { message: 'hello', sessionKey: 'sk1' } })
    })

    it('parses agent URL with no params', () => {
      const r = parseOpenClawUrl('openclaw://_')
      expect(r).toEqual({ type: 'agent', params: {} })
    })
  })

  describe('openclaw-fileprompt://', () => {
    it('parses fileprompt URL with params', () => {
      const r = parseOpenClawUrl('openclaw-fileprompt://_?file=prompts/deploy.md&agentId=dev')
      expect(r).toEqual({ type: 'fileprompt', params: { file: 'prompts/deploy.md', agentId: 'dev' } })
    })

    it('parses fileprompt URL with file only', () => {
      const r = parseOpenClawUrl('openclaw-fileprompt://trigger?file=task.txt')
      expect(r).toEqual({ type: 'fileprompt', params: { file: 'task.txt' } })
    })
  })

  describe('non-matching URLs', () => {
    it('returns null for https URLs', () => {
      expect(parseOpenClawUrl('https://example.com')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(parseOpenClawUrl('')).toBeNull()
    })

    it('returns null for plain text', () => {
      expect(parseOpenClawUrl('not a url')).toBeNull()
    })
  })
})
