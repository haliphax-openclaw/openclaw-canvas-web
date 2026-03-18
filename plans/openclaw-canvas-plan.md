# OpenClaw Canvas — Implementation Plan

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Agent (external)                                    │
│  connects via WebSocket to Gateway                   │
└──────────────┬──────────────────────────────────────┘
               │ ws://localhost:<port>/gateway
┌──────────────▼──────────────────────────────────────┐
│  Express Server (localhost only)                     │
│                                                      │
│  ├─ /gateway          — WebSocket (agent commands)   │
│  ├─ /canvas/:session/ — static file serving          │
│  ├─ /a2ui/:session    — A2UI JSONL push endpoint     │
│  ├─ /scaffold         — built-in scaffold page       │
│  └─ /api/state        — panel state persistence      │
│                                                      │
│  Services:                                           │
│  ├─ FileResolver      — path resolution + traversal  │
│  │                      guard                        │
│  ├─ FileWatcher       — chokidar on canvas root      │
│  ├─ SessionManager    — tracks active session         │
│  └─ A2UIManager       — stores A2UI surface state    │
└──────────────┬──────────────────────────────────────┘
               │ http://127.0.0.1:<port>
┌──────────────▼──────────────────────────────────────┐
│  Webview Client (webview-nodejs)                     │
│                                                      │
│  ├─ Native window (borderless, resizable)            │
│  ├─ Loads Vue 3 SPA from Express                     │
│  ├─ bind() bridge: JS ↔ Node for protocol calls     │
│  └─ Persists window geometry per session             │
│                                                      │
│  Vue 3 SPA:                                          │
│  ├─ Vue Router — /session/:id/*path                  │
│  ├─ Vuex store — session, panel, A2UI state          │
│  ├─ A2UI renderer components                         │
│  └─ WebSocket client → server for live reload + A2UI │
└─────────────────────────────────────────────────────┘
```

The Express server binds exclusively to `127.0.0.1`. The webview loads the Vue SPA from it. The agent connects over WebSocket. All canvas file access goes through the server's `FileResolver`, which enforces session-scoped path resolution.

---

## 2. Project Structure

```
openclaw-canvas/
├── package.json
├── tsconfig.json
├── vite.config.ts              # builds the Vue SPA
├── src/
│   ├── server/
│   │   ├── index.ts            # Express bootstrap, binds localhost
│   │   ├── routes/
│   │   │   ├── canvas.ts       # GET /canvas/:session/*path
│   │   │   ├── scaffold.ts     # GET /scaffold
│   │   │   ├── a2ui.ts         # POST /a2ui/:session (JSONL body)
│   │   │   └── state.ts        # GET/PUT /api/state/:session
│   │   ├── gateway/
│   │   │   └── index.ts        # WebSocket server + command dispatch
│   │   └── services/
│   │       ├── file-resolver.ts
│   │       ├── file-watcher.ts
│   │       ├── session-manager.ts
│   │       └── a2ui-manager.ts
│   ├── client/
│   │   ├── main.ts             # Vue app entry
│   │   ├── App.vue
│   │   ├── router.ts
│   │   ├── store/
│   │   │   ├── index.ts        # Vuex store root
│   │   │   ├── session.ts      # session module
│   │   │   ├── panel.ts        # window geometry module
│   │   │   └── a2ui.ts         # A2UI surface state module
│   │   ├── views/
│   │   │   ├── CanvasView.vue  # main canvas frame (iframe or inline)
│   │   │   └── ScaffoldView.vue
│   │   ├── components/
│   │   │   └── a2ui/
│   │   │       ├── A2UIRenderer.vue
│   │   │       ├── A2UIColumn.vue
│   │   │       ├── A2UIRow.vue
│   │   │       ├── A2UIText.vue
│   │   │       ├── A2UIButton.vue
│   │   │       └── A2UIImage.vue
│   │   └── services/
│   │       ├── ws-client.ts    # WebSocket to server (reload + A2UI)
│   │       └── protocol.ts     # openclaw-canvas:// URL parser/rewriter
│   └── webview/
│       └── index.ts            # webview-nodejs launcher + bind() bridge
├── static/
│   └── scaffold/
│       └── index.html          # built-in scaffold page
└── canvas/                     # default canvas root (configurable)
```

---

## 3. Component Breakdown & Design Answers

### 3.1 Express Server — File Serving & Session Scoping

`FileResolver` is the security boundary:
- Canvas root defaults to `~/.openclaw-canvas/` (cross-platform equivalent of `~/Library/Application Support/OpenClaw/canvas/`). Configurable via env var `OPENCLAW_CANVAS_ROOT`.
- `resolve(session, subpath)` → joins `canvasRoot/session/subpath`, then calls `fs.realpath()` and asserts the result starts with `canvasRoot/session/`. Rejects with 403 on traversal.
- If `subpath` is `/` or ends with `/`, appends `index.html`.

Route `GET /canvas/:session/*path`:
1. Calls `FileResolver.resolve(session, path)`.
2. If file exists → serve with correct MIME type.
3. If session root exists but no `index.html` → 302 to `/scaffold?session=<session>`.
4. If session doesn't exist → 404.

### 3.2 Webview Client Bootstrap & Communication

`src/webview/index.ts`:
1. Starts the Express server programmatically (imports `src/server/index.ts`, gets back the port).
2. Creates a `webview-nodejs` Webview instance — borderless, resizable.
3. Restores saved window geometry for the current session from `canvasRoot/.panel-state.json`.
4. Calls `webview.navigate(`http://127.0.0.1:${port}`)`.
5. Registers `bind()` functions:
   - `resolveCanvasUrl(url)` — parses `openclaw-canvas://session/path` → returns `http://127.0.0.1:${port}/canvas/session/path`. The Vue SPA calls this to rewrite any `openclaw-canvas://` URLs encountered in content.
   - `saveGeometry(json)` — persists window size/position.
   - `getSession()` — returns current session ID.
6. On window close → saves geometry, shuts down server.

### 3.3 Vue Router Mapping

```
/                           → redirect to /session/main/
/session/:sessionId/*path   → CanvasView.vue
/scaffold                   → ScaffoldView.vue
/a2ui/:sessionId/:surfaceId → A2UIRenderer.vue (standalone A2UI surface)
```

`CanvasView.vue`:
- Extracts `sessionId` and `path` from route params.
- Fetches content from `/canvas/:sessionId/:path` via fetch.
- For HTML content: renders in a sandboxed `<iframe>` with `srcdoc` or `src` pointing to the Express route. The iframe approach keeps canvas HTML isolated from the Vue SPA.
- For direct A2UI mode (when agent pushes A2UI instead of files): switches to `A2UIRenderer`.

### 3.4 Vuex State

```ts
// session module
state: {
  activeSession: string,        // e.g. "main"
  sessions: string[],           // known session IDs
}
mutations: setActiveSession, addSession, removeSession
actions: switchSession (updates route + notifies server)

// panel module
state: {
  geometry: Record<string, { x: number, y: number, w: number, h: number }>,
  visible: boolean,
}
mutations: setGeometry, setVisible
actions: saveGeometry (calls bind bridge), restoreGeometry

// a2ui module
state: {
  surfaces: Record<string, {       // keyed by surfaceId
    components: Record<string, any>, // keyed by component id
    root: string | null,             // root component id
    dataModel: Record<string, any>,
  }>,
  renderingActive: Record<string, boolean>,
}
mutations: upsertSurface, deleteSurface, setRoot, updateDataModel, clearAll
actions: processA2UIMessage (parses JSONL line, dispatches to correct mutation)
```

The `a2ui` module is the single source of truth for all A2UI surface state. When a `surfaceUpdate` arrives, it merges components into the surface's component map. `beginRendering` sets the root and flips `renderingActive`. `deleteSurface` removes the entry. `dataModelUpdate` patches the surface's `dataModel`. The Vue renderer reactively picks up all changes.

---

### 3.5 A2UI v0.8 Rendering

The A2UI renderer is a recursive Vue component tree driven by the Vuex `a2ui` module.

**Data flow:**
1. Agent sends A2UI JSONL to server via Gateway WebSocket command (`a2ui.push`).
2. Server's `A2UIManager` stores the surface state and forwards the raw JSONL lines to the Vue SPA over a client-facing WebSocket channel (`ws://127.0.0.1:<port>/ws`).
3. `ws-client.ts` in the SPA receives the message, calls `store.dispatch('a2ui/processA2UIMessage', line)`.
4. `A2UIRenderer.vue` reads from the store and renders.

**Component mapping:**

| A2UI Component | Vue Component      | Notes                                      |
|----------------|--------------------|-------------------------------------------|
| `Column`       | `A2UIColumn.vue`   | Flexbox column, resolves `children.explicitList` |
| `Row`          | `A2UIRow.vue`      | Flexbox row                                |
| `Text`         | `A2UIText.vue`     | Maps `usageHint` → HTML tag (h1–h6, p, span) |
| `Button`       | `A2UIButton.vue`   | Click events sent back via WS              |
| `Image`        | `A2UIImage.vue`    | `src` rewritten through protocol resolver  |
| `Stack`        | `A2UIStack.vue`    | Absolute-positioned layering               |
| `Spacer`       | `A2UISpacer.vue`   | Flex spacer                                |

**`A2UIRenderer.vue` logic:**
```
props: surfaceId
computed: surface → store.state.a2ui.surfaces[surfaceId]
          rootComponent → surface.components[surface.root]

Renders recursively: looks up component by id → resolves its type →
renders the matching A2UI* Vue component → that component resolves
its own children from the store and recurses.
```

**`A2UINode.vue`** — a single dispatcher component that takes a `componentId` prop, looks up the component definition from the store, and renders the correct `A2UI*.vue` via `<component :is="...">`. Each child-bearing component (Column, Row, Stack) renders `<A2UINode>` for each child ID. This keeps recursion in one place.

**Message type handling:**

- `beginRendering` — sets `root` on the surface, marks it active. Renderer starts from this root.
- `surfaceUpdate` — upserts components into the surface's component map. Partial updates merge; full updates replace.
- `dataModelUpdate` — patches `dataModel` on the surface. Components can bind to data model values via template expressions (simple `{{key}}` interpolation in text fields).
- `deleteSurface` — removes the surface entirely from the store.

**What's NOT supported (v0.9):** `createSurface` messages are ignored with a console warning.

---

### 3.6 File Watching & Auto-Reload

**Server side — `FileWatcher` service:**
- Uses `chokidar` to watch `canvasRoot/` recursively.
- On any file change/add/unlink, determines which session is affected (first path segment under canvas root).
- Emits a `file-changed` event with `{ session, path, event }` on an internal EventEmitter.
- Debounces per-session: collapses rapid changes into a single notification (300ms window).

**Delivery to client:**
- The server maintains a WebSocket endpoint at `/ws` for the Vue SPA (separate from the `/gateway` agent WebSocket).
- On debounced `file-changed`, server sends `{ type: "reload", session }` to all connected SPA WebSocket clients.

**Client side — `ws-client.ts`:**
- Listens for `reload` messages.
- If `message.session === store.state.session.activeSession`, triggers a reload:
  - If rendering an iframe (HTML canvas content) → resets the iframe `src` with a cache-bust query param.
  - If rendering A2UI → no-op (A2UI state comes from agent pushes, not files).

---

### 3.7 Agent API — Gateway WebSocket

The agent connects to `ws://127.0.0.1:<port>/gateway`. Messages are JSON with a `command` field and an optional `id` for request/response correlation.

**Command dispatch table:**

| Command | Payload | Behavior |
|---|---|---|
| `canvas.show` | `{ session? }` | Sets panel visible. Optionally switches session. Sends `setVisible(true)` to SPA via `/ws`. Webview `bind()` bridge calls native show. |
| `canvas.hide` | — | Hides panel. Sends `setVisible(false)` to SPA. Bridge calls native hide. |
| `canvas.navigate` | `{ session, path }` | Switches active session + path. Server sends `{ type: "navigate", session, path }` to SPA via `/ws`. Vue Router pushes `/session/:session/:path`. |
| `canvas.navigateExternal` | `{ url }` | Only allows `http(s)://` URLs. SPA opens in iframe with sandbox. |
| `canvas.eval` | `{ js }` | Server forwards JS string to SPA via `/ws`. SPA executes it in the canvas iframe via `iframe.contentWindow.postMessage` + a message listener inside the iframe, or via webview `eval()` bridge for top-level eval. Returns result. |
| `canvas.snapshot` | `{ session }` | Triggers webview-nodejs screenshot via `bind()` bridge. Returns base64 PNG. |
| `a2ui.push` | `{ session, jsonl }` | Parses JSONL lines, updates `A2UIManager` state, forwards to SPA via `/ws`. |
| `a2ui.reset` | `{ session }` | Clears all A2UI surfaces for the session. Sends `{ type: "a2ui-reset", session }` to SPA. |

**Response format:**
```json
{ "id": "req-123", "ok": true, "data": { ... } }
{ "id": "req-456", "ok": false, "error": "Session not found" }
```

**Gateway implementation (`src/server/gateway/index.ts`):**
- Uses `ws` library, attached to the Express HTTP server on the `/gateway` path.
- Validates incoming JSON, extracts `command`, dispatches to handler functions.
- Handlers call into `SessionManager`, `A2UIManager`, `FileResolver` as needed.
- For commands that need to reach the webview native layer (show/hide/snapshot/eval), the server communicates with the webview process. Since server and webview run in the same Node process (webview `index.ts` imports and starts the server), they share references — the gateway handlers get a reference to a `WebviewController` interface that wraps the webview-nodejs instance.

---

### 3.8 Custom Protocol Handling

Since `webview-nodejs` doesn't yet support `webview_set_uri_scheme_handler`:

**Current approach — URL rewriting:**
1. `protocol.ts` in the SPA exports `rewriteUrl(url: string, port: number): string`.
2. Given `openclaw-canvas://main/assets/app.css` → returns `http://127.0.0.1:<port>/canvas/main/assets/app.css`.
3. The Vue SPA intercepts link clicks and resource loads in canvas iframes via a `MutationObserver` + `click` handler injected into iframe content. All `openclaw-canvas://` hrefs/srcs are rewritten before the browser tries to resolve them.
4. For CSS `url()` references inside canvas HTML, the server's canvas route injects a `<base>` tag pointing to `http://127.0.0.1:<port>/canvas/<session>/` so relative URLs resolve correctly.

**Migration path:**
- The `WebviewController` interface includes an optional `registerScheme(scheme, handler)` method.
- When webview-nodejs adds `webview_set_uri_scheme_handler`, implement this method to register `openclaw-canvas://` natively.
- The handler calls `FileResolver.resolve()` and returns the file content directly.
- Remove the URL rewriting layer and `<base>` tag injection.
- The rest of the architecture stays the same.

---

### 3.9 Panel State Persistence

**Storage:** `<canvasRoot>/.panel-state.json`

```json
{
  "main": { "x": 100, "y": 200, "w": 800, "h": 600 },
  "debug": { "x": 50, "y": 50, "w": 400, "h": 300 }
}
```

**Flow:**
- On webview launch → read file, restore geometry for active session.
- On window move/resize → debounced (500ms) save via `bind("saveGeometry", ...)` bridge → writes to file.
- On session switch → save current geometry under old session key, restore geometry for new session (or use defaults: centered, 800×600).

---

### 3.10 Session Switching

Only one canvas view is active at a time:
1. Agent sends `canvas.navigate { session: "debug", path: "/" }`.
2. Gateway handler calls `SessionManager.setActive("debug")`.
3. Server sends `{ type: "navigate", session: "debug", path: "/" }` over `/ws`.
4. SPA's `ws-client` receives it → dispatches `store.dispatch('session/switchSession', 'debug')` → Vue Router pushes `/session/debug/`.
5. `CanvasView` reacts to route change, loads content from `/canvas/debug/`.
6. Panel geometry is swapped (save old, restore new).

---

## 4. Implementation Phases

### Phase 1 — Skeleton & File Serving
- Project scaffolding: `package.json`, TypeScript config, Vite config for Vue SPA.
- `FileResolver` with traversal guard.
- Express server with `/canvas/:session/*path` route and scaffold fallback.
- Webview launcher that starts server and opens the SPA.
- Minimal Vue SPA: `App.vue`, router with `CanvasView` (renders iframe), `ScaffoldView`.
- Vuex `session` module (hardcoded to "main").
- Verify: webview opens, serves a hand-placed `canvas/main/index.html`, scaffold shows when missing.

### Phase 2 — Gateway & Agent Commands
- WebSocket server on `/gateway`.
- `SessionManager` service.
- Implement `canvas.show`, `canvas.hide`, `canvas.navigate`, `canvas.navigateExternal`.
- `WebviewController` wrapper with show/hide/eval via `bind()` bridge.
- Implement `canvas.eval` (top-level via webview eval).
- SPA WebSocket client (`ws-client.ts`) handling `navigate`, `setVisible` messages.
- Vuex `panel` module with visibility state.
- Verify: external WebSocket client can show/hide panel, navigate between sessions.

### Phase 3 — File Watching & Auto-Reload
- `FileWatcher` service with chokidar + debounce.
- Server sends `reload` events over `/ws`.
- SPA handles reload (iframe cache-bust).
- Verify: edit a file in `canvas/main/`, webview reloads automatically.

### Phase 4 — A2UI Rendering
- `A2UIManager` service (server-side surface state store).
- `a2ui.push` and `a2ui.reset` gateway commands.
- Vuex `a2ui` module with all mutations.
- `A2UIRenderer.vue`, `A2UINode.vue`, and individual component Vue files.
- `dataModelUpdate` support with simple interpolation.
- Verify: send A2UI JSONL via gateway, see rendered components in webview.

### Phase 5 — Protocol Handling & Polish
- `protocol.ts` URL rewriter.
- Iframe `MutationObserver` injection for `openclaw-canvas://` URL interception.
- `<base>` tag injection in served HTML.
- Panel state persistence (geometry save/restore).
- `canvas.snapshot` implementation via webview-nodejs screenshot API.
- Session geometry swapping on session switch.
- Verify: canvas HTML with `openclaw-canvas://` URLs renders correctly, snapshots work, geometry persists across restarts.

### Phase 6 — Hardening
- Input validation on all gateway commands (schema validation with a lightweight lib or manual checks).
- Rate limiting on gateway WebSocket.
- Ensure `FileResolver` handles symlinks (resolve then check).
- Error handling: malformed A2UI JSONL, missing sessions, dead WebSocket connections.
- Graceful shutdown: close watcher, close WebSocket connections, save state.
- Logging with configurable verbosity.

---

## 5. Key Dependencies

| Package | Purpose |
|---|---|
| `express` | HTTP server |
| `ws` | WebSocket (gateway + SPA channel) |
| `webview-nodejs` | Native webview window |
| `vue` (3.x) | UI framework |
| `vue-router` (4.x) | SPA routing |
| `vuex` (4.x) | State management |
| `vite` | SPA build tool |
| `@vitejs/plugin-vue` | Vite Vue plugin |
| `chokidar` | File watching |
| `mime-types` | MIME type resolution for file serving |
| `typescript` | Language |

---

## 6. Open Risks & Decisions

1. **webview-nodejs maturity** — The library is relatively young. If `bind()` or window manipulation APIs are insufficient, we may need to fork or contribute patches. Mitigation: Phase 1 validates core webview capabilities before building on top.

2. **iframe isolation vs. inline rendering** — Using iframes for canvas HTML content provides security isolation but complicates `canvas.eval` and protocol interception. Alternative: render canvas HTML inline in a shadow DOM. Recommendation: start with iframes (safer), switch to shadow DOM only if iframe limitations become blocking.

3. **Snapshot API** — `webview-nodejs` may not expose a screenshot method on all platforms. Fallback: use `html2canvas` inside the webview (lower fidelity but cross-platform). Investigate in Phase 5.

4. **A2UI component coverage** — The plan covers core components (Column, Row, Text, Button, Image, Stack, Spacer). If the real A2UI v0.8 spec includes more component types, we'll add them incrementally. The `A2UINode` dispatcher pattern makes this straightforward — add a new `.vue` file and register it.

5. **Port selection** — The Express server needs a port. Use `0` (OS-assigned) to avoid conflicts, pass the actual port to the webview. Store it in a lockfile (`<canvasRoot>/.port`) so external agents can discover it.

---

That's the full plan. Ready to start implementation on your signal.
