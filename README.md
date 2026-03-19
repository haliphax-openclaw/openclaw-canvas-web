# OpenClaw Canvas

A cross-platform canvas server for OpenClaw. Serves HTML content, renders A2UI v0.9 surfaces, and provides a WebSocket gateway for agent-driven UI control.

## MCP Server

The canvas server registers as an OpenClaw gateway node, exposing an MCP-compatible tool interface that agents can invoke via `mcporter`. On startup, it connects to the gateway WebSocket, authenticates with Ed25519 signatures, and advertises the following commands:

| Command | Description |
|---------|-------------|
| `canvas.present` | Show/present canvas content |
| `canvas.hide` | Hide the canvas panel |
| `canvas.navigate` | Navigate to a canvas session/path or external URL |
| `canvas.eval` | Execute JavaScript in the canvas context |
| `canvas.snapshot` | Capture the current canvas as a base64 PNG |
| `canvas.a2ui.push` | Push A2UI surface commands (structured) |
| `canvas.a2ui.pushJSONL` | Push A2UI JSONL payload (string) |
| `canvas.a2ui.reset` | Clear A2UI surface state |

Node identity (Ed25519 keypair and device ID) is generated on first run and stored at `~/.openclaw-canvas/node-identity.json`. The gateway URL and auth token are read from environment variables or `openclaw.json`.

## Agent Skill

