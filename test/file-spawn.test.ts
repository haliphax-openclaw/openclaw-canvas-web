import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import express from 'express'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileSpawnRoute } from '../src/server/routes/file-spawn.js'

let proxyServer: http.Server
let proxyPort: number
let targetServer: http.Server
let targetPort: number
let tmpDir: string

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

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-spawn-test-'))
})

afterEach(async () => {
  if (proxyServer) await new Promise<void>((r) => proxyServer.close(() => r()))
  if (targetServer) await new Promise<void>((r) => targetServer.close(() => r()))
  fs.rmSync(tmpDir, { recursive: true, force: true })
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

function startProxy(gatewayUrl: string, token: string, canvasRoot: string, agentWorkspaceMap?: Map<string, string>): Promise<void> {
  const app = express()
  app.use(fileSpawnRoute(gatewayUrl, token, canvasRoot, agentWorkspaceMap))
  return new Promise((resolve) => {
    proxyServer = app.listen(0, '127.0.0.1', () => {
      proxyPort = (proxyServer.address() as any).port
      resolve()
    })
  })
}

describe('fileSpawnRoute', () => {
  it('reads file and spawns subagent with file contents as task', async () => {
    const promptFile = path.join(tmpDir, 'prompt.md')
    fs.writeFileSync(promptFile, 'Deploy the app to staging')

    let receivedBody = ''
    let receivedHeaders: http.IncomingHttpHeaders = {}
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
    await startProxy(`http://127.0.0.1:${targetPort}`, 'gw-token', tmpDir)

    const res = await post(proxyPort, '/api/file-spawn', JSON.stringify({ file: 'prompt.md' }))
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
    expect(receivedHeaders.authorization).toBe('Bearer gw-token')

    const parsed = JSON.parse(receivedBody)
    expect(parsed.tool).toBe('sessions_spawn')
    expect(parsed.args.task).toBe('Deploy the app to staging')
    expect(parsed.args.mode).toBe('run')
  })

  it('passes optional agentId and model', async () => {
    fs.writeFileSync(path.join(tmpDir, 'task.txt'), 'do stuff')

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
    await startProxy(`http://127.0.0.1:${targetPort}`, 'tok', tmpDir)

    await post(proxyPort, '/api/file-spawn', JSON.stringify({ file: 'task.txt', agentId: 'dev', model: 'claude' }))
    const parsed = JSON.parse(receivedBody)
    expect(parsed.args.agentId).toBe('dev')
    expect(parsed.args.model).toBe('claude')
  })

  it('resolves file from agent-specific workspace when agentId matches', async () => {
    const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-workspace-'))
    fs.writeFileSync(path.join(agentDir, 'deploy.md'), 'agent-specific prompt')
    const map = new Map([['dev', agentDir]])

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
    await startProxy(`http://127.0.0.1:${targetPort}`, 'tok', tmpDir, map)

    const res = await post(proxyPort, '/api/file-spawn', JSON.stringify({ file: 'deploy.md', agentId: 'dev' }))
    expect(res.status).toBe(200)
    expect(JSON.parse(receivedBody).args.task).toBe('agent-specific prompt')
    fs.rmSync(agentDir, { recursive: true, force: true })
  })

  it('falls back to canvasRoot when agentId is not in workspace map', async () => {
    fs.writeFileSync(path.join(tmpDir, 'fallback.md'), 'default prompt')
    const map = new Map([['other', '/tmp/nonexistent']])

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
    await startProxy(`http://127.0.0.1:${targetPort}`, 'tok', tmpDir, map)

    const res = await post(proxyPort, '/api/file-spawn', JSON.stringify({ file: 'fallback.md', agentId: 'unknown' }))
    expect(res.status).toBe(200)
    expect(JSON.parse(receivedBody).args.task).toBe('default prompt')
  })

  it('rejects invalid JSON', async () => {
    await startProxy('http://127.0.0.1:1', 'tok', tmpDir)
    const res = await post(proxyPort, '/api/file-spawn', 'not json')
    expect(res.status).toBe(400)
    expect(JSON.parse(res.body).error).toBe('invalid JSON')
  })

  it('rejects missing file param', async () => {
    await startProxy('http://127.0.0.1:1', 'tok', tmpDir)
    const res = await post(proxyPort, '/api/file-spawn', JSON.stringify({ agentId: 'x' }))
    expect(res.status).toBe(400)
    expect(JSON.parse(res.body).error).toBe('file is required')
  })

  it('rejects path traversal', async () => {
    await startProxy('http://127.0.0.1:1', 'tok', tmpDir)
    const res = await post(proxyPort, '/api/file-spawn', JSON.stringify({ file: '../../../etc/passwd' }))
    expect(res.status).toBe(403)
    expect(JSON.parse(res.body).error).toBe('path traversal not allowed')
  })

  it('returns 404 for missing file', async () => {
    await startProxy('http://127.0.0.1:1', 'tok', tmpDir)
    const res = await post(proxyPort, '/api/file-spawn', JSON.stringify({ file: 'nonexistent.md' }))
    expect(res.status).toBe(404)
    expect(JSON.parse(res.body).error).toBe('file not found')
  })

  it('returns 502 when gateway is unreachable', async () => {
    fs.writeFileSync(path.join(tmpDir, 'p.md'), 'hello')
    await startProxy('http://127.0.0.1:1', 'tok', tmpDir)
    const res = await post(proxyPort, '/api/file-spawn', JSON.stringify({ file: 'p.md' }))
    expect(res.status).toBe(502)
    expect(JSON.parse(res.body).error).toMatch(/gateway unreachable/)
  })

  it('converts ws:// gateway URL to http://', async () => {
    fs.writeFileSync(path.join(tmpDir, 'p.md'), 'hi')
    let hit = false
    await startTarget((_req, res) => {
      hit = true
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('{"ok":true}')
    })
    await startProxy(`ws://127.0.0.1:${targetPort}`, 'tok', tmpDir)
    await post(proxyPort, '/api/file-spawn', JSON.stringify({ file: 'p.md' }))
    expect(hit).toBe(true)
  })
})
