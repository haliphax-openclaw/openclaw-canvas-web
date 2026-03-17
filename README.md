# OpenClaw Canvas

A cross-platform canvas server for OpenClaw. Serves HTML content, renders A2UI v0.8 surfaces, and provides a WebSocket gateway for agent-driven UI control.

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
| `OPENCLAW_CANVAS_ROOT` | `~/.openclaw-canvas` | Root directory for session files |
| `OPENCLAW_CANVAS_BASE_PATH` | `/` | Public base path when behind a reverse proxy (e.g. `/canvas`) |
| `OPENCLAW_CANVAS_SKIP_CONFIRM` | `false` | Skip deep link confirmation dialog when `true` |

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
│   │   └── a2ui-manager.ts   # A2UI surface state
│   ├── shared/
│   │   ├── deep-link-script.ts  # Injected script for openclaw:// deep links
│   │   └── snapshot-script.ts   # Injected script for canvas snapshots (inlines dom-to-image-more)
│   ├── commands/
│   │   ├── canvas.ts         # show, hide, navigate, navigateExternal, eval, snapshot
│   │   └── a2ui.ts           # push (JSONL), reset
│   └── routes/
│       ├── canvas.ts         # GET /canvas/:session/:path
│       └── scaffold.ts       # GET /scaffold
├── client/
│   ├── main.ts               # Vue app entry
│   ├── views/
│   │   ├── CanvasView.vue    # Main canvas — iframe, A2UI, external URLs
│   │   └── ScaffoldView.vue  # Placeholder when no index.html
│   ├── components/           # A2UI renderers (Column, Row, Text, Button, Image, Stack, Spacer)
│   ├── store/                # Vuex (session, panel visibility, a2ui surfaces)
│   └── services/
│       ├── ws-client.ts      # Browser WebSocket client
│       └── url-rewriter.ts   # openclaw-canvas:// URL rewriter
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
{ "id": "7", "command": "a2ui.push", "payload": "{\"surfaceUpdate\":{...}}\n{\"beginRendering\":{...}}" }
```

**a2ui.reset** — Clear all A2UI surfaces.
```json
{ "id": "8", "command": "a2ui.reset" }
```

## Custom URL Protocols

### `openclaw://` — Agent Deep Links

Trigger agent runs from links inside canvas HTML. When a user clicks an `openclaw://` link in the canvas iframe, the server-injected script intercepts it, posts a message to the parent SPA, and the SPA proxies the request to the gateway via `POST /api/agent`.

Two URL forms are supported:

| Form | Example |
|------|---------|
| Direct | `openclaw://agent?message=hello` |
| Container hostname | `openclaw://<hostname>/agent?message=hello` |

The container hostname form allows URLs where the OpenClaw container name appears in the authority position (e.g. `openclaw://openclaw/agent?message=...`). Both forms are equivalent — the hostname is ignored and the request always routes to the local `/api/agent` proxy.

**Supported query parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `message` | Yes | Message to send to the agent |
| `sessionKey` | No | Target session key |
| `thinking` | No | Thinking mode |
| `deliver` | No | Delivery target |
| `to` | No | Recipient |
| `channel` | No | Channel override |
| `timeoutSeconds` | No | Request timeout |
| `key` | No | Unattended mode — skips confirmation dialog |

**Example in canvas HTML:**
```html
<a href="openclaw://agent?message=run+my+task&sessionKey=main">Run Task</a>
```

### `openclaw-canvas://` — Canvas File References

Reference files in other canvas sessions without hardcoding the server origin or base path. The SPA rewrites these URLs at runtime to the correct `/_c/<session>/<path>` route.

**Format:** `openclaw-canvas://<session>/<path>`

**Example:**
```html
<img src="openclaw-canvas://my-project/logo.png">
<a href="openclaw-canvas://dashboard/index.html">Open Dashboard</a>
```

These are rewritten to `http(s)://<host>:<port>/<base>/_c/<session>/<path>` based on the current origin and `BASE_URL`.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent` | POST | Proxies deep link requests to the gateway's `/hooks/agent` endpoint |
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
- `allowedAgentIds` — agents allowed for hook delivery, from `hooks.allowedAgentIds`

### Deep Link Confirmation Dialog

When a user clicks an `openclaw://` link in canvas content, a confirmation dialog appears (unless `OPENCLAW_CANVAS_SKIP_CONFIRM=true` or the URL includes a `key` parameter).

The dialog includes a collapsible "Options" section with controls for:
- **Agent** — dropdown populated from the canvas config API
- **Model** — free-text input
- **Thinking** — on / off / stream
- **Session Key** — free-text input

## Session Files

Place HTML/CSS/JS files in `$OPENCLAW_CANVAS_ROOT/<session>/`. The server serves them at `/canvas/<session>/<path>`. File changes trigger live reload in the browser.

## Limitations vs macOS App

The canvas web server provides feature parity with the macOS OpenClaw app's canvas panel, with a few browser-inherent limitations:

- **`file://` URLs** — The macOS app supports `file://` URLs in canvas.navigate. Browsers block these for security reasons. Use `openclaw-canvas://` or `http(s)` URLs instead.
- **Snapshot fidelity** — The macOS app captures snapshots natively via WKWebView. The web server injects `dom-to-image-more` into canvas HTML and captures from within the iframe via `postMessage`. This works for locally-served canvas files and `data:` URLs. External cross-origin URLs (http/https from other domains) cannot be captured since the snapshot script can't be injected into third-party content.

## Extra Features

Features available in the web server that are not present in the macOS app:

- **`data:` URL support** — `canvas.present` and `canvas.navigate` accept `data:text/html` URLs with automatic deep link and snapshot script injection.
- **Enhanced confirmation dialog** — Collapsible "Options" section with controls for agent, model, thinking mode, and session key.
- **Skip confirmation globally** — `OPENCLAW_CANVAS_SKIP_CONFIRM=true` env var bypasses the deep link confirmation dialog for all requests.
- **Container hostname URLs** — `openclaw://<hostname>/agent?message=...` is accepted alongside the standard `openclaw://agent?message=...` form, supporting Docker network hostnames in the URL authority.
- **Canvas config API** — `GET /api/canvas-config` exposes available agents and configuration to the SPA.

## License

Public Domain. See [LICENSE](LICENSE).
