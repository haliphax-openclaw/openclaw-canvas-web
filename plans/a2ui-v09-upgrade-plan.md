# A2UI v0.9 Upgrade — Implementation Plan

**Spec:** [docs/a2ui-v09-upgrade-spec.md](a2ui-v09-upgrade-spec.md)
**Date:** 2026-03-18

---

## Phase 1 — v0.9 with backward-compat shim

### Step 1: Server-side normalization layer

Add v0.8→v0.9 normalization to `processA2UICommand()` in `src/server/services/a2ui-commands.ts`. This is the single entry point for all JSONL processing (gateway push, node-client, JSONL file watcher).

**Tasks:**
1. Add command name aliasing at the top of `processA2UICommand()`:
   - `surfaceUpdate` → `updateComponents`
   - `beginRendering` → `createSurface`
   - `dataModelUpdate` → `updateDataModel`
   - Log a deprecation warning when a v0.8 name is encountered
2. Add `normalizeComponent()` function that detects v0.8 wrapped shape (`{ "Text": { ... } }`) vs v0.9 flat shape (`"component": "Text"`) and normalizes to v0.9
3. Add `usageHint` → `variant` normalization inside `normalizeComponent()`
4. Update all handler branches to use v0.9 command names (`updateComponents`, `createSurface`, `updateDataModel`)
5. Update broadcast message types:
   - `a2ui.surfaceUpdate` → `a2ui.updateComponents`
   - `a2ui.beginRendering` → `a2ui.createSurface`
   - `a2ui.dataModelUpdate` → `a2ui.updateDataModel`
6. Handle new `createSurface` fields: `catalogId`, `theme`, `sendDataModel`; default `root` to `"root"` if omitted

**Files:** `src/server/services/a2ui-commands.ts`

### Step 2: Refactor gateway command handler

Remove duplicated JSONL processing logic from `src/server/commands/a2ui.ts`. The `a2ui.push` handler currently re-implements all command parsing inline instead of delegating to `processA2UICommand()`.

**Tasks:**
1. Replace the inline `surfaceUpdate`/`beginRendering`/`dataModelUpdate`/`dataSourcePush`/`deleteSurface` handling with a call to `processA2UICommand()` per parsed line
2. Keep the JSONL line parsing and error handling

**Files:** `src/server/commands/a2ui.ts`

### Step 3: Update A2UIManager storage format

Change the in-memory component representation from v0.8 wrapped to v0.9 flat.

**Tasks:**
1. Update `upsertSurface()` to accept and store v0.9 flat components (`{ component: "Text", text: "..." }`)
2. Update `serialize()` to emit v0.9 flat format
3. Add one-time SQLite migration in the constructor: after loading from store, detect v0.8 wrapped components, normalize to v0.9, and write back
4. Update the `A2UISurface` interface to reflect the new component shape

**Files:** `src/server/services/a2ui-manager.ts`

### Step 4: Update SPA replay

Update the `onSpaConnect` callback in `src/server/index.ts` to use v0.9 broadcast message types.

**Tasks:**
1. `a2ui.surfaceUpdate` → `a2ui.updateComponents`
2. `a2ui.beginRendering` → `a2ui.createSurface`
3. `a2ui.dataModelUpdate` → `a2ui.updateDataModel`
4. Include `theme`, `catalogId` in the `createSurface` replay message if present on the surface

**Files:** `src/server/index.ts`

### Step 5: Update SPA WebSocket handlers

Update CanvasView to listen for v0.9 message types.

**Tasks:**
1. Change handler registrations:
   - `a2ui.surfaceUpdate` → `a2ui.updateComponents`
   - `a2ui.beginRendering` → `a2ui.createSurface`
   - `a2ui.dataModelUpdate` → `a2ui.updateDataModel`
2. Handler function bodies stay the same (they call the same Vuex mutations)

**Files:** `src/client/views/CanvasView.vue`

### Step 6: Update A2UINode component resolution

Change from v0.8 key-based type extraction to v0.9 `component` discriminator.

**Tasks:**
1. `typeName` reads `entry.component` (string) instead of `Object.keys(entry)[0]`
2. `componentDef` spreads the remaining props (`{ component, ...props } = entry`) instead of unwrapping a nested object
3. MultiSelect alias logic stays (inject `multi: true` when `component === 'MultiSelect'`)

**Files:** `src/client/components/A2UINode.vue`

### Step 7: Update Vuex store

Update the `upsertSurface` mutation to handle v0.9 flat component payloads.

**Tasks:**
1. Update payload type: components are `Array<{ id: string; component: string; [key: string]: unknown }>`
2. Store `{ component, ...props }` (without `id`) as the value in `s.components[id]`
3. Add `theme`, `catalogId`, `sendDataModel` fields to `A2UISurfaceState` interface
4. Update `setRoot` (or add a `createSurface` mutation) to also store `theme`/`catalogId`/`sendDataModel`

**Files:** `src/client/store/a2ui.ts`

### Step 8: Property renames in client components

Update components that read `usageHint` to read `variant` instead.

**Tasks:**
1. `A2UIText.vue` — change `def.usageHint` → `def.variant` in the `hintMap` lookup
2. `A2UIImage.vue` — check for and update any `usageHint` references
3. Grep for any other `usageHint` references in `src/client/`

