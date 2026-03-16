type Handler = (data: Record<string, unknown>) => void

class WsClient {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<Handler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  connect() {
    if (this.destroyed) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    this.ws = new WebSocket(`${proto}://${location.host}/ws`)
    this.ws.onmessage = (e) => {
      let data: Record<string, unknown>
      try { data = JSON.parse(e.data) } catch { return }
      const type = data.type as string
      if (type) this.handlers.get(type)?.forEach((h) => h(data))
    }
    this.ws.onclose = () => {
      if (!this.destroyed) {
        this.reconnectTimer = setTimeout(() => this.connect(), 2000)
      }
    }
    this.ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    }
  }

  on(type: string, handler: Handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
  }

  off(type: string, handler: Handler) {
    this.handlers.get(type)?.delete(handler)
  }

  send(data: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  destroy() {
    this.destroyed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
  }
}

export const wsClient = new WsClient()
