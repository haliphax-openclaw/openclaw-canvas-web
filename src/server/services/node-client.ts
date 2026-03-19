import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { WebSocket } from 'ws'
import type { Gateway } from './gateway.js'
import { injectDeepLinkIntoDataUrl } from '../shared/deep-link-script.js'
import { injectSnapshotIntoDataUrl } from '../shared/snapshot-script.js'
import type { A2UIManager } from './a2ui-manager.js'
import { processA2UICommand } from './a2ui-commands.js'
import type { SessionManager } from './session-manager.js'

const IDENTITY_PATH = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? '.',
  '.openclaw-canvas', 'device-identity.json'
)

const CANVAS_COMMANDS = [
  'canvas.present', 'canvas.hide', 'canvas.navigate', 'canvas.eval',
  'canvas.snapshot', 'canvas.a2ui.push', 'canvas.a2ui.pushJSONL', 'canvas.a2ui.reset'
]

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

interface DeviceIdentity {
  deviceId: string
  publicKeyPem: string
  privateKeyPem: string
}

interface InvokeRequest {
  id: string
  nodeId: string
  command: string
  paramsJSON: string | null
  timeoutMs?: number
  idempotencyKey?: string
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const spki = crypto.createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' })
  if (spki.length === ED25519_SPKI_PREFIX.length + 32 &&
      spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX))
    return spki.subarray(ED25519_SPKI_PREFIX.length)
  return spki
}

function fingerprintPublicKey(publicKeyPem: string): string {
  return crypto.createHash('sha256').update(derivePublicKeyRaw(publicKeyPem)).digest('hex')
}

function loadOrCreateIdentity(): DeviceIdentity {
  try {
    if (fs.existsSync(IDENTITY_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(IDENTITY_PATH, 'utf8'))
      if (parsed?.deviceId && parsed?.publicKeyPem && parsed?.privateKeyPem)
        return parsed
    }
  } catch (err) { console.warn('[node-client] Key load failed, regenerating:', err) }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const identity: DeviceIdentity = { deviceId: fingerprintPublicKey(publicKeyPem), publicKeyPem, privateKeyPem }

  fs.mkdirSync(path.dirname(IDENTITY_PATH), { recursive: true })
  fs.writeFileSync(IDENTITY_PATH, JSON.stringify({ version: 1, ...identity, createdAtMs: Date.now() }, null, 2) + '\n', { mode: 0o600 })
  return identity
}

function signPayload(privateKeyPem: string, payload: string): string {
  return base64UrlEncode(crypto.sign(null, Buffer.from(payload, 'utf8'), crypto.createPrivateKey(privateKeyPem)))
}

export class NodeClient {
  private ws: WebSocket | null = null
  private identity: DeviceIdentity
  private token: string
  private gatewayUrl: string
  private gateway: Gateway
  private a2uiManager: A2UIManager
  private sessionManager: SessionManager
  private pendingRequests = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private closed = false
  private nodeId = ''

  constructor(opts: {
    gatewayUrl: string
    token: string
    gateway: Gateway
    a2uiManager: A2UIManager
    sessionManager: SessionManager
  }) {
    this.gatewayUrl = opts.gatewayUrl
    this.token = opts.token
    this.gateway = opts.gateway
    this.a2uiManager = opts.a2uiManager
    this.sessionManager = opts.sessionManager
    this.identity = loadOrCreateIdentity()
    this.nodeId = this.identity.deviceId
  }

  start() {
    this.closed = false
    this.connect()
  }

