# AGENTS.md — OpenClaw Canvas

Guidance for AI agents working on this codebase.

## Project Overview

OpenClaw Canvas is a local canvas server that agents control via WebSocket. It renders HTML content and A2UI surfaces in a Vue 3 SPA. The server is Express + ws, the client is Vue 3 + Vuex + Vue Router, built with Vite. It registers as an OpenClaw gateway node to receive canvas commands via `node.invoke`.

## Key Conventions

- TypeScript everywhere. Strict mode. No `any` except where vuex forces it.
- ESM (`"type": "module"` in package.json). Use `.js` extensions in server imports.
- Server code in `src/server/`, client code in `src/client/`, tests in `test/`.
- Vitest for tests. Config in `vitest.config.ts` (separate from `vite.config.ts`).
- `npm install --include=dev` is required — the environment may have `omit=dev` set globally.

## How Things Connect

```
OpenClaw Gateway ──node.invoke──▶ NodeClient ──▶ command handlers ──▶ broadcastSpa ──ws──▶ /ws ──▶ SPA
                                                                                                    │
Canvas HTML ──click openclaw://──▶ injected script ──postMessage──▶ SPA ──POST /api/agent──▶ gateway /hooks/agent
```

1. The server registers as an OpenClaw gateway node via `NodeClient` (Ed25519 challenge-response auth).
2. Gateway sends `node.invoke` commands (canvas.present, canvas.navigate, etc.) to the server.
3. `NodeClient.executeCommand()` dispatches to the appropriate handler and calls `gateway.broadcastSpa()`.
4. SPA connects to `/ws` WebSocket, receives broadcasts, updates Vuex store and renders content.
5. For deep links: server injects a click interceptor script into served HTML (and `data:` URLs). Clicks on `openclaw://` links post a message to the parent SPA, which shows a confirmation dialog and POSTs to `/api/agent`.
6. For snapshots: SPA captures via `dom-to-image-more`, sends result back through `/ws`, gateway resolves the pending promise.

## Custom URL Protocols

- `openclaw://agent?message=...` — triggers agent runs via deep link.
- `openclaw-canvas://<session>/<path>` — references canvas files across sessions, rewritten to `/_c/<session>/<path>` at runtime.

## Adding a New Command

1. Add handler in `src/server/commands/` using `gateway.on('command.name', (msg, reply) => { ... })`.
2. Register it in `src/server/index.ts`.
3. Add handling in `NodeClient.executeCommand()` if the command arrives via gateway node.invoke.
4. If the SPA needs to react, add a `wsClient.on()` handler in `CanvasView.vue`.
5. Add a test in `test/`.

## Adding a New A2UI Component

1. Create `src/client/components/A2UI<Name>.vue`.
2. Add it to the `componentMap` in `A2UINode.vue`.

## File Layout

```
src/server/
  index.ts                    # Entrypoint. Express app, server startup, graceful shutdown.
  services/gateway.ts         # WebSocket server. Two paths: /gateway (agents), /ws (SPA).
  services/node-client.ts     # OpenClaw gateway node registration and command dispatch.
  services/file-resolver.ts   # Resolves session file paths. Blocks traversal.
  services/file-watcher.ts    # chokidar watcher, triggers live reload.
  services/session-manager.ts # Tracks active session.
  services/a2ui-manager.ts    # Server-side A2UI surface state.
  commands/canvas.ts          # canvas.show/hide/navigate/navigateExternal/eval/snapshot
  commands/a2ui.ts            # a2ui.push (JSONL parsing), a2ui.reset
  routes/canvas.ts            # GET /_c/:session/{*subpath} — serves session files with deep link injection
  routes/scaffold.ts          # GET /scaffold — placeholder page
  routes/agent-proxy.ts       # POST /api/agent — proxies deep link requests to gateway /hooks/agent
  routes/canvas-config.ts     # GET /api/canvas-config — exposes config (agents, skipConfirmation) to SPA
  shared/deep-link-script.ts  # Shared deep link script constant and data: URL injection helper

src/client/
  main.ts                     # Vue app bootstrap
  views/CanvasView.vue        # Main view — iframe, A2UI renderer, external URLs, snapshot, deep link handling
  views/ScaffoldView.vue      # "No index.html" placeholder
  store/index.ts              # Vuex root — session + panel modules
  store/a2ui.ts               # Vuex A2UI module — surface state
  services/ws-client.ts       # Browser WebSocket with reconnect
  services/deep-link.ts       # openclaw:// URL parser, executeDeepLink, fetchCanvasConfig
  services/url-rewriter.ts    # openclaw-canvas:// → http:// rewriter
  components/DeepLinkConfirm.vue # Confirmation dialog with collapsible agent/model/thinking controls
  components/A2UI*.vue         # A2UI component renderers (incl. Accordion, Tabs)
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCLAW_CANVAS_HOST` | `0.0.0.0` | Bind address |
| `OPENCLAW_CANVAS_PORT` | `3456` | Listen port |
| `OPENCLAW_CANVAS_ROOT` | `~/.openclaw-canvas` | Root directory for session files |
| `OPENCLAW_CANVAS_SKIP_CONFIRM` | `false` | Skip deep link confirmation dialog |

## Reverse Proxy (Traefik)

When deployed behind Traefik with path prefix stripping (e.g. `/canvas/` → `/`):
- Build with `VITE_BASE=/canvas/ npm run build` so asset paths and Vue Router base are correct.
- Traefik handles WebSocket upgrades automatically — no special config needed.
- The SPA's WebSocket client builds its URL from `import.meta.env.BASE_URL`.

## Testing

```bash
npm test
```

Tests use real HTTP servers and WebSocket connections — no mocks for the gateway tests. Unit tests for services are straightforward. When adding features, test the flow end-to-end through the gateway when possible.

## Gotchas

- `vite.config.ts` sets `root: 'src/client'` — vitest needs its own `vitest.config.ts` to avoid path confusion.
- Vuex 4 doesn't export types properly via package.json `exports`. The workaround is a `declare module 'vuex'` in `env.d.ts`.
- The snapshot command is async — it sends a request to the SPA and waits up to 30s for a response via a pending promise map in Gateway. Uses `dom-to-image-more` (not html2canvas). Cannot capture cross-origin iframe content.
- `npm install` may skip devDependencies if the environment has `omit=dev`. Always use `--include=dev`.
- `data:` URLs are cross-origin — the deep link script must be injected server-side before broadcasting. `injectDeepLinkIntoDataUrl()` in `shared/deep-link-script.ts` handles this.
- `new.css` is loaded globally for scaffold styling but sets `body { max-width: 750px; padding: 2rem }` — overridden in `index.html` with `body { max-width: none; padding: 0 }`.
- Canvas file routes use `/_c/:session/{*subpath}` prefix to avoid collisions with SPA routes.
- Express 5 `{*subpath}` wildcard returns arrays, not strings — use `.join('/')`.
