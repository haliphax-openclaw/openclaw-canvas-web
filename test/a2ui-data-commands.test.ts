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

describe('a2ui commands - dataModelUpdate and dataSourcePush', () => {
  it('a2ui.push processes dataModelUpdate', async () => {
    mgr.upsertSurface('s1', [])
    const ws = await connectGw()
    const payload = JSON.stringify({ dataModelUpdate: { surfaceId: 's1', data: { count: 42 } } })
    const res = await rpc(ws, { id: '1', command: 'a2ui.push', payload })
    expect(res.ok).toBe(true)
    expect(mgr.getSurface('s1')!.dataModel).toEqual({ count: 42 })
    ws.close()
  })

  it('a2ui.push skips dataModelUpdate with missing surfaceId', async () => {
    const ws = await connectGw()
    const payload = JSON.stringify({ dataModelUpdate: { data: { x: 1 } } })
    const res = await rpc(ws, { id: '2', command: 'a2ui.push', payload })
    expect(res.ok).toBe(true)
    ws.close()
  })

  it('a2ui.push processes dataSourcePush', async () => {
    mgr.upsertSurface('s1', [])
    const ws = await connectGw()
    const payload = JSON.stringify({ dataSourcePush: { surfaceId: 's1', sources: { items: { fields: ['name'], rows: [{ name: 'Alice' }] } } } })
    const res = await rpc(ws, { id: '3', command: 'a2ui.push', payload })
    expect(res.ok).toBe(true)
    expect(mgr.getSurface('s1')!.dataModel.$sources).toBeTruthy()
    ws.close()
  })

  it('a2ui.push skips dataSourcePush with missing surfaceId', async () => {
    const ws = await connectGw()
    const payload = JSON.stringify({ dataSourcePush: { sources: {} } })
    const res = await rpc(ws, { id: '4', command: 'a2ui.push', payload })
    expect(res.ok).toBe(true)
    ws.close()
  })

  it('a2ui.push broadcasts dataModelUpdate to SPA', async () => {
    mgr.upsertSurface('s1', [])
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
    const payload = JSON.stringify({ dataModelUpdate: { surfaceId: 's1', data: { key: 'val' } } })
    await rpc(gwWs, { id: '5', command: 'a2ui.push', payload })

    const received = await spaMsg
    expect(received.type).toBe('a2ui.dataModelUpdate')
    expect(received.surfaceId).toBe('s1')

    spaWs.close()
    gwWs.close()
  })
})
