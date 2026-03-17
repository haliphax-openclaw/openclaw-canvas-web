import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1
  readyState = MockWebSocket.OPEN
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  send = vi.fn()
  close = vi.fn()
  ping = vi.fn()
}

vi.stubGlobal('WebSocket', MockWebSocket)

// Mock import.meta.env
vi.stubGlobal('location', { protocol: 'http:', host: 'localhost:3456' })

// Import after mocks are set up
const { wsClient } = await import('../src/client/services/ws-client')

// Helper to create a fresh WsClient for each test
async function createClient() {
  // Re-import to get a fresh instance
  vi.resetModules()
  vi.stubGlobal('WebSocket', MockWebSocket)
  vi.stubGlobal('location', { protocol: 'http:', host: 'localhost:3456' })
  const mod = await import('../src/client/services/ws-client')
  return mod.wsClient
}

function simulateMessage(client: any, data: Record<string, unknown>) {
  // Access the internal ws and trigger onmessage
  const ws = (client as any).ws
  if (ws?.onmessage) {
    ws.onmessage({ data: JSON.stringify(data) })
  }
}

describe('WsClient message buffering', () => {
  let client: typeof wsClient

  beforeEach(async () => {
    client = await createClient()
    client.connect()
  })

  it('delivers messages immediately when handler is registered', () => {
    const handler = vi.fn()
    client.on('test.event', handler)

    simulateMessage(client, { type: 'test.event', value: 42 })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({ type: 'test.event', value: 42 })
  })

  it('buffers messages when no handler is registered', () => {
    const handler = vi.fn()

    // Send message before registering handler
    simulateMessage(client, { type: 'a2ui.surfaceUpdate', surfaceId: 'main', components: [] })

    // Handler not called yet
    expect(handler).not.toHaveBeenCalled()

    // Register handler — buffered message should flush
    client.on('a2ui.surfaceUpdate', handler)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({ type: 'a2ui.surfaceUpdate', surfaceId: 'main', components: [] })
  })

  it('flushes multiple buffered messages of the same type in order', () => {
    const calls: number[] = []
    const handler = vi.fn((data: Record<string, unknown>) => calls.push(data.seq as number))

    simulateMessage(client, { type: 'a2ui.surfaceUpdate', seq: 1 })
    simulateMessage(client, { type: 'a2ui.surfaceUpdate', seq: 2 })
    simulateMessage(client, { type: 'a2ui.surfaceUpdate', seq: 3 })

    client.on('a2ui.surfaceUpdate', handler)

    expect(handler).toHaveBeenCalledTimes(3)
    expect(calls).toEqual([1, 2, 3])
  })

  it('only flushes messages matching the registered type', () => {
    const surfaceHandler = vi.fn()
    const renderHandler = vi.fn()

    simulateMessage(client, { type: 'a2ui.surfaceUpdate', surfaceId: 'main' })
    simulateMessage(client, { type: 'a2ui.beginRendering', surfaceId: 'main', root: 'root' })
    simulateMessage(client, { type: 'a2ui.surfaceUpdate', surfaceId: 'other' })

    // Register only surfaceUpdate handler
    client.on('a2ui.surfaceUpdate', surfaceHandler)

    expect(surfaceHandler).toHaveBeenCalledTimes(2)
    expect(renderHandler).not.toHaveBeenCalled()

    // Now register beginRendering handler — should flush the remaining buffered message
    client.on('a2ui.beginRendering', renderHandler)

    expect(renderHandler).toHaveBeenCalledOnce()
    expect(renderHandler).toHaveBeenCalledWith({ type: 'a2ui.beginRendering', surfaceId: 'main', root: 'root' })
  })

  it('clears flushed messages from the buffer', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()

    simulateMessage(client, { type: 'a2ui.surfaceUpdate', data: 'first' })

    client.on('a2ui.surfaceUpdate', handler1)
    expect(handler1).toHaveBeenCalledOnce()

    // Register another handler for the same type — should NOT re-flush
    client.on('a2ui.surfaceUpdate', handler2)
    expect(handler2).not.toHaveBeenCalled()
  })

  it('does not buffer messages that have handlers', () => {
    const handler = vi.fn()
    client.on('test.event', handler)

    simulateMessage(client, { type: 'test.event', value: 1 })
    simulateMessage(client, { type: 'test.event', value: 2 })

    expect(handler).toHaveBeenCalledTimes(2)

    // Check internal buffer is empty for this type
    const pending = (client as any).pendingMessages as Array<Record<string, unknown>>
    const testPending = pending.filter((m: Record<string, unknown>) => m.type === 'test.event')
    expect(testPending).toHaveLength(0)
  })

  it('ignores messages without a type field', () => {
    const handler = vi.fn()

    simulateMessage(client, { noType: true })

    client.on('noType', handler)
    expect(handler).not.toHaveBeenCalled()

    const pending = (client as any).pendingMessages as Array<Record<string, unknown>>
    expect(pending).toHaveLength(0)
  })

  it('ignores malformed JSON messages', () => {
    const ws = (client as any).ws
    // Send invalid JSON — should not throw
    expect(() => {
      ws.onmessage({ data: 'not json{{{' })
    }).not.toThrow()

    const pending = (client as any).pendingMessages as Array<Record<string, unknown>>
    expect(pending).toHaveLength(0)
  })
})
