import type { Gateway } from '../services/gateway.js'
import type { A2UIManager } from '../services/a2ui-manager.js'
import { processA2UICommand } from '../services/a2ui-commands.js'

export function registerA2UICommands(gateway: Gateway, a2uiManager: A2UIManager) {
  gateway.on('a2ui.push', (msg, reply) => {
    const payload = msg.payload
    if (typeof payload !== 'string' || !payload) {
      reply({ error: 'Missing or invalid payload' })
      return
    }
    const session = (msg.session as string) || 'main'

    const lines = payload.split('\n').filter(l => l.trim())
    for (const line of lines) {
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(line)
      } catch (e) {
        console.warn(`[a2ui] Skipping malformed JSONL line: ${line.slice(0, 100)}`)
        continue
      }

      processA2UICommand(session, parsed, a2uiManager, gateway)
    }
    reply({ ok: true })
  })

  gateway.on('a2ui.reset', (msg, reply) => {
    const session = msg.session as string | undefined
    if (session) {
      a2uiManager.clearSession(session)
      gateway.broadcastSpaSession(session, { type: 'a2ui.clearAll' })
    } else {
      a2uiManager.clearAll()
      gateway.broadcastSpa({ type: 'a2ui.clearAll' })
    }
    reply({ ok: true })
  })
}
