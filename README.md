# OpenClaw Canvas

A cross-platform canvas server for OpenClaw. Serves HTML content, renders A2UI v0.9 surfaces, and provides a WebSocket gateway for agent-driven UI control.

## Quick Start

```bash
npm run setup
npm run build
npm start
```

Open `http://localhost:3456` in a browser.

## Architecture

```
packages/
├── a2ui-sdk/                     # @haliphax-openclaw/a2ui-sdk
│   └── src/
│       ├── index.ts              # Barrel exports
│       ├── types.ts              # Shared types (A2UISurfaceState, DataSource, PackageDefinition, etc.)
│       ├── filters.ts            # applyFilters, computeAggregate, formatCompact
│       ├── ws.ts                 # sendEvent / registerWsSend
│       ├── composables/          # useDataSource, useFilterBind, useOptionsFrom, useSortable
│       └── utils/                # format-string, deep-link
├── a2ui-catalog-basic/           # @haliphax-openclaw/a2ui-catalog-basic
│   ├── catalog.json              # JSON Schema catalog definition
│   └── src/
│       ├── index.ts              # PackageDefinition
│       └── *.vue                 # Component implementations
├── a2ui-catalog-extended/        # @haliphax-openclaw/a2ui-catalog-extended
│   ├── catalog.json
│   └── src/
│       ├── index.ts              # PackageDefinition
│       └── *.vue
├── a2ui-catalog-all/             # @haliphax-openclaw/a2ui-catalog-all
│   ├── catalog.json
│   └── src/
│       └── index.ts              # Meta-catalog — re-exports basic + extended
src/
├── build/
│   └── vite-plugin-catalogs.ts   # Vite plugin — discovers catalogs, generates virtual:openclaw-catalogs
├── server/
│   ├── index.ts                  # Express server, startup, shutdown
│   ├── services/
│   │   ├── gateway.ts            # WebSocket server (/gateway for agents, /ws for SPA)
│   │   ├── session-manager.ts
│   │   ├── file-resolver.ts      # Path resolution with traversal guard
│   │   ├── file-watcher.ts       # chokidar live reload
│   │   ├── jsonl-watcher.ts      # JSONL file watcher for A2UI auto-push
│   │   ├── node-client.ts        # OpenClaw gateway node registration (Ed25519 auth, invoke handling)
│   │   ├── a2ui-manager.ts       # A2UI surface state (in-memory cache, backed by a2ui-store)
│   │   ├── a2ui-store.ts         # SQLite persistence for A2UI surfaces (better-sqlite3)
│   │   ├── a2ui-pipeline.ts      # A2UI command processing pipeline
│   │   ├── a2ui-commands.ts      # v0.8 → v0.9 normalization layer
│   │   └── catalog-registry.ts   # Discovers catalog packages in node_modules/
│   ├── shared/
│   │   ├── deep-link-script.ts   # Injected script for openclaw:// deep links
│   │   └── snapshot-script.ts    # Injected script for canvas snapshots
│   ├── commands/
│   │   ├── canvas.ts             # show, hide, navigate, navigateExternal, eval, snapshot
│   │   └── a2ui.ts               # push (JSONL), reset
│   └── routes/
│       ├── canvas.ts             # GET /:session/:path
│       ├── catalogs.ts           # GET /api/catalogs
│       ├── canvas-config.ts      # GET /api/canvas-config
│       ├── agent-proxy.ts        # POST /api/agent → gateway /tools/invoke
│       ├── file-spawn.ts         # POST /api/file-spawn → read prompt → sessions_spawn
│       └── scaffold.ts           # GET /scaffold
├── client/
│   ├── main.ts                   # Vue app entry, wires registerWsSend
│   ├── router.ts                 # Vue Router
│   ├── virtual-openclaw-catalogs.d.ts  # Type declaration for virtual module
│   ├── views/
│   │   ├── CanvasView.vue        # Main canvas — iframe, A2UI, external URLs
│   │   └── ScaffoldView.vue      # Placeholder when no index.html
│   ├── components/
│   │   ├── A2UINode.vue          # Component resolver (catalog-based two-tier lookup)
│   │   ├── A2UIRenderer.vue      # Surface renderer (DaisyUI theming via data-theme)
│   │   └── DeepLinkConfirm.vue   # Deep link confirmation dialog
│   ├── store/
│   │   ├── index.ts              # Vuex root
│   │   └── a2ui.ts               # A2UI surface state (surfaces, components, dataModel, theme, catalogId)
│   ├── services/
│   │   ├── ws-client.ts          # Browser WebSocket client
│   │   ├── url-rewriter.ts       # openclaw-canvas:// URL rewriter
│   │   └── deep-link.ts          # Deep link handling
│   ├── utils/
│   │   ├── format-string.ts      # String formatting utilities
│   │   └── url-schemes.ts        # URL scheme parser (openclaw://, openclaw-fileprompt://, openclaw-canvas://)
│   └── styles/
│       ├── custom.css            # Custom styleeet
│       └── tailwind.css          # Tailwind + DaisyUI (all themes)
test/                             # vitest tests
```