  stop() {
    this.closed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  private connect() {
    if (this.closed) return
    console.log(`[node-client] Connecting to ${this.gatewayUrl}`)
    const ws = new WebSocket(this.gatewayUrl)
    this.ws = ws

    ws.on('open', () => {
      console.log('[node-client] WebSocket open, waiting for challenge...')
    })

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'event' && msg.event === 'connect.challenge') {
          this.handleChallenge(msg.payload.nonce)
        } else if (msg.type === 'event' && msg.event === 'node.invoke.request') {
          this.handleInvoke(msg.payload)
        } else if (msg.type === 'event') {
          // ignore other events
        } else if (msg.type === 'res') {
          const pending = this.pendingRequests.get(msg.id)
          if (pending) {
            this.pendingRequests.delete(msg.id)
            if (msg.ok) pending.resolve(msg.payload)
            else pending.reject(new Error(msg.error?.message ?? 'request failed'))
          }
        }
      } catch (e) {
        console.error('[node-client] Parse error:', e)
      }
    })

    ws.on('close', (code, reason) => {
      console.log(`[node-client] Closed: ${code} ${reason.toString()}`)
      this.ws = null
      this.scheduleReconnect()
    })

    ws.on('error', (err) => {
      console.error('[node-client] Error:', err.message)
    })
  }

  private scheduleReconnect() {
    if (this.closed) return
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => this.connect(), 3000)
  }

  private handleChallenge(nonce: string) {
    console.log('[node-client] Got challenge, sending connect...')
    const signedAtMs = Date.now()
    const role = 'node'
    const scopes: string[] = []
    const platform = 'linux'

    const payloadStr = [
      'v3', this.identity.deviceId, 'node-host', 'node', role,
      scopes.join(','), String(signedAtMs), this.token, nonce, platform, 'server'
    ].join('|')

    const signature = signPayload(this.identity.privateKeyPem, payloadStr)
    const publicKeyRaw = derivePublicKeyRaw(this.identity.publicKeyPem)

    const params = {
      minProtocol: 3, maxProtocol: 3,
      client: { id: 'node-host', displayName: 'Canvas Web Server', version: '0.1.0', platform, mode: 'node', deviceFamily: 'server' },
      role, scopes,
      caps: ['canvas'],
      commands: CANVAS_COMMANDS,
      auth: { token: this.token },
      device: {
        id: this.identity.deviceId,
        publicKey: base64UrlEncode(publicKeyRaw),
        signature,
        signedAt: signedAtMs,
        nonce
      }
    }

    this.request('connect', params).then((helloOk) => {
      console.log('[node-client] Connected as node! Protocol:', helloOk?.protocol)
    }).catch((err) => {
      console.error('[node-client] Connect failed:', err.message)
      this.ws?.close()
    })
  }

  private async handleInvoke(payload: unknown) {
    const frame = payload as InvokeRequest
    if (!frame?.id || !frame?.command) return

    console.log(`[node-client] Invoke: ${frame.command}`)
    const params = frame.paramsJSON ? JSON.parse(frame.paramsJSON) : {}

    try {
      const result = await this.executeCommand(frame.command, params)
      await this.request('node.invoke.result', {
        id: frame.id, nodeId: frame.nodeId, ok: true, payload: result
      })
    } catch (err: any) {
      await this.request('node.invoke.result', {
        id: frame.id, nodeId: frame.nodeId, ok: false,
        error: { code: 'COMMAND_FAILED', message: err.message ?? String(err) }
      }).catch(() => {})
    }
  }

  private async executeCommand(command: string, params: Record<string, any>): Promise<any> {
    switch (command) {
      case 'canvas.present': {
        const target = params.target ?? params.url ?? ''
        const session = params.session ?? this.sessionManager.getActive()
        const surface = params.surface
        this.sessionManager.setActive(session)
        if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('data:'))
          this.gateway.broadcastSpa({ type: 'canvas.navigateExternal', url: injectSnapshotIntoDataUrl(injectDeepLinkIntoDataUrl(target)) })
        else
          this.gateway.broadcastSpaSession(session, { type: 'canvas.show', session, surface })
        return { ok: true }
      }
      case 'canvas.hide':
        this.gateway.broadcastSpa({ type: 'canvas.hide' })
        return { ok: true }

      case 'canvas.navigate': {
        const url = params.url ?? params.target ?? ''
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:'))
          this.gateway.broadcastSpa({ type: 'canvas.navigateExternal', url: injectSnapshotIntoDataUrl(injectDeepLinkIntoDataUrl(url)) })
        else {
          let session = params.session ?? this.sessionManager.getActive()
          let navPath = url
          const canvasPrefix = 'openclaw-canvas://'
          if (url.startsWith(canvasPrefix)) {
            const rest = url.slice(canvasPrefix.length)
            const slashIdx = rest.indexOf('/')
            if (slashIdx >= 0) {
              session = rest.slice(0, slashIdx)
              navPath = rest.slice(slashIdx + 1)
            } else {
              session = rest
              navPath = ''
            }
          }
          this.sessionManager.setActive(session)
          this.gateway.broadcastSpaSession(session, { type: 'canvas.navigate', session, path: navPath })
        }
        return { ok: true }
      }
      case 'canvas.eval': {
        const js = params.javaScript ?? ''
        if (!js) throw new Error('javaScript param required')
        const session = params.session ?? 'main'
        const id = `eval_${Date.now()}`
        this.gateway.broadcastSpaSession(session, { type: 'canvas.eval', js, id })
        return { result: null, note: 'eval dispatched' }
      }
      case 'canvas.snapshot': {
        const id = `snap_${Date.now()}`
        const result = await this.gateway.requestSnapshot(id)
        if ((result as any).error) throw new Error((result as any).error)
        const image = (result as any).image
        if (!image) throw new Error('no snapshot data')
        const raw = typeof image === 'string' ? image : image.base64 ?? ''
        const base64 = raw.replace(/^data:image\/[^;]+;base64,/, '')
        return {
          format: params.format ?? 'png',
          base64
        }
      }
      case 'canvas.a2ui.push':
      case 'canvas.a2ui.pushJSONL': {
        const jsonl = params.jsonl ?? params.payload ?? ''
        if (!jsonl) throw new Error('payload required')
        const session = params.session ?? 'main'
        const lines = (typeof jsonl === 'string' ? jsonl : JSON.stringify(jsonl)).split('\n').filter((l: string) => l.trim())
        for (const line of lines) {
          const parsed = JSON.parse(line)
          processA2UICommand(session, parsed, this.a2uiManager, this.gateway)
        }
        return { ok: true }
      }
      case 'canvas.a2ui.reset': {
        const session = params.session as string | undefined
        if (session) {
          this.a2uiManager.clearSession(session)
          this.gateway.broadcastSpaSession(session, { type: 'a2ui.clearAll' })
        } else {
          this.a2uiManager.clearAll()
          this.gateway.broadcastSpa({ type: 'a2ui.clearAll' })
        }
        return { ok: true }
      }

      default:
        throw new Error(`Unknown command: ${command}`)
    }
  }

  private request(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('not connected'))
        return
      }
      const id = crypto.randomUUID()
      this.pendingRequests.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ type: 'req', id, method, params }))
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error('request timeout'))
        }
      }, 30000)
    })
  }
}
