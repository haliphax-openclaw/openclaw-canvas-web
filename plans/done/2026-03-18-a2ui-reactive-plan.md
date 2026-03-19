# A2UI Reactive Data-Binding — Architectural Plan

## 1. Overview

Add a client-side reactive data layer to A2UI so that display components (Table, Badge, ProgressBar, Text, etc.) can bind to agent-pushed data sources and be filtered/transformed by interactive filter components (Select, Slider, Checkbox, TextInput) — all without agent round-trips.

The agent pushes data and layout once. The user interacts with filters. Display components re-render instantly on the client. Agent events remain available as an opt-in escape hatch via `openclaw://` deep links.

---

## 2. Data Model Schema

### 2.1 Where data lives

The existing `dataModel` field on each surface (`A2UISurfaceState.dataModel`) becomes the reactive data store. It holds named **data sources**, each being an array of row objects.

```jsonc
// dataModelUpdate pushed by agent
{
  "dataModelUpdate": {
    "surfaceId": "main",
    "data": {
      "$sources": {
        "tasks": {
          "fields": ["id", "title", "status", "progress", "assignee"],
          "rows": [
            { "id": 1, "title": "Auth module", "status": "done", "progress": 100, "assignee": "Alice" },
            { "id": 2, "title": "Dashboard", "status": "in-progress", "progress": 60, "assignee": "Bob" },
            { "id": 3, "title": "API docs", "status": "blocked", "progress": 10, "assignee": "Alice" }
          ]
        },
        "kpis": {
          "fields": ["metric", "value"],
          "rows": [
            { "metric": "uptime", "value": 99.9 },
            { "metric": "latency_p99", "value": 42 }
          ]
        }
      }
    }
  }
}
```

Convention: the `$sources` key inside `dataModel` is reserved for structured data sources. Everything else in `dataModel` remains free-form key-value (backward compatible).

### 2.2 Data source shape

```ts
interface DataSource {
  fields: string[]           // column/field names (for schema awareness)
  rows: Record<string, unknown>[]  // the actual data
  primaryKey?: string        // optional — field to use as row identity (default: array index)
}
```

### 2.3 Incremental updates

The agent can push partial updates to an existing source:

```jsonc
{
  "dataModelUpdate": {
    "surfaceId": "main",
    "data": {
      "$sources": {
        "tasks": {
          "rows": [
            { "id": 2, "title": "Dashboard", "status": "done", "progress": 100, "assignee": "Bob" }
          ],
          "merge": true  // upsert by primaryKey; without this flag, rows replace entirely
        }
      }
    }
  }
}
```

When `merge: true` and `primaryKey` is set, rows are upserted by key. Otherwise the entire `rows` array is replaced.

---

## 3. Filter Component Spec

Filters are regular A2UI components with additional binding metadata. Any interactive component can act as a filter by including a `bind` property.

### 3.1 Filter bind schema

```ts
interface FilterBind {
  source: string | string[]  // data source name(s) — array targets multiple sources
  field: string              // field to filter on, e.g. "status"
  op?: FilterOp              // operator (default: "eq")
  nullValue?: unknown        // value that means "no filter" (default: "")
  emitTo?: string            // optional agent deep link on change
}

type FilterOp = "eq" | "contains" | "gte" | "lte" | "range" | "in"
```

**`nullValue`**: The value that disables the filter (passthrough). Defaults to `""` (empty string). Set to `"all"` when the Select uses `"all"` as its "show everything" option. When the component's current value equals `nullValue`, the filter is inactive.

**`source` as array**: When a single filter must target multiple data sources (e.g., an agent Select filtering both an agents table and a cron table), `source` accepts an array of source names. The same field/op/value filter is applied to each source independently.

### 3.2 Component examples

**Select as filter:**
```jsonc
{
  "Select": {
    "options": [
      { "value": "", "label": "All statuses" },
      { "value": "done", "label": "Done" },
      { "value": "in-progress", "label": "In Progress" },
      { "value": "blocked", "label": "Blocked" }
    ],
    "selected": "",
    "bind": { "source": "tasks", "field": "status", "op": "eq" }
  }
}
```

**Select with `nullValue` (passthrough is not empty string):**
```jsonc
{
  "Select": {
    "options": [
      { "value": "all", "label": "All Agents" },
      { "value": "main", "label": "main" }
    ],
    "selected": "all",
    "bind": { "source": ["agents", "crons"], "field": "agent", "op": "eq", "nullValue": "all" }
  }
}
```

