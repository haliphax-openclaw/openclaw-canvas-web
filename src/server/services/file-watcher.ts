import { watch, type FSWatcher } from 'chokidar'
import type { Gateway } from './gateway.js'

export class FileWatcher {
  private watcher: FSWatcher

  constructor(canvasRoot: string, gateway: Gateway) {
    this.watcher = watch(canvasRoot, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    })

    const notify = (filePath: string) => {
      gateway.broadcastSpa({ type: 'reload', path: filePath })
    }

    this.watcher.on('change', notify)
    this.watcher.on('add', notify)
    this.watcher.on('unlink', notify)
  }

  async close() {
    await this.watcher.close()
  }
}