## Monorepo Structure

This project uses npm workspaces. All packages live in `packages/`:

| Package                                    | Description                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `@haliphax-openclaw/a2ui-sdk`              | Component SDK — types, composables, filters, event helpers                                      |
| `@haliphax-openclaw/a2ui-catalog-basic`    | Basic catalog — Column, Row, Text, Button, Image, Tabs, Divider, Slider, Checkbox, ChoicePicker |
| `@haliphax-openclaw/a2ui-catalog-extended` | Extended catalog — Badge, Table, Stack, Spacer, ProgressBar, Repeat, Accordion                  |
| `@haliphax-openclaw/a2ui-catalog-all`      | All catalog — re-exports basic + extended                                                       |

Install all dependencies (including workspace packages) from the repo root:

```bash
npm ci
```

npm automatically symlinks workspace packages into `node_modules/`, so cross-package imports resolve locally during development.

### Adding a new catalog package

1. Create a directory under `packages/` (e.g., `packages/a2ui-my-catalog/`)
2. Add a `package.json` with the `openclaw-canvas-web` field pointing to your `catalog.json` and entry module
3. Run `npm install` at the root to link the new workspace
4. Restart the dev server — the Vite catalog plugin discovers it automatically

See [docs/creating-catalog-packages.md](docs/creating-catalog-packages.md) for the full guide on authoring catalog packages.

## Gateway Node

The canvas server registers as an OpenClaw gateway node, exposing a tool interface that agents can access via `openclaw node invoke`. On startup, it connects to the gateway WebSocket, authenticates with Ed25519 signatures, and advertises the following commands:

| Command                 | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `canvas.present`        | Show/present canvas content                       |
| `canvas.hide`           | Hide the canvas panel                             |
| `canvas.navigate`       | Navigate to a canvas session/path or external URL |
| `canvas.eval`           | Execute JavaScript in the canvas context          |
| `canvas.snapshot`       | Capture the current canvas as a base64 PNG        |
| `canvas.a2ui.push`      | Push A2UI surface commands (structured)           |
| `canvas.a2ui.pushJSONL` | Push A2UI JSONL payload (string)                  |
| `canvas.a2ui.reset`     | Clear A2UI surface state                          |

Node identity (Ed25519 keypair and device ID) is generated on first run and stored at `~/.openclaw-canvas/node-identity.json`. The gateway URL and auth token are read from environment variables or `openclaw.json`.

## MCP Server

The project includes an MCP server that agents can invoke using `mcporter` which exposes all of the same commands as the gateway node interface without the node-routing context overhead.

## Agent Skill