**Slider as range filter:**
```jsonc
{
  "Slider": {
    "min": 0, "max": 100, "value": 0,
    "label": "Min progress",
    "bind": { "source": "tasks", "field": "progress", "op": "gte" }
  }
}
```

**Checkbox as toggle filter:**
```jsonc
{
  "Checkbox": {
    "label": "Only Alice's tasks",
    "checked": false,
    "bind": { "source": "tasks", "field": "assignee", "op": "eq", "value": "Alice" }
  }
}
```

For Checkbox, `bind.value` specifies the filter value applied when checked. When unchecked, the filter is inactive.

**TextInput as search filter (new component):**
```jsonc
{
  "TextInput": {
    "placeholder": "Search tasks…",
    "bind": { "source": "tasks", "field": "title", "op": "contains" }
  }
}
```

### 3.3 Filter state management

Filter state lives in a new Vuex module `a2ui-filters` (or as a sub-object of the existing `a2ui` module state):

```ts
interface FilterState {
  // keyed by surfaceId → source → field → { op, value, componentId }
  [surfaceId: string]: {
    [source: string]: {
      [field: string]: { op: FilterOp; value: unknown; componentId: string }[]
    }
  }
}
```

When a filter component changes value:
1. The component emits a local Vuex mutation: `a2ui/setFilter`
2. If `bind.source` is an array, the mutation is applied to each source independently
3. All display components bound to any affected source reactively recompute via Vue's computed properties
4. No WebSocket message is sent (unless `emitTo` is configured — see §5)
5. If the current value equals `bind.nullValue` (or `""` if not set), the filter is inactive (passthrough)

---

## 4. Display Component Binding Syntax

### 4.1 Direct source binding

Display components reference data sources via a `dataSource` property:

```ts
interface DataSourceBinding {
  source: string                    // data source name
  map?: Record<string, string>      // maps component prop → data field
  aggregate?: AggregateSpec         // optional aggregation
}

interface AggregateSpec {
  fn: "count" | "sum" | "avg" | "min" | "max"
  field?: string  // required for sum/avg/min/max
}
```

### 4.2 Table binding

Table auto-maps when `dataSource` is present — `fields` become headers, `rows` become table rows (post-filter).

```jsonc
{
  "Table": {
    "dataSource": { "source": "tasks" }
  }
}
```

Explicit column selection/ordering:
```jsonc
{
  "Table": {
    "dataSource": {
      "source": "tasks",
      "columns": ["title", "status", "progress"]
    }
  }
}
```

Static `headers`/`rows` still work as before when `dataSource` is absent (backward compatible).

### 4.3 Scalar display binding

For components that display a single value (Text, Badge, ProgressBar):

```jsonc
{
  "Text": {
    "dataSource": { "source": "tasks", "aggregate": { "fn": "count" } },
    "map": { "text": "$value" }
  }
}
```

`$value` is the result of the aggregate. The `map` object maps component props to either `$value` (aggregate result) or field names.

**Badge showing status of first matching row:**
```jsonc
{
  "Badge": {
    "dataSource": { "source": "tasks", "map": { "text": "status" } },
    "rowIndex": 0
  }
}
```

**ProgressBar bound to aggregate:**
```jsonc
{
  "ProgressBar": {
    "dataSource": { "source": "tasks", "aggregate": { "fn": "avg", "field": "progress" } },
    "map": { "value": "$value", "label": "Avg progress" }
  }
}
```

### 4.4 Repeat / iteration

A new `Repeat` layout component renders its child template once per row in the filtered data:

```jsonc
{
  "Repeat": {
    "dataSource": { "source": "tasks" },
    "template": {
      "Row": {
        "children": ["_repeat_text", "_repeat_bar", "_repeat_badge"]
      }
    },
    "templateComponents": {
      "_repeat_text": { "Text": { "text": "{{title}}" } },
      "_repeat_bar": { "ProgressBar": { "value": "{{progress}}", "label": "{{title}}" } },
      "_repeat_badge": { "Badge": { "text": "{{status}}", "variant": "{{status | variantMap}}" } }
    }
  }
}
```

`{{field}}` placeholders are resolved per-row. The optional `| variantMap` syntax allows simple value mapping (defined in a `transforms` object on the Repeat):

```jsonc
"transforms": {
  "variantMap": { "done": "success", "in-progress": "warning", "blocked": "error" }
}
```

Implementation: `A2UIRepeat.vue` iterates filtered rows, clones template components with resolved values, and renders each as a virtual component subtree. No new component IDs are registered in the store — these are ephemeral render-time clones.

---

## 5. Event Model

### 5.1 Client-side reactivity (default)

Filter changes trigger Vuex mutations. Display components recompute via Vue `computed()`. No network traffic.

