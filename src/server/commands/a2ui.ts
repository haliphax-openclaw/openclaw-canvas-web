import type { Gateway } from '../services/gateway.js'
import type { A2UIManager } from '../services/a2ui-manager.js'

export function registerA2UICommands(gateway: Gateway, a2uiManager: A2UIManager) {
  gateway.on('a2ui.push', (msg, reply) => {
    const payload = msg.payload
    if (typeof payload !== 'string' || !payload) {
      reply({ error: 'Missing or invalid payload' })
      return
    }

    const lines = payload.split('\n').filter(l => l.trim())
    for (const line of lines) {
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(line)
      } catch (e) {
        console.warn(`[a2ui] Skipping malformed JSONL line: ${line.slice(0, 100)}`)
        continue
      }

      if (parsed.surfaceUpdate) {
        const su = parsed.surfaceUpdate as { surfaceId: string; components: Array<{ id: string; component: Record<string, unknown> }> }
        if (!su.surfaceId || !Array.isArray(su.components)) {
          console.warn('[a2ui] Invalid surfaceUpdate — missing surfaceId or components')
          continue
        }
        a2uiManager.upsertSurface(su.surfaceId, su.components)
        gateway.broadcastSpa({ type: 'a2ui.surfaceUpdate', surfaceId: su.surfaceId, components: su.components })
      } else if (parsed.beginRendering) {
        const br = parsed.beginRendering as { surfaceId: string; root: string }
        if (!br.surfaceId || !br.root) {
          console.warn('[a2ui] Invalid beginRendering — missing surfaceId or root')
          continue
        }
        a2uiManager.setRoot(br.surfaceId, br.root)
        gateway.broadcastSpa({ type: 'a2ui.beginRendering', surfaceId: br.surfaceId, root: br.root })
      } else if (parsed.dataModelUpdate) {
        const dm = parsed.dataModelUpdate as { surfaceId: string; data: Record<string, unknown> }
        if (!dm.surfaceId) {
          console.warn('[a2ui] Invalid dataModelUpdate — missing surfaceId')
          continue
        }
        a2uiManager.updateDataModel(dm.surfaceId, dm.data ?? {})
        gateway.broadcastSpa({ type: 'a2ui.dataModelUpdate', surfaceId: dm.surfaceId, data: dm.data ?? {} })
      } else if (parsed.dataSourcePush) {
        const dp = parsed.dataSourcePush as { surfaceId: string; sources: Record<string, unknown> }
        if (!dp.surfaceId) {
          console.warn('[a2ui] Invalid dataSourcePush — missing surfaceId')
          continue
        }
        const data = { $sources: dp.sources ?? {} }
        a2uiManager.updateDataModel(dp.surfaceId, data)
        gateway.broadcastSpa({ type: 'a2ui.dataModelUpdate', surfaceId: dp.surfaceId, data })
      } else if (parsed.deleteSurface) {
        const ds = parsed.deleteSurface as { surfaceId: string }
        if (!ds.surfaceId) {
          console.warn('[a2ui] Invalid deleteSurface — missing surfaceId')
          continue
        }
        a2uiManager.deleteSurface(ds.surfaceId)
        gateway.broadcastSpa({ type: 'a2ui.deleteSurface', surfaceId: ds.surfaceId })
      }
    }
    reply({ ok: true })
  })

  gateway.on('a2ui.reset', (_msg, reply) => {
    a2uiManager.clearAll()
    gateway.broadcastSpa({ type: 'a2ui.clearAll' })
    reply({ ok: true })
  })
}
