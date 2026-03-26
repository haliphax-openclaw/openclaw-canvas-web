import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { canvasRoute } from '../src/server/routes/canvas.js'
import { FileResolver } from '../src/server/services/file-resolver.js'
import { DEEP_LINK_SCRIPT } from '../src/server/shared/deep-link-script.js'
import { SNAPSHOT_SCRIPT } from '../src/server/shared/snapshot-script.js'

let tmpDir: string
let server: http.Server
let port: number

async function get(urlPath: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${urlPath}`, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body }))
    }).on('error', reject)
  })
}

async function getFollowRedirects(urlPath: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  const res = await get(urlPath)
  if (res.status === 302 || res.status === 301) {
    const loc = res.headers.location!
    return get(loc)
  }
  return res
}

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-route-'))
})

afterEach(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()))
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function startServer(basePath: string = ''): Promise<void> {
  const resolver = new FileResolver(new Map(), tmpDir)
  const app = express()
  app.use(canvasRoute(resolver, basePath))
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      port = (server.address() as any).port
      resolve()
    })
  })
}

describe('canvasRoute', () => {
  it('serves HTML with injected deep link and snapshot scripts', async () => {
    fs.mkdirSync(path.join(tmpDir, 'sess'))
    fs.writeFileSync(path.join(tmpDir, 'sess', 'index.html'), '<html><head></head><body></body></html>')
    await startServer()
    const res = await get('/_c/sess/index.html')
    expect(res.status).toBe(200)
    expect(res.body).toContain(DEEP_LINK_SCRIPT)
    expect(res.body).toContain(SNAPSHOT_SCRIPT)
    // Scripts injected before </head>
    expect(res.body).toContain(SNAPSHOT_SCRIPT + '</head>')
  })

  it('injects into </body> when no </head>', async () => {
    fs.mkdirSync(path.join(tmpDir, 'sess'))
    fs.writeFileSync(path.join(tmpDir, 'sess', 'index.html'), '<body>hi</body>')
    await startServer()
    const res = await get('/_c/sess/index.html')
    expect(res.body).toContain(SNAPSHOT_SCRIPT + '</body>')
  })

  it('appends scripts when no </head> or </body>', async () => {
    fs.mkdirSync(path.join(tmpDir, 'sess'))
    fs.writeFileSync(path.join(tmpDir, 'sess', 'index.html'), '<p>bare</p>')
    await startServer()
    const res = await get('/_c/sess/index.html')
    expect(res.body).toContain('<p>bare</p>' + DEEP_LINK_SCRIPT + SNAPSHOT_SCRIPT)
  })

  it('serves non-HTML files without injection', async () => {
    fs.mkdirSync(path.join(tmpDir, 'sess'))
    fs.writeFileSync(path.join(tmpDir, 'sess', 'app.js'), 'console.log("hi")')
    await startServer()
    const res = await get('/_c/sess/app.js')
    expect(res.status).toBe(200)
    expect(res.body).toBe('console.log("hi")')
    expect(res.headers['content-type']).toMatch(/javascript/)
  })

  it('serves CSS with correct content type', async () => {
    fs.mkdirSync(path.join(tmpDir, 'sess'))
    fs.writeFileSync(path.join(tmpDir, 'sess', 'style.css'), 'body{}')
    await startServer()
    const res = await get('/_c/sess/style.css')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/css/)
  })

  it('serves subfolder files', async () => {
    fs.mkdirSync(path.join(tmpDir, 'sess', 'assets'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'sess', 'assets', 'logo.svg'), '<svg/>')
    await startServer()
    const res = await get('/_c/sess/assets/logo.svg')
    expect(res.status).toBe(200)
    expect(res.body).toBe('<svg/>')
  })

  it('redirects to scaffold when session exists but has no index.html', async () => {
    fs.mkdirSync(path.join(tmpDir, 'empty'))
    await startServer('/base')
    const res = await get('/_c/empty')
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/base/scaffold?session=empty')
  })

  it('returns 404 for nonexistent session', async () => {
    await startServer()
    const res = await get('/_c/nosuch/index.html')
    expect(res.status).toBe(404)
    expect(res.body).toContain('Not found')
  })

  it('returns 404 for directory without index.html', async () => {
    fs.mkdirSync(path.join(tmpDir, 'sess', 'tools'), { recursive: true })
    await startServer()
    const res = await get('/_c/sess/tools')
    expect(res.status).toBe(404)
    expect(res.body).toContain('Not found')
  })

  it('returns 404 for missing file under session', async () => {
    fs.mkdirSync(path.join(tmpDir, 'sess'))
    fs.writeFileSync(path.join(tmpDir, 'sess', 'index.html'), '<h1>hi</h1>')
    await startServer()
    const res = await get('/_c/sess/nope.txt')
    expect(res.status).toBe(404)
    expect(res.body).toContain('Not found')
  })

  it('sets security headers', async () => {
    fs.mkdirSync(path.join(tmpDir, 'sess'))
    fs.writeFileSync(path.join(tmpDir, 'sess', 'index.html'), '<h1>hi</h1>')
    await startServer()
    const res = await get('/_c/sess/index.html')
    expect(res.headers['content-security-policy']).toBe("frame-ancestors 'self'")
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
  })

  it('serves index.html when session path has no subpath', async () => {
    fs.mkdirSync(path.join(tmpDir, 'sess'))
    fs.writeFileSync(path.join(tmpDir, 'sess', 'index.html'), '<h1>root</h1>')
    await startServer()
    const res = await get('/_c/sess')
    expect(res.status).toBe(200)
    expect(res.body).toContain('root')
  })
})
