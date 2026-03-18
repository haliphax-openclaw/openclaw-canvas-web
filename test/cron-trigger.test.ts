import { describe, it, expect, afterEach } from 'vitest'
import express from 'express'
import http from 'node:http'
import { cronTriggerRoute } from '../src/server/routes/cron-trigger.js'

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
  app.use(cronTriggerRoute(gatewayUrl, token))
  return new Promise((resolve) => {
    proxyServer = app.listen(0, '127.0.0.1', () => {
      proxyPort = (proxyServer.address() as any).port
      resolve()
    })
  })
}

describe('cronTriggerRoute', () => {
  it('proxies valid request with auth header and defaults runMode', async () => {
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
    await startProxy(`http://127.0.0.1:${targetPort}`, 'cron-secret')

    const res = await post(proxyPort, '/api/cron-trigger', JSON.stringify({ jobId: 'daily-backup' }))
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
    expect(receivedHeaders.authorization).toBe('Bearer cron-secret')
    const parsed = JSON.parse(receivedBody)
    expect(parsed.jobId).toBe('daily-backup')
    expect(parsed.runMode).toBe('force')
  })

  it('forwards explicit runMode', async () => {
    let receivedBody = ''
    await startTarget((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        receivedBody = body
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{"ok":true}')
      })
    })
    await startProxy(`http://127.0.0.1:${targetPort}`, 'tok')

    await post(proxyPort, '/api/cron-trigger', JSON.stringify({ jobId: 'j1', runMode: 'skip-if-running' }))
    expect(JSON.parse(receivedBody).runMode).toBe('skip-if-running')
  })

  it('rejects invalid JSON', async () => {
    await startProxy('http://127.0.0.1:1', 'tok')
    const res = await post(proxyPort, '/api/cron-trigger', 'not json')
    expect(res.status).toBe(400)
    expect(JSON.parse(res.body).error).toBe('invalid JSON')
  })

  it('rejects missing jobId', async () => {
    await startProxy('http://127.0.0.1:1', 'tok')
    const res = await post(proxyPort, '/api/cron-trigger', JSON.stringify({ runMode: 'force' }))
    expect(res.status).toBe(400)
    expect(JSON.parse(res.body).error).toBe('jobId is required')
  })

  it('returns 502 when gateway is unreachable', async () => {
    await startProxy('http://127.0.0.1:1', 'tok')
    const res = await post(proxyPort, '/api/cron-trigger', JSON.stringify({ jobId: 'j1' }))
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
    await post(proxyPort, '/api/cron-trigger', JSON.stringify({ jobId: 'j1' }))
    expect(hit).toBe(true)
  })
})
