import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import http from 'node:http'
import { agentProxyRoute } from '../src/server/routes/agent-proxy.js'

let proxyServer: http.Server
let proxyPort: number
let targetServer: http.Server
let targetPort: number

function post(port: number, path: string, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve({ status: res.statusCode!, body: data }))
    })
    req.on('error', reject)
    req.end(body)
  })
}

afterEach(async () => {
  if (proxyServer) await new Promise<void>((r) => proxyServer.close(() => r()))
  if (targetServer) await new Promise<void>((r) => targetServer.close(() => r()))
})

function startTarget(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void): Promise<void> {
  return new Promise((resolve) => {
    targetServer = http.createServer(handler)
    targetServer.listen(0, '127.0.0.1', () => {
      targetPort = (targetServer.address() as any).port
      resolve()
    })
  })
}

function startProxy(gatewayUrl: string, token: string): Promise<void> {
  const app = express()
  app.use(agentProxyRoute(gatewayUrl, token))
  return new Promise((resolve) => {
    proxyServer = app.listen(0, '127.0.0.1', () => {
      proxyPort = (proxyServer.address() as any).port
      resolve()
    })
  })
}

describe('agentProxyRoute', () => {
  it('proxies valid request to gateway with auth header', async () => {
    let receivedHeaders: http.IncomingHttpHeaders = {}
    let receivedBody = ''
    await startTarget((req, res) => {
      receivedHeaders = req.headers
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        receivedBody = body
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      })
    })
    await startProxy(`http://127.0.0.1:${targetPort}`, 'secret-token')

    const res = await post(proxyPort, '/api/agent', JSON.stringify({ message: 'hello' }))
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
    expect(receivedHeaders.authorization).toBe('Bearer secret-token')
    expect(JSON.parse(receivedBody).message).toBe('hello')
  })

  it('rejects invalid JSON', async () => {
    await startProxy('http://127.0.0.1:1', 'tok')
    const res = await post(proxyPort, '/api/agent', 'not json')
    expect(res.status).toBe(400)
    expect(JSON.parse(res.body).error).toBe('invalid JSON')
  })

  it('rejects missing message field', async () => {
    await startProxy('http://127.0.0.1:1', 'tok')
    const res = await post(proxyPort, '/api/agent', JSON.stringify({ foo: 'bar' }))
    expect(res.status).toBe(400)
    expect(JSON.parse(res.body).error).toBe('message is required')
  })

  it('returns 502 when gateway is unreachable', async () => {
    await startProxy('http://127.0.0.1:1', 'tok')
    const res = await post(proxyPort, '/api/agent', JSON.stringify({ message: 'hi' }))
    expect(res.status).toBe(502)
    expect(JSON.parse(res.body).error).toMatch(/gateway unreachable/)
  })

  it('converts ws:// gateway URL to http://', async () => {
    let hit = false
    await startTarget((_req, res) => {
      hit = true
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('{"ok":true}')
    })
    await startProxy(`ws://127.0.0.1:${targetPort}`, 'tok')
    await post(proxyPort, '/api/agent', JSON.stringify({ message: 'test' }))
    expect(hit).toBe(true)
  })
})
