# A2UI v0.9 Upgrade Spec — openclaw-canvas-web

**Status:** Draft
**Date:** 2026-03-18
**Scope:** Server JSONL processing, Vuex store, SPA WebSocket handlers, A2UINode component resolution, skill docs, existing JSONL files

---

## 1. Summary

Upgrade the A2UI command pipeline from v0.8 naming/structure to v0.9, with a backward-compatibility shim period so existing JSONL files and agent-generated payloads continue to work during migration.

### What changes

| v0.8 command | v0.9 command | Notes |
|---|---|---|
| `surfaceUpdate` | `updateComponents` | Rename only at the JSONL envelope level |
| `beginRendering` | `createSurface` | Adds optional `catalogId`, `theme`, `sendDataModel` |
| `dataModelUpdate` | `updateDataModel` | Rename only |
| `dataSourcePush` | `dataSourcePush` | **No change** — custom command, not in either spec |
| `deleteSurface` | `deleteSurface` | **No change** |

| v0.8 component shape | v0.9 component shape |
|---|---|
| `{ "id": "x", "component": { "Text": { "text": "..." } } }` | `{ "id": "x", "component": "Text", "text": "..." }` |

| v0.8 prop | v0.9 prop | Components affected |
|---|---|---|
| `usageHint` | `variant` | Text, Image, and any component using `usageHint` |

### What stays the same

- `dataSourcePush` — custom command, not in either spec, keeps working as-is
- `deleteSurface` — unchanged in v0.9
- Data model structure — already uses flat key/value objects (not v0.8 adjacency lists), which is what v0.9 expects
- `$sources` convention for data sources — custom extension, unaffected
- All existing component types (Column, Row, Text, Badge, Table, etc.)
- Filter/bind/aggregate/reactive system — custom extensions, unaffected

---

## 2. Migration Strategy: Backward-Compat Shim (Recommended)

**Hard cut is too risky.** There are JSONL files on disk (`~/.openclaw/workspaces/*/canvas/jsonl/`), cached surfaces in SQLite, and agents that will continue generating v0.8 payloads until the skill docs are updated and agents re-read them.

### Approach: Accept both, normalize to v0.9 internally

The server-side command processor (`processA2UICommand` and the gateway `a2ui.push` handler) will:

1. Accept both v0.8 and v0.9 command names
2. Accept both v0.8 wrapped and v0.9 flattened component shapes
3. Normalize everything to v0.9 internally before storing/broadcasting
4. The SPA only handles v0.9 message types and component shapes

This keeps the shim in one place (server-side normalization) rather than spreading dual-format handling across the client.

### Deprecation timeline

- **Phase 1 (this PR):** Accept both formats, log warnings for v0.8 usage
- **Phase 2 (after skill docs updated + 2 weeks):** Remove v0.8 acceptance, hard error on old format

---

## 3. Detailed Changes by File

### 3.1 `src/server/services/a2ui-commands.ts` — Command Processor

The central normalization point. Changes:

**Command name aliasing:**
```typescript
// Normalize v0.8 command names to v0.9
if (parsed.surfaceUpdate) {
  parsed.updateComponents = parsed.surfaceUpdate
  delete parsed.surfaceUpdate
}
if (parsed.beginRendering) {
  parsed.createSurface = parsed.beginRendering
  delete parsed.beginRendering
}
if (parsed.dataModelUpdate) {
  parsed.updateDataModel = parsed.dataModelUpdate
  delete parsed.dataModelUpdate
}
```

**Component shape normalization** (inside `updateComponents` handler):
```typescript
// Normalize v0.8 wrapped components to v0.9 flat shape
// v0.8: { id: "x", component: { "Text": { "text": "..." } } }
// v0.9: { id: "x", component: "Text", "text": "..." }
function normalizeComponent(c: { id: string; component: unknown }): { id: string; [key: string]: unknown } {
  const comp = c.component
  if (typeof comp === 'string') return c as any // already v0.9
  if (typeof comp === 'object' && comp !== null) {
    const keys = Object.keys(comp)
    if (keys.length === 1) {
      const type = keys[0]
      const props = (comp as any)[type] ?? {}
      return { id: c.id, component: type, ...props }
    }
  }
  return c as any
}
```

**`createSurface` handling:**
- Accept `root` field (v0.8 `beginRendering` style) for backward compat
- Accept new v0.9 fields: `catalogId`, `theme`, `sendDataModel`
- `root` is no longer required in the command — v0.9 says "there must be exactly one component with id 'root'". However, we keep accepting an explicit `root` field for backward compat and because our renderer uses it to know which component to start from. If omitted, default to `"root"`.
- Store `sendDataModel` flag on the surface for future client→server sync support

