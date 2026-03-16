import { describe, it, expect } from 'vitest'
import { SessionManager } from '../src/server/services/session-manager.js'

describe('SessionManager', () => {
  it('defaults to main session', () => {
    const sm = new SessionManager()
    expect(sm.getActive()).toBe('main')
    expect(sm.getSessions()).toEqual(['main'])
  })

  it('setActive switches and registers session', () => {
    const sm = new SessionManager()
    sm.setActive('project-x')
    expect(sm.getActive()).toBe('project-x')
    expect(sm.getSessions()).toContain('project-x')
    expect(sm.getSessions()).toContain('main')
  })

  it('addSession registers without switching', () => {
    const sm = new SessionManager()
    sm.addSession('bg-session')
    expect(sm.getActive()).toBe('main')
    expect(sm.getSessions()).toContain('bg-session')
  })

  it('does not duplicate sessions', () => {
    const sm = new SessionManager()
    sm.setActive('main')
    sm.setActive('main')
    sm.addSession('main')
    expect(sm.getSessions().filter(s => s === 'main').length).toBe(1)
  })
})
