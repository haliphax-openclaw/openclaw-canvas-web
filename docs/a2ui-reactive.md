# A2UI Reactive Data Binding Guide

The A2UI reactive layer lets agents push structured data sources to the canvas and bind UI components to that data. Filters, aggregates, and repeating templates update automatically as data or selections change.

## Data Sources

A data source is a named collection of rows with typed fields, stored in the Vuex A2UI store per surface.

### Schema

```ts
interface DataSource {
  fields: string[]                    // column/field names
  rows: Record<string, unknown>[]     // array of row objects
  primaryKey?: string                 // optional key field for incremental merges
}
```

### Pushing data via `dataModelUpdate`

Include a `$sources` key inside the `data` object of a `dataModelUpdate` JSONL command. The `$sources` key is extracted and stored separately from the regular data model.

```jsonl
{"dataModelUpdate": {"surfaceId": "dash", "data": {"$sources": {"users": {"fields": ["id", "name", "role"], "rows": [{"id": "1", "name": "Alice", "role": "admin"}, {"id": "2", "name": "Bob", "role": "viewer"}], "primaryKey": "id"}}}}}
```

You can mix regular data model keys alongside `$sources` in the same `dataModelUpdate`:

```jsonl
{"dataModelUpdate": {"surfaceId": "dash", "data": {"title": "Dashboard", "$sources": {"users": {"fields": ["id", "name"], "rows": []}}}}}
```

### Pushing data via `dataSourcePush` shorthand

The `dataSourcePush` JSONL command is a convenience wrapper that sends sources without needing to nest them under `$sources`. Internally it wraps the payload as `{ $sources: ... }` and calls `updateDataModel`.

```jsonl
{"dataSourcePush": {"surfaceId": "dash", "sources": {"users": {"fields": ["id", "name", "role"], "rows": [{"id": "1", "name": "Alice", "role": "admin"}], "primaryKey": "id"}}}}
```

### Incremental updates with merge

When a `dataModelUpdate` is sent with `merge: true` and the data source has a `primaryKey`, existing rows are updated by primary key and new rows are appended. Rows not present in the update are preserved.

```jsonl
{"dataModelUpdate": {"surfaceId": "dash", "merge": true, "data": {"$sources": {"users": {"rows": [{"id": "1", "name": "Alice Updated", "role": "admin"}, {"id": "3", "name": "Charlie", "role": "editor"}]}}}}}
```

After this merge, the `users` source contains rows for ids 1 (updated), 2 (unchanged), and 3 (new).

---

## Filtering

Filters are driven by interactive components (Select, MultiSelect) via the `bind` property. When a user changes a selection, the bound filter is applied to one or more data sources, and all components reading from those sources update reactively.

### FilterBind schema

```ts
interface FilterBind {
  source: string | string[]   // data source name(s) to filter
  field: string               // field name to filter on
  op?: string                 // filter operation (default: "eq")
  nullValue?: unknown         // value that means "no filter" / show all
  emitTo?: string             // optional deep link URL to emit on change
}
```

### Supported filter operations

| Operation | Description | Value type |
|-----------|-------------|------------|
| `eq` | Exact equality (default) | `string \| number` |
| `contains` | Case-insensitive substring match | `string` |
| `gte` | Greater than or equal | `number` |
| `lte` | Less than or equal | `number` |
| `range` | Value falls within `[lo, hi]` | `[number, number]` |
| `in` | Value is in the provided array | `unknown[]` |

### Example: Select with filter binding

```jsonl
{"surfaceUpdate": {"surfaceId": "dash", "components": [{"id": "role-filter", "component": {"Select": {"options": [{"label": "All Roles", "value": ""}, {"label": "Admin", "value": "admin"}, {"label": "Viewer", "value": "viewer"}], "selected": "", "bind": {"source": "users", "field": "role", "op": "eq", "nullValue": ""}}}}]}}
```

When the user selects "Admin", only rows where `role === "admin"` pass through. When "All Roles" is selected (value `""`), the filter is inactive because the value matches `nullValue`.

### nullValue concept

`nullValue` defines the "no filter" sentinel. When the current selection equals `nullValue`, the filter is marked as null (`isNull: true`) and excluded from filtering — all rows pass through.

For MultiSelect, `nullValue` can be an array. The comparison checks array equality (same length, same elements in order):

```json
{
  "bind": {
    "source": "users",
    "field": "role",
    "op": "in",
    "nullValue": ["admin", "viewer", "editor"]
  }
}
```

When all options are selected (matching the `nullValue` array), the filter is inactive.

