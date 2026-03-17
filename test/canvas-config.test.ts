import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { canvasConfigRoute } from '../src/server/routes/canvas-config.js'

let server: http.Server
let port: number
let tmpDir: string

function get(urlPath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${urlPath}`, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve({ status: res.statusCode!, body }))
    }).on('error', reject)
  })
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-config-test-'))
})

afterEach(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()))
  fs.rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.OPENCLAW_CANVAS_SKIP_CONFIRM
})

function startServer(configPath?: string): Promise<void> {
  const app = express()
  app.use(canvasConfigRoute(configPath))
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      port = (server.address() as any).port
      resolve()
    })
  })
}

describe('canvasConfigRoute', () => {
  it('returns defaults when no config file exists', async () => {
    await startServer(path.join(tmpDir, 'nonexistent.json'))
    const res = await get('/api/canvas-config')
    expect(res.status).toBe(200)
    const data = JSON.parse(res.body)
    expect(data.skipConfirmation).toBe(false)
    expect(data.agents).toEqual([])
    expect(data.allowedAgentIds).toEqual([])
  })

  it('reads agents from openclaw.json', async () => {
    const configPath = path.join(tmpDir, 'openclaw.json')
    fs.writeFileSync(configPath, JSON.stringify({
      agents: { list: [{ id: 'main' }, { id: 'dev' }] },
      hooks: { allowedAgentIds: ['main'] },
    }))
    await startServer(configPath)
    const res = await get('/api/canvas-config')
    const data = JSON.parse(res.body)
    expect(data.agents).toEqual(['main', 'dev'])
    expect(data.allowedAgentIds).toEqual(['main'])
  })

  it('respects OPENCLAW_CANVAS_SKIP_CONFIRM env var', async () => {
    process.env.OPENCLAW_CANVAS_SKIP_CONFIRM = 'true'
    await startServer(path.join(tmpDir, 'nonexistent.json'))
    const res = await get('/api/canvas-config')
    expect(JSON.parse(res.body).skipConfirmation).toBe(true)
  })

  it('handles malformed config file gracefully', async () => {
    const configPath = path.join(tmpDir, 'openclaw.json')
    fs.writeFileSync(configPath, 'not json')
    await startServer(configPath)
    const res = await get('/api/canvas-config')
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body).agents).toEqual([])
  })
})
