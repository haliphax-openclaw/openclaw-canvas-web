# AGENTS.md — OpenClaw Canvas

Guidance for AI agents working on this codebase.

## Project Overview

OpenClaw Canvas is a local canvas server that agents control via WebSocket. It renders HTML content and A2UI surfaces in a Vue 3 SPA. The server is Express + ws, the client is Vue 3 + Vuex + Vue Router, built with Vite.

## Key Conventions

- TypeScript everywhere. Strict mode. No `any` except where vuex forces it.
- ESM (`"type": "module"` in package.json). Use `.js` extensions in server imports.
- Server code in `src/server/`, client code in `src/client/`, tests in `test/`.
- Vitest for tests. Config in `vitest.config.ts` (separate from `vite.config.ts`).
- `npm install --include=dev` is required — the environment may have `omit=dev` set globally.

## How Things Connect

```
Agent ──ws──▶ /gateway ──▶ Gateway (command handlers) ──▶ broadcastSpa ──ws──▶ /ws ──▶ SPA
```

1. Agent connects to `/gateway` WebSocket, sends `{ command, id, ...params }`.
2. Gateway dispatches to registered command handlers (in `commands/`).
3. Handlers call `gateway.broadcastSpa()` to push state to the Vue SPA.
4. SPA connects to `/ws` WebSocket, receives broadcasts, updates Vuex store.
5. For snapshots: SPA captures via html2canvas, sends result back through `/ws`, gateway resolves the pending promise.

## Adding a New Command

1. Add handler in `src/server/commands/` using `gateway.on('command.name', (msg, reply) => { ... })`.
2. Register it in `src/server/index.ts`.
3. If the SPA needs to react, add a `wsClient.on()` handler in `CanvasView.vue`.
4. Add a test in `test/`.

## Adding a New A2UI Component

1. Create `src/client/components/A2UI<Name>.vue`.
2. Add it to the `componentMap` in `A2UINode.vue`.

## File Layout

```
src/server/
  index.ts                 # Entrypoint. Express app, server startup, graceful shutdown.
  services/gateway.ts      # WebSocket server. Two paths: /gateway (agents), /ws (SPA).
  services/file-resolver.ts # Resolves session file paths. Blocks traversal.
  services/file-watcher.ts  # chokidar watcher, triggers live reload.
  services/session-manager.ts # Tracks active session.
  services/a2ui-manager.ts   # Server-side A2UI surface state.
  commands/canvas.ts        # canvas.show/hide/navigate/navigateExternal/eval/snapshot
  commands/a2ui.ts          # a2ui.push (JSONL parsing), a2ui.reset
  routes/canvas.ts          # GET /canvas/:session/:path — serves session files
  routes/scaffold.ts        # GET /scaffold — placeholder page

src/client/
  main.ts                  # Vue app bootstrap
  views/CanvasView.vue     # Main view — iframe, A2UI renderer, external URLs, snapshot capture
  views/ScaffoldView.vue   # "No index.html" placeholder
  store/index.ts           # Vuex root — session + panel modules
  store/a2ui.ts            # Vuex A2UI module — surface state
  services/ws-client.ts    # Browser WebSocket with reconnect
  services/url-rewriter.ts # openclaw-canvas:// → http:// rewriter
  components/A2UI*.vue     # A2UI component renderers
```

## Testing

```bash
npm test
```

Tests use real HTTP servers and WebSocket connections — no mocks for the gateway tests. Unit tests for services are straightforward. When adding features, test the flow end-to-end through the gateway when possible.

## Gotchas

- `vite.config.ts` sets `root: 'src/client'` — vitest needs its own `vitest.config.ts` to avoid path confusion.
- Vuex 4 doesn't export types properly via package.json `exports`. The workaround is a `declare module 'vuex'` in `env.d.ts`.
- The snapshot command is async — it sends a request to the SPA and waits up to 10s for a response via a pending promise map in Gateway.
- `npm install` may skip devDependencies if the environment has `omit=dev`. Always use `--include=dev`.