**Empty selection:** When a MultiSelect has no options selected (empty array), the filter is also treated as inactive — all rows pass through. This ensures that clearing a MultiSelect shows all data rather than hiding everything.

### Multi-source filtering

A single filter component can target multiple data sources by providing an array of source names:

```json
{
  "bind": {
    "source": ["users", "audit_log"],
    "field": "role",
    "op": "eq",
    "nullValue": ""
  }
}
```

The filter is applied independently to each named source. Any component bound to either `users` or `audit_log` will reactively update.

---

## Display Binding

Components like Table, Badge, and Text can bind to a data source for dynamic display using the `dataSource` prop.

### DataSourceBinding schema

```ts
interface DataSourceBinding {
  source: string                          // data source name
  columns?: string[]                      // (Table) which columns to display
  aggregate?: {                           // single aggregate
    fn: 'count' | 'sum' | 'avg' | 'min' | 'max'
    field?: string                        // required for sum/avg/min/max
    format?: 'compact'                    // optional compact number formatting
  }
  aggregates?: Record<string, {           // named compound aggregates
    fn: 'count' | 'sum' | 'avg' | 'min' | 'max'
    field?: string
    format?: 'compact'
    where?: { field: string; op: string; value: unknown }
  }>
  map?: Record<string, string>            // map aggregate results to component props
}
```

### Aggregates

A single `aggregate` computes one value from the filtered rows:

```json
{
  "dataSource": {
    "source": "orders",
    "aggregate": { "fn": "sum", "field": "total", "format": "compact" }
  }
}
```

- `count` — number of rows (no `field` needed)
- `sum` — sum of numeric field values
- `avg` — average of numeric field values
- `min` / `max` — minimum / maximum of numeric field values

### Compound aggregates

Multiple named aggregates can be computed with optional `where` clauses for inline filtering:

```json
{
  "dataSource": {
    "source": "orders",
    "aggregates": {
      "$total": { "fn": "sum", "field": "amount", "format": "compact" },
      "$pending": { "fn": "count", "where": { "field": "status", "op": "eq", "value": "pending" } }
    },
    "map": { "text": "Total: {{$total}} ({{$pending}} pending)" }
  }
}
```

### Map syntax

The `map` property maps computed values to component props:

- `{ "text": "$value" }` — maps the single `aggregate` result to the `text` prop
- `{ "text": "{{$total}}" }` — interpolates named compound aggregate keys
- `{ "text": "fieldName" }` — maps a field from the first filtered row to the `text` prop

### Compact number formatting

When `format: "compact"` is set on an aggregate, large numbers are shortened:

| Value | Formatted |
|-------|-----------|
| 1,234 | 1.2K |
| 1,234,567 | 1.2M |
| 999 | 999 |

---

## Repeat Component

The Repeat component iterates over filtered data source rows and renders a template component for each row.

### Basic usage

```jsonl
{"surfaceUpdate": {"surfaceId": "dash", "components": [{"id": "user-list", "component": {"Repeat": {"dataSource": {"source": "users"}, "template": {"Text": {"text": "{{name}} ({{role}})"}}, "emptyText": "No users found"}}}]}}
```

### Template syntax

Templates use `{{field}}` placeholders that are resolved against each row:

```json
{
  "template": {
    "ProgressBar": {
      "label": "{{name}}: {{score}} pts",
      "value": "{{score | percentOfMax}}"
    }
  }
}
```

Placeholders are resolved recursively through all string values in the template definition, including nested objects and arrays.

### Transforms

Transforms modify field values using the `{{field | transformName}}` pipe syntax.

Built-in transforms:

| Transform | Description |
|-----------|-------------|
| `percentOfMax` | Converts the value to a percentage of the maximum value for that field across all rows |

Transforms are defined in the `transforms` property:

```json
{
  "Repeat": {
    "dataSource": { "source": "scores" },
    "transforms": {
      "percentOfMax": { "fn": "percentOfMax" }
    },
    "template": {
      "ProgressBar": {
        "label": "{{name}}",
        "value": "{{score | percentOfMax}}"
      }
    }
  }
}
```

The `percentOfMax` transform optionally accepts a `field` override. If omitted, it uses the field from the placeholder.

### Empty state

When the filtered data source has no rows, the `emptyText` string is displayed instead of the template:

```json
{ "Repeat": { "dataSource": { "source": "results" }, "template": { "Text": { "text": "{{name}}" } }, "emptyText": "No results match your filters" } }
```

### Supported template components

The Repeat component can render these component types as templates:
- `ProgressBar`
- `Text`
- `Badge`

