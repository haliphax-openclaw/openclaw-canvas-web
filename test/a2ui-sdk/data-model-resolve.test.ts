import { describe, it, expect } from 'vitest'
import {
  getDataModelValue,
  resolveDynamicString,
  resolveDynamicBoolean,
} from '../../packages/a2ui-sdk/src/utils/data-model-resolve'

describe('data-model-resolve', () => {
  const dm = { user: { email: 'a@b.com' }, flags: { ok: true, bad: false } }

  it('getDataModelValue resolves JSON pointer paths', () => {
    expect(getDataModelValue(dm, '/user/email')).toBe('a@b.com')
    expect(getDataModelValue(dm, 'user/email')).toBe('a@b.com')
    expect(getDataModelValue(dm, '/missing/x')).toBeUndefined()
  })

  it('resolveDynamicString handles string, literalString, and path', () => {
    expect(resolveDynamicString('hi', dm)).toBe('hi')
    expect(resolveDynamicString({ literalString: 'x' }, dm)).toBe('x')
    expect(resolveDynamicString({ path: '/user/email' }, dm)).toBe('a@b.com')
    expect(resolveDynamicString({ path: '/none' }, dm)).toBe('')
  })

  it('resolveDynamicBoolean handles boolean and path', () => {
    expect(resolveDynamicBoolean(true, dm)).toBe(true)
    expect(resolveDynamicBoolean({ path: '/flags/ok' }, dm)).toBe(true)
    expect(resolveDynamicBoolean({ path: '/flags/bad' }, dm)).toBe(false)
    expect(resolveDynamicBoolean({ path: '/user/email' }, dm)).toBeUndefined()
  })
})