**Broadcast message types renamed:**
```
a2ui.surfaceUpdate  → a2ui.updateComponents
a2ui.beginRendering → a2ui.createSurface
a2ui.dataModelUpdate → a2ui.updateDataModel
```

### 3.2 `src/server/commands/a2ui.ts` — Gateway Command Handlers

The `a2ui.push` handler currently duplicates the command processing logic from `a2ui-commands.ts`. This should be refactored to delegate entirely to `processA2UICommand` (it already does for the node-client path). The duplicated inline handlers should be removed.

After refactoring, this file just parses JSONL lines and calls `processA2UICommand` for each — the normalization happens there.

### 3.3 `src/server/services/a2ui-manager.ts` — Surface State

**Component storage format change:**

Currently stores components as `Map<string, Record<string, unknown>>` where the value is the v0.8 wrapped object (`{ "Text": { "text": "..." } }`).

Change to store the v0.9 flat shape: the value becomes `{ component: "Text", text: "..." }` (the type discriminator + props, without the `id`).

Update `upsertSurface` signature:
```typescript
// Old: components: Array<{ id: string; component: Record<string, unknown> }>
// New: components: Array<{ id: string; component: string; [key: string]: unknown }>
```

The `serialize` method must emit v0.9 flat components.

### 3.4 `src/server/services/a2ui-store.ts` — SQLite Persistence

The `components` column stores JSON. The format changes from:
```json
{ "root": { "Column": { "children": ["a"] } } }
```
to:
```json
{ "root": { "component": "Column", "children": ["a"] } }
```

**Migration:** On startup, detect and normalize any v0.8-format components in the database. A one-time migration pass in the `A2UIManager` constructor after loading from the store:

```typescript
// After loading from store, normalize any v0.8 components
for (const [key, surface] of this.surfaces) {
  let migrated = false
  for (const [id, comp] of surface.components) {
    if (typeof comp.component !== 'string') {
      // v0.8 wrapped format — normalize
      const keys = Object.keys(comp)
      if (keys.length === 1 && typeof (comp as any)[keys[0]] === 'object') {
        const type = keys[0]
        const props = (comp as any)[type] ?? {}
        surface.components.set(id, { component: type, ...props })
        migrated = true
      }
    }
  }
  if (migrated) this.store?.save(surface.session, surface)
}
```

### 3.5 `src/client/store/a2ui.ts` — Vuex Store

**`upsertSurface` mutation** — payload changes:

```typescript
// Old: components stored as { "Text": { "text": "..." } }
// New: components stored as { component: "Text", text: "..." }
upsertSurface(state, payload: { surfaceId: string; components: Array<{ id: string; component: string; [key: string]: unknown }> }) {
  // ...
  for (const c of payload.components) {
    const { id, ...rest } = c
    s.components[id] = rest  // { component: "Text", text: "..." }
  }
}
```

**Rename mutations** (optional, for clarity):
- No rename needed — the mutation names (`upsertSurface`, `setRoot`, `updateDataModel`) are internal and don't need to match the wire protocol names.

### 3.6 `src/client/views/CanvasView.vue` — WebSocket Handlers

Update the handler registrations:

```typescript
const handlers: [string, (d: Record<string, unknown>) => void][] = [
  // ... canvas handlers unchanged ...
  ['a2ui.updateComponents', onSurfaceUpdate],
  ['a2ui.createSurface', onBeginRendering],
  ['a2ui.updateDataModel', onDataModelUpdate],
  ['a2ui.deleteSurface', onDeleteSurface],
  ['a2ui.clearAll', onClearAll],
]
```

The handler function bodies don't change — they still call the same Vuex mutations.

### 3.7 `src/client/components/A2UINode.vue` — Component Resolution

This is the biggest client-side change. Currently extracts the type from the v0.8 wrapper:

```typescript
// Old: component is { "Text": { "text": "..." } }
const typeName = computed(() => Object.keys(entry)[0])
const componentDef = computed(() => entry[typeName])
```

Change to read the v0.9 flat shape:

```typescript
// New: component is { component: "Text", text: "..." }
const typeName = computed(() => {
  const entry = componentEntry.value
  if (!entry) return null
  return (entry.component as string) ?? null
})

const componentDef = computed(() => {
  const entry = componentEntry.value
  if (!entry) return null
  const { component, ...props } = entry as Record<string, unknown>
  if (component === 'MultiSelect') return { ...props, multi: true }
  return props
})
```

### 3.8 `src/server/index.ts` — SPA Replay on Connect

The replay block sends cached surfaces to newly connected SPA clients. Update the broadcast message types:

```typescript
gateway.sendToSpa(ws, { type: 'a2ui.updateComponents', ... })
gateway.sendToSpa(ws, { type: 'a2ui.updateDataModel', ... })
gateway.sendToSpa(ws, { type: 'a2ui.createSurface', ... })
```

The component array sent during replay must be in v0.9 flat format (which it will be, since the manager now stores v0.9).

### 3.9 `src/server/services/node-client.ts` — MCP Command Dispatch

The `canvas.a2ui.push` / `canvas.a2ui.pushJSONL` case already delegates to `processA2UICommand`, so no changes needed beyond what's done in 3.1.

### 3.10 `src/server/services/jsonl-watcher.ts` — File Watcher

Already delegates to `processA2UICommand`. No changes needed.

---

## 4. Property Renames

### `usageHint` → `variant`

v0.9 renames `usageHint` to `variant` across Text, Image, and other components. Our components already use `usageHint` extensively in JSONL files and component implementations.

**Server-side normalization** (in the component normalizer):
```typescript
// Normalize usageHint → variant for backward compat
if ('usageHint' in props && !('variant' in props)) {
  props.variant = props.usageHint
  delete props.usageHint
}
```

**Client components:** Update all A2UI*.vue components that reference `def.usageHint` to use `def.variant` instead. Affected:
- `A2UIText.vue`
- `A2UIImage.vue`
- Any others using `usageHint`

### Other v0.9 property renames (not currently used)

These are in the v0.9 spec but don't affect us because we don't implement these props:
- `distribution` → `justify` (Row/Column) — we don't use these
- `alignment` → `align` (Row/Column) — we don't use these
- `minValue`/`maxValue` → `min`/`max` (Slider) — we already use `min`/`max`

---

## 5. New v0.9 Features Worth Adopting

### 5.1 `sendDataModel` (client→server sync) — **Adopt later**

`createSurface` can include `sendDataModel: true`, which tells the client to include the full data model in every client→server message (button clicks, etc.). This enables the server to see filter state, user selections, etc.

**Current state:** We don't have a client→server action channel beyond deep links. Our filter/bind system is entirely client-side.

**Recommendation:** Store the flag on the surface, but don't implement the sync mechanism yet. It becomes useful when we add server-side action handling (e.g., Button actions that call back to the agent instead of using deep links).

### 5.2 `catalogId` — **Store but don't enforce**

v0.9 requires `createSurface` to include a `catalogId` URI identifying which component catalog is in use. We have a fixed component set, so this is informational only.

Store it on the surface metadata. Don't validate against it.

### 5.3 `theme` — **Adopt**

`createSurface` can include `theme: { primaryColor: "#007bff" }`. This replaces v0.8's `styles`.

Worth adopting — pass the theme object through to the SPA and apply it as CSS custom properties on the surface container. Minimal implementation:

```typescript
// In A2UIRenderer.vue
const theme = computed(() => store.state.a2ui.surfaces[surfaceId]?.theme ?? {})
const themeStyle = computed(() => {
  const t = theme.value
  return t.primaryColor ? { '--a2ui-primary': t.primaryColor } : {}
})
```

### 5.4 `ValidationFailed` error feedback — **Skip (future improvement)**

v0.9 introduces structured validation errors sent back to the LLM. This is for the "prompt-generate-validate" loop where the LLM self-corrects. Not relevant to our current architecture — agents generate JSONL offline and push it; there's no interactive correction loop.

**Future improvement:** A later version could add a streaming A2UI ingestion mode alongside the existing file-loading and content-pushing methods. In this mode, an agent would hold an open WebSocket (or SSE) connection to the canvas server and stream JSONL commands incrementally. The server would validate each command as it arrives and send `ValidationFailed` errors back over the same connection, giving the agent a chance to self-correct within the same turn. This would complement — not replace — the current fire-and-forget paths (`canvas.a2ui.push`, JSONL file watcher), which would remain available for batch/offline use cases.

### 5.5 `formatString` interpolation — **Skip (future improvement)**

v0.9 introduces `${expression}` syntax within a `formatString` function for string interpolation with support for nested function calls (e.g. `${formatDate(value: ${/timestamp}, format: 'yyyy-MM-dd')}`). We already have our own `{{field}}` template interpolation that covers the common cases.

**Future improvement:** Implement `formatString` as a separate effort to reach full spec compliance. This would add a unified interpolation engine that evaluates `${...}` expressions (JSON Pointer paths, nested function calls) and replace all existing interpolation points in the codebase:

- `useDataSource.ts` — `{{$key}}` replacement in `mappedProps` (aggregate map templates)
- `A2UIText.vue` — `{{field}}` replacement in `displayText` (data-bound text)
- `A2UIProgressBar.vue` — `{{field}}` replacement in `resolveTemplate` (label and value props)
- `A2UIRepeat.vue` — `{{field | transform}}` replacement in `resolveTemplate` / `deepResolve` (per-row template rendering with pipe transforms)

These are four separate implementations of essentially the same regex-based interpolation (`/\{\{(\$?\w+)\}\}/g`), with Repeat adding its own pipe-transform extension. A single `formatString` engine would consolidate all of them. During migration, both `{{field}}` and `${...}` syntaxes would be accepted, with `{{field}}` normalized to the equivalent `formatString` expression server-side. Once rolled out, the `{{field}}` shim and all per-component interpolation logic would be removed and skill docs updated to use `formatString` exclusively.

---

## 6. Impact on Existing JSONL Files

### Files on disk

Two known JSONL files in `~/.openclaw/workspaces/developer/canvas/jsonl/`:
- `dashboard-demo.jsonl` — uses `surfaceUpdate`, `dataSourcePush`, `beginRendering`, v0.8 wrapped components, `usageHint`
- `dashboard-demo-data.jsonl` — likely uses `dataSourcePush`

These will continue to work during the backward-compat period (Phase 1). They should be migrated to v0.9 format when the skill docs are updated.

### SQLite cache

Existing cached surfaces use v0.8 component format. The startup migration in section 3.4 handles this automatically.

---

## 7. Skill Doc Updates

All files under `~/.openclaw/skills/custom/canvas/` need updating:

| File | Changes needed |
|---|---|
| `SKILL.md` | Update command names in JSONL Commands section, update examples |
| `references/surface-updates.md` | Rename `surfaceUpdate` → `updateComponents`, `beginRendering` → `createSurface`, update component shape examples |
| `references/data-sources.md` | Rename `dataModelUpdate` → `updateDataModel` in examples |
| `references/components.md` | Update component JSONL examples to v0.9 flat shape, `usageHint` → `variant` |
| `references/reactive.md` | Update any JSONL examples |

The skill docs should be updated in the same PR as the code changes, so agents pick up the new format immediately.

---

## 8. Test Impact

Tests that need updating (all use v0.8 command names and component shapes in their fixtures):

| Test file | Changes |
|---|---|
| `test/a2ui-process-command.test.ts` | Update fixtures to v0.9 format, add tests for v0.8→v0.9 normalization |
| `test/a2ui-commands.test.ts` | Same |
| `test/a2ui-data-commands.test.ts` | Rename `dataModelUpdate` → `updateDataModel` in fixtures |
| `test/a2ui-replay.test.ts` | Update expected broadcast message types |
| `test/jsonl-watcher.test.ts` | Update JSONL fixtures |
| `test/ws-client-buffer.test.ts` | Update message type strings |
| `test/a2ui-store.test.ts` | Update component format |
| `test/a2ui-vuex.test.ts` | Update component format |
| `test/a2ui-manager.test.ts` | Update component format |

---

## 9. Implementation Order

1. **Normalization layer** — Add v0.8→v0.9 command name aliasing and component shape normalization in `a2ui-commands.ts`
2. **A2UIManager** — Update component storage to v0.9 flat format, add SQLite migration
3. **Refactor `a2ui.ts`** — Remove duplicated logic, delegate to `processA2UICommand`
4. **Broadcast types** — Rename WS message types (`a2ui.surfaceUpdate` → `a2ui.updateComponents`, etc.)
5. **SPA handlers** — Update CanvasView handler registrations
6. **A2UINode** — Update component type resolution for v0.9 flat shape
7. **Vuex store** — Update mutation payload types
8. **Replay** — Update `index.ts` SPA replay message types
9. **Property renames** — `usageHint` → `variant` normalization + component updates
10. **`createSurface` extras** — Store `theme`, `catalogId`, `sendDataModel`
11. **Tests** — Update all test fixtures
12. **Skill docs** — Update all JSONL examples and command references
13. **Migrate JSONL files** — Update `dashboard-demo.jsonl` and any others

---

## 10. Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Agents generate v0.8 after skill doc update | Medium | Backward-compat shim with warnings |
| SQLite migration corrupts data | Low | Migration is additive (normalize in place), original data recoverable from JSONL files |
| Component prop breakage (`usageHint` → `variant`) | Medium | Server-side normalization handles both |
| Missed v0.8 references in codebase | Low | Grep for old names before removing shim |
| `dataSourcePush` confusion (not in v0.9 spec) | Low | It's our custom command, clearly documented as such |