Flow:
```
User changes Select → Select.onChange() → store.commit('a2ui/setFilter', {...})
                                              ↓
                              Vue reactivity triggers recompute of
                              filteredRows in every bound display component
```

### 5.2 Agent prompt triggers (opt-in)

Any component can include `emitTo` to fire an `openclaw://` deep link on interaction:

```jsonc
{
  "Select": {
    "options": [...],
    "bind": { "source": "tasks", "field": "status" },
    "emitTo": "openclaw://agent?message=User+filtered+tasks+by+status%3D{{value}}&sessionKey=main"
  }
}
```

`{{value}}` is interpolated with the current component value before the deep link fires.

This happens **in addition to** the client-side filter update. To make it agent-only (no client filter), omit `bind` and use only `emitTo`.

### 5.3 Button events

Buttons already send `a2ui.buttonClick` over WS. Add optional `emitTo` for deep link:

```jsonc
{
  "Button": {
    "label": "Refresh data",
    "emitTo": "openclaw://agent?message=refresh+task+data"
  }
}
```

When `emitTo` is present, the button fires the deep link instead of (or in addition to) the WS event.

---

## 6. Implementation Plan

### Phase 1: Data source store (Vuex)

**Files to modify:**
- `src/client/store/a2ui.ts` — extend `updateDataModel` mutation to detect `$sources` and store them as reactive arrays. Add `setFilter` and `clearFilters` mutations.

New state shape:
```ts
interface A2UISurfaceState {
  components: Record<string, Record<string, unknown>>
  root: string | null
  dataModel: Record<string, unknown>
  sources: Record<string, DataSource>       // NEW — parsed from $sources
  filters: Record<string, FieldFilter[]>    // NEW — keyed by source name
}

interface FieldFilter {
  field: string
  op: FilterOp
  value: unknown
  nullValue: unknown       // NEW — value that means "no filter" (default: "")
  isNull: boolean          // NEW — true when value === nullValue
  componentId: string
}
```

Add a Vuex getter `filteredSource(surfaceId, sourceName)` that applies all active filters for that source and returns the filtered rows.

### Phase 2: Filter components

**Files to modify:**
- `src/client/components/A2UISelect.vue` — detect `bind` in `def`, on change commit `a2ui/setFilter` instead of (or in addition to) WS send.
- `src/client/components/A2UISlider.vue` — same pattern.
- `src/client/components/A2UICheckbox.vue` — same pattern, with toggle semantics.

**New file:**
- `src/client/components/A2UITextInput.vue` — text search filter with debounce (300ms).

Register `TextInput` in `A2UINode.vue`'s `componentMap`.

Shared logic extracted to a composable:
- `src/client/composables/useFilterBind.ts`

```ts
export function useFilterBind(props: { def: object; componentId: string; surfaceId: string }) {
  const store = useStore()
  const bind = computed(() => (props.def as any).bind as FilterBind | undefined)

  function updateFilter(value: unknown) {
    if (!bind.value) return
    const sources = Array.isArray(bind.value.source) ? bind.value.source : [bind.value.source]
    const nullValue = bind.value.nullValue ?? ''
    for (const source of sources) {
      store.commit('a2ui/setFilter', {
        surfaceId: props.surfaceId,
        source,
        field: bind.value.field,
        op: bind.value.op ?? 'eq',
        value,
        nullValue,
        isNull: value === nullValue,
        componentId: props.componentId,
      })
    }
  }

  function maybeEmit(value: unknown) {
    const emitTo = (props.def as any).emitTo ?? bind.value?.emitTo
    if (emitTo) {
      const url = emitTo.replace(/\{\{value\}\}/g, encodeURIComponent(String(value)))
      executeDeepLink(parseOpenclawUrl(url)!)
    }
  }

  return { bind, updateFilter, maybeEmit }
}
```

### Phase 3: Display component binding

**Files to modify:**
- `src/client/components/A2UITable.vue` — when `dataSource` is present, use `filteredSource` getter instead of static `headers`/`rows`.
- `src/client/components/A2UIProgressBar.vue` — support `dataSource` + `aggregate` + `map`.
- `src/client/components/A2UIBadge.vue` — support `dataSource` + `map` + `rowIndex`.
- `src/client/components/A2UIText.vue` — support `dataSource` + `aggregate` + `map`.

Shared composable:
- `src/client/composables/useDataSource.ts`