---

## Components Reference

> For the full component reference (all props, layout components, containers, inputs), see [components.md](components.md). This section covers data binding specifics.

### Select

Single-selection dropdown. Sends `a2ui.selectChange` with `{ componentId, value }` on change.

| Prop | Type | Description |
|------|------|-------------|
| `options` | `{ label: string, value: string }[]` | Dropdown options |
| `selected` | `string` | Currently selected value |
| `bind` | `FilterBind` | Optional filter binding |
| `emitTo` | `string` | Optional deep link URL (supports `{{value}}` interpolation) |

```json
{"Select": {"options": [{"label": "All", "value": ""}, {"label": "Active", "value": "active"}], "selected": "", "bind": {"source": "items", "field": "status", "nullValue": ""}}}
```

### MultiSelect

Alias for Select with `multi: true` injected automatically. Renders a `<select multiple>` element. Sends `a2ui.selectChange` with `{ componentId, values }` (array) on change.

| Prop | Type | Description |
|------|------|-------------|
| `options` | `{ label: string, value: string }[]` | Dropdown options |
| `selected` | `string[]` | Currently selected values |
| `bind` | `FilterBind` | Optional filter binding (typically with `op: "in"`) |

```json
{"MultiSelect": {"options": [{"label": "Admin", "value": "admin"}, {"label": "Editor", "value": "editor"}, {"label": "Viewer", "value": "viewer"}], "selected": ["admin", "editor", "viewer"], "bind": {"source": "users", "field": "role", "op": "in", "nullValue": ["admin", "editor", "viewer"]}}}
```

In the component map (`A2UINode`), `MultiSelect` resolves to the same `A2UISelect` component but with `multi: true` merged into the definition.

### Table

Displays tabular data. Supports two modes:

**Static mode** — headers and rows provided directly:

```json
{"Table": {"headers": ["Name", "Role"], "rows": [["Alice", "Admin"], ["Bob", "Viewer"]]}}
```

**Data source mode** — bound to a filtered data source:

```json
{"Table": {"dataSource": {"source": "users", "columns": ["name", "role", "email"]}}}
```

| Prop | Type | Description |
|------|------|-------------|
| `headers` | `string[]` | Static column headers |
| `rows` | `unknown[][]` | Static row data |
| `dataSource` | `DataSourceBinding` | Bind to a data source |
| `sortable` | `boolean` | Enable click-to-sort on column headers |

When using `dataSource`, if `columns` is omitted, all keys from the first row are used as headers.

**Sorting:** When `sortable` is `true`, clicking a column header cycles through: unsorted → ascending (⬆) → descending (⬇) → unsorted. Only one column can be sorted at a time. Sorting operates on raw data values, not display-formatted strings.

```json
{"Table": {"dataSource": {"source": "runs", "columns": ["repo", "status", "duration"]}, "sortable": true}}
```

### Badge

Inline badge with variant styling. Supports static text or data source binding with aggregates.

**Static mode:**

```json
{"Badge": {"text": "Active", "variant": "success"}}
```

**Data source mode:**

```json
{"Badge": {"variant": "info", "dataSource": {"source": "users", "aggregate": {"fn": "count"}, "map": {"text": "$value"}}}}
```

| Prop | Type | Description |
|------|------|-------------|
| `text` | `string` | Static display text |
| `variant` | `string` | `success`, `warning`, `error`, or `info` (default) |
| `dataSource` | `DataSourceBinding` | Bind to a data source |

Display priority: `mappedProps.text` > `aggregatedValue` > static `text`.

### Text

Text display component. Renders as `<p>` by default, or as heading/span based on `usageHint`.

**Static mode:**

```json
{"Text": {"text": "Hello world", "usageHint": "h2"}}
```

**Data source mode:**

```json
{"Text": {"dataSource": {"source": "orders", "aggregate": {"fn": "sum", "field": "total", "format": "compact"}, "map": {"text": "$value"}}, "usageHint": "h1"}}
```

| Prop | Type | Description |
|------|------|-------------|
| `text` | `string \| { literalString: string }` | Static text content |
| `usageHint` | `string` | HTML tag hint: `h1`–`h6`, `body` (→ `<p>`), `label` (→ `<span>`) |
| `dataSource` | `DataSourceBinding` | Bind to a data source |

Display priority: `mappedProps.text` > `aggregatedValue` > static `text`.

### ProgressBar

Static progress bar. Commonly used inside Repeat templates for dynamic per-row rendering.