**Files:** `src/client/components/A2UIText.vue`, `src/client/components/A2UIImage.vue`, others as found

### Step 9: Apply theme from createSurface

Pass the `theme` object from the Vuex surface state to the renderer as CSS custom properties.

**Tasks:**
1. In `A2UIRenderer.vue`, read `theme` from the surface state
2. Apply `primaryColor` as `--a2ui-primary` CSS custom property on the surface container
3. Update any components that should respect the primary color

**Files:** `src/client/components/A2UIRenderer.vue`

### Step 10: Update tests

Update all test fixtures from v0.8 to v0.9 format. Add backward-compat normalization tests.

**Tasks:**
1. Update command names and component shapes in fixtures across all affected test files:
   - `test/a2ui-process-command.test.ts`
   - `test/a2ui-commands.test.ts`
   - `test/a2ui-data-commands.test.ts`
   - `test/a2ui-replay.test.ts`
   - `test/jsonl-watcher.test.ts`
   - `test/ws-client-buffer.test.ts`
   - `test/a2ui-store.test.ts`
   - `test/a2ui-vuex.test.ts`
   - `test/a2ui-manager.test.ts`
   - `test/vue-components.test.ts`
   - `test/a2ui-components.test.ts`
   - `test/text-data-binding.test.ts`
   - `test/progressbar-data-binding.test.ts`
   - `test/tabs.test.ts`
   - `test/accordion.test.ts`
   - `test/select-options-from.test.ts`
   - `test/sortable.test.ts`
2. Add new tests for v0.8→v0.9 normalization:
   - v0.8 command names accepted and normalized
   - v0.8 wrapped component shape accepted and normalized
   - `usageHint` normalized to `variant`
   - `createSurface` with and without explicit `root`
   - `createSurface` with `theme`, `catalogId`, `sendDataModel`
3. Add SQLite migration test: load v0.8 format from store, verify normalized on read
4. Run full test suite, fix any remaining breakage

**Files:** `test/*.test.ts`

### Step 11: Update skill docs

Update all JSONL examples and command references in the canvas skill.

**Tasks:**
1. `SKILL.md` — update command names in the JSONL Commands section and all inline examples
2. `references/surface-updates.md` — rename `surfaceUpdate` → `updateComponents`, `beginRendering` → `createSurface`, update component shape examples to v0.9 flat format
3. `references/data-sources.md` — rename `dataModelUpdate` → `updateDataModel` in examples
4. `references/components.md` — update all component JSONL examples to v0.9 flat shape, `usageHint` → `variant`
5. `references/reactive.md` — update any JSONL examples

**Files:** `~/.openclaw/skills/custom/canvas/SKILL.md`, `~/.openclaw/skills/custom/canvas/references/*.md`

### Step 12: Migrate existing JSONL files

Convert on-disk JSONL files to v0.9 format.

**Tasks:**
1. `~/.openclaw/workspaces/developer/canvas/jsonl/dashboard-demo.jsonl` — update command names, flatten component shapes, `usageHint` → `variant`
2. `~/.openclaw/workspaces/developer/canvas/jsonl/dashboard-demo-data.jsonl` — update command names if applicable
3. Search for any other `.jsonl` files across workspaces and update

**Files:** `~/.openclaw/workspaces/*/canvas/jsonl/*.jsonl`

### Step 13: Update project docs

Update README and internal docs to reflect v0.9 terminology.

**Tasks:**
1. `README.md` — update A2UI command references
2. `docs/a2ui-reactive.md` — update command names in examples
3. `docs/jsonl-watcher.md` — update command names in examples
4. `docs/components.md` — update component shape examples

**Files:** `README.md`, `docs/*.md`

---

## Phase 2 — Remove backward-compat shim

*Target: 2 weeks after Phase 1 ships and skill docs are live.*

### Step 14: Remove v0.8 acceptance

1. Remove command name aliasing from `processA2UICommand()` — v0.8 names become errors
2. Remove wrapped component shape detection from `normalizeComponent()` — only v0.9 flat accepted
3. Remove `usageHint` → `variant` normalization — only `variant` accepted
4. Remove SQLite migration code (one-time migration already ran)
5. Update tests to remove backward-compat test cases
6. Log errors (not warnings) for any remaining v0.8 payloads

---

## Future improvements (separate efforts)

### Streaming A2UI ingestion with ValidationFailed

Add a streaming WebSocket/SSE mode where agents hold an open connection and stream JSONL commands incrementally. The server validates each command and sends `ValidationFailed` errors back over the same connection for in-turn self-correction. Complements the existing batch paths (`canvas.a2ui.push`, JSONL file watcher).

See spec section 5.4.

### formatString interpolation engine

Replace the four separate `{{field}}` regex interpolation implementations (`useDataSource.ts`, `A2UIText.vue`, `A2UIProgressBar.vue`, `A2UIRepeat.vue`) with a single `formatString` engine supporting v0.9 `${expression}` syntax (JSON Pointer paths, nested function calls). Transitional shim accepts both syntaxes, then `{{field}}` is removed.

See spec section 5.5.