```ts
export function useDataSource(props: { def: object; surfaceId: string }) {
  const store = useStore()
  const binding = computed(() => (props.def as any).dataSource as DataSourceBinding | undefined)

  const filteredRows = computed(() => {
    if (!binding.value) return null
    return store.getters['a2ui/filteredSource'](props.surfaceId, binding.value.source)
  })

  const aggregatedValue = computed(() => {
    if (!binding.value?.aggregate || !filteredRows.value) return null
    return computeAggregate(binding.value.aggregate, filteredRows.value)
  })

  const mappedProps = computed(() => {
    // resolve map: { propName: fieldOrSpecial } against filteredRows/aggregatedValue
  })

  return { filteredRows, aggregatedValue, mappedProps, binding }
}
```

### Phase 4: Repeat component

**New file:**
- `src/client/components/A2UIRepeat.vue`

Iterates `filteredRows`, resolves `{{field}}` placeholders in template components, renders each row as a virtual subtree using `A2UINode`-like rendering but with inline component defs (not store-registered).

Register in `A2UINode.vue` componentMap.

### Phase 5: Server-side passthrough

The server needs no logic changes — `$sources` is just data inside `dataModel`, which already flows through `updateDataModel` → SQLite → WS broadcast → Vuex. The server is a dumb pipe for this feature.

One addition:
- `src/server/commands/a2ui.ts` — add a `dataSourcePush` JSONL command as syntactic sugar (optional, maps to `dataModelUpdate` with `$sources`).

### Phase 6: surfaceId propagation

`A2UINode.vue` already passes `surfaceId` to all child components via the template:
```html
<component :is="resolvedComponent" :def="componentDef" :component-id="componentId" :surface-id="surfaceId" />
```

However, **leaf components that currently ignore `surfaceId` must declare it as a prop** for the binding composables to work. Currently missing from:
- `A2UISelect.vue` — only has `def`, `componentId`
- `A2UIButton.vue` — only has `def`, `componentId`
- `A2UIProgressBar.vue` — only has `def`
- `A2UIBadge.vue` — only has `def`
- `A2UIText.vue` — only has `def`
- `A2UITable.vue` — only has `def`

**Action**: Add `surfaceId: { type: String, required: true }` to the `props` of all six components. Also add `componentId: { type: String, required: true }` where missing (ProgressBar, Badge, Text, Table) — needed for filter composable's `componentId` parameter.

Vue currently silently drops the unrecognized prop as a fallthrough attr, so this is a non-breaking change — just making explicit what was implicit.

---

## 7. Filtering Logic

Centralized in a pure function:

```ts
function applyFilters(rows: Row[], filters: FieldFilter[]): Row[] {
  const active = filters.filter(f => !f.isNull)  // skip inactive (nullValue) filters
  if (active.length === 0) return rows
  return rows.filter(row => active.every(f => matchFilter(row, f)))
}

function matchFilter(row: Row, f: FieldFilter): boolean {
  const val = row[f.field]
  switch (f.op) {
    case 'eq':       return val === f.value
    case 'contains': return String(val).toLowerCase().includes(String(f.value).toLowerCase())
    case 'gte':      return Number(val) >= Number(f.value)
    case 'lte':      return Number(val) <= Number(f.value)
    case 'range':    return Number(val) >= (f.value as [number,number])[0] && Number(val) <= (f.value as [number,number])[1]
    case 'in':       return (f.value as unknown[]).includes(val)
  }
}
```

The `isNull` flag is set by the store when the filter value equals the bind's `nullValue` (default `""`). This replaces the previous approach of checking `f.value === ''` inside `matchFilter` for `eq` — that was fragile and didn't generalize to other ops or non-empty passthrough values like `"all"`.

Multiple filters on the same source are AND-ed. Multiple filters on the same field are AND-ed (allows range via separate gte + lte).

---

## 8. Edge Cases

| Case | Behavior |
|---|---|
| **Empty data source** | Display components show empty state (empty table, 0 progress, blank text). No errors. |
| **No matching filters** | `filteredRows` returns `[]`. Components render empty. |
| **Filter on nonexistent field** | Filter is a no-op (always passes). Log a console warning. |
| **Multiple data sources** | Each source is independent. Filters are scoped to their declared `source`. A display component binds to one source. |
| **One filter → multiple sources** | When `bind.source` is an array, the filter is applied independently to each source. E.g., agent Select filters both `agents` and `crons` sources. |
| **nullValue passthrough** | When a filter's current value equals its `nullValue` (default `""`), the filter is inactive. Supports non-empty passthroughs like `"all"`. |
| **Chained filters** | Multiple filters on the same source compose naturally (AND). No explicit chaining syntax needed. |
| **Source updated while filters active** | Vuex reactivity handles this — `filteredRows` recomputes when either `sources` or `filters` change. |
| **Backward compatibility** | Components without `dataSource` or `bind` work exactly as before. Static `headers`/`rows` on Table still work. |
| **Missing `$sources`** | `dataModel` without `$sources` is unchanged behavior. |
| **Repeat with 0 rows** | Renders nothing. Optional `emptyText` prop on Repeat for a fallback message. |
| **Large datasets** | For >1000 rows, consider adding pagination props to Table. Filtering is O(n×m) where m = filter count — acceptable for typical dashboard sizes (<10k rows). |

