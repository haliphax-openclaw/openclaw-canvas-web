# A2UI v0.9 Upgrade — Implementation Plan

**Spec:** [a2ui-v09-upgrade-spec.md](2026-03-18-a2ui-v09-upgrade-spec.md)
**Date:** 2026-03-18
**Status:** Phase 1 complete

---

## Phase 1 — v0.9 with backward-compat shim ✅

### ~~Step 1: Server-side normalization layer~~ ✅

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

### ~~Step 2: Refactor gateway command handler~~ ✅

Remove duplicated JSONL processing logic from `src/server/commands/a2ui.ts`. The `a2ui.push` handler currently re-implements all command parsing inline instead of delegating to `processA2UICommand()`.

**Tasks:**
1. Replace the inline `surfaceUpdate`/`beginRendering`/`dataModelUpdate`/`dataSourcePush`/`deleteSurface` handling with a call to `processA2UICommand()` per parsed line
2. Keep the JSONL line parsing and error handling

**Files:** `src/server/commands/a2ui.ts`

### ~~Step 3: Update A2UIManager storage format~~ ✅

Change the in-memory component representation from v0.8 wrapped to v0.9 flat.

**Prerequisite:** Wipe the SQLite state cache database (`~/.openclaw-canvas/a2ui-cache.db`) before deploying. v0.8 stored surfaces are not migrated — surfaces will be rebuilt on next agent push. This avoids the complexity of a migration script for cached state that is easily regenerated.

**Tasks:**
1. Update `upsertSurface()` to accept and store v0.9 flat components (`{ component: "Text", text: "..." }`)
2. Update `serialize()` to emit v0.9 flat format
3. Update the `A2UISurface` interface to reflect the new component shape

**Files:** `src/server/services/a2ui-manager.ts`

### ~~Step 4: Update SPA replay~~ ✅

Update the `onSpaConnect` callback in `src/server/index.ts` to use v0.9 broadcast message types.

**Tasks:**
1. `a2ui.surfaceUpdate` → `a2ui.updateComponents`
2. `a2ui.beginRendering` → `a2ui.createSurface`
3. `a2ui.dataModelUpdate` → `a2ui.updateDataModel`
4. Include `theme`, `catalogId` in the `createSurface` replay message if present on the surface

**Files:** `src/server/index.ts`

### ~~Step 5: Update SPA WebSocket handlers~~ ✅

Update CanvasView to listen for v0.9 message types.

**Tasks:**
1. Change handler registrations:
   - `a2ui.surfaceUpdate` → `a2ui.updateComponents`
   - `a2ui.beginRendering` → `a2ui.createSurface`
   - `a2ui.dataModelUpdate` → `a2ui.updateDataModel`
2. Handler function bodies stay the same (they call the same Vuex mutations)

**Files:** `src/client/views/CanvasView.vue`

### ~~Step 6: Update A2UINode component resolution~~ ✅

Change from v0.8 key-based type extraction to v0.9 `component` discriminator.

**Tasks:**
1. `typeName` reads `entry.component` (string) instead of `Object.keys(entry)[0]`
2. `componentDef` spreads the remaining props (`{ component, ...props } = entry`) instead of unwrapping a nested object
3. MultiSelect alias logic stays (inject `multi: true` when `component === 'MultiSelect'`)

**Files:** `src/client/components/A2UINode.vue`

### ~~Step 7: Update Vuex store~~ ✅

Update the `upsertSurface` mutation to handle v0.9 flat component payloads.

**Tasks:**
1. Update payload type: components are `Array<{ id: string; component: string; [key: string]: unknown }>`
2. Store `{ component, ...props }` (without `id`) as the value in `s.components[id]`
3. Add `theme`, `catalogId`, `sendDataModel` fields to `A2UISurfaceState` interface
4. Update `setRoot` (or add a `createSurface` mutation) to also store `theme`/`catalogId`/`sendDataModel`

**Files:** `src/client/store/a2ui.ts`

### ~~Step 8: Property renames in client components~~ ✅

Update components that read `usageHint` to read `variant` instead.

