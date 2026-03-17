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
│   │   └── a2ui-manager.ts   # A2UI surface state
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

**canvas.snapshot** — Capture the canvas as a base64 PNG using `dom-to-image-more` (SVG foreignObject). The SPA resolves CSS variables and renders the current view, then returns the image via WebSocket. 30s timeout.
```json
{ "id": "6", "command": "canvas.snapshot" }
→ { "id": "6", "ok": true, "image": "data:image/png;base64,..." }
```

> **Note:** Snapshot colors may differ slightly from the live browser view due to how `dom-to-image-more` handles CSS custom properties and external fonts. A `bgcolor` of `#000000` is applied to ensure the terminal theme background renders correctly.

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

## License

Public Domain. See [LICENSE](LICENSE).
