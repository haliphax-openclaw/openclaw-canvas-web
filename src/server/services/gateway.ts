import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'node:http'

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
  private pendingSnapshots = new Map<string, (data: Record<string, unknown>) => void>()
  private pingTimer: ReturnType<typeof setInterval> | null = null

  constructor(server: Server) {
    this.wss = new WebSocketServer({ noServer: true })

    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
      if (url.pathname === '/gateway') {
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit('connection', ws, req)
        })
      } else if (url.pathname === '/ws') {
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.spaClients.add(ws)
          ws.on('close', () => this.spaClients.delete(ws))
          ws.on('message', (raw) => {
            try {
              const data = JSON.parse(raw.toString())
              if (data.type === 'canvas.snapshotResult' && data.id) {
                const resolve = this.pendingSnapshots.get(data.id)
                if (resolve) {
                  this.pendingSnapshots.delete(data.id)
                  resolve(data.error ? { error: data.error } : { ok: true, image: data.image })
                }
              }
            } catch { /* ignore malformed */ }
          })
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
        if (ws.readyState !== WebSocket.OPEN) { this.spaClients.delete(ws); continue }
        ws.ping()
      }
    }, PING_INTERVAL)
  }

  on(command: string, handler: CommandHandler) {
    this.handlers.set(command, handler)
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

  broadcastGateway(data: Record<string, unknown>) {
    const payload = JSON.stringify(data)
    for (const ws of this.wss.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload)
    }
  }

  close() {
    if (this.pingTimer) clearInterval(this.pingTimer)
    for (const ws of this.spaClients) ws.close()
    for (const ws of this.wss.clients) ws.close()
    this.wss.close()
  }
}
