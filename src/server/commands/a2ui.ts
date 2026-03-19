import type { Gateway } from '../services/gateway.js'
import type { A2UIManager } from '../services/a2ui-manager.js'
import { processBatch } from '../services/a2ui-pipeline.js'

export function registerA2UICommands(gateway: Gateway, a2uiManager: A2UIManager) {
  gateway.on('a2ui.push', (msg, reply) => {
    const payload = msg.payload
    if (typeof payload !== 'string' || !payload) {
      reply({ error: 'Missing or invalid payload' })
      return
    }
    const session = (msg.session as string) || 'main'
    const results = processBatch(session, payload, a2uiManager, gateway)
    const errors = results.filter(r => !r.ok)
    reply({ ok: true, results, errors })
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
