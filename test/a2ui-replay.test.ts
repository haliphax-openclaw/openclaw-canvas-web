import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import { WebSocket } from 'ws'
import { Gateway } from '../src/server/services/gateway.js'
import { A2UIManager } from '../src/server/services/a2ui-manager.js'

let server: http.Server
let gateway: Gateway
let mgr: A2UIManager
let port: number

function connectSpa(session = 'main'): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?session=${session}`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

/** Connect and collect `count` messages, attaching listener before open to avoid race. */
function connectAndCollect(count: number, session = 'main', timeoutMs = 2000): Promise<{ ws: WebSocket; msgs: Record<string, unknown>[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?session=${session}`)
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
    const session = gateway.getSpaSession(ws)
    for (const surface of mgr.surfacesForSession(session)) {
      const components = Array.from(surface.components.entries()).map(([id, comp]) => ({ id, ...comp }))
      gateway.sendToSpa(ws, { type: 'a2ui.updateComponents', session, surfaceId: surface.surfaceId, components })
      if (surface.root) {
        const msg: Record<string, unknown> = { type: 'a2ui.createSurface', session, surfaceId: surface.surfaceId, root: surface.root }
        if (surface.catalogId) msg.catalogId = surface.catalogId
        if (surface.theme) msg.theme = surface.theme
        gateway.sendToSpa(ws, msg)
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
    mgr.upsertSurface('main', 'main', [{ id: 'c1', component: 'Text', text: 'hello' }])
    mgr.setRoot('main', 'main', 'c1')

    const { ws, msgs } = await connectAndCollect(2, 'main')

    expect(msgs[0]).toMatchObject({
      type: 'a2ui.updateComponents',
      session: 'main',
      surfaceId: 'main',
      components: [{ id: 'c1', component: 'Text', text: 'hello' }],
    })
    expect(msgs[1]).toMatchObject({
      type: 'a2ui.createSurface',
      session: 'main',
      surfaceId: 'main',
      root: 'c1',
    })
    ws.close()
  })

  it('skips beginRendering when root is null', async () => {
    mgr.upsertSurface('main', 'main', [{ id: 'c1', component: 'Text' }])

    const { ws, msgs } = await connectAndCollect(1, 'main')
    expect(msgs[0].type).toBe('a2ui.updateComponents')

    // Ensure no beginRendering arrives
    let extra = false
    ws.on('message', () => { extra = true })
    await new Promise((r) => setTimeout(r, 100))
    expect(extra).toBe(false)
    ws.close()
  })

  it('replays multiple surfaces for the same session', async () => {
    mgr.upsertSurface('main', 's1', [{ id: 'a', component: 'Text' }])
    mgr.setRoot('main', 's1', 'a')
    mgr.upsertSurface('main', 's2', [{ id: 'b', component: 'Button' }])
    mgr.setRoot('main', 's2', 'b')

    const { ws, msgs } = await connectAndCollect(4, 'main')

    const types = msgs.map((m) => m.type)
    expect(types).toContain('a2ui.updateComponents')
    expect(types).toContain('a2ui.createSurface')
    const surfaceIds = msgs.map((m) => m.surfaceId)
    expect(surfaceIds).toContain('s1')
    expect(surfaceIds).toContain('s2')
    ws.close()
  })

  it('sends nothing when no surfaces exist', async () => {
    const ws = await connectSpa('main')
    let received = false
    ws.on('message', () => { received = true })
    await new Promise((r) => setTimeout(r, 100))
    expect(received).toBe(false)
    ws.close()
  })

  it('only sends replay to the newly connected client', async () => {
    const ws1 = await connectSpa('main')
    await new Promise((r) => setTimeout(r, 50))

    // Add surface after ws1 is connected
    mgr.upsertSurface('main', 'main', [{ id: 'c1', component: 'Text' }])
    mgr.setRoot('main', 'main', 'c1')

    let ws1Received = false
    ws1.on('message', () => { ws1Received = true })

    // ws2 connects — only ws2 should get replay
    const { ws: ws2, msgs } = await connectAndCollect(2, 'main')
    expect(msgs[0].type).toBe('a2ui.updateComponents')
    expect(msgs[1].type).toBe('a2ui.createSurface')

    await new Promise((r) => setTimeout(r, 100))
    expect(ws1Received).toBe(false)

    ws1.close()
    ws2.close()
  })

  it('only replays surfaces for the connected session', async () => {
    mgr.upsertSurface('main', 's1', [{ id: 'c1', component: 'Text' }])
    mgr.setRoot('main', 's1', 'c1')
    mgr.upsertSurface('other', 's2', [{ id: 'c2', component: 'Button' }])
    mgr.setRoot('other', 's2', 'c2')

    // Connect to 'main' — should only get s1
    const { ws: wsMain, msgs: mainMsgs } = await connectAndCollect(2, 'main')
    expect(mainMsgs.every(m => m.surfaceId === 's1')).toBe(true)
    wsMain.close()

    // Connect to 'other' — should only get s2
    const { ws: wsOther, msgs: otherMsgs } = await connectAndCollect(2, 'other')
    expect(otherMsgs.every(m => m.surfaceId === 's2')).toBe(true)
    wsOther.close()
  })

  it('replays catalogId and theme in createSurface message', async () => {
    mgr.upsertSurface('main', 'main', [{ id: 'c1', component: 'Text', text: 'hello' }])
    mgr.setRoot('main', 'main', 'c1', { catalogId: '@test/my-catalog', theme: 'dark' })

    const { ws, msgs } = await connectAndCollect(2, 'main')

    const createMsg = msgs.find(m => m.type === 'a2ui.createSurface')!
    expect(createMsg).toBeTruthy()
    expect(createMsg.catalogId).toBe('@test/my-catalog')
    expect(createMsg.theme).toBe('dark')
    ws.close()
  })
})
