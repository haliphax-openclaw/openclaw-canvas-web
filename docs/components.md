# A2UI Component Reference

All components are defined in JSONL surface updates as `{"ComponentName": { ...props }}` and referenced by ID in the component tree.

## Layout Components

### Column

Vertical flex container. Renders children top-to-bottom with an 8px gap.

```json
{"Column": {"children": ["header", "content", "footer"]}}
```

| Prop | Type | Description |
|------|------|-------------|
| `children` | `string[]` | Ordered list of child component IDs |

### Row

Horizontal flex container. Renders children left-to-right with a 16px gap.

```json
{"Row": {"children": ["label", "input", "button"]}}
```

| Prop | Type | Description |
|------|------|-------------|
| `children` | `string[]` | Ordered list of child component IDs |

### Stack

Layered container. Children are positioned absolutely on top of each other (z-stacked).

```json
{"Stack": {"children": ["background", "overlay"]}}
```

| Prop | Type | Description |
|------|------|-------------|
| `children` | `string[]` | Ordered list of child component IDs (later items render on top) |

### Spacer

Flexible space filler. Expands to fill available space in a Row or Column (`flex: 1`). Takes no props.

```json
{"Spacer": {}}
```

### Divider

Horizontal rule. Renders a 1px border with 8px vertical margin. Takes no props.

```json
{"Divider": {}}
```

---

## Container Components

### Accordion

Collapsible container with expandable/collapsible panels. Each panel has a clickable header that toggles visibility of its child component.

```json
{"Accordion": {"panels": [{"title": "Section 1", "child": "section-1-content"}, {"title": "Section 2", "child": "section-2-content"}], "mode": "single", "expanded": [0]}}
```

| Prop | Type | Description |
|------|------|-------------|
| `panels` | `{ title: string, child: string }[]` | Panel definitions — `title` is the header text, `child` is the component ID to render |
| `mode` | `string` | `"single"` (default) — one panel open at a time; `"multi"` — multiple panels can be open simultaneously |
| `expanded` | `number[]` | Optional array of panel indices to start expanded (default: all collapsed) |

Panel headers display ▶ when collapsed and ▼ when expanded. In `single` mode, opening a panel automatically closes any other open panel. Both `mode` and `expanded` react to prop changes from surface updates, allowing agents to programmatically toggle panels.

### Tabs

Container that organizes child components into switchable tabbed panels.

```json
{"Tabs": {"tabs": [{"label": "Overview", "child": "overview-content"}, {"label": "Details", "child": "details-content"}], "active": 0, "position": "top", "height": "auto"}}
```

| Prop | Type | Description |
|------|------|-------------|
| `tabs` | `{ label: string, child: string }[]` | Tab definitions — `label` is the tab header text, `child` is the component ID to render |
| `active` | `number` | 0-based index of the initially active tab (default: `0`) |
| `position` | `string` | Tab bar placement: `"top"` (default), `"bottom"`, `"left"`, `"right"`, or `"hidden"` |
| `height` | `string` | Content panel height. `"auto"` (default) sizes to the tallest child; a CSS value (e.g. `"300px"`, `"50vh"`) sets a fixed height with `overflow: auto` |

When `height` is `"auto"`, all tab panels remain in the DOM (inactive panels use `visibility: hidden; position: absolute`) so the content area grows to accommodate the tallest child. When `position` is `"hidden"`, the tab bar is not rendered — useful when tab switching is driven programmatically via surface updates.

The `active` prop reacts to surface updates, allowing agents to switch tabs programmatically. Top/bottom tab bars wrap labels to the next line when they overflow. Left/right tab bars size to their widest label, capped at 33% of the viewport.

---

## Display Components

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

### Badge

Inline badge with variant styling. Supports static text or data source binding with aggregates.

**Static mode:**

```json
{"Badge": {"text": "Active", "variant": "success"}}
```

**Data source mode:**