| Prop | Type | Description |
|------|------|-------------|
| `value` | `number` | Progress percentage (clamped 0–100) |
| `label` | `string` | Optional label above the bar |

```json
{"ProgressBar": {"label": "Upload progress", "value": 75}}
```

Inside a Repeat template with transforms:

```json
{"Repeat": {"dataSource": {"source": "scores"}, "transforms": {"percentOfMax": {"fn": "percentOfMax"}}, "template": {"ProgressBar": {"label": "{{name}}: {{score}}", "value": "{{score | percentOfMax}}"}}}}
```

### Repeat

Data-driven iteration component. Renders a template component for each row in a filtered data source.

| Prop | Type | Description |
|------|------|-------------|
| `dataSource` | `DataSourceBinding` | Data source to iterate over |
| `template` | `Record<string, object>` | Component template (e.g. `{ "Text": { "text": "{{field}}" } }`) |
| `transforms` | `Record<string, { fn: string, field?: string }>` | Named transform definitions |
| `emptyText` | `string` | Text shown when no rows match |
| `sortable` | `boolean` | Enable a sort direction dropdown above repeated content |
| `sortField` | `string` | Field name to sort by (required when `sortable` is `true`) |

**Sorting:** When `sortable` is `true`, a dropdown appears above the repeated content with options: "Unsorted" (default), "Ascending", and "Descending". The `sortField` prop specifies which field to sort by. Sorting operates on raw data values.

```json
{"Repeat": {"dataSource": {"source": "scores"}, "template": {"ProgressBar": {"label": "{{name}}", "value": "{{score | percentOfMax}}"}}, "sortable": true, "sortField": "score"}}
```

See the [Repeat Component](#repeat-component) section above for detailed usage.

### Accordion

Collapsible container with expandable/collapsible panels. Each panel has a clickable header that toggles visibility of its child component.

| Prop | Type | Description |
|------|------|-------------|
| `panels` | `{ title: string, child: string }[]` | Panel definitions — `title` is the header text, `child` is the component ID to render |
| `mode` | `string` | `"single"` (default) — one panel open at a time; `"multi"` — multiple panels can be open simultaneously |
| `expanded` | `number[]` | Optional array of panel indices to start expanded (default: all collapsed) |

**Single mode (default):**

```json
{"Accordion": {"panels": [{"title": "Section 1", "child": "section-1-content"}, {"title": "Section 2", "child": "section-2-content"}]}}
```

**Multi mode with initial expansion:**

```json
{"Accordion": {"panels": [{"title": "Details", "child": "details-content"}, {"title": "Settings", "child": "settings-content"}], "mode": "multi", "expanded": [0, 1]}}
```

Panel headers display ▶ when collapsed and ▼ when expanded. In `single` mode, opening a panel automatically closes any other open panel.

---

## Full Example

A complete dashboard with a data source, filter, table, and summary badges:

```jsonl
{"surfaceUpdate":{"surfaceId":"dash","components":[{"id":"root","component":{"Column":{"children":["title","filter-row","stats-row","user-table"]}}},{"id":"title","component":{"Text":{"text":"User Dashboard","usageHint":"h2"}}},{"id":"filter-row","component":{"Row":{"children":["role-filter","count-badge"]}}},{"id":"role-filter","component":{"Select":{"options":[{"label":"All Roles","value":""},{"label":"Admin","value":"admin"},{"label":"Viewer","value":"viewer"}],"selected":"","bind":{"source":"users","field":"role","op":"eq","nullValue":""}}}},{"id":"count-badge","component":{"Badge":{"variant":"info","dataSource":{"source":"users","aggregate":{"fn":"count"},"map":{"text":"$value"}}}}},{"id":"stats-row","component":{"Row":{"children":["total-badge"]}}},{"id":"total-badge","component":{"Badge":{"variant":"success","dataSource":{"source":"users","aggregate":{"fn":"count","format":"compact"},"map":{"text":"$value"}}}}},{"id":"user-table","component":{"Table":{"dataSource":{"source":"users","columns":["name","role","email"]}}}}]}}
{"dataSourcePush":{"surfaceId":"dash","sources":{"users":{"fields":["name","role","email"],"rows":[{"name":"Alice","role":"admin","email":"alice@example.com"},{"name":"Bob","role":"viewer","email":"bob@example.com"},{"name":"Charlie","role":"admin","email":"charlie@example.com"}],"primaryKey":"name"}}}}
{"beginRendering":{"surfaceId":"dash","root":"root"}}
```

This renders a dashboard where selecting a role filters the table and updates the count badge in real time.
