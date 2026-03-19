import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import crypto from 'node:crypto'
import http from 'node:http'
import { WebSocket } from 'ws'

// Mock fs so NodeClient constructor never touches the real filesystem
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
const fakePub = publicKey.export({ type: 'spki', format: 'pem' }).toString()
const fakePriv = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const fakeIdentity = JSON.stringify({ deviceId: 'test-device', publicKeyPem: fakePub, privateKeyPem: fakePriv })

vi.mock('node:fs', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs')>()
  return {
    ...real,
    default: {
      ...real,
      existsSync: (p: string) => String(p).includes('device-identity') ? true : real.existsSync(p),
      readFileSync: (p: string, ...args: any[]) => String(p).includes('device-identity') ? fakeIdentity : (real.readFileSync as any)(p, ...args),
      writeFileSync: (p: string, ...args: any[]) => { if (!String(p).includes('device-identity')) (real.writeFileSync as any)(p, ...args) },
      mkdirSync: (p: string, ...args: any[]) => { if (!String(p).includes('device-identity')) (real.mkdirSync as any)(p, ...args) },
    },
  }
})

import { Gateway } from '../src/server/services/gateway.js'
import { SessionManager } from '../src/server/services/session-manager.js'
import { A2UIManager } from '../src/server/services/a2ui-manager.js'
import { NodeClient } from '../src/server/services/node-client.js'

let server: http.Server
let gateway: Gateway
let sm: SessionManager
let nodeClient: NodeClient
let port: number

function connectSpa(session?: string): Promise<WebSocket> {
  const qs = session ? `?session=${session}` : ''
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws${qs}`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function waitForMessage(ws: WebSocket, timeoutMs = 500): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { ws.removeAllListeners('message'); resolve(null) }, timeoutMs)
    ws.once('message', (raw) => { clearTimeout(timer); resolve(JSON.parse(raw.toString())) })
  })
}

beforeEach(async () => {
  server = http.createServer()
  gateway = new Gateway(server)
  sm = new SessionManager()
  nodeClient = new NodeClient({
    gatewayUrl: 'ws://127.0.0.1:0', // unused — we call executeCommand directly
    token: 'test',
    gateway,
    a2uiManager: new A2UIManager(),
    sessionManager: sm,
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  port = (server.address() as any).port
})

afterEach(async () => {
  gateway.close()
  await new Promise<void>((r) => server.close(() => r()))
})

const exec = (cmd: string, params: Record<string, any> = {}) =>
  (nodeClient as any).executeCommand(cmd, params)

describe('node-client executeCommand session handling', () => {
  it('canvas.present uses params.session, not hardcoded main', async () => {
    const spa = await connectSpa('developer')
    await new Promise((r) => setTimeout(r, 50))

    await exec('canvas.present', { session: 'developer' })

    const msg = await waitForMessage(spa)
    expect(msg).toEqual({ type: 'canvas.show', session: 'developer' })
    expect(sm.getActive()).toBe('developer')
    spa.close()
  })

  it('canvas.present falls back to sessionManager.getActive()', async () => {
    sm.setActive('other-agent')
    const spa = await connectSpa('other-agent')
    await new Promise((r) => setTimeout(r, 50))

    await exec('canvas.present', {})

    const msg = await waitForMessage(spa)
    expect(msg).toEqual({ type: 'canvas.show', session: 'other-agent' })
    spa.close()
  })

  it('canvas.present does not broadcast to wrong session', async () => {
    const spaMain = await connectSpa('main')
    const spaDev = await connectSpa('developer')
    await new Promise((r) => setTimeout(r, 50))

    await exec('canvas.present', { session: 'developer' })

    const devMsg = await waitForMessage(spaDev)
    const mainMsg = await waitForMessage(spaMain)
    expect(devMsg).toEqual({ type: 'canvas.show', session: 'developer' })
    expect(mainMsg).toBeNull()
    spaMain.close()
    spaDev.close()
  })

  it('canvas.navigate uses params.session, not hardcoded main', async () => {
    const spa = await connectSpa('developer')
    await new Promise((r) => setTimeout(r, 50))

    await exec('canvas.navigate', { session: 'developer', url: 'page.html' })

    const msg = await waitForMessage(spa)
    expect(msg).toEqual({ type: 'canvas.navigate', session: 'developer', path: 'page.html' })
    expect(sm.getActive()).toBe('developer')
    spa.close()
  })

  it('canvas.navigate falls back to sessionManager.getActive()', async () => {
    sm.setActive('agent-x')
    const spa = await connectSpa('agent-x')
    await new Promise((r) => setTimeout(r, 50))

    await exec('canvas.navigate', { url: 'index.html' })

    const msg = await waitForMessage(spa)
    expect(msg).toEqual({ type: 'canvas.navigate', session: 'agent-x', path: 'index.html' })
    spa.close()
  })

  it('canvas.navigate does not broadcast to wrong session', async () => {
    const spaMain = await connectSpa('main')
    const spaDev = await connectSpa('developer')
    await new Promise((r) => setTimeout(r, 50))

    await exec('canvas.navigate', { session: 'developer', url: 'app.html' })

    const devMsg = await waitForMessage(spaDev)
    const mainMsg = await waitForMessage(spaMain)
    expect(devMsg).toEqual({ type: 'canvas.navigate', session: 'developer', path: 'app.html' })
    expect(mainMsg).toBeNull()
    spaMain.close()
    spaDev.close()
  })

  it('canvas.navigate with openclaw-canvas:// extracts session from URL', async () => {
    const spa = await connectSpa('my-proj')
    await new Promise((r) => setTimeout(r, 50))

    await exec('canvas.navigate', { url: 'openclaw-canvas://my-proj/dashboard.html' })

    const msg = await waitForMessage(spa)
    expect(msg).toEqual({ type: 'canvas.navigate', session: 'my-proj', path: 'dashboard.html' })
    expect(sm.getActive()).toBe('my-proj')
    spa.close()
  })
})
