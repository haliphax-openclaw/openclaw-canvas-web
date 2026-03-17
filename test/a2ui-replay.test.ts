import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import { WebSocket } from 'ws'
import { Gateway } from '../src/server/services/gateway.js'
import { A2UIManager } from '../src/server/services/a2ui-manager.js'

let server: http.Server
let gateway: Gateway
let mgr: A2UIManager
let port: number

function connectSpa(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

/** Connect and collect `count` messages, attaching listener before open to avoid race. */
function connectAndCollect(count: number, timeoutMs = 2000): Promise<{ ws: WebSocket; msgs: Record<string, unknown>[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    const msgs: Record<string, unknown>[] = []
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${count} messages, got ${msgs.length}`)), timeoutMs)
    ws.on('message', (raw) => {
      msgs.push(JSON.parse(raw.toString()))
      if (msgs.length >= count) {
        clearTimeout(timer)
        resolve({ ws, msgs })
      }
    })
    ws.on('error', reject)
  })
}

function wireReplay(gateway: Gateway, mgr: A2UIManager) {
  gateway.onSpaConnect((ws) => {
    for (const surface of mgr.allSurfaces()) {
      const components = Array.from(surface.components.entries()).map(([id, component]) => ({ id, component }))
      gateway.sendToSpa(ws, { type: 'a2ui.surfaceUpdate', surfaceId: surface.surfaceId, components })
      if (surface.root) {
        gateway.sendToSpa(ws, { type: 'a2ui.beginRendering', surfaceId: surface.surfaceId, root: surface.root })
      }
    }
  })
}

beforeEach(async () => {
  server = http.createServer()
  gateway = new Gateway(server)
  mgr = new A2UIManager()
  wireReplay(gateway, mgr)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  port = (server.address() as any).port
})

afterEach(async () => {
  gateway.close()
  await new Promise<void>((r) => server.close(() => r()))
})

describe('A2UI state replay on SPA connect', () => {
  it('replays surfaceUpdate and beginRendering to new client', async () => {
    mgr.upsertSurface('main', [{ id: 'c1', component: { Text: { text: 'hello' } } }])
    mgr.setRoot('main', 'c1')

    const { ws, msgs } = await connectAndCollect(2)

    expect(msgs[0]).toEqual({
      type: 'a2ui.surfaceUpdate',
      surfaceId: 'main',
      components: [{ id: 'c1', component: { Text: { text: 'hello' } } }],
    })
    expect(msgs[1]).toEqual({
      type: 'a2ui.beginRendering',
      surfaceId: 'main',
      root: 'c1',
    })
    ws.close()
  })

  it('skips beginRendering when root is null', async () => {
    mgr.upsertSurface('main', [{ id: 'c1', component: { Text: {} } }])

    const { ws, msgs } = await connectAndCollect(1)
    expect(msgs[0].type).toBe('a2ui.surfaceUpdate')

    // Ensure no beginRendering arrives
    let extra = false
    ws.on('message', () => { extra = true })
    await new Promise((r) => setTimeout(r, 100))
    expect(extra).toBe(false)
    ws.close()
  })

  it('replays multiple surfaces', async () => {
    mgr.upsertSurface('s1', [{ id: 'a', component: { Text: {} } }])
    mgr.setRoot('s1', 'a')
    mgr.upsertSurface('s2', [{ id: 'b', component: { Button: {} } }])
    mgr.setRoot('s2', 'b')

    const { ws, msgs } = await connectAndCollect(4)

    const types = msgs.map((m) => m.type)
    expect(types).toContain('a2ui.surfaceUpdate')
    expect(types).toContain('a2ui.beginRendering')
    const surfaceIds = msgs.map((m) => m.surfaceId)
    expect(surfaceIds).toContain('s1')
    expect(surfaceIds).toContain('s2')
    ws.close()
  })

  it('sends nothing when no surfaces exist', async () => {
    const ws = await connectSpa()
    let received = false
    ws.on('message', () => { received = true })
    await new Promise((r) => setTimeout(r, 100))
    expect(received).toBe(false)
    ws.close()
  })

  it('only sends replay to the newly connected client', async () => {
    const ws1 = await connectSpa()
    await new Promise((r) => setTimeout(r, 50))

    // Add surface after ws1 is connected
    mgr.upsertSurface('main', [{ id: 'c1', component: { Text: {} } }])
    mgr.setRoot('main', 'c1')

    let ws1Received = false
    ws1.on('message', () => { ws1Received = true })

    // ws2 connects — only ws2 should get replay
    const { ws: ws2, msgs } = await connectAndCollect(2)
    expect(msgs[0].type).toBe('a2ui.surfaceUpdate')
    expect(msgs[1].type).toBe('a2ui.beginRendering')

    await new Promise((r) => setTimeout(r, 100))
    expect(ws1Received).toBe(false)

    ws1.close()
    ws2.close()
  })
})