**Tasks:**
1. `A2UIText.vue` — change `def.usageHint` → `def.variant` in the `hintMap` lookup
2. `A2UIImage.vue` — check for and update any `usageHint` references
3. Grep for any other `usageHint` references in `src/client/`

**Files:** `src/client/components/A2UIText.vue`, `src/client/components/A2UIImage.vue`, others as found

### ~~Step 9: Apply theme from createSurface~~ ✅

Pass the `theme` object from the Vuex surface state to the renderer as CSS custom properties.

**Tasks:**
1. In `A2UIRenderer.vue`, read `theme` from the surface state
2. Apply `primaryColor` as `--a2ui-primary` CSS custom property on the surface container
3. Update any components that should respect the primary color

**Files:** `src/client/components/A2UIRenderer.vue`

### ~~Step 10: Update tests~~ ✅

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
3. Add test verifying that a fresh A2UIManager with an empty/wiped store initializes cleanly
4. Run full test suite, fix any remaining breakage

**Files:** `test/*.test.ts`

### ~~Step 11: Update skill docs~~ ✅

Completed — PR merged: https://github.com/haliphax-openclaw/skills/pull/1

### ~~Step 12: Update project docs~~ ✅

Completed — committed to `a2ui-v0.9` branch, merged to main.

---

## Phase 2 — Remove backward-compat shim

*Timeline: Indefinite. May align with OpenClaw's internal canvas server upgrade plans.*

1. Remove command name aliasing from `processA2UICommand()` — v0.8 names become errors
2. Remove wrapped component shape detection from `normalizeComponent()` — only v0.9 flat accepted
3. Remove `usageHint` → `variant` normalization — only `variant` accepted
4. Update tests to remove backward-compat test cases
5. Log errors (not warnings) for any remaining v0.8 payloads

---

## Future improvements (separate efforts)

### ~~Streaming A2UI ingestion with ValidationFailed~~ ✅

Issue: https://github.com/haliphax-openclaw/openclaw-canvas-web/issues/5
Spec: [a2ui-v09-upgrade-spec.md §5.4](2026-03-18-a2ui-v09-upgrade-spec.md)

#### Approach: streaming core with batch adapter

Build a single streaming pipeline as the core command processing path. All A2UI commands flow through this pipeline, which validates each command as it arrives and emits per-command validation results (success or `ValidationFailed` errors).

Two interfaces expose this pipeline:

1. **Streaming interface** (WebSocket or SSE) — scripts, orchestration tools, and non-LLM agents connect directly and receive per-command validation feedback in real-time as each command is processed. Consumers can react and self-correct mid-stream.

2. **Batch interface** (node invoke / tool call) — a thin adapter that feeds a batch of commands into the same streaming pipeline, collects all validation responses, and returns the aggregated result as a single synchronous response. LLM agents see a normal request-response with full validation feedback for every command in the batch.

The existing `canvas.a2ui.push` handler becomes a batch adapter over the streaming core. The streaming pipeline is the single source of truth for command processing and validation — no duplicated logic between the two interfaces.

#### Key design points

- The streaming pipeline validates per-command (component type checks, required props, data source references, root component existence, etc.)
- The batch adapter gathers all validation results before returning, so the agent can self-correct in its next tool call
- The streaming interface complements (does not replace) the batch path — both remain available
- The JSONL file watcher can also be wired through the same pipeline for consistent validation

### ~~formatString interpolation engine~~ ✅

Issue: https://github.com/haliphax-openclaw/openclaw-canvas-web/issues/8
Spec: [a2ui-v09-upgrade-spec.md §5.5](2026-03-18-a2ui-v09-upgrade-spec.md)

### ~~Theme support~~ ✅

Issue: https://github.com/haliphax-openclaw/openclaw-canvas-web/issues/6
Plan: [theme-support-plan.md](done/2026-03-19-theme-support-plan.md)

### Catalog support

Issue: https://github.com/haliphax-openclaw/openclaw-canvas-web/issues/7
Plan: [catalog-support-plan.md](2026-03-19-catalog-support-plan.md)
Depends on: Theme support (#6)
