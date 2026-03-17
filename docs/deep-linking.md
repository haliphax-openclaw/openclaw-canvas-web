# Deep Linking — `openclaw://` URLs

The canvas web server supports `openclaw://` deep links that allow rendered canvas content to trigger agent runs. This creates a feedback loop where agents can build interactive UIs with actionable links.

## How It Works

1. An agent pushes HTML content to the canvas (via file-served HTML or `data:` URLs)
2. The server injects a script into served HTML that intercepts clicks on `openclaw://` links
3. The SPA surfaces a confirmation dialog showing the message and options
4. On confirmation, the request is proxied to the gateway's hooks endpoint
5. The gateway triggers an agent run with the specified message

## URL Format

```
openclaw://agent?message=<text>&sessionKey=<key>&agentId=<id>&model=<model>&thinking=<mode>
```

The `agent` action is currently the only supported action. The authority position can be either `agent` directly or a container hostname:

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
| `sessionKey` | No | Target session key (auto-resolved if omitted). Requires `hooks.allowRequestSessionKey=true` in gateway config. |
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

## API Proxy

Deep link execution is proxied through the canvas server's `/api/agent` endpoint, which forwards the request to the OpenClaw gateway's hooks endpoint. The proxy handles authentication and routing transparently.

```
Client → POST /api/agent { message, agentId, ... }
       → Gateway hooks endpoint
       → Agent run triggered
```

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

A2UI Button components support deep links via the `href` prop. Unlike iframe-based deep links, A2UI buttons POST directly to the `/api/agent` endpoint without showing a confirmation dialog. This is appropriate for trusted A2UI content where the agent controls the button labels and URLs.

```json
{"Button": {"label": "Refresh", "href": "openclaw://agent?message=Refresh+data&agentId=developer"}}
```

## Gateway Configuration

Deep linking requires the OpenClaw gateway's hooks system to be enabled and configured. The following settings in `openclaw.json` control deep link behavior:

| Setting | Type | Description |
|---------|------|-------------|
| `hooks.enabled` | `boolean` | Must be `true` for the hooks endpoint to accept requests |
| `hooks.token` | `string` | Bearer token used by the canvas server to authenticate with the gateway's hooks endpoint. Must match the `HOOKS_TOKEN` environment variable passed to the canvas server |
| `hooks.allowedAgentIds` | `string[]` | Restricts which agent IDs can be targeted by deep links. Omit to allow all agents |
| `hooks.allowRequestSessionKey` | `boolean` | Must be `true` if deep links include a `sessionKey` parameter for session-targeted routing. Default: `false` |
| `hooks.allowedSessionKeyPrefixes` | `string[]` | Optional allowlist of session key prefixes accepted when `allowRequestSessionKey` is enabled. Use narrow prefixes to prevent arbitrary session injection |

Example configuration:

```json
{
  "hooks": {
    "enabled": true,
    "token": "your-hooks-token",
    "allowedAgentIds": ["developer", "main"],
    "allowRequestSessionKey": true,
    "allowedSessionKeyPrefixes": ["agent:developer:"]
  }
}
```

Without `hooks.enabled` and `hooks.token`, the canvas server's `/api/agent` proxy will receive a connection error or authentication failure from the gateway.

## Security Considerations

- All deep links require user confirmation by default (confirmation dialog)
- The `allowedAgentIds` list restricts which agents can be targeted
- Deep links are proxied through the canvas server, not sent directly to the gateway
- The `key` parameter can be used for additional authentication when required
