import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { WebSocket } from 'ws'
import { Gateway } from '../src/server/services/gateway.js'
import { A2UIManager } from '../src/server/services/a2ui-manager.js'
import { JSONLWatcher } from '../src/server/services/jsonl-watcher.js'

let tmpDir: string
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

function waitForMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.once('message', (raw) => resolve(JSON.parse(raw.toString())))
  })
}

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl-watcher-'))
  server = http.createServer()
  gateway = new Gateway(server)
  mgr = new A2UIManager()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  port = (server.address() as any).port
})

afterEach(async () => {
  gateway.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('JSONLWatcher', () => {
  it('processFile pushes surfaceUpdate to a2ui manager and broadcasts', async () => {
    const canvasDir = path.join(tmpDir, 'canvas')
    const jsonlDir = path.join(canvasDir, 'jsonl')
    fs.mkdirSync(jsonlDir, { recursive: true })

    const sessionMap = new Map([['testagent', canvasDir]])
    const watcher = new JSONLWatcher(sessionMap, gateway, mgr, { debounceMs: 10 })

    const spa = await connectSpa('testagent')
    const msgPromise = waitForMessage(spa)

    const filePath = path.join(jsonlDir, 'test.jsonl')
    const jsonl = JSON.stringify({
      updateComponents: {
        surfaceId: 'dash',
        components: [{ id: 'c1', component: 'Text', content: 'hello' }]
      }
    })
    fs.writeFileSync(filePath, jsonl + '\n')

    // Call processFile directly (synchronous, no debounce)
    watcher.processFile('testagent', filePath)

    const msg = await msgPromise
    expect(msg.type).toBe('a2ui.updateComponents')
    expect(msg.surfaceId).toBe('dash')
    expect(msg.session).toBe('testagent')

    // Verify manager state
    const surface = mgr.getSurface('testagent', 'dash')
    expect(surface).toBeDefined()
    expect(surface!.components.get('c1')).toEqual({ component: 'Text', content: 'hello' })

    spa.close()
    watcher.close()
  })

  it('processFile handles beginRendering', () => {
    const canvasDir = path.join(tmpDir, 'canvas2')
    const jsonlDir = path.join(canvasDir, 'jsonl')
    fs.mkdirSync(jsonlDir, { recursive: true })

    const sessionMap = new Map([['agent2', canvasDir]])
    const watcher = new JSONLWatcher(sessionMap, gateway, mgr, { debounceMs: 10 })

    // First create the surface
    mgr.upsertSurface('agent2', 'dash', [{ id: 'root', component: 'Column' }])

    const filePath = path.join(jsonlDir, 'render.jsonl')
    fs.writeFileSync(filePath, JSON.stringify({ createSurface: { surfaceId: 'dash', root: 'root' } }) + '\n')

    watcher.processFile('agent2', filePath)

    const surface = mgr.getSurface('agent2', 'dash')
    expect(surface!.root).toBe('root')

    watcher.close()
  })

  it('processFile handles dataSourcePush', () => {
    const canvasDir = path.join(tmpDir, 'canvas3')
    const jsonlDir = path.join(canvasDir, 'jsonl')
    fs.mkdirSync(jsonlDir, { recursive: true })

    const sessionMap = new Map([['agent3', canvasDir]])
    const watcher = new JSONLWatcher(sessionMap, gateway, mgr, { debounceMs: 10 })

    mgr.upsertSurface('agent3', 'dash', [{ id: 'c1', component: 'Table' }])

    const filePath = path.join(jsonlDir, 'data.jsonl')
    fs.writeFileSync(filePath, JSON.stringify({
      dataSourcePush: { surfaceId: 'dash', sources: { users: { fields: ['name'], rows: [{ name: 'Alice' }] } } }
    }) + '\n')

    watcher.processFile('agent3', filePath)

    const surface = mgr.getSurface('agent3', 'dash')
    expect((surface!.dataModel as any).$sources.users.rows[0].name).toBe('Alice')

    watcher.close()
  })

  it('processFile skips invalid JSON lines and processes valid ones', () => {
    const canvasDir = path.join(tmpDir, 'canvas4')
    const jsonlDir = path.join(canvasDir, 'jsonl')
    fs.mkdirSync(jsonlDir, { recursive: true })

    const sessionMap = new Map([['agent4', canvasDir]])
    const watcher = new JSONLWatcher(sessionMap, gateway, mgr, { debounceMs: 10 })

    const filePath = path.join(jsonlDir, 'mixed.jsonl')
    const lines = [
      'not valid json',
      JSON.stringify({ updateComponents: { surfaceId: 'ok', components: [{ id: 'c1', component: 'Text' }] } }),
      '{broken',
    ]
    fs.writeFileSync(filePath, lines.join('\n') + '\n')

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    watcher.processFile('agent4', filePath)
    warnSpy.mockRestore()

    expect(mgr.getSurface('agent4', 'ok')).toBeDefined()

    watcher.close()
  })

  it('processFile handles deleteSurface', () => {
    const canvasDir = path.join(tmpDir, 'canvas5')
    const jsonlDir = path.join(canvasDir, 'jsonl')
    fs.mkdirSync(jsonlDir, { recursive: true })

    const sessionMap = new Map([['agent5', canvasDir]])
    const watcher = new JSONLWatcher(sessionMap, gateway, mgr, { debounceMs: 10 })

    mgr.upsertSurface('agent5', 'dash', [{ id: 'c1', component: 'Text' }])
    expect(mgr.getSurface('agent5', 'dash')).toBeDefined()

    const filePath = path.join(jsonlDir, 'delete.jsonl')
    fs.writeFileSync(filePath, JSON.stringify({ deleteSurface: { surfaceId: 'dash' } }) + '\n')

    watcher.processFile('agent5', filePath)

    expect(mgr.getSurface('agent5', 'dash')).toBeUndefined()

    watcher.close()
  })

  it('processFile handles multiple JSONL files for same surface (merge)', () => {
    const canvasDir = path.join(tmpDir, 'canvas6')
    const jsonlDir = path.join(canvasDir, 'jsonl')
    fs.mkdirSync(jsonlDir, { recursive: true })

    const sessionMap = new Map([['agent6', canvasDir]])
    const watcher = new JSONLWatcher(sessionMap, gateway, mgr, { debounceMs: 10 })

    // File 1: layout
    const file1 = path.join(jsonlDir, 'layout.jsonl')
    fs.writeFileSync(file1, JSON.stringify({
      updateComponents: { surfaceId: 'dash', components: [{ id: 'c1', component: 'Column' }] }
    }) + '\n')

    // File 2: data
    const file2 = path.join(jsonlDir, 'data.jsonl')
    fs.writeFileSync(file2, JSON.stringify({
      dataSourcePush: { surfaceId: 'dash', sources: { items: { fields: ['x'], rows: [{ x: 1 }] } } }
    }) + '\n')

    watcher.processFile('agent6', file1)
    watcher.processFile('agent6', file2)

    const surface = mgr.getSurface('agent6', 'dash')
    expect(surface).toBeDefined()
    expect(surface!.components.get('c1')).toEqual({ component: 'Column' })
    expect((surface!.dataModel as any).$sources.items.rows[0].x).toBe(1)

    watcher.close()
  })

  it('close stops all watchers and timers', () => {
    const canvasDir = path.join(tmpDir, 'canvas7')
    fs.mkdirSync(path.join(canvasDir, 'jsonl'), { recursive: true })

    const sessionMap = new Map([['agent7', canvasDir]])
    const watcher = new JSONLWatcher(sessionMap, gateway, mgr, { debounceMs: 10 })

    watcher.close()
    // Should not throw on double close
    watcher.close()
  })
})
