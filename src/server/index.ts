import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FileResolver } from './services/file-resolver.js'
import { SessionManager } from './services/session-manager.js'
import { Gateway } from './services/gateway.js'
import { FileWatcher } from './services/file-watcher.js'
import { canvasRoute } from './routes/canvas.js'
import { scaffoldRoute } from './routes/scaffold.js'
import { registerCanvasCommands } from './commands/canvas.js'
import { registerA2UICommands } from './commands/a2ui.js'
import { A2UIManager } from './services/a2ui-manager.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const HOST = process.env.OPENCLAW_CANVAS_HOST ?? '0.0.0.0'
const PORT = parseInt(process.env.OPENCLAW_CANVAS_PORT ?? '3456', 10)
const CANVAS_ROOT = process.env.OPENCLAW_CANVAS_ROOT ?? path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? '.',
  '.openclaw-canvas'
)

fs.mkdirSync(CANVAS_ROOT, { recursive: true })
fs.mkdirSync(path.join(CANVAS_ROOT, 'main'), { recursive: true })

const fileResolver = new FileResolver(CANVAS_ROOT)
const sessionManager = new SessionManager()

const app = express()

const clientDist = path.join(__dirname, '../../dist/client')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
}

app.use(canvasRoute(fileResolver))
app.use(scaffoldRoute())

app.get('/{*path}', (_req, res) => {
  const indexPath = path.join(clientDist, 'index.html')
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath)
  } else {
    res.status(404).send('SPA not built. Run: npm run build')
  }
})

const server = app.listen(PORT, HOST, () => {
  const addr = server.address()
  const bound = typeof addr === 'string' ? addr : `${addr?.address}:${addr?.port}`
  console.log(`OpenClaw Canvas server listening on ${bound}`)
  console.log(`Canvas root: ${CANVAS_ROOT}`)
})

const gateway = new Gateway(server)
const a2uiManager = new A2UIManager()
registerCanvasCommands(gateway, sessionManager)
registerA2UICommands(gateway, a2uiManager)
const fileWatcher = new FileWatcher(CANVAS_ROOT, gateway)

export { app, server, fileResolver, sessionManager, gateway, a2uiManager }

async function shutdown() {
  console.log('Shutting down…')
  gateway.broadcastSpa({ type: 'server.shutdown' })
  await fileWatcher.close()
  gateway.close()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 5000)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
})

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err)
})