---

## 9. Agent Push Protocol Summary

| JSONL command | Purpose |
|---|---|
| `{ "dataModelUpdate": { "surfaceId": "...", "data": { "$sources": { ... } } } }` | Push/replace data sources |
| `{ "dataModelUpdate": { "surfaceId": "...", "data": { "$sources": { "tasks": { "rows": [...], "merge": true } } } } }` | Incremental upsert |
| `{ "surfaceUpdate": { ... } }` | Push components with `bind` / `dataSource` props (unchanged wire format) |

No new JSONL commands required. Everything flows through existing `dataModelUpdate` and `surfaceUpdate`.

---

## 10. File Change Summary

| File | Change |
|---|---|
| `src/client/store/a2ui.ts` | Add `sources`, `filters` to state; `setFilter`, `clearFilters` mutations; `filteredSource` getter |
| `src/client/composables/useFilterBind.ts` | **New** — shared filter binding logic |
| `src/client/composables/useDataSource.ts` | **New** — shared data source + aggregate logic |
| `src/client/components/A2UISelect.vue` | Add `surfaceId` prop; add `bind` support via `useFilterBind` |
| `src/client/components/A2UISlider.vue` | Add `bind` support via `useFilterBind` |
| `src/client/components/A2UICheckbox.vue` | Add `bind` support via `useFilterBind` |
| `src/client/components/A2UITextInput.vue` | **New** — text search filter component |
| `src/client/components/A2UIRepeat.vue` | **New** — iteration/repeat component |
| `src/client/components/A2UITable.vue` | Add `surfaceId`, `componentId` props; add `dataSource` support via `useDataSource` |
| `src/client/components/A2UIProgressBar.vue` | Add `surfaceId`, `componentId` props; add `dataSource` + aggregate support |
| `src/client/components/A2UIBadge.vue` | Add `surfaceId`, `componentId` props; add `dataSource` + map support |
| `src/client/components/A2UIText.vue` | Add `surfaceId`, `componentId` props; add `dataSource` + aggregate + map support |
| `src/client/components/A2UIButton.vue` | Add `surfaceId` prop; add optional `emitTo` deep link support |
| `src/client/components/A2UINode.vue` | Register `TextInput`, `Repeat` in componentMap; pass `surfaceId` to all children |
| `src/client/services/filter-engine.ts` | **New** — pure `applyFilters` / `matchFilter` / `computeAggregate` functions |

---

## 11. Dashboard Case Study — OpenClaw Agent Dashboard

This section shows how the current OpenClaw dashboard (surfaceId `"main"`) would be restructured to use reactive data bindings. The current dashboard has these components:

- A title row with an agent filter Select (uses `"all"` as passthrough, not `""`)
- Stat badges showing hardcoded counts ("6", "20", "175.3K", "3 (1 error)")
- An agents table with static `headers`/`rows`
- Per-agent ProgressBars (pb-main, pb-expert, pb-dev, pb-editor, pb-media, pb-gw)
- A cron jobs table with static `headers`/`rows`

### 11.1 Problems with the current approach

1. **All data is static** — the agent must re-push the entire surface to update any value
2. **Filter Select uses `"all"` as passthrough** — the plan's original `eq` filter assumed `""` means no filter
3. **One Select must filter two tables** — the agent filter should filter both agents-table and cron-table
4. **ProgressBars are per-agent** — hardcoded IDs (pb-main, pb-expert, etc.) that must be manually managed
5. **Stat badges are hardcoded strings** — should be computed aggregates over the data
6. **No surfaceId prop** on Select/Button — composables can't scope filters

### 11.2 Data sources

The agent pushes data once via `dataModelUpdate`:

