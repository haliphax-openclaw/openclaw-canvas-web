import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import { WebSocket } from 'ws'
import { Gateway } from '../src/server/services/gateway.js'
import { A2UIManager } from '../src/server/services/a2ui-manager.js'
import { registerA2UICommands } from '../src/server/commands/a2ui.js'

let server: http.Server
let gateway: Gateway
let mgr: A2UIManager
let port: number

function connectGw(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/gateway`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function rpc(ws: WebSocket, msg: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.once('message', (raw) => resolve(JSON.parse(raw.toString())))
    ws.send(JSON.stringify(msg))
  })
}

beforeEach(async () => {
  server = http.createServer()
  gateway = new Gateway(server)
  mgr = new A2UIManager()
  registerA2UICommands(gateway, mgr)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  port = (server.address() as any).port
})

afterEach(async () => {
  gateway.close()
  await new Promise<void>((r) => server.close(() => r()))
})

describe('a2ui.push batch validation results', () => {
  it('returns per-command results array', async () => {
    const ws = await connectGw()
    const payload = [
      JSON.stringify({ updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text' }] } }),
      JSON.stringify({ createSurface: { surfaceId: 's1' } }),
    ].join('\n')
    const res = await rpc(ws, { id: '1', command: 'a2ui.push', session: 'main', payload })
    expect(res.ok).toBe(true)
    expect(res.results).toHaveLength(2)
    expect((res.results as any[])[0].ok).toBe(true)
    expect((res.results as any[])[1].ok).toBe(true)
    expect(res.errors).toHaveLength(0)
    ws.close()
  })

  it('returns errors array for validation failures', async () => {
    const ws = await connectGw()
    const payload = [
      JSON.stringify({ updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text' }] } }),
      JSON.stringify({ updateComponents: { components: [] } }), // missing surfaceId
      JSON.stringify({ deleteSurface: {} }), // missing surfaceId
    ].join('\n')
    const res = await rpc(ws, { id: '2', command: 'a2ui.push', session: 'main', payload })
    expect(res.ok).toBe(true)
    expect(res.results).toHaveLength(3)
    expect(res.errors).toHaveLength(2)
    const errors = res.errors as any[]
    expect(errors[0].index).toBe(1)
    expect(errors[0].error).toMatch(/missing surfaceId/)
    expect(errors[1].index).toBe(2)
    ws.close()
  })

  it('includes parse errors in results', async () => {
    const ws = await connectGw()
    const payload = [
      'not json',
      JSON.stringify({ createSurface: { surfaceId: 's1' } }),
    ].join('\n')
    const res = await rpc(ws, { id: '3', command: 'a2ui.push', session: 'main', payload })
    expect(res.ok).toBe(true)
    const results = res.results as any[]
    expect(results[0].ok).toBe(false)
    expect(results[0].command).toBe('parse')
    expect(results[1].ok).toBe(true)
    ws.close()
  })
})
