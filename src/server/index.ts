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
import { canvasConfigRoute } from './routes/canvas-config.js'
import { agentProxyRoute } from './routes/agent-proxy.js'
import { fileSpawnRoute } from './routes/file-spawn.js'
import { registerCanvasCommands } from './commands/canvas.js'
import { registerA2UICommands } from './commands/a2ui.js'
import { A2UIManager } from './services/a2ui-manager.js'
import { A2UIStore } from './services/a2ui-store.js'
import { NodeClient } from './services/node-client.js'
import { JSONLWatcher } from './services/jsonl-watcher.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BASE_PATH = (process.env.OPENCLAW_CANVAS_BASE_PATH ?? '/').replace(/\/+$/, '')
const HOST = process.env.OPENCLAW_CANVAS_HOST ?? '0.0.0.0'
const PORT = parseInt(process.env.OPENCLAW_CANVAS_PORT ?? '3456', 10)
const WORKSPACE = process.env.OPENCLAW_WORKSPACE ?? path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? '.',
  '.openclaw', 'workspace'
)
const CANVAS_ROOT = process.env.OPENCLAW_CANVAS_ROOT ?? path.join(WORKSPACE, 'canvas')
fs.mkdirSync(CANVAS_ROOT, { recursive: true })

// Read OpenClaw config once
const OPENCLAW_CONFIG_PATH = path.join(process.env.HOME ?? '.', '.openclaw', 'openclaw.json')
const openclawConfig: Record<string, any> = (() => {
  try {
    return JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8'))
  } catch { return {} }
})()

// Resolve gateway connection details early (needed for agent proxy route)
const GATEWAY_WS_URL = process.env.OPENCLAW_GATEWAY_WS_URL ?? 'ws://127.0.0.1:18789'
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? openclawConfig?.gateway?.auth?.token ?? ''

// Build agent workspace map: agentId → <workspace>/canvas/
const defaultWorkspace = openclawConfig?.agents?.defaults?.workspace ?? WORKSPACE
const agentWorkspaceMap = new Map<string, string>()
const agentsList = openclawConfig?.agents?.list ?? []
for (const agent of agentsList) {
  const ws = agent.workspace ?? defaultWorkspace
  const canvasDir = path.join(ws, 'canvas')
  fs.mkdirSync(canvasDir, { recursive: true })
  agentWorkspaceMap.set(agent.id, canvasDir)
  console.log(`Canvas workspace: ${agent.id} → ${canvasDir}`)
}

const fileResolver = new FileResolver(agentWorkspaceMap, CANVAS_ROOT)
const sessionManager = new SessionManager()

const app = express()

const clientDist = path.join(__dirname, '../../dist/client')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
}

app.use(canvasRoute(fileResolver, BASE_PATH))
app.use(scaffoldRoute())
app.use(canvasConfigRoute())

// Deep link proxy: openclaw://... → POST /api/agent → gateway /tools/invoke (sessions_spawn)
if (GATEWAY_TOKEN) {
  app.use(agentProxyRoute(GATEWAY_WS_URL, GATEWAY_TOKEN))
}
// File spawn: openclaw-fileprompt://... → POST /api/file-spawn → read file → gateway /tools/invoke (sessions_spawn)
if (GATEWAY_TOKEN) {
  app.use(fileSpawnRoute(GATEWAY_WS_URL, GATEWAY_TOKEN, CANVAS_ROOT, agentWorkspaceMap))
}

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
const a2uiStore = new A2UIStore()
const a2uiManager = new A2UIManager(a2uiStore)
registerCanvasCommands(gateway, sessionManager)
registerA2UICommands(gateway, a2uiManager)

// Replay cached A2UI state to newly connected SPA clients
gateway.onSpaConnect((ws) => {
  const session = gateway.getSpaSession(ws)
  for (const surface of a2uiManager.surfacesForSession(session)) {
    const components = Array.from(surface.components.entries()).map(([id, component]) => ({ id, ...component }))
    gateway.sendToSpa(ws, { type: 'a2ui.updateComponents', session, surfaceId: surface.surfaceId, components })
    if (surface.dataModel && Object.keys(surface.dataModel).length > 0) {
      gateway.sendToSpa(ws, { type: 'a2ui.updateDataModel', session, surfaceId: surface.surfaceId, data: surface.dataModel })
    }
    if (surface.root) {
      const msg: Record<string, unknown> = { type: 'a2ui.createSurface', session, surfaceId: surface.surfaceId, root: surface.root }
      if (surface.catalogId) msg.catalogId = surface.catalogId
      if (surface.theme) msg.theme = surface.theme
      gateway.sendToSpa(ws, msg)
    }
  }
})
const sessionPathMap = new Map<string, string>()
sessionPathMap.set('main', CANVAS_ROOT)
for (const [agentId, canvasDir] of agentWorkspaceMap) {
  sessionPathMap.set(agentId, canvasDir)
}
const CANVAS_IGNORE_DIRS = (process.env.OPENCLAW_CANVAS_IGNORE_DIRS ?? 'tmp,jsonl').split(',').map(s => s.trim()).filter(Boolean)
const fileWatcher = new FileWatcher(sessionPathMap, gateway, { ignoreDirs: CANVAS_IGNORE_DIRS })
const jsonlWatcher = new JSONLWatcher(sessionPathMap, gateway, a2uiManager)

// Connect to OpenClaw gateway as a node
let nodeClient: NodeClient | null = null
if (GATEWAY_TOKEN) {
  nodeClient = new NodeClient({
    gatewayUrl: GATEWAY_WS_URL,
    token: GATEWAY_TOKEN,
    gateway,
    a2uiManager,
    sessionManager
  })
  nodeClient.start()
  console.log(`Node client connecting to ${GATEWAY_WS_URL}`)
} else {
  console.warn('No gateway token found — node registration disabled')
}

export { app, server, fileResolver, sessionManager, gateway, a2uiManager, nodeClient }

async function shutdown() {
  console.log('Shutting down…')
  nodeClient?.stop()
  gateway.broadcastSpa({ type: 'server.shutdown' })
  jsonlWatcher.close()
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
