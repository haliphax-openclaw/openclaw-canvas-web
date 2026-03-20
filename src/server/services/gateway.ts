import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'node:http'
import type { A2UIManager } from './a2ui-manager.js'
import { processPipelineCommand, type ValidationResult } from './a2ui-pipeline.js'
import type { SchemaResolver } from './a2ui-component-schemas.js'

export interface GatewayMessage {
  id?: string
  command: string
  [key: string]: unknown
}

export type CommandHandler = (msg: GatewayMessage, reply: (data: Record<string, unknown>) => void) => void

const PING_INTERVAL = 30_000
const SNAPSHOT_TIMEOUT = 30_000

export class Gateway {
  private wss: WebSocketServer
  private handlers = new Map<string, CommandHandler>()
  private spaClients = new Set<WebSocket>()
  private spaSessionMap = new Map<WebSocket, string>()
  private pendingSnapshots = new Map<string, (data: Record<string, unknown>) => void>()
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private spaConnectListeners: Array<(ws: WebSocket) => void> = []
  private a2uiManager: A2UIManager | null = null
  private a2uiStreamClients = new Set<WebSocket>()
  private resolveSchema: SchemaResolver = () => undefined

  constructor(server: Server) {
    this.wss = new WebSocketServer({ noServer: true })

    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
      const path = url.pathname
      if (path === '/gateway') {
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit('connection', ws, req)
        })
      } else if (path === '/ws') {
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          (ws as any).__alive = true
          this.spaClients.add(ws)
          // Track session from query param
          const session = url.searchParams.get('session') ?? 'main'
          this.spaSessionMap.set(ws, session)
          ws.on('pong', () => { (ws as any).__alive = true })
          ws.on('close', () => {
            this.spaClients.delete(ws)
            this.spaSessionMap.delete(ws)
          })
          ws.on('message', (raw) => {
            this.handleSpaMessage(raw, ws)
          })
          for (const listener of this.spaConnectListeners) listener(ws)
        })
      } else if (path === '/ws/a2ui') {
        // Streaming A2UI interface — per-command validation feedback
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          (ws as any).__alive = true
          this.a2uiStreamClients.add(ws)
          const session = url.searchParams.get('session') ?? 'main'
          ws.on('pong', () => { (ws as any).__alive = true })
          ws.on('close', () => { this.a2uiStreamClients.delete(ws) })
          ws.on('message', (raw) => { this.handleA2UIStreamMessage(raw, ws, session) })
        })
      } else {
        socket.destroy()
      }
    })

    this.wss.on('connection', (ws) => {
      (ws as any).__alive = true
      ws.on('pong', () => { (ws as any).__alive = true })
      ws.on('message', (raw) => {
        let msg: GatewayMessage
        try {
          msg = JSON.parse(raw.toString())
        } catch {
          ws.send(JSON.stringify({ error: 'Invalid JSON' }))
          return
        }
        if (!msg.command || typeof msg.command !== 'string') {
          ws.send(JSON.stringify({ id: msg.id, error: 'Missing or invalid command' }))
          return
        }
        const handler = this.handlers.get(msg.command)
        if (!handler) {
          ws.send(JSON.stringify({ id: msg.id, error: `Unknown command: ${msg.command}` }))
          return
        }
        handler(msg, (data) => ws.send(JSON.stringify({ id: msg.id, ...data })))
      })
    })

    // Ping/pong for dead connection cleanup
    this.pingTimer = setInterval(() => {
      for (const ws of this.wss.clients) {
        if (!(ws as any).__alive) { ws.terminate(); continue }
        (ws as any).__alive = false
        ws.ping()
      }
      for (const ws of this.spaClients) {
        if (ws.readyState !== WebSocket.OPEN) {
          this.spaClients.delete(ws)
          this.spaSessionMap.delete(ws)
          continue
        }
        ws.ping()
      }
      for (const ws of this.a2uiStreamClients) {
        if (ws.readyState !== WebSocket.OPEN) {
          this.a2uiStreamClients.delete(ws)
          continue
        }
        ws.ping()
      }
    }, PING_INTERVAL)
  }

  /** Process an incoming SPA WebSocket message (snapshot results, session switches). */
  private handleSpaMessage(raw: unknown, ws: WebSocket) {
    let data: Record<string, unknown>
    try {
      data = JSON.parse(String(raw))
    } catch {
      return // ignore non-JSON
    }
    if (data.type === 'canvas.snapshotResult' && data.id) {
      const resolve = this.pendingSnapshots.get(data.id as string)
      if (resolve) {
        this.pendingSnapshots.delete(data.id as string)
        resolve(data.error ? { error: data.error } : { ok: true, image: data.image })
      }
    } else if (data.type === 'session.switch' && data.session) {
      this.spaSessionMap.set(ws, data.session as string)
    }
  }

  /** Process streaming A2UI commands — validates each line and sends per-command results. */
  private handleA2UIStreamMessage(raw: unknown, ws: WebSocket, session: string) {
    if (!this.a2uiManager) {
      ws.send(JSON.stringify({ ok: false, error: 'A2UI manager not initialized' }))
      return
    }
    const line = String(raw).trim()
    if (!line) return

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(line)
    } catch {
      ws.send(JSON.stringify({ ok: false, command: 'parse', index: 0, error: `Invalid JSON: ${line.slice(0, 100)}` } as ValidationResult))
      return
    }

    const result = processPipelineCommand(session, parsed, 0, this.a2uiManager, this, this.resolveSchema)
    ws.send(JSON.stringify(result))
  }

  /** Set the A2UI manager for streaming interface. */
  setA2UIManager(manager: A2UIManager) {
    this.a2uiManager = manager
  }

  setSchemaResolver(resolver: SchemaResolver) {
    this.resolveSchema = resolver
  }

  on(command: string, handler: CommandHandler) {
    this.handlers.set(command, handler)
  }

  onSpaConnect(listener: (ws: WebSocket) => void) {
    this.spaConnectListeners.push(listener)
  }

  getSpaSession(ws: WebSocket): string {
    return this.spaSessionMap.get(ws) ?? 'main'
  }

  sendToSpa(ws: WebSocket, data: Record<string, unknown>) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data))
  }

  /** Request snapshot from SPA and wait for result */
  requestSnapshot(id: string): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      this.pendingSnapshots.set(id, resolve)
      this.broadcastSpa({ type: 'canvas.snapshot', id })
      setTimeout(() => {
        if (this.pendingSnapshots.has(id)) {
          this.pendingSnapshots.delete(id)
          resolve({ error: 'Snapshot timed out' })
        }
      }, SNAPSHOT_TIMEOUT)
    })
  }

  broadcastSpa(data: Record<string, unknown>) {
    const payload = JSON.stringify(data)
    for (const ws of this.spaClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload)
    }
  }

  /** Broadcast only to SPA clients connected for a specific session */
  broadcastSpaSession(session: string, data: Record<string, unknown>) {
    const payload = JSON.stringify({ ...data, session })
    for (const ws of this.spaClients) {
      if (ws.readyState === WebSocket.OPEN && this.spaSessionMap.get(ws) === session) {
        ws.send(payload)
      }
    }
  }

  broadcastGateway(data: Record<string, unknown>) {
    const payload = JSON.stringify(data)
    for (const ws of this.wss.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload)
    }
  }

  close() {
    if (this.pingTimer) clearInterval(this.pingTimer)
    for (const ws of this.spaClients) ws.close()
    for (const ws of this.a2uiStreamClients) ws.close()
    for (const ws of this.wss.clients) ws.close()
    this.wss.close()
  }
}