A complementary [Canvas agent skill](https://github.com/haliphax-openclaw/skills/blob/main/canvas/SKILL.md) is available with usage instructions, JSONL command reference, component docs, and examples for agents interacting with this server. The skill expects that the MCP server is configured.

## Canvas Session URLs

Each canvas session is accessed via its session ID in the URL path:

```
http://<host>:<port>/<sessionId>/
```

For example:

- `http://localhost:3456/main/` — the default `main` session
- `http://localhost:3456/developer/` — the `developer` session

When running behind a reverse proxy with a base path (e.g., `OPENCLAW_CANVAS_BASE_PATH=/canvas`):

- `https://example.com/canvas/developer/`

The root path (`/`) redirects to `/main/` by default.

## Scripts

| Command         | Description                                       |
| --------------- | ------------------------------------------------- |
| `npm run build` | Build the Vue SPA to `dist/client/`               |
| `npm run clean` | Delete build artifacts and dependencies           |
| `npm run dev`   | Run server + Vite dev server concurrently         |
| `npm run setup` | Cleanly install all dependencies for all projects |
| `npm start`     | Start the production server                       |
| `npm test`      | Run tests (vitest)                                |

## Environment Variables

| Variable                       | Default                            | Description                                                                                                                     |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `OPENCLAW_CANVAS_HOST`         | `0.0.0.0`                          | Bind address                                                                                                                    |
| `OPENCLAW_CANVAS_PORT`         | `3456`                             | Listen port                                                                                                                     |
| `OPENCLAW_CANVAS_BASE_PATH`    | `/`                                | Public base path when behind a reverse proxy (e.g. `/canvas`)                                                                   |
| `OPENCLAW_CANVAS_SKIP_CONFIRM` | `false`                            | Skip deep link confirmation dialog when `true`                                                                                  |
| `OPENCLAW_CANVAS_A2UI_DB`      | `~/.openclaw-canvas/a2ui-cache.db` | Path to SQLite database for A2UI surface persistence                                                                            |
| `OPENCLAW_GATEWAY_WS_URL`      | `ws://127.0.0.1:18789`             | Gateway WebSocket URL for deep link and file-spawn proxying                                                                     |
| `OPENCLAW_GATEWAY_TOKEN`       | _(from openclaw.json)_             | Gateway auth token for agent deep links and file-spawn (`/tools/invoke`). Falls back to `gateway.auth.token` in `openclaw.json` |

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
{
  "id": "3",
  "command": "canvas.navigate",
  "session": "demo",
  "path": "page.html"
}
```

**canvas.navigateExternal** — Load an external URL (http/https only).

```json
{
  "id": "4",
  "command": "canvas.navigateExternal",
  "url": "https://example.com"
}
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
{
  "id": "7",
  "command": "a2ui.push",
  "payload": "{\"updateComponents\":{...}}\n{\"createSurface\":{...}}"
}
```

**a2ui.reset** — Clear all A2UI surfaces.

```json
{ "id": "8", "command": "a2ui.reset" }
```

## Custom URL Protocols

### `openclaw://` — Agent Deep Links

Trigger agent runs from links inside canvas HTML. When a user clicks an `openclaw://` link in the canvas iframe, a confirmation dialog appears, and on approval the request is proxied to the gateway to start an agent run.

```html
<a href="openclaw://agent?message=run+my+task">Run Task</a>
```

See [docs/deep-linking.md](docs/deep-linking.md) for the full URL format, parameters, confirmation dialog, script injection details, and security considerations.

### `openclaw-fileprompt://` — File-Based Subagent Spawn

Spawn a subagent with its prompt loaded from a file in the workspace associated with the canvas session. The server reads the file and passes its contents as the task to `sessions_spawn` via the gateway.

```html
<a href="openclaw-fileprompt://prompts/deploy.md?agentId=developer">Deploy</a>
```

### `openclaw-canvas://` — Canvas File References

Reference files in other canvas sessions without hardcoding the server origin or base path. The SPA rewrites these URLs at runtime to the correct `/_c/<session>/<path>` route.

**Format:** `openclaw-canvas://<session>/<path>`

**Example:**

```html
<img src="openclaw-canvas://my-project/logo.png" />
<a href="openclaw-canvas://dashboard/index.html">Open Dashboard</a>
```

These are rewritten to `http(s)://<host>:<port>/<base>/_c/<session>/<path>` based on the current origin and `OPENCLAW_CANVAS_BASE_PATH`.

## API Endpoints

| Endpoint             | Method | Description                                                                                                                            |
| -------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/agent`         | POST   | Proxies deep link requests to the gateway's `/tools/invoke` endpoint (`sessions_spawn`)                                                |
| `/api/file-spawn`    | POST   | Reads a prompt file from the workspace associated with the canvas session and spawns a subagent via `/tools/invoke` (`sessions_spawn`) |
| `/api/canvas-config` | GET    | Returns canvas configuration for the SPA                                                                                               |

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

## A2UI Persistence

A2UI surface state is persisted to a local SQLite database so it survives server restarts. On startup, all cached surfaces are loaded from the database and replayed to connecting SPA clients.

- The database is managed by `A2UIStore` (`better-sqlite3`, synchronous)
- The in-memory `Map` in `A2UIManager` remains the primary data source; SQLite is the backing store
- Every mutation (`upsertSurface`, `setRoot`, `updateDataModel`, `deleteSurface`, `clearAll`) writes through to SQLite
- DB location defaults to `~/.openclaw-canvas/a2ui-cache.db`, configurable via `OPENCLAW_CANVAS_A2UI_DB`

## Backward Compatibility

The server includes a normalization layer (`src/server/services/a2ui-commands.ts`) that auto-converts v0.8 commands and component shapes to v0.9 format with deprecation warnings logged. v0.8 payloads still work but are deprecated:

| v0.8 (deprecated)                                                           | v0.9                                                             |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `surfaceUpdate`                                                             | `updateComponents`                                               |
| `beginRendering`                                                            | `createSurface`                                                  |
| `dataModelUpdate`                                                           | `updateDataModel`                                                |
| `usageHint` (Text prop)                                                     | `variant`                                                        |
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

## Limitations vs macOS App

The canvas web server provides feature parity with the macOS OpenClaw app's canvas panel, with a few browser-inherent limitations:

- **`file://` URLs** — The macOS app supports `file://` URLs in canvas.navigate. Browsers block these for security reasons. Use `openclaw-canvas://` or `http(s)` URLs instead.
- **Snapshot fidelity** — The macOS app captures snapshots natively via WKWebView. The web server injects `dom-to-image-more` into canvas HTML and captures from within the iframe via `postMessage`. This works for locally-served canvas files and `data:` URLs. External cross-origin URLs (http/https from other domains) cannot be captured since the snapshot script can't be injected into third-party content.
- **Panel geometry** — The macOS app's canvas is a floating, resizable panel sharing screen space with the menu bar, webchat, and voice overlay. It supports `canvas.geometry` commands and persists size/position per session. The web server omits this — the canvas owns the full browser tab, so viewport sizing is handled by the browser itself.

## Extra Features

Features available in the web server that are not present in the macOS app:

- **`data:` URL support** — `canvas.present` and `canvas.navigate` accept `data:text/html` URLs with automatic deep link and snapshot script injection.
- **`openclaw-fileprompt://` deep links** — Spawn subagents with prompts loaded directly from workspace files. The server reads the file and passes its contents as the task, removing the indirection of telling an agent to load a file. See [Custom URL Protocols](#openclaw-fileprompt----file-based-subagent-spawn).
- **Enhanced confirmation dialog** — Collapsible "Options" section with controls for agent, model, thinking mode, and session key.
- **Skip confirmation globally** — `OPENCLAW_CANVAS_SKIP_CONFIRM=true` env var bypasses the deep link confirmation dialog for all requests.
- **Canvas config API** — `GET /api/canvas-config` exposes available agents and configuration to the SPA.

## License

Public Domain. See [LICENSE](LICENSE).