```jsonc
{
  "dataModelUpdate": {
    "surfaceId": "main",
    "data": {
      "$sources": {
        "agents": {
          "fields": ["agent", "sessions", "tokens", "tokensRaw", "model", "status"],
          "primaryKey": "agent",
          "rows": [
            { "agent": "main",             "sessions": 8, "tokens": "32.3K", "tokensRaw": 32300,  "model": "auto",            "status": "idle" },
            { "agent": "openclaw-expert",   "sessions": 5, "tokens": "1.7K",  "tokensRaw": 1700,   "model": "auto",            "status": "active" },
            { "agent": "developer",         "sessions": 4, "tokens": "6.8K",  "tokensRaw": 6800,   "model": "auto",            "status": "idle" },
            { "agent": "editor",            "sessions": 1, "tokens": "17.2K", "tokensRaw": 17200,  "model": "auto",            "status": "idle" },
            { "agent": "media",             "sessions": 1, "tokens": "21.6K", "tokensRaw": 21600,  "model": "auto",            "status": "idle" },
            { "agent": "guild-wars",        "sessions": 1, "tokens": "95.6K", "tokensRaw": 95600,  "model": "gemini-2.5-pro",  "status": "idle" }
          ]
        },
        "crons": {
          "fields": ["name", "agent", "schedule", "status"],
          "primaryKey": "name",
          "rows": [
            { "name": "Daily Discord Cleanup", "agent": "main",             "schedule": "0 0 * * * CT", "status": "⚠ timed out" },
            { "name": "Rate Limit Log Check",  "agent": "openclaw-expert",  "schedule": "0 8 * * * CT", "status": "✓ ok" },
            { "name": "Daily Briefing",         "agent": "openclaw-expert",  "schedule": "0 9 * * * CT", "status": "✓ ok" }
          ]
        }
      }
    }
  }
}
```

Notes:
- `tokensRaw` is the numeric value for ProgressBar computation; `tokens` is the display string
- Both sources share an `agent` field — the filter Select targets both via `source: ["agents", "crons"]`

### 11.3 Full component tree (JSONL)

Each line below is a separate `a2ui_push` JSONL command. Component IDs are on the left.

```jsonc
// --- Layout root ---
{"root": {"Column": {"children": {"explicitList": ["title-row", "filter-row", "div1", "stats-row", "div2", "agents-header", "agents-table", "tokens-header", "token-bars", "div3", "cron-header", "cron-table", "div4", "footer"]}}}}

// --- Title ---
{"title-row": {"Row": {"children": {"explicitList": ["title"]}}}}
{"title": {"Text": {"text": {"literalString": "OpenClaw Dashboard"}, "usageHint": "h1"}}}

// --- Filter row ---
{"filter-row": {"Row": {"children": {"explicitList": ["filter-select", "filter-spacer", "version"]}}}}
{"filter-select": {"Select": {"options": [{"label": "All Agents", "value": "all"}, {"label": "main", "value": "main"}, {"label": "openclaw-expert", "value": "openclaw-expert"}, {"label": "developer", "value": "developer"}, {"label": "editor", "value": "editor"}, {"label": "media", "value": "media"}, {"label": "guild-wars", "value": "guild-wars"}], "selected": "all", "bind": {"source": ["agents", "crons"], "field": "agent", "op": "eq", "nullValue": "all"}}}}
{"filter-spacer": {"Spacer": {}}}
{"version": {"Text": {"text": {"literalString": "v2026.3.11"}, "usageHint": "label"}}}

// --- Dividers ---
{"div1": {"Divider": {}}}
{"div2": {"Divider": {}}}
{"div3": {"Divider": {}}}
{"div4": {"Divider": {}}}

// --- Stats row (aggregates over filtered data) ---
{"stats-row": {"Row": {"children": {"explicitList": ["stat-agents-col", "stat-sessions-col", "stat-tokens-col", "stat-cron-col"]}}}}

{"stat-agents-col": {"Column": {"children": {"explicitList": ["stat-agents-label", "stat-agents-badge"]}}}}
{"stat-agents-label": {"Text": {"text": {"literalString": "AGENTS"}, "usageHint": "label"}}}
{"stat-agents-badge": {"Badge": {"variant": "info", "dataSource": {"source": "agents", "aggregate": {"fn": "count"}}, "map": {"text": "$value"}}}}

{"stat-sessions-col": {"Column": {"children": {"explicitList": ["stat-sessions-label", "stat-sessions-badge"]}}}}
{"stat-sessions-label": {"Text": {"text": {"literalString": "ACTIVE SESSIONS"}, "usageHint": "label"}}}
{"stat-sessions-badge": {"Badge": {"variant": "success", "dataSource": {"source": "agents", "aggregate": {"fn": "sum", "field": "sessions"}}, "map": {"text": "$value"}}}}

{"stat-tokens-col": {"Column": {"children": {"explicitList": ["stat-tokens-label", "stat-tokens-badge"]}}}}
{"stat-tokens-label": {"Text": {"text": {"literalString": "TOTAL TOKENS"}, "usageHint": "label"}}}
{"stat-tokens-badge": {"Badge": {"variant": "info", "dataSource": {"source": "agents", "aggregate": {"fn": "sum", "field": "tokensRaw"}, "format": "{{$value | compact}}"}, "map": {"text": "$value"}}}}

{"stat-cron-col": {"Column": {"children": {"explicitList": ["stat-cron-label", "stat-cron-badge"]}}}}
{"stat-cron-label": {"Text": {"text": {"literalString": "CRON JOBS"}, "usageHint": "label"}}}
{"stat-cron-badge": {"Badge": {"variant": "warning", "dataSource": {"source": "crons", "aggregate": {"fn": "count"}, "errorCount": {"fn": "count", "where": {"field": "status", "op": "contains", "value": "⚠"}}}, "map": {"text": "{{$value}} ({{$errorCount}} error)"}}}}

// --- Agents table (bound to "agents" source, auto-filtered) ---
{"agents-header": {"Text": {"text": {"literalString": "Agent Sessions"}, "usageHint": "h3"}}}
{"agents-table": {"Table": {"dataSource": {"source": "agents", "columns": ["agent", "sessions", "tokens", "model", "status"]}}}}

// --- Token usage bars (Repeat over filtered "agents" source) ---
{"tokens-header": {"Text": {"text": {"literalString": "Token Usage"}, "usageHint": "label"}}}
{"token-bars": {"Repeat": {"dataSource": {"source": "agents"}, "template": {"ProgressBar": {"value": "{{tokensRaw | pctOfMax}}", "label": "{{agent}} — {{tokens}}"}}, "transforms": {"pctOfMax": {"fn": "percentOfMax", "field": "tokensRaw"}}}}}

// --- Cron table (bound to "crons" source, auto-filtered by same Select) ---
{"cron-header": {"Text": {"text": {"literalString": "Cron Jobs"}, "usageHint": "h3"}}}
{"cron-table": {"Table": {"dataSource": {"source": "crons"}}}}

// --- Footer ---
{"footer": {"Text": {"text": {"literalString": "Generated by OpenTawd · A2UI surface · v2026.3.11"}, "usageHint": "label"}}}
```

