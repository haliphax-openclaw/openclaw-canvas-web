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

describe('a2ui commands', () => {
  it('a2ui.push processes surfaceUpdate JSONL', async () => {
    const ws = await connectGw()
    const payload = JSON.stringify({
      surfaceUpdate: {
        surfaceId: 's1',
        components: [{ id: 'c1', component: { Text: { text: 'hi' } } }],
      },
    })
    const res = await rpc(ws, { id: '1', command: 'a2ui.push', payload })
    expect(res.ok).toBe(true)
    expect(mgr.getSurface('s1')).toBeTruthy()
    expect(mgr.getSurface('s1')!.components.get('c1')).toEqual({ Text: { text: 'hi' } })
    ws.close()
  })

  it('a2ui.push processes multi-line JSONL', async () => {
    const ws = await connectGw()
    const lines = [
      JSON.stringify({ surfaceUpdate: { surfaceId: 's1', components: [{ id: 'c1', component: { Text: {} } }] } }),
      JSON.stringify({ beginRendering: { surfaceId: 's1', root: 'c1' } }),
      JSON.stringify({ dataModelUpdate: { surfaceId: 's1', data: { count: 5 } } }),
    ].join('\n')
    const res = await rpc(ws, { id: '2', command: 'a2ui.push', payload: lines })
    expect(res.ok).toBe(true)
    const s = mgr.getSurface('s1')!
    expect(s.root).toBe('c1')
    expect(s.dataModel).toEqual({ count: 5 })
    ws.close()
  })

  it('a2ui.push handles deleteSurface', async () => {
    mgr.upsertSurface('s1', [])
    const ws = await connectGw()
    const payload = JSON.stringify({ deleteSurface: { surfaceId: 's1' } })
    await rpc(ws, { id: '3', command: 'a2ui.push', payload })
    expect(mgr.getSurface('s1')).toBeUndefined()
    ws.close()
  })

  it('a2ui.push skips malformed JSON lines without failing', async () => {
    const ws = await connectGw()
    const lines = [
      'not valid json',
      JSON.stringify({ surfaceUpdate: { surfaceId: 's1', components: [{ id: 'c1', component: {} }] } }),
    ].join('\n')
    const res = await rpc(ws, { id: '4', command: 'a2ui.push', payload: lines })
    expect(res.ok).toBe(true)
    expect(mgr.getSurface('s1')).toBeTruthy()
    ws.close()
  })

  it('a2ui.push skips surfaceUpdate with missing surfaceId', async () => {
    const ws = await connectGw()
    const payload = JSON.stringify({ surfaceUpdate: { components: [] } })
    const res = await rpc(ws, { id: '5', command: 'a2ui.push', payload })
    expect(res.ok).toBe(true)
    // No surface should have been created
    expect(mgr.getSurface('')).toBeUndefined()
    ws.close()
  })

  it('a2ui.push skips beginRendering with missing root', async () => {
    mgr.upsertSurface('s1', [])
    const ws = await connectGw()
    const payload = JSON.stringify({ beginRendering: { surfaceId: 's1' } })
    await rpc(ws, { id: '6', command: 'a2ui.push', payload })
    expect(mgr.getSurface('s1')!.root).toBeNull()
    ws.close()
  })

  it('a2ui.push rejects missing payload', async () => {
    const ws = await connectGw()
    const res = await rpc(ws, { id: '7', command: 'a2ui.push' })
    expect(res.error).toMatch(/Missing or invalid payload/)
    ws.close()
  })

  it('a2ui.push rejects non-string payload', async () => {
    const ws = await connectGw()
    const res = await rpc(ws, { id: '8', command: 'a2ui.push', payload: 123 })
    expect(res.error).toMatch(/Missing or invalid payload/)
    ws.close()
  })

  it('a2ui.reset clears all surfaces', async () => {
    mgr.upsertSurface('s1', [])
    mgr.upsertSurface('s2', [])
    const ws = await connectGw()
    const res = await rpc(ws, { id: '9', command: 'a2ui.reset' })
    expect(res.ok).toBe(true)
    expect(mgr.getSurface('s1')).toBeUndefined()
    expect(mgr.getSurface('s2')).toBeUndefined()
    ws.close()
  })

  it('a2ui.push broadcasts surfaceUpdate to SPA clients', async () => {
    const spaWs = await new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
      ws.on('open', () => resolve(ws))
      ws.on('error', reject)
    })
    await new Promise((r) => setTimeout(r, 50))

    const spaMsg = new Promise<Record<string, unknown>>((resolve) => {
      spaWs.once('message', (raw) => resolve(JSON.parse(raw.toString())))
    })

    const gwWs = await connectGw()
    const payload = JSON.stringify({
      surfaceUpdate: {
        surfaceId: 's1',
        components: [{ id: 'c1', component: { Text: { text: 'broadcast' } } }],
      },
    })
    await rpc(gwWs, { id: '10', command: 'a2ui.push', payload })

    const received = await spaMsg
    expect(received.type).toBe('a2ui.surfaceUpdate')
    expect(received.surfaceId).toBe('s1')

    spaWs.close()
    gwWs.close()
  })
})
