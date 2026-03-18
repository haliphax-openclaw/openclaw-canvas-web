import fs from 'node:fs'
import path from 'node:path'
import type { Gateway } from './gateway.js'
import type { A2UIManager } from './a2ui-manager.js'

export interface JSONLWatcherOptions {
  debounceMs?: number
}

/**
 * Watches each agent's canvas/jsonl/ directory for .jsonl file changes
 * and auto-pushes A2UI surface data to the canvas.
 */
export class JSONLWatcher {
  private watchers = new Map<string, fs.FSWatcher>()
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private debounceMs: number

  constructor(
    private sessionPathMap: Map<string, string>,
    private gateway: Gateway,
    private a2uiManager: A2UIManager,
    options: JSONLWatcherOptions = {},
  ) {
    this.debounceMs = options.debounceMs ?? 300

    for (const [session, canvasDir] of sessionPathMap) {
      const jsonlDir = path.join(canvasDir, 'jsonl')
      fs.mkdirSync(jsonlDir, { recursive: true })
      try {
        const watcher = fs.watch(jsonlDir, (eventType, filename) => {
          if (!filename || !filename.endsWith('.jsonl')) return
          if (eventType !== 'change' && eventType !== 'rename') return
          const filePath = path.join(jsonlDir, filename)
          this.scheduleProcess(session, filePath)
        })
        this.watchers.set(session, watcher)
        console.log(`[jsonl-watcher] Watching ${jsonlDir} for session "${session}"`)
      } catch (err: any) {
        console.warn(`[jsonl-watcher] Failed to watch ${jsonlDir}: ${err.message}`)
      }
    }
  }

  private scheduleProcess(session: string, filePath: string) {
    const key = `${session}\0${filePath}`
    const existing = this.debounceTimers.get(key)
    if (existing) clearTimeout(existing)
    this.debounceTimers.set(key, setTimeout(() => {
      this.debounceTimers.delete(key)
      this.processFile(session, filePath)
    }, this.debounceMs))
  }

  processFile(session: string, filePath: string) {
    let content: string
    try {
      content = fs.readFileSync(filePath, 'utf8')
    } catch {
      return // file may have been deleted
    }

    const lines = content.split('\n').filter(l => l.trim())
    for (const line of lines) {
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(line)
      } catch {
        console.warn(`[jsonl-watcher] Skipping invalid JSON in ${path.basename(filePath)}: ${line.slice(0, 80)}`)
        continue
      }

      if (parsed.surfaceUpdate) {
        const su = parsed.surfaceUpdate as { surfaceId: string; components: Array<{ id: string; component: Record<string, unknown> }> }
        if (!su.surfaceId || !Array.isArray(su.components)) continue
        this.a2uiManager.upsertSurface(session, su.surfaceId, su.components)
        this.gateway.broadcastSpaSession(session, { type: 'a2ui.surfaceUpdate', surfaceId: su.surfaceId, components: su.components })
      } else if (parsed.beginRendering) {
        const br = parsed.beginRendering as { surfaceId: string; root: string }
        if (!br.surfaceId || !br.root) continue
        this.a2uiManager.setRoot(session, br.surfaceId, br.root)
        this.gateway.broadcastSpaSession(session, { type: 'a2ui.beginRendering', surfaceId: br.surfaceId, root: br.root })
      } else if (parsed.dataModelUpdate) {
        const dm = parsed.dataModelUpdate as { surfaceId: string; data: Record<string, unknown> }
        if (!dm.surfaceId) continue
        this.a2uiManager.updateDataModel(session, dm.surfaceId, dm.data ?? {})
        this.gateway.broadcastSpaSession(session, { type: 'a2ui.dataModelUpdate', surfaceId: dm.surfaceId, data: dm.data ?? {} })
      } else if (parsed.dataSourcePush) {
        const dp = parsed.dataSourcePush as { surfaceId: string; sources: Record<string, unknown> }
        if (!dp.surfaceId) continue
        const data = { $sources: dp.sources ?? {} }
        this.a2uiManager.updateDataModel(session, dp.surfaceId, data)
        this.gateway.broadcastSpaSession(session, { type: 'a2ui.dataModelUpdate', surfaceId: dp.surfaceId, data })
      } else if (parsed.deleteSurface) {
        const ds = parsed.deleteSurface as { surfaceId: string }
        if (!ds.surfaceId) continue
        this.a2uiManager.deleteSurface(session, ds.surfaceId)
        this.gateway.broadcastSpaSession(session, { type: 'a2ui.deleteSurface', surfaceId: ds.surfaceId })
      }
    }
  }

  close() {
    for (const timer of this.debounceTimers.values()) clearTimeout(timer)
    this.debounceTimers.clear()
    for (const watcher of this.watchers.values()) watcher.close()
    this.watchers.clear()
  }
}