### 11.4 How each issue is resolved

| # | Issue | Resolution |
|---|---|---|
| 1 | Select uses `"all"` as passthrough | `bind.nullValue: "all"` — filter is inactive when value equals nullValue |
| 2 | One Select → two data sources | `bind.source: ["agents", "crons"]` — filter applied to both independently |
| 3 | ProgressBars are per-agent | Replaced 6 hardcoded `pb-*` components with one `Repeat` over `agents` source |
| 4 | Stat badges are hardcoded | Each Badge uses `dataSource.aggregate` to compute count/sum over filtered rows |
| 5 | Select/Button missing surfaceId | All leaf components get `surfaceId` + `componentId` props (Phase 6) |
| 6 | dataModel field unused | `$sources` key inside dataModel stores the reactive data sources |

### 11.5 Reactive flow walkthrough

**Initial render (Select = "all"):**
1. Agent pushes `dataModelUpdate` with `$sources.agents` (6 rows) and `$sources.crons` (3 rows)
2. Agent pushes `surfaceUpdate` with the component tree above
3. `filter-select` has `bind.nullValue: "all"` and `selected: "all"` → filter is inactive
4. `agents-table` renders all 6 rows from `filteredSource("main", "agents")`
5. `token-bars` Repeat iterates all 6 agents, rendering a ProgressBar per row
6. `stat-agents-badge` shows `count(agents)` = 6
7. `stat-sessions-badge` shows `sum(agents.sessions)` = 20
8. `stat-tokens-badge` shows `sum(agents.tokensRaw)` = 175,300 → formatted as "175.3K"
9. `stat-cron-badge` shows `count(crons)` = 3, error count = 1 → "3 (1 error)"
10. `cron-table` renders all 3 rows from `filteredSource("main", "crons")`

**User selects "openclaw-expert":**
1. Select onChange → `useFilterBind.updateFilter("openclaw-expert")`
2. Commits `a2ui/setFilter` for source `"agents"` AND source `"crons"` (because `source` is an array)
3. Both filters: `{ field: "agent", op: "eq", value: "openclaw-expert", isNull: false }`
4. `filteredSource("main", "agents")` → 1 row (openclaw-expert)
5. `filteredSource("main", "crons")` → 2 rows (Rate Limit Log Check, Daily Briefing)
6. `agents-table` re-renders with 1 row
7. `token-bars` Repeat renders 1 ProgressBar
8. `stat-agents-badge` → 1, `stat-sessions-badge` → 5, `stat-tokens-badge` → "1.7K"
9. `stat-cron-badge` → "2 (0 error)" (variant could auto-switch to "success" via conditional)
10. `cron-table` re-renders with 2 rows
11. Zero WebSocket messages sent — entirely client-side