A complementary [Canvas agent skill](https://github.com/haliphax-openclaw/skills/blob/main/canvas/SKILL.md) is available with usage instructions, JSONL command reference, component docs, and examples for agents interacting with this server.

## Quick Start

```bash
npm install --include=dev
npm run build
OPENCLAW_CANVAS_PORT=9999 npm start
```

Open `http://localhost:9999` in a browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run server + Vite dev server concurrently |
| `npm run build` | Build the Vue SPA to `dist/client/` |
| `npm start` | Start the production server |
| `npm test` | Run tests (vitest) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCLAW_CANVAS_HOST` | `0.0.0.0` | Bind address |
| `OPENCLAW_CANVAS_PORT` | `3456` | Listen port |
| `OPENCLAW_CANVAS_BASE_PATH` | `/` | Public base path when behind a reverse proxy (e.g. `/canvas`) |
| `OPENCLAW_CANVAS_SKIP_CONFIRM` | `false` | Skip deep link confirmation dialog when `true` |
| `OPENCLAW_CANVAS_A2UI_DB` | `~/.openclaw-canvas/a2ui-cache.db` | Path to SQLite database for A2UI surface persistence |
| `OPENCLAW_GATEWAY_WS_URL` | `ws://127.0.0.1:18789` | Gateway WebSocket URL for deep link and file-spawn proxying |
| `OPENCLAW_GATEWAY_TOKEN` | *(from openclaw.json)* | Gateway auth token for agent deep links and file-spawn (`/tools/invoke`). Falls back to `gateway.auth.token` in `openclaw.json` |

## Architecture

```
src/
├── server/
│   ├── index.ts              # Express server, startup, shutdown
│   ├── services/
│   │   ├── gateway.ts        # WebSocket server (/gateway for agents, /ws for SPA)
│   │   ├── session-manager.ts
│   │   ├── file-resolver.ts  # Path resolution with traversal guard
│   │   ├── file-watcher.ts   # chokidar live reload
│   │   ├── node-client.ts    # OpenClaw gateway node registration (Ed25519 auth, invoke handling)
│   │   ├── a2ui-manager.ts   # A2UI surface state (in-memory cache, backed by a2ui-store)
│   │   └── a2ui-store.ts     # SQLite persistence for A2UI surfaces (better-sqlite3)
│   ├── shared/
│   │   ├── deep-link-script.ts  # Injected script for openclaw:// deep links
│   │   └── snapshot-script.ts   # Injected script for canvas snapshots (inlines dom-to-image-more)
│   ├── commands/
│   │   ├── canvas.ts         # show, hide, navigate, navigateExternal, eval, snapshot
│   │   └── a2ui.ts           # push (JSONL), reset
│   └── routes/
│       ├── canvas.ts         # GET /:session/:path
│       ├── agent-proxy.ts    # POST /api/agent → gateway /tools/invoke (sessions_spawn)
│       ├── file-spawn.ts    # POST /api/file-spawn → read prompt file → gateway /tools/invoke (sessions_spawn)
│       └── scaffold.ts       # GET /scaffold
├── client/
│   ├── main.ts               # Vue app entry
│   ├── views/
│   │   ├── CanvasView.vue    # Main canvas — iframe, A2UI, external URLs
│   │   └── ScaffoldView.vue  # Placeholder when no index.html
│   ├── components/           # A2UI renderers (Column, Row, Text, Button, Image, Stack, Spacer, Badge, Checkbox, Divider, ProgressBar, Select, Slider, Table, Accordion, Tabs)
│   ├── store/                # Vuex (session, panel visibility, a2ui surfaces)
│   └── services/
│       ├── ws-client.ts      # Browser WebSocket client
│       └── url-rewriter.ts   # openclaw-canvas:// URL rewriter
├── utils/
│   └── url-schemes.ts        # Shared URL scheme parser (openclaw://, openclaw-fileprompt://, openclaw-canvas://)
test/                          # vitest tests
```

## Gateway Protocol

Connect via WebSocket to `/gateway`. Send JSON messages with a `command` field. Responses include the original `id` if provided.

### Commands

**canvas.show** — Show the canvas panel.
```json
{ "id": "1", "command": "canvas.show", "session": "my-project" }
```

**canvas.hide** — Hide the canvas panel.
```json
{ "id": "2", "command": "canvas.hide" }
```

**canvas.navigate** — Navigate to a session/path.
```json
{ "id": "3", "command": "canvas.navigate", "session": "demo", "path": "page.html" }
```

**canvas.navigateExternal** — Load an external URL (http/https only).
```json
{ "id": "4", "command": "canvas.navigateExternal", "url": "https://example.com" }
```

**canvas.eval** — Evaluate JS in the canvas iframe.
```json
{ "id": "5", "command": "canvas.eval", "js": "document.title" }
```

**canvas.snapshot** — Capture the canvas as a base64 PNG. A snapshot helper script (using `dom-to-image-more`) is injected into canvas HTML at serve time — the same pattern as deep link injection. When a snapshot is requested, the parent SPA sends a `postMessage` to the iframe, the injected script captures `document.body` from within the frame, and sends the image back via `postMessage`. This works for same-origin files and `data:` URLs. External cross-origin URLs cannot be captured. Falls back to parent-level DOM capture for A2UI surfaces. 30s timeout.
```json
{ "id": "6", "command": "canvas.snapshot" }
→ { "id": "6", "ok": true, "image": "data:image/png;base64,..." }
```

**a2ui.push** — Push A2UI JSONL payload.
```json
{ "id": "7", "command": "a2ui.push", "payload": "{\"updateComponents\":{...}}\n{\"createSurface\":{...}}" }
```

**a2ui.reset** — Clear all A2UI surfaces.
```json
{ "id": "8", "command": "a2ui.reset" }
```

## A2UI Persistence

A2UI surface state is persisted to a local SQLite database so it survives server restarts. On startup, all cached surfaces are loaded from the database and replayed to connecting SPA clients.

- The database is managed by `A2UIStore` (`better-sqlite3`, synchronous)
- The in-memory `Map` in `A2UIManager` remains the primary data source; SQLite is the backing store
- Every mutation (`upsertSurface`, `setRoot`, `updateDataModel`, `deleteSurface`, `clearAll`) writes through to SQLite
- DB location defaults to `~/.openclaw-canvas/a2ui-cache.db`, configurable via `OPENCLAW_CANVAS_A2UI_DB`

## Custom URL Protocols

### `openclaw://` — Agent Deep Links

Trigger agent runs from links inside canvas HTML. When a user clicks an `openclaw://` link in the canvas iframe, a confirmation dialog appears, and on approval the request is proxied to the gateway to start an agent run.

```html
<a href="openclaw://_?message=run+my+task">Run Task</a>
```

See [docs/deep-linking.md](docs/deep-linking.md) for the full URL format, parameters, confirmation dialog, script injection details, and security considerations.

### `openclaw-fileprompt://` — File-Based Subagent Spawn

Spawn a subagent with its prompt loaded from a file in the workspace associated with the canvas session. The server reads the file and passes its contents as the task to `sessions_spawn` via the gateway.

```html
<a href="openclaw-fileprompt://_?file=prompts/deploy.md&agentId=developer">Deploy</a>
```

### `openclaw-canvas://` — Canvas File References

Reference files in other canvas sessions without hardcoding the server origin or base path. The SPA rewrites these URLs at runtime to the correct `/_c/<session>/<path>` route.

**Format:** `openclaw-canvas://<session>/<path>`

**Example:**
```html
<img src="openclaw-canvas://my-project/logo.png">
<a href="openclaw-canvas://dashboard/index.html">Open Dashboard</a>
```

These are rewritten to `http(s)://<host>:<port>/<base>/_c/<session>/<path>` based on the current origin and `OPENCLAW_CANVAS_BASE_PATH`.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent` | POST | Proxies deep link requests to the gateway's `/tools/invoke` endpoint (`sessions_spawn`) |
| `/api/file-spawn` | POST | Reads a prompt file from the workspace associated with the canvas session and spawns a subagent via `/tools/invoke` (`sessions_spawn`) |
| `/api/canvas-config` | GET | Returns canvas configuration for the SPA |

### GET /api/canvas-config

Returns configuration used by the SPA for deep link handling.

```json
{
  "skipConfirmation": false,
  "agents": ["main", "openclaw-expert", "developer"],
  "allowedAgentIds": ["main", "openclaw-expert"]
}
```

- `skipConfirmation` — controlled by `OPENCLAW_CANVAS_SKIP_CONFIRM` env var
- `agents` — agent IDs read from `openclaw.json`
- `allowedAgentIds` — agents allowed for deep link execution, from `hooks.allowedAgentIds`

### Deep Link Confirmation Dialog

When a user clicks an `openclaw://` link in canvas content, a confirmation dialog appears (unless `OPENCLAW_CANVAS_SKIP_CONFIRM=true` or the URL includes a `key` parameter).

The dialog includes a collapsible "Options" section with controls for:
- **Agent** — dropdown populated from the canvas config API
- **Model** — free-text input
- **Thinking** — on / off / stream
- **Session Key** — free-text input

## Session Files

Place HTML/CSS/JS files in the agent's `canvas/` workspace directory. The server serves them at `/<session>/<path>`. File changes trigger live reload in the browser.

## Limitations vs macOS App

The canvas web server provides feature parity with the macOS OpenClaw app's canvas panel, with a few browser-inherent limitations:

- **`file://` URLs** — The macOS app supports `file://` URLs in canvas.navigate. Browsers block these for security reasons. Use `openclaw-canvas://` or `http(s)` URLs instead.
- **Snapshot fidelity** — The macOS app captures snapshots natively via WKWebView. The web server injects `dom-to-image-more` into canvas HTML and captures from within the iframe via `postMessage`. This works for locally-served canvas files and `data:` URLs. External cross-origin URLs (http/https from other domains) cannot be captured since the snapshot script can't be injected into third-party content.
- **Panel geometry** — The macOS app's canvas is a floating, resizable panel sharing screen space with the menu bar, webchat, and voice overlay. It supports `canvas.geometry` commands and persists size/position per session. The web server omits this — the canvas owns the full browser tab, so viewport sizing is handled by the browser itself.

## Extra Features

Features available in the web server that are not present in the macOS app:

- **`data:` URL support** — `canvas.present` and `canvas.navigate` accept `data:text/html` URLs with automatic deep link and snapshot script injection.
- **Enhanced confirmation dialog** — Collapsible "Options" section with controls for agent, model, thinking mode, and session key.
- **Skip confirmation globally** — `OPENCLAW_CANVAS_SKIP_CONFIRM=true` env var bypasses the deep link confirmation dialog for all requests.
- **Canvas config API** — `GET /api/canvas-config` exposes available agents and configuration to the SPA.

## Backward Compatibility

The server includes a normalization layer (`src/server/services/a2ui-commands.ts`) that auto-converts v0.8 commands and component shapes to v0.9 format with deprecation warnings logged. v0.8 payloads still work but are deprecated:

| v0.8 (deprecated) | v0.9 |
|--------------------|------|
| `surfaceUpdate` | `updateComponents` |
| `beginRendering` | `createSurface` |
| `dataModelUpdate` | `updateDataModel` |
| `usageHint` (Text prop) | `variant` |
| Wrapped component shape: `{ id, component: { "Text": { "text": "..." } } }` | Flat component shape: `{ id, component: "Text", "text": "..." }` |

`dataSourcePush` and `deleteSurface` are unchanged.

## Reactive Data Binding (A2UI)

A2UI surfaces support a reactive data-binding layer that lets agents push structured data sources and bind UI components to live, filterable data.

Key capabilities:

- **Data Sources** — Push named datasets via `updateDataModel` (with `$sources`) or the `dataSourcePush` JSONL shorthand. Supports incremental merges with `primaryKey`.
- **Filtering** — Select and MultiSelect components can `bind` to data sources, applying filter operations (`eq`, `contains`, `gte`, `lte`, `range`, `in`) that reactively update all bound displays. Clearing a MultiSelect shows all data.
- **Sorting** — Table and Repeat components support optional sorting via the `sortable` prop. Tables sort by clicking column headers (⬆/⬇ indicators); Repeat components include a sort direction dropdown. Sorting operates on raw data values.
- **Display Binding** — Table, Badge, and Text components accept a `dataSource` prop for dynamic content with built-in aggregates (`count`, `sum`, `avg`, `min`, `max`) and compact number formatting.
- **Repeat** — The Repeat component iterates over filtered rows, rendering a template per row with `{{field}}` placeholders and transforms like `percentOfMax`.

See [docs/a2ui-reactive.md](docs/a2ui-reactive.md) for the full data binding guide and [docs/components.md](docs/components.md) for the complete component reference.

## License

Public Domain. See [LICENSE](LICENSE).
