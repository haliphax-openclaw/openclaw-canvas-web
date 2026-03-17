import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileResolver } from '../src/server/services/file-resolver.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

let tmpDir: string
let resolver: FileResolver

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-test-'))
  fs.mkdirSync(path.join(tmpDir, 'main'), { recursive: true })
  fs.writeFileSync(path.join(tmpDir, 'main', 'index.html'), '<h1>hi</h1>')
  fs.writeFileSync(path.join(tmpDir, 'main', 'style.css'), 'body{}')
  resolver = new FileResolver(new Map(), tmpDir)
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('FileResolver', () => {
  it('resolves existing file', async () => {
    const result = await resolver.resolve('main', 'index.html')
    expect(result).toBeTruthy()
    expect(result!.endsWith('index.html')).toBe(true)
  })

  it('resolves subpath files', async () => {
    const result = await resolver.resolve('main', 'style.css')
    expect(result).toBeTruthy()
    expect(result!.endsWith('style.css')).toBe(true)
  })

  it('defaults to index.html when subpath is empty', async () => {
    const result = await resolver.resolve('main', '')
    expect(result).toBeTruthy()
    expect(result!.endsWith('index.html')).toBe(true)
  })

  it('resolves directory to its index.html', async () => {
    fs.mkdirSync(path.join(tmpDir, 'main', 'sub'))
    fs.writeFileSync(path.join(tmpDir, 'main', 'sub', 'index.html'), '<h1>sub</h1>')
    const result = await resolver.resolve('main', 'sub')
    expect(result).toBeTruthy()
    expect(result!.endsWith(path.join('sub', 'index.html'))).toBe(true)
  })

  it('returns null for directory without index.html', async () => {
    fs.mkdirSync(path.join(tmpDir, 'main', 'empty'))
    expect(await resolver.resolve('main', 'empty')).toBeNull()
  })

  it('returns null for missing file', async () => {
    expect(await resolver.resolve('main', 'nope.html')).toBeNull()
  })

  it('returns null for missing session', async () => {
    expect(await resolver.resolve('nonexistent', 'index.html')).toBeNull()
  })

  it('blocks path traversal with ..', async () => {
    expect(await resolver.resolve('..', 'etc/passwd')).toBeNull()
    expect(await resolver.resolve('main/../main', 'index.html')).toBeNull()
  })

  it('blocks empty session', async () => {
    expect(await resolver.resolve('', 'index.html')).toBeNull()
  })

  it('contains resolved path within session root via symlink', async () => {
    // Create a symlink inside session dir pointing outside
    const outsideFile = path.join(tmpDir, 'secret.txt')
    fs.writeFileSync(outsideFile, 'secret')
    const linkPath = path.join(tmpDir, 'main', 'escape')
    fs.symlinkSync(outsideFile, linkPath)
    expect(await resolver.resolve('main', 'escape')).toBeNull()
  })

  it('uses workspaceMap override when session matches', async () => {
    const altDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-alt-'))
    fs.writeFileSync(path.join(altDir, 'index.html'), '<h1>alt</h1>')
    const map = new Map([['custom', altDir]])
    const r = new FileResolver(map, tmpDir)
    const result = await r.resolve('custom', 'index.html')
    expect(result).toBeTruthy()
    expect(result!.startsWith(altDir)).toBe(true)
    fs.rmSync(altDir, { recursive: true, force: true })
  })

  it('falls back to defaultCanvasRoot when session not in map', async () => {
    const map = new Map([['other', '/nonexistent']])
    const r = new FileResolver(map, tmpDir)
    const result = await r.resolve('main', 'index.html')
    expect(result).toBeTruthy()
  })

  it('sessionExists returns true for existing dir', async () => {
    expect(await resolver.sessionExists('main')).toBe(true)
  })

  it('sessionExists returns false for missing dir', async () => {
    expect(await resolver.sessionExists('nope')).toBe(false)
  })

  it('sessionExists blocks traversal', async () => {
    expect(await resolver.sessionExists('..')).toBe(false)
  })

  it('hasIndex returns true when index.html exists', async () => {
    expect(await resolver.hasIndex('main')).toBe(true)
  })

  it('hasIndex returns false when no index.html', async () => {
    fs.mkdirSync(path.join(tmpDir, 'empty'))
    expect(await resolver.hasIndex('empty')).toBe(false)
  })

  it('getCanvasRoot returns the default root', () => {
    expect(resolver.getCanvasRoot()).toBe(tmpDir)
  })
})
