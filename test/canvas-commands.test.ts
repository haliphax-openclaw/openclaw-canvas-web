import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import { WebSocket } from 'ws'
import { Gateway } from '../src/server/services/gateway.js'
import { SessionManager } from '../src/server/services/session-manager.js'
import { registerCanvasCommands } from '../src/server/commands/canvas.js'

let server: http.Server
let gateway: Gateway
let sm: SessionManager
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
  sm = new SessionManager()
  registerCanvasCommands(gateway, sm)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  port = (server.address() as any).port
})

afterEach(async () => {
  gateway.close()
  await new Promise<void>((r) => server.close(() => r()))
})

describe('canvas commands', () => {
  it('canvas.show sets active session and replies', async () => {
    const ws = await connectGw()
    const res = await rpc(ws, { id: '1', command: 'canvas.show', session: 'proj' })
    expect(res).toEqual({ id: '1', ok: true, session: 'proj' })
    expect(sm.getActive()).toBe('proj')
    ws.close()
  })

  it('canvas.show defaults to current session when none provided', async () => {
    const ws = await connectGw()
    const res = await rpc(ws, { id: '2', command: 'canvas.show' })
    expect(res).toEqual({ id: '2', ok: true, session: 'main' })
    ws.close()
  })

  it('canvas.hide replies ok', async () => {
    const ws = await connectGw()
    const res = await rpc(ws, { id: '3', command: 'canvas.hide' })
    expect(res).toEqual({ id: '3', ok: true })
    ws.close()
  })

  it('canvas.navigate sets session and path', async () => {
    const ws = await connectGw()
    const res = await rpc(ws, { id: '4', command: 'canvas.navigate', session: 'demo', path: 'page.html' })
    expect(res).toEqual({ id: '4', ok: true, session: 'demo', path: 'page.html' })
    expect(sm.getActive()).toBe('demo')
    ws.close()
  })

  it('canvas.navigateExternal rejects non-http URLs', async () => {
    const ws = await connectGw()
    const res1 = await rpc(ws, { id: '5', command: 'canvas.navigateExternal', url: 'ftp://evil.com' })
    expect(res1.error).toMatch(/only http/)

    const res2 = await rpc(ws, { id: '6', command: 'canvas.navigateExternal', url: '' })
    expect(res2.error).toMatch(/only http/)

    const res3 = await rpc(ws, { id: '7', command: 'canvas.navigateExternal' })
    expect(res3.error).toMatch(/only http/)
    ws.close()
  })

  it('canvas.navigateExternal accepts valid http(s) URLs', async () => {
    const ws = await connectGw()
    const res = await rpc(ws, { id: '8', command: 'canvas.navigateExternal', url: 'https://example.com' })
    expect(res).toEqual({ id: '8', ok: true, url: 'https://example.com' })
    ws.close()
  })

  it('canvas.eval rejects missing js', async () => {
    const ws = await connectGw()
    const res = await rpc(ws, { id: '9', command: 'canvas.eval' })
    expect(res.error).toMatch(/Missing js/)
    ws.close()
  })

  it('canvas.eval accepts valid js', async () => {
    const ws = await connectGw()
    const res = await rpc(ws, { id: '10', command: 'canvas.eval', js: 'alert(1)' })
    expect(res.ok).toBe(true)
    ws.close()
  })
})
