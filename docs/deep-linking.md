# Deep Linking — `openclaw://` URLs

The canvas web server supports `openclaw://` deep links that allow rendered canvas content to trigger agent runs. This creates a feedback loop where agents can build interactive UIs with actionable links.

## How It Works

1. An agent pushes HTML content to the canvas (via file-served HTML or `data:` URLs)
2. The server injects a script into served HTML that intercepts clicks on `openclaw://` links
3. The SPA surfaces a confirmation dialog showing the message and options
4. On confirmation, the request is proxied to the gateway's `/tools/invoke` endpoint
5. The gateway spawns an isolated subagent session via `sessions_spawn`

## URL Schemes

Three custom URL schemes are supported:

| Scheme | Purpose | Example |
|--------|---------|---------|
| `openclaw://` | Agent deep links | `openclaw://agent?message=Run+the+tests` |
| `openclaw-cron://` | Cron job triggers | `openclaw-cron://run?jobId=daily-backup` |
| `openclaw-canvas://` | Session file references | `openclaw-canvas://my-project/logo.png` |

A shared utility (`src/client/utils/url-schemes.ts`) provides `parseOpenClawUrl()` for parsing all three schemes.

### `openclaw://` — Agent Deep Links

```
openclaw://agent?message=<text>&sessionKey=<key>&agentId=<id>&model=<model>&thinking=<mode>
```

The authority position can be either `agent` directly or a container hostname:

```
openclaw://agent?message=Run+the+tests
openclaw://my-container/agent?message=Run+the+tests
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `message` | Yes | The message to send to the agent |
| `agentId` | No | Target agent ID (uses default if omitted) |
| `model` | No | Model override (e.g. `claude-sonnet-4-20250514`) |
| `sessionKey` | No | Parent session key for completion announcements. Defaults to `"devnull"` (suppresses announcements). Set to a real session key to receive completion events. |
| `thinking` | No | Thinking mode: `on`, `off`, or `stream` |
| `deliver` | No | Delivery mode for the response |
| `to` | No | Delivery target |
| `channel` | No | Delivery channel |
| `timeoutSeconds` | No | Timeout for the agent run |
| `key` | No | Authentication key |

## Confirmation Dialog

When a user clicks an `openclaw://` link, a confirmation dialog appears showing:

- The message that will be sent to the agent (truncated to 300 characters)
- An expandable "Options" section with:
  - Agent selector (populated from the canvas config's agent list)
  - Model override text input
  - Thinking mode selector (default/on/off/stream)
  - Session key override

The user must click "Send" to execute the deep link. Clicking "Cancel" or the overlay dismisses it.

### Skipping Confirmation

The confirmation dialog can be disabled via the canvas config endpoint (`/api/canvas-config`) by setting `skipConfirmation: true`. Use with caution — this allows any rendered canvas content to trigger agent runs without user approval.

## Script Injection

The server automatically injects a deep link handler script into HTML content served through the canvas file routes (`/_c/:session/*`). The injected script:

1. Listens for click events on `<a>` elements with `href` starting with `openclaw://`
2. Prevents the default navigation
3. Sends a `postMessage` to the parent SPA frame with the URL
4. The SPA's CanvasView receives the message and shows the confirmation dialog

This works for both file-served HTML and inline content. For `data:` URLs, the script is injected into the iframe's content document.

## Example: Interactive Dashboard

An agent can build a dashboard with actionable links:

```html
<h2>Failing CI Checks</h2>
<ul>
  <li>
    openclaw-tools-mcp-server — test workflow
    <a href="openclaw://agent?message=Fix+the+failing+test+in+openclaw-tools-mcp-server">Fix this</a>
  </li>
  <li>
    skills — validate workflow
    <a href="openclaw://agent?message=Fix+the+schema+validation+in+the+skills+repo">Fix this</a>
  </li>
</ul>
```

When the user clicks "Fix this", the confirmation dialog appears, and on approval, the agent receives the message and can act on it.

## Cron Trigger — `openclaw-cron://` URLs

The `openclaw-cron://` scheme triggers cron job runs via the canvas server's `/api/cron-trigger` endpoint, which proxies to the gateway's `/hooks/cron/run` endpoint.

### URL Format

```
openclaw-cron://<action>?jobId=<id>&runMode=<mode>
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `jobId` | Yes | The cron job ID to trigger |
| `runMode` | No | Run mode (default: `force`) |

### Example

```html
<a href="openclaw-cron://run?jobId=daily-backup">Run Backup Now</a>
```

## API Proxy

Deep link execution is proxied through the canvas server's `/api/agent` endpoint, which calls the gateway's `/tools/invoke` endpoint to spawn an isolated subagent session via `sessions_spawn`. This avoids the hooks security boundary, which injects warning text into the agent's prompt.

```
Client → POST /api/agent { message, agentId, ... }
       → Gateway /tools/invoke (sessions_spawn)
       → Isolated subagent run triggered

Client → POST /api/cron-trigger { jobId, runMode }
       → Gateway /hooks/cron/run
       → Cron job triggered
```

### Suppressing Completion Announcements

By default, `sessions_spawn` auto-announces completion back to the parent session, which costs tokens. To suppress this, the proxy sets `sessionKey` to `"devnull"` by default — a nonexistent session that silently drops the announcement.

To route the completion to a specific session instead (e.g., for monitoring), pass `sessionKey` in the deep link URL:

```
openclaw://agent?message=Refresh+data&agentId=developer&sessionKey=agent:developer:discord:channel:123
```

If `sessionKey` is omitted, it defaults to `"devnull"` (no announcement).

## Canvas Config Endpoint

The `/api/canvas-config` endpoint provides client-side configuration:

```json
{
  "skipConfirmation": false,
  "agents": ["developer", "openclaw-expert", "editor"],
  "allowedAgentIds": ["developer", "openclaw-expert"]
}
```

- `agents` — List of available agent IDs for the confirmation dialog's agent selector
- `allowedAgentIds` — Agent IDs permitted for deep link execution
- `skipConfirmation` — Whether to bypass the confirmation dialog

## A2UI Button Deep Links

A2UI Button components support deep links via the `href` prop. Unlike iframe-based deep links, A2UI buttons POST directly to the appropriate API endpoint without showing a confirmation dialog. This is appropriate for trusted A2UI content where the agent controls the button labels and URLs.

Agent trigger:
```json
{"Button": {"label": "Refresh", "href": "openclaw://agent?message=Refresh+data&agentId=developer"}}
```

Cron trigger:
```json
{"Button": {"label": "Run Backup", "href": "openclaw-cron://run?jobId=daily-backup&runMode=force"}}
```

## Gateway Configuration

Agent deep links use the gateway's `/tools/invoke` endpoint with `sessions_spawn`, while cron deep links use the hooks system. The following settings control deep link behavior:

### Agent Deep Links (`/tools/invoke`)

| Setting | Type | Description |
|---------|------|-------------|
| `gateway.auth.token` | `string` | Bearer token used by the canvas server to authenticate with the gateway. Must match the `OPENCLAW_GATEWAY_TOKEN` environment variable (or be readable from `openclaw.json`) |
| `gateway.tools.allow` | `string[]` | Must include `"sessions_spawn"` to permit agent deep links via `/tools/invoke` |

### Cron Deep Links (`/hooks/cron/run`)

| Setting | Type | Description |
|---------|------|-------------|
| `hooks.enabled` | `boolean` | Must be `true` for the hooks endpoint to accept cron trigger requests |
| `hooks.token` | `string` | Bearer token for cron trigger authentication. Must match the `OPENCLAW_HOOKS_TOKEN` environment variable (or be readable from `openclaw.json`) |

Example configuration:

```json
{
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "your-gateway-token"
    },
    "tools": {
      "allow": ["sessions_spawn", "sessions_send", "sessions_list"]
    }
  },
  "hooks": {
    "enabled": true,
    "token": "your-hooks-token"
  }
}
```

Without `gateway.auth.token` and `sessions_spawn` in `gateway.tools.allow`, the canvas server's `/api/agent` proxy will receive an authentication failure or 404 from the gateway.

### Disabling the built-in canvas tool

OpenClaw includes a built-in `canvas` tool designed for the desktop app. When using the canvas web server, this tool can cause confusion — agents may attempt to use it instead of `openclaw nodes invoke`, and its `jsonlPath` parameter rejects paths outside the OpenClaw state directory. To prevent this, add `canvas` to the global tool denylist:

```json
{
  "tools": {
    "deny": ["canvas"]
  }
}
```

## Security Considerations

- All deep links require user confirmation by default (confirmation dialog)
- The `allowedAgentIds` list restricts which agents can be targeted
- Deep links are proxied through the canvas server, not sent directly to the gateway
- The `key` parameter can be used for additional authentication when required