```json
{"Badge": {"variant": "info", "dataSource": {"source": "users", "aggregate": {"fn": "count"}, "map": {"text": "{{$value}} users"}}}}
```

| Prop | Type | Description |
|------|------|-------------|
| `text` | `string` | Static display text |
| `variant` | `string` | `success`, `warning`, `error`, or `info` (default) |
| `dataSource` | `DataSourceBinding` | Bind to a data source |

Display priority: `mappedProps.text` > `aggregatedValue` > static `text`.

Map templates support `{{$value}}` for single aggregates and `{{$key}}` for compound aggregates:

```json
{"Badge": {"variant": "success", "dataSource": {"source": "runs", "aggregates": {"$count": {"fn": "count", "where": {"field": "status", "op": "eq", "value": "pass"}}}, "map": {"text": "✓ {{$count}}"}}}}
```

### Image

Displays an image. Supports `openclaw-canvas://` URLs for canvas-relative paths.

```json
{"Image": {"src": "openclaw-canvas://chart.png", "alt": "Sales chart"}}
```

| Prop | Type | Description |
|------|------|-------------|
| `src` | `string` | Image URL (supports `openclaw-canvas://` for canvas file references) |
| `alt` | `string` | Alt text for accessibility |

### ProgressBar

Static progress bar. Commonly used inside Repeat templates for dynamic per-row rendering.

```json
{"ProgressBar": {"label": "Upload progress", "value": 75}}
```

| Prop | Type | Description |
|------|------|-------------|
| `value` | `number` | Progress percentage (clamped 0–100) |
| `label` | `string` | Optional label above the bar |

Inside a Repeat template with transforms:

```json
{"Repeat": {"dataSource": {"source": "scores"}, "transforms": {"percentOfMax": {"fn": "percentOfMax"}}, "template": {"ProgressBar": {"label": "{{name}}: {{score}}", "value": "{{score | percentOfMax}}"}}}}
```

### Table

Displays tabular data with optional sorting. Scrolls horizontally when content exceeds viewport width.

**Static mode:**

```json
{"Table": {"headers": ["Name", "Role"], "rows": [["Alice", "Admin"], ["Bob", "Viewer"]]}}
```

**Data source mode:**

```json
{"Table": {"dataSource": {"source": "users", "columns": ["name", "role", "email"]}, "sortable": true}}
```

| Prop | Type | Description |
|------|------|-------------|
| `headers` | `string[]` | Static column headers |
| `rows` | `unknown[][]` | Static row data |
| `dataSource` | `DataSourceBinding` | Bind to a data source |
| `sortable` | `boolean` | Enable click-to-sort on column headers |

When using `dataSource`, if `columns` is omitted, all keys from the first row are used as headers. When all rows are filtered out, the table shows column headers with an empty body instead of disappearing.

**Sorting:** When `sortable` is `true`, clicking a column header cycles through: unsorted → ascending (⬆) → descending (⬇) → unsorted. Only one column can be sorted at a time. Sorting operates on raw data values, not display-formatted strings.

### Repeat

Data-driven iteration component. Renders a template component for each row in a filtered data source.

```json
{"Repeat": {"dataSource": {"source": "scores"}, "template": {"ProgressBar": {"label": "{{name}}", "value": "{{score | percentOfMax}}"}}, "sortable": true, "sortField": "score"}}
```

| Prop | Type | Description |
|------|------|-------------|
| `dataSource` | `DataSourceBinding` | Data source to iterate over |
| `template` | `Record<string, object>` | Component template with `{{field}}` placeholders |
| `transforms` | `Record<string, { fn: string, field?: string }>` | Named transform definitions |
| `emptyText` | `string` | Text shown when no rows match |
| `sortable` | `boolean` | Enable a sort direction dropdown above repeated content |
| `sortField` | `string` | Field name to sort by (required when `sortable` is `true`) |

