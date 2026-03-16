import path from 'node:path'
import fs from 'node:fs/promises'

export class FileResolver {
  constructor(private canvasRoot: string) {}

  async resolve(session: string, subpath: string): Promise<string | null> {
    if (!session || session.includes('..') || session.includes('/')) return null

    const sessionRoot = path.join(this.canvasRoot, session)
    const target = path.join(sessionRoot, subpath || 'index.html')
    const finalPath = target.endsWith('/') ? path.join(target, 'index.html') : target

    let real: string
    try {
      real = await fs.realpath(finalPath)
    } catch {
      return null
    }

    const realSessionRoot = await fs.realpath(sessionRoot).catch(() => null)
    if (!realSessionRoot || !real.startsWith(realSessionRoot + path.sep) && real !== realSessionRoot) {
      return null
    }

    return real
  }

  async sessionExists(session: string): Promise<boolean> {
    if (!session || session.includes('..') || session.includes('/')) return false
    try {
      const stat = await fs.stat(path.join(this.canvasRoot, session))
      return stat.isDirectory()
    } catch {
      return false
    }
  }

  async hasIndex(session: string): Promise<boolean> {
    const resolved = await this.resolve(session, 'index.html')
    return resolved !== null
  }

  getCanvasRoot(): string {
    return this.canvasRoot
  }
}
