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
  resolver = new FileResolver(tmpDir)
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

  it('blocks session names with slashes', async () => {
    expect(await resolver.resolve('main/sub', 'index.html')).toBeNull()
  })

  it('blocks empty session', async () => {
    expect(await resolver.resolve('', 'index.html')).toBeNull()
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
})
