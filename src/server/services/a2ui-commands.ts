import type { Gateway } from './gateway.js'
import type { A2UIManager } from './a2ui-manager.js'

/**
 * Normalize data source rows from positional arrays to keyed objects.
 * Rows can arrive as either [{name: "Alice"}] or [["Alice"]] with a fields array.
 */
function normalizeSources(sources: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [name, src] of Object.entries(sources)) {
    if (!src || !Array.isArray(src.rows) || !Array.isArray(src.fields)) {
      out[name] = src
      continue
    }
    const fields: string[] = src.fields
    const hasArrayRows = src.rows.some((r: any) => Array.isArray(r))
    if (hasArrayRows) console.log(`[a2ui-commands] Normalizing ${src.rows.length} array rows for source "${name}"`)
    const rows = src.rows.map((r: any) =>
      Array.isArray(r) ? Object.fromEntries(fields.map((f, i) => [f, r[i]])) : r
    )
    out[name] = { ...src, rows }
  }
  return out
}

/**
 * Process a single parsed JSONL command and push it to the A2UI surface.
 * Shared by both the node-client (mcporter) and the JSONL file watcher.
 */
export function processA2UICommand(
  session: string,
  parsed: Record<string, unknown>,
  a2uiManager: A2UIManager,
  gateway: Gateway,
): boolean {
  if (parsed.surfaceUpdate) {
    const su = parsed.surfaceUpdate as { surfaceId: string; components: Array<{ id: string; component: Record<string, unknown> }> }
    if (!su.surfaceId || !Array.isArray(su.components)) return false
    a2uiManager.upsertSurface(session, su.surfaceId, su.components)
    gateway.broadcastSpaSession(session, { type: 'a2ui.surfaceUpdate', surfaceId: su.surfaceId, components: su.components })
    return true
  } else if (parsed.beginRendering) {
    const br = parsed.beginRendering as { surfaceId: string; root: string }
    if (!br.surfaceId || !br.root) return false
    a2uiManager.setRoot(session, br.surfaceId, br.root)
    gateway.broadcastSpaSession(session, { type: 'a2ui.beginRendering', surfaceId: br.surfaceId, root: br.root })
    return true
  } else if (parsed.dataModelUpdate) {
    const dm = parsed.dataModelUpdate as { surfaceId: string; data: Record<string, unknown> }
    if (!dm.surfaceId) return false
    a2uiManager.updateDataModel(session, dm.surfaceId, dm.data ?? {})
    gateway.broadcastSpaSession(session, { type: 'a2ui.dataModelUpdate', surfaceId: dm.surfaceId, data: dm.data ?? {} })
    return true
  } else if (parsed.dataSourcePush) {
    const dp = parsed.dataSourcePush as { surfaceId: string; sources: Record<string, unknown> }
    if (!dp.surfaceId) return false
    const normalized = normalizeSources(dp.sources ?? {})
    const data = { $sources: normalized }
    a2uiManager.updateDataModel(session, dp.surfaceId, data)
    gateway.broadcastSpaSession(session, { type: 'a2ui.dataModelUpdate', surfaceId: dp.surfaceId, data })
    return true
  } else if (parsed.deleteSurface) {
    const ds = parsed.deleteSurface as { surfaceId: string }
    if (!ds.surfaceId) return false
    a2uiManager.deleteSurface(session, ds.surfaceId)
    gateway.broadcastSpaSession(session, { type: 'a2ui.deleteSurface', surfaceId: ds.surfaceId })
    return true
  }
  return false
}
