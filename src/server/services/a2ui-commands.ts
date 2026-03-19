import type { Gateway } from './gateway.js'
import type { A2UIManager } from './a2ui-manager.js'

/** v0.8 → v0.9 command name aliases */
const COMMAND_ALIASES: Record<string, string> = {
  surfaceUpdate: 'updateComponents',
  beginRendering: 'createSurface',
  dataModelUpdate: 'updateDataModel',
}

/**
 * Normalize a single component from v0.8 wrapped shape to v0.9 flat shape.
 * v0.8: { id: "x", component: { "Text": { "text": "..." } } }
 * v0.9: { id: "x", component: "Text", "text": "..." }
 * Also normalizes usageHint → variant.
 */
function normalizeComponent(c: { id: string; component: unknown;[key: string]: unknown }): { id: string; component: string;[key: string]: unknown } {
  let result: { id: string; component: string;[key: string]: unknown }

  if (typeof c.component === 'string') {
    // Already v0.9 flat shape
    result = c as { id: string; component: string;[key: string]: unknown }
  } else if (typeof c.component === 'object' && c.component !== null) {
    // v0.8 wrapped shape — unwrap
    const keys = Object.keys(c.component as object)
    if (keys.length === 1) {
      const type = keys[0]
      const props = (c.component as Record<string, Record<string, unknown>>)[type] ?? {}
      result = { id: c.id, component: type, ...props }
    } else {
      return c as any
    }
  } else {
    return c as any
  }

  // Normalize usageHint → variant
  if ('usageHint' in result && !('variant' in result)) {
    result.variant = result.usageHint
    delete result.usageHint
  }

  return result
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
  // Normalize v0.8 command names to v0.9
  for (const [oldName, newName] of Object.entries(COMMAND_ALIASES)) {
    if (parsed[oldName] !== undefined) {
      console.warn(`[a2ui] Deprecated command "${oldName}" — use "${newName}" instead`)
      parsed[newName] = parsed[oldName]
      delete parsed[oldName]
    }
  }

  if (parsed.updateComponents) {
    const su = parsed.updateComponents as { surfaceId: string; components: Array<{ id: string; component: unknown;[key: string]: unknown }> }
    if (!su.surfaceId || !Array.isArray(su.components)) return false
    const normalized = su.components.map(normalizeComponent)
    a2uiManager.upsertSurface(session, su.surfaceId, normalized as any)
    gateway.broadcastSpaSession(session, { type: 'a2ui.updateComponents', surfaceId: su.surfaceId, components: normalized })
    return true
  } else if (parsed.createSurface) {
    const br = parsed.createSurface as { surfaceId: string; root?: string; catalogId?: string; theme?: Record<string, unknown>; sendDataModel?: boolean }
    if (!br.surfaceId) return false
    const root = br.root ?? 'root'
    a2uiManager.setRoot(session, br.surfaceId, root, { catalogId: br.catalogId, theme: br.theme })
    gateway.broadcastSpaSession(session, { type: 'a2ui.createSurface', surfaceId: br.surfaceId, root, catalogId: br.catalogId, theme: br.theme, sendDataModel: br.sendDataModel })
    return true
  } else if (parsed.updateDataModel) {
    const dm = parsed.updateDataModel as { surfaceId: string; data: Record<string, unknown> }
    if (!dm.surfaceId) return false
    a2uiManager.updateDataModel(session, dm.surfaceId, dm.data ?? {})
    gateway.broadcastSpaSession(session, { type: 'a2ui.updateDataModel', surfaceId: dm.surfaceId, data: dm.data ?? {} })
    return true
  } else if (parsed.dataSourcePush) {
    const dp = parsed.dataSourcePush as { surfaceId: string; sources: Record<string, unknown> }
    if (!dp.surfaceId) return false
    const data = { $sources: dp.sources ?? {} }
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