**Agent pushes incremental update (openclaw-expert goes active → idle):**
```jsonc
{"dataModelUpdate": {"surfaceId": "main", "data": {"$sources": {"agents": {"rows": [{"agent": "openclaw-expert", "status": "idle"}], "merge": true}}}}}
```
1. Vuex upserts the row by `primaryKey: "agent"`
2. All computed properties depending on `agents` source recompute
3. Table cell updates, stats recalculate — no full surface re-push needed

### 11.6 Aggregate formatting

The `stat-tokens-badge` needs to display `175300` as `"175.3K"`. Two approaches:

**Option A — `format` transform on the aggregate (recommended):**
```jsonc
"dataSource": { "source": "agents", "aggregate": { "fn": "sum", "field": "tokensRaw" }, "format": "compact" }
```
The `useDataSource` composable applies a formatter after aggregation. Built-in formatters:
- `"compact"` — 175300 → "175.3K", 1200000 → "1.2M"
- `"percent"` — 0.856 → "85.6%"
- `"fixed:N"` — fixed decimal places

**Option B — keep a display field in the data:**
The agent pre-computes `tokens: "175.3K"` alongside `tokensRaw: 175300`. The badge uses a non-aggregate binding with `map: { "text": "tokens" }` and `rowIndex: 0`. Less elegant for filtered aggregates but simpler.

For the dashboard, Option A is preferred because the stat badges must recompute when the filter changes.

### 11.7 Repeat transforms

The `token-bars` Repeat uses `{{tokensRaw | pctOfMax}}` to compute each bar's percentage relative to the max token count in the filtered set. This is a built-in Repeat transform:

```ts
// Built-in transforms for Repeat
const builtinTransforms: Record<string, (rows: Row[], field: string, row: Row) => number> = {
  percentOfMax(rows, field, row) {
    const max = Math.max(...rows.map(r => Number(r[field]) || 0))
    return max === 0 ? 0 : (Number(row[field]) / max) * 100
  },
}
```

When `transforms.pctOfMax` references `{ fn: "percentOfMax", field: "tokensRaw" }`, the Repeat component calls `percentOfMax(filteredRows, "tokensRaw", currentRow)` for each iteration, producing the percentage value for the ProgressBar.

### 11.8 Cron badge error count — compound aggregate

The `stat-cron-badge` needs to show both total count AND error count. This requires a compound aggregate:

```jsonc
"dataSource": {
  "source": "crons",
  "aggregates": {
    "$value": { "fn": "count" },
    "$errorCount": { "fn": "count", "where": { "field": "status", "op": "contains", "value": "⚠" } }
  }
}
```

The `map` template `"{{$value}} ({{$errorCount}} error)"` interpolates both aggregate results. The `where` clause on an aggregate pre-filters rows before counting — this is a sub-filter that doesn't affect other components.

Implementation in `useDataSource`:
```ts
const aggregatedValues = computed(() => {
  if (!binding.value?.aggregates) return null
  const rows = filteredRows.value ?? []
  const result: Record<string, unknown> = {}
  for (const [key, spec] of Object.entries(binding.value.aggregates)) {
    const filtered = spec.where ? rows.filter(r => matchFilter(r, spec.where)) : rows
    result[key] = computeAggregate({ fn: spec.fn, field: spec.field }, filtered)
  }
  return result
})
```

### 11.9 Migration path from current dashboard

The current dashboard can be migrated incrementally:

1. **Phase A**: Add `surfaceId` and `componentId` props to all leaf components (non-breaking)
2. **Phase B**: Implement `$sources` parsing in Vuex store + `filteredSource` getter
3. **Phase C**: Add `bind` to Select — the existing `a2ui.selectChange` WS event still fires alongside the local filter
4. **Phase D**: Add `dataSource` to Table — falls back to static `headers`/`rows` when absent
5. **Phase E**: Add `dataSource` + `aggregate` to Badge — falls back to static `text` when absent
6. **Phase F**: Implement Repeat component, replace hardcoded `pb-*` ProgressBars
7. **Phase G**: Agent code updated to push `dataModelUpdate` with `$sources` instead of baking data into component defs

Each phase is independently deployable. The dashboard works in mixed mode (some components static, some data-bound) throughout the migration.