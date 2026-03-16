export interface A2UISurface {
  surfaceId: string
  components: Map<string, Record<string, unknown>>
  root: string | null
  dataModel: Record<string, unknown>
}

export class A2UIManager {
  private surfaces = new Map<string, A2UISurface>()

  upsertSurface(surfaceId: string, components: Array<{ id: string; component: Record<string, unknown> }>) {
    let surface = this.surfaces.get(surfaceId)
    if (!surface) {
      surface = { surfaceId, components: new Map(), root: null, dataModel: {} }
      this.surfaces.set(surfaceId, surface)
    }
    for (const c of components) {
      surface.components.set(c.id, c.component)
    }
  }

  setRoot(surfaceId: string, root: string) {
    const surface = this.surfaces.get(surfaceId)
    if (surface) surface.root = root
  }

  updateDataModel(surfaceId: string, data: Record<string, unknown>) {
    const surface = this.surfaces.get(surfaceId)
    if (surface) Object.assign(surface.dataModel, data)
  }

  deleteSurface(surfaceId: string) {
    this.surfaces.delete(surfaceId)
  }

  clearAll() {
    this.surfaces.clear()
  }

  getSurface(surfaceId: string): A2UISurface | undefined {
    return this.surfaces.get(surfaceId)
  }

  /** Serialize for sending to SPA */
  serialize(surfaceId: string): Record<string, unknown> | null {
    const s = this.surfaces.get(surfaceId)
    if (!s) return null
    const components: Record<string, Record<string, unknown>> = {}
    for (const [id, comp] of s.components) components[id] = comp
    return { surfaceId: s.surfaceId, components, root: s.root, dataModel: s.dataModel }
  }
}
