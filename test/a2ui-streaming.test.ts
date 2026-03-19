import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import { WebSocket } from 'ws'
import { Gateway } from '../src/server/services/gateway.js'
import { A2UIManager } from '../src/server/services/a2ui-manager.js'

let server: http.Server
let gateway: Gateway
let mgr: A2UIManager
let port: number

function connectA2UIStream(session = 'main'): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/a2ui?session=${session}`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function sendAndReceive(ws: WebSocket, msg: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.once('message', (raw) => resolve(JSON.parse(raw.toString())))
    ws.send(msg)
  })
}

beforeEach(async () => {
  server = http.createServer()
  gateway = new Gateway(server)
  mgr = new A2UIManager()
  gateway.setA2UIManager(mgr)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  port = (server.address() as any).port
})

afterEach(async () => {
  gateway.close()
  await new Promise<void>((r) => server.close(() => r()))
})

describe('streaming A2UI WebSocket /ws/a2ui', () => {
  it('returns ok:true for valid updateComponents command', async () => {
    const ws = await connectA2UIStream()
    const cmd = JSON.stringify({
      updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text', text: 'hi' }] },
    })
    const result = await sendAndReceive(ws, cmd)
    expect(result.ok).toBe(true)
    expect(result.command).toBe('updateComponents')
    expect(result.index).toBe(0)
    expect(mgr.getSurface('main', 's1')).toBeTruthy()
    ws.close()
  })

  it('returns validation error for missing surfaceId', async () => {
    const ws = await connectA2UIStream()
    const cmd = JSON.stringify({ updateComponents: { components: [] } })
    const result = await sendAndReceive(ws, cmd)
    expect(result.ok).toBe(false)
    expect(result.command).toBe('updateComponents')
    expect(result.error).toMatch(/missing surfaceId/)
    ws.close()
  })

  it('returns parse error for invalid JSON', async () => {
    const ws = await connectA2UIStream()
    const result = await sendAndReceive(ws, 'not valid json')
    expect(result.ok).toBe(false)
    expect(result.command).toBe('parse')
    expect(result.error).toMatch(/Invalid JSON/)
    ws.close()
  })

  it('returns error for unrecognized command', async () => {
    const ws = await connectA2UIStream()
    const cmd = JSON.stringify({ unknownCommand: {} })
    const result = await sendAndReceive(ws, cmd)
    expect(result.ok).toBe(false)
    expect(result.command).toBe('unknown')
    expect(result.error).toMatch(/Unrecognized/)
    ws.close()
  })

  it('uses session from query param', async () => {
    const ws = await connectA2UIStream('developer')
    const cmd = JSON.stringify({
      updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text' }] },
    })
    await sendAndReceive(ws, cmd)
    expect(mgr.getSurface('developer', 's1')).toBeTruthy()
    expect(mgr.getSurface('main', 's1')).toBeUndefined()
    ws.close()
  })

  it('processes multiple commands in sequence', async () => {
    const ws = await connectA2UIStream()

    const r1 = await sendAndReceive(ws, JSON.stringify({
      updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text' }] },
    }))
    expect(r1.ok).toBe(true)

    const r2 = await sendAndReceive(ws, JSON.stringify({
      createSurface: { surfaceId: 's1', root: 'c1' },
    }))
    expect(r2.ok).toBe(true)

    const r3 = await sendAndReceive(ws, JSON.stringify({
      updateDataModel: { surfaceId: 's1', data: { count: 5 } },
    }))
    expect(r3.ok).toBe(true)

    const surface = mgr.getSurface('main', 's1')!
    expect(surface.root).toBe('c1')
    expect(surface.dataModel).toEqual({ count: 5 })
    ws.close()
  })

  it('ignores empty messages', async () => {
    const ws = await connectA2UIStream()
    // Send empty string — should not crash or respond
    ws.send('')
    ws.send('   ')
    // Send a valid command to verify connection still works
    const result = await sendAndReceive(ws, JSON.stringify({
      createSurface: { surfaceId: 's1' },
    }))
    expect(result.ok).toBe(true)
    ws.close()
  })
})