**Sorting:** When `sortable` is `true`, a dropdown appears above the repeated content with options: "Unsorted" (default), "Ascending", and "Descending". Sorting operates on raw data values.

Repeated items are rendered with a 12px vertical gap between them.

#### Template syntax

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

#### Transforms

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

#### Empty state

When the filtered data source has no rows, the `emptyText` string is displayed instead of the template:

```json
{ "Repeat": { "dataSource": { "source": "results" }, "template": { "Text": { "text": "{{name}}" } }, "emptyText": "No results match your filters" } }
```

#### Supported template components

The Repeat component can render these component types as templates:
- `ProgressBar`
- `Text`
- `Badge`

---

## Input Components

### Button

Clickable button. Sends an `a2ui.buttonClick` WebSocket message with the component ID when clicked.

```json
{"Button": {"label": "Submit"}}
```

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Button text (also accepts `text`; falls back to `"Button"`) |

### Checkbox

Toggle checkbox with label. Sends an `a2ui.checkboxChange` WebSocket message with the component ID and checked state on change.

```json
{"Checkbox": {"label": "Enable notifications", "checked": true}}
```

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Label text displayed next to the checkbox |
| `checked` | `boolean` | Initial checked state (default: `false`) |

### Select

Dropdown select. Can bind to a data source for reactive filtering.

```json
{"Select": {"options": [{"label": "All", "value": ""}, {"label": "Active", "value": "active"}], "selected": "", "bind": {"source": "items", "field": "status", "op": "eq", "nullValue": ""}}}
```

| Prop | Type | Description |
|------|------|-------------|
| `options` | `{ label: string, value: string }[]` | Dropdown options |
| `selected` | `string` | Currently selected value |
| `bind` | `FilterBind` | Optional filter binding |

Sends `a2ui.selectChange` with `{ componentId, value }` on change.

### MultiSelect

Multi-selection dropdown. Alias for Select with `multi: true`. Renders a `<select multiple>` element.

```json
{"MultiSelect": {"options": [{"label": "Pass", "value": "pass"}, {"label": "Fail", "value": "fail"}], "selected": ["pass", "fail"], "bind": {"source": "runs", "field": "status", "op": "in", "nullValue": ["pass", "fail"]}}}
```

| Prop | Type | Description |
|------|------|-------------|
| `options` | `{ label: string, value: string }[]` | Dropdown options |
| `selected` | `string[]` | Currently selected values |
| `bind` | `FilterBind` | Optional filter binding (typically with `op: "in"`) |

Sends `a2ui.selectChange` with `{ componentId, values }` (array) on change.

**Empty selection:** When a MultiSelect has no options selected (empty array), the filter is treated as inactive — all rows pass through. This ensures clearing a MultiSelect shows all data rather than hiding everything.

The `bind.source` prop accepts an array to filter multiple data sources simultaneously:

```json
{"bind": {"source": ["runs", "health"], "field": "repo", "op": "in", "nullValue": ["repo1", "repo2"]}}
```

### Slider

Range slider input. Sends an `a2ui.sliderChange` WebSocket message with the component ID and value on change.

```json
{"Slider": {"label": "Volume", "min": 0, "max": 100, "value": 50}}
```

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Optional label above the slider |
| `min` | `number` | Minimum value (default: `0`) |
| `max` | `number` | Maximum value (default: `100`) |
| `value` | `number` | Current value (default: `0`) |

---

## Nesting

All container and layout components render children via `A2UINode`, which recursively resolves any component type from the surface's component map. Containers can be nested freely — a Column can contain Rows, which can contain Columns, Tabs, Accordions, etc.

## Data Source Binding

Components that support `dataSource` can bind to reactive data pushed via `dataSourcePush` or `dataModelUpdate`. See [a2ui-reactive.md](a2ui-reactive.md) for the full data binding guide, including filter operations, aggregates, transforms, and incremental merges.
