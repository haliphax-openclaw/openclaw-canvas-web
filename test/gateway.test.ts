import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import { WebSocket } from 'ws'
import { Gateway } from '../src/server/services/gateway.js'

let server: http.Server
let gateway: Gateway
let port: number

function connectWs(path: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function sendAndReceive(ws: WebSocket, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.once('message', (raw) => resolve(JSON.parse(raw.toString())))
    ws.send(JSON.stringify(data))
  })
}

function waitForMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.once('message', (raw) => resolve(JSON.parse(raw.toString())))
  })
}

beforeEach(async () => {
  server = http.createServer()
  gateway = new Gateway(server)
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  port = (server.address() as any).port
})

afterEach(async () => {
  gateway.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe('Gateway', () => {
  it('routes command to registered handler and replies', async () => {
    gateway.on('test.echo', (msg, reply) => {
      reply({ echoed: msg.value })
    })
    const ws = await connectWs('/gateway')
    const res = await sendAndReceive(ws, { id: '1', command: 'test.echo', value: 'hello' })
    expect(res).toEqual({ id: '1', echoed: 'hello' })
    ws.close()
  })

  it('returns error for invalid JSON', async () => {
    const ws = await connectWs('/gateway')
    const p = waitForMessage(ws)
    ws.send('not json{{{')
    const res = await p
    expect(res.error).toBe('Invalid JSON')
    ws.close()
  })

  it('returns error for missing command field', async () => {
    const ws = await connectWs('/gateway')
    const res = await sendAndReceive(ws, { id: '2' } as any)
    expect(res.error).toMatch(/Missing or invalid command/)
    expect(res.id).toBe('2')
    ws.close()
  })

  it('returns error for unknown command', async () => {
    const ws = await connectWs('/gateway')
    const res = await sendAndReceive(ws, { id: '3', command: 'no.such.cmd' })
    expect(res.error).toMatch(/Unknown command/)
    expect(res.id).toBe('3')
    ws.close()
  })

  it('broadcastSpa sends to /ws clients', async () => {
    const spaWs = await connectWs('/ws')
    // small delay for registration
    await new Promise((r) => setTimeout(r, 50))
    const p = waitForMessage(spaWs)
    gateway.broadcastSpa({ type: 'test.ping', data: 42 })
    const msg = await p
    expect(msg).toEqual({ type: 'test.ping', data: 42 })
    spaWs.close()
  })

  it('broadcastSpa does not leak to /gateway clients', async () => {
    const gwWs = await connectWs('/gateway')
    gateway.on('dummy', (_m, reply) => reply({ ok: true }))
    await new Promise((r) => setTimeout(r, 50))

    let received = false
    gwWs.on('message', () => { received = true })
    gateway.broadcastSpa({ type: 'should.not.arrive' })
    await new Promise((r) => setTimeout(r, 100))
    expect(received).toBe(false)
    gwWs.close()
  })

  it('snapshot flow: SPA receives request and server resolves with image', async () => {
    const spaWs = await connectWs('/ws')
    await new Promise((r) => setTimeout(r, 50))

    // SPA auto-responds to snapshot requests
    spaWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'canvas.snapshot') {
        spaWs.send(JSON.stringify({
          type: 'canvas.snapshotResult',
          id: msg.id,
          image: 'data:image/png;base64,FAKE',
        }))
      }
    })

    const result = await gateway.requestSnapshot('snap-1')
    expect(result).toEqual({ ok: true, image: 'data:image/png;base64,FAKE' })
    spaWs.close()
  })

  it('snapshot flow: resolves with error when SPA reports error', async () => {
    const spaWs = await connectWs('/ws')
    await new Promise((r) => setTimeout(r, 50))

    spaWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'canvas.snapshot') {
        spaWs.send(JSON.stringify({
          type: 'canvas.snapshotResult',
          id: msg.id,
          error: 'No element',
        }))
      }
    })

    const result = await gateway.requestSnapshot('snap-2')
    expect(result).toEqual({ error: 'No element' })
    spaWs.close()
  })

  it('cleans up SPA client on disconnect', async () => {
    const spaWs = await connectWs('/ws')
    await new Promise((r) => setTimeout(r, 50))

    // Verify broadcast reaches it
    const p = waitForMessage(spaWs)
    gateway.broadcastSpa({ type: 'check' })
    await p

    spaWs.close()
    await new Promise((r) => setTimeout(r, 100))

    // After close, broadcast should not throw
    gateway.broadcastSpa({ type: 'after.close' })
  })

  it('destroys unknown upgrade paths', async () => {
    await expect(connectWs('/unknown')).rejects.toThrow()
  })
})
