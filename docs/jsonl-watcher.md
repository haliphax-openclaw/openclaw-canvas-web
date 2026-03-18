# JSONL File Watcher (Auto-Push)

The canvas web server includes a file watcher that monitors each agent's `canvas/jsonl/` directory. When `.jsonl` files are created or modified, the server automatically reads and pushes each line as an A2UI command — no manual mcporter call needed.

## How it works

1. On startup, the server creates an `fs.watch` on `~/.openclaw/workspaces/<agent-id>/canvas/jsonl/` for each configured agent
2. When a `.jsonl` file is created or modified, the watcher debounces (300ms) then reads the file
3. Each line is parsed as JSON and processed as an A2UI command (`surfaceUpdate`, `beginRendering`, `dataModelUpdate`, `dataSourcePush`, `deleteSurface`)
4. Commands are applied to the A2UI manager (persisted in SQLite) and broadcast to connected SPA clients

## Usage

Write JSONL files to your agent's `canvas/jsonl/` directory:

```bash
# Layout file
cat > ~/.openclaw/workspaces/developer/canvas/jsonl/dashboard-layout.jsonl << 'EOF'
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"root","component":{"type":"Column","children":["title","table"]}}]}}
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"title","component":{"type":"Text","props":{"content":"Dashboard"}}}]}}
{"beginRendering":{"surfaceId":"main","root":"root"}}
EOF

# Data file (can target the same surfaceId)
cat > ~/.openclaw/workspaces/developer/canvas/jsonl/dashboard-data.jsonl << 'EOF'
{"dataSourcePush":{"surfaceId":"main","sources":{"users":{"fields":["name","role"],"rows":[{"name":"Alice","role":"admin"}]}}}}
EOF
```

## Multiple files per surface

Multiple `.jsonl` files can target the same `surfaceId`. They merge in the SQLite cache — layout in one file, data in another. This lets you update data independently of component structure.

## Session mapping

The session is derived from the workspace path:
- `~/.openclaw/workspaces/developer/canvas/jsonl/` → session `developer`
- `~/.openclaw/workspaces/assistant/canvas/jsonl/` → session `assistant`

## Error handling

- Invalid JSON lines are skipped with a warning log
- If a file is deleted before the debounce fires, the read is silently skipped
- The watcher is cleaned up on server shutdown

## Configuration

- Debounce interval: 300ms (hardcoded)
- The `jsonl/` directory is excluded from the iframe file watcher (no duplicate reload events)
