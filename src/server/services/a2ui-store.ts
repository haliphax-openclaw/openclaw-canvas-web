import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

export interface A2UISurfaceRow {
  surfaceId: string
  components: string // JSON
  root: string | null
  dataModel: string // JSON
}

export class A2UIStore {
  private db: Database.Database

  constructor(dbPath?: string) {
    const resolvedPath = dbPath
      ?? process.env.OPENCLAW_CANVAS_A2UI_DB
      ?? path.join(process.env.HOME ?? '.', '.openclaw-canvas', 'a2ui-cache.db')
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true })
    this.db = new Database(resolvedPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS a2ui_surfaces (
        surfaceId TEXT PRIMARY KEY,
        components TEXT NOT NULL DEFAULT '{}',
        root TEXT,
        dataModel TEXT NOT NULL DEFAULT '{}'
      )
    `)
  }

  save(surface: { surfaceId: string; components: Map<string, Record<string, unknown>>; root: string | null; dataModel: Record<string, unknown> }) {
    const componentsObj: Record<string, Record<string, unknown>> = {}
    for (const [id, comp] of surface.components) componentsObj[id] = comp
    this.db.prepare(`
      INSERT OR REPLACE INTO a2ui_surfaces (surfaceId, components, root, dataModel)
      VALUES (?, ?, ?, ?)
    `).run(surface.surfaceId, JSON.stringify(componentsObj), surface.root, JSON.stringify(surface.dataModel))
  }

  load(surfaceId: string): A2UISurfaceRow | undefined {
    return this.db.prepare('SELECT * FROM a2ui_surfaces WHERE surfaceId = ?').get(surfaceId) as A2UISurfaceRow | undefined
  }

  loadAll(): A2UISurfaceRow[] {
    return this.db.prepare('SELECT * FROM a2ui_surfaces').all() as A2UISurfaceRow[]
  }

  delete(surfaceId: string) {
    this.db.prepare('DELETE FROM a2ui_surfaces WHERE surfaceId = ?').run(surfaceId)
  }

  clear() {
    this.db.exec('DELETE FROM a2ui_surfaces')
  }

  close() {
    this.db.close()
  }
}
