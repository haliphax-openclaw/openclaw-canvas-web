# Catalog Support Plan — openclaw-canvas-web

**Date:** 2026-03-19
**Status:** Draft
**Depends on:** a2ui-v09-upgrade (complete), theme-support-plan (in progress)

---

## 1. Summary

Enable third-party Vue 3 components to be installed via npm and served alongside the built-in A2UI components. External components are NOT loaded at runtime from external sites — they are installed on the server, discovered at startup, and bundled into the SPA as a unified app.

This aligns with the A2UI v0.9 catalog concept: a catalog is a named collection of components identified by a `catalogId` URI. Packages advertise component IDs — the server owns catalog membership and bundles components into catalogs based on local configuration.

Catalog namespace: `https://haliphax-openclaw.github.io/a2ui/`

### Default catalogs

| Catalog ID | Contents |
|---|---|
| `https://haliphax-openclaw.github.io/a2ui/1.0/basic` | The basic set of built-in components (maps to A2UI v0.9 basic catalog) |
| `https://haliphax-openclaw.github.io/a2ui/1.0/built-in` | All built-in components, including those outside the basic set |
| `https://haliphax-openclaw.github.io/a2ui/1.0/all` | Everything — all built-in + all installed third-party components |

### Architecture overview

```
┌─────────────────────────────────────────────────────┐
│  npm install @example/a2ui-charts                   │
│                                                     │
│  node_modules/@example/a2ui-charts/                 │
│    package.json  ← declares openclaw-canvas-web field   │
│    dist/                                            │
│      index.js    ← exports { components }           │
│      Chart.vue   ← Vue 3 SFC (pre-built)           │
└─────────────────────────────────────────────────────┘
         │
         ▼  server startup: scan node_modules
┌─────────────────────────────────────────────────────┐
│  Server: catalog-registry.ts                        │
│    discovers packages with openclaw-canvas-web field    │
│    loads component IDs into registry                │
│    assigns components to catalogs via server config │
│    generates virtual module for Vite                 │
└─────────────────────────────────────────────────────┘
         │
         ▼  Vite build / dev server
┌─────────────────────────────────────────────────────┐
│  Client: A2UINode.vue                               │
│    resolves component name → built-in OR catalog    │
│    catalogId on surface restricts available catalogs│
└─────────────────────────────────────────────────────┘
```

---

## 2. Package Extraction — `@openclaw-canvas-web/sdk`

External component authors need to import types and composables from the platform. Extract the following into a shared SDK package that lives in `packages/sdk/` (monorepo-style, published as `@openclaw-canvas-web/sdk`).

### 2.1 What to extract

| Current location | SDK export | Purpose |
|---|---|---|
| `src/client/store/a2ui.ts` → `A2UISurfaceState`, `DataSource`, `FieldFilter` | `@openclaw-canvas-web/sdk/types` | Store shape contracts so external components can type their store access |
| `src/client/composables/useDataSource.ts` | `@openclaw-canvas-web/sdk/composables` | Data binding — the primary way components read from data sources |
| `src/client/composables/useFilterBind.ts` | `@openclaw-canvas-web/sdk/composables` | Filter binding — how interactive components push filters to the store |
| `src/client/composables/useOptionsFrom.ts` | `@openclaw-canvas-web/sdk/composables` | Derived options from data sources |
| `src/client/composables/useSortable.ts` | `@openclaw-canvas-web/sdk/composables` | Client-side sorting |
| `src/client/services/filter-engine.ts` → `applyFilters`, `computeAggregate`, `formatCompact`, `FieldFilter`, `AggregateSpec` | `@openclaw-canvas-web/sdk/filters` | Filter/aggregate engine |
| `src/client/services/ws-client.ts` → `wsClient.send()` | `@openclaw-canvas-web/sdk/ws` | Send events back to server (button clicks, select changes, etc.) |
| Theme token definitions (from theme-support-plan) | `@openclaw-canvas-web/sdk/theme` | CSS custom property contract (`--a2ui-primary`, `--a2ui-text`, etc.) as documented constants |

### 2.2 What stays internal

- `A2UINode.vue`, `A2UIRenderer.vue` — platform internals
- Vuex store module registration — platform wiring
- WebSocket connection management — platform internal
- All server-side code

### 2.3 SDK package structure

```
packages/sdk/
  package.json          ← name: @openclaw-canvas-web/sdk
  src/
    types.ts            ← A2UISurfaceState, DataSource, FieldFilter, AggregateSpec, ComponentRegistration
    composables/
      useDataSource.ts
      useFilterBind.ts
      useOptionsFrom.ts
      useSortable.ts
    filters.ts          ← applyFilters, computeAggregate, formatCompact
    ws.ts               ← thin wrapper: sendEvent(type, payload)
    theme.ts            ← token name constants + CSS snippet generator
    index.ts            ← barrel export
  tsconfig.json
```

### 2.4 Internal codebase migration

After extraction, the main app imports from `@openclaw-canvas-web/sdk` instead of relative paths. This is a refactor — no behavior change. Use TypeScript path aliases during development so the monorepo resolves locally.

### 2.5 Component registration contract

External packages export a `PackageDefinition`:

```typescript
// @openclaw-canvas-web/sdk/types.ts
import type { Component } from 'vue'

export interface ComponentRegistration {
  /** The A2UI component type name (e.g. "Chart", "Map") */
  name: string
  /** The Vue 3 component implementation */
  component: Component
}

export interface PackageDefinition {
  /** Components provided by this package */
  components: ComponentRegistration[]
}
```

### 2.6 Component props contract

Every external component receives the same props as built-in components:

```typescript
// Standard A2UI component props
{
  def: Record<string, unknown>   // The component definition (all props from the JSONL)
  surfaceId: string              // The surface this component belongs to
  componentId: string            // This component's unique ID
}
```

Components use `useDataSource(props)`, `useFilterBind(props)`, etc. from the SDK to participate in the reactive data system. They use `var(--a2ui-*)` CSS custom properties for theming.

---

## 3. Discovery Mechanism

### 3.1 Package.json convention

External catalog packages declare themselves via an `openclaw-canvas-web` field in their `package.json`:

```json
{
  "name": "@example/a2ui-charts",
  "version": "1.0.0",
  "openclaw-canvas-web": {
    "entry": "./dist/index.js"
  },
  "peerDependencies": {
    "vue": "^3.5.0",
    "@openclaw-canvas-web/sdk": "^0.1.0"
  }
}
```

Fields:
- `entry` (required): Path to the ES module that default-exports a `PackageDefinition`.

Packages advertise component IDs only. Catalog membership is determined by the server's local configuration.

### 3.2 Server-side discovery

New file: `src/server/services/catalog-registry.ts`

At startup, the server:

1. Reads its own `package.json` to get the dependency list
2. For each dependency, reads `node_modules/<pkg>/package.json`
3. If the package has an `openclaw-canvas-web` field, records it
4. Builds a registry: `Map<catalogId, { packageName, entry, components[] }>`
5. Exposes the registry to the Vite build pipeline and to the SPA via an API endpoint

```typescript
export interface CatalogEntry {
  packageName: string
  entry: string          // resolved absolute path to entry module
  componentNames: string[] // populated after loading the entry
}

export class CatalogRegistry {
  private packages = new Map<string, CatalogEntry>()
  private catalogs = new Map<string, Set<string>>() // catalogId → component names

  async discover(projectRoot: string): Promise<void> { /* scan node_modules */ }
  getPackage(packageName: string): CatalogEntry | undefined { /* ... */ }
  getCatalogComponents(catalogId: string): string[] { /* ... */ }
  allCatalogs(): { catalogId: string; components: string[] }[] { /* ... */ }
  getComponentMap(): Record<string, { packageName: string; importPath: string }> { /* ... */ }
}
```

### 3.3 API endpoint

New route: `GET /api/catalogs`

Returns the list of available catalogs and their component names. Used by agents to know what's available, and by the SPA for debugging.

```json
{
  "catalogs": [
    {
      "catalogId": "https://haliphax-openclaw.github.io/a2ui/1.0/basic",
      "components": ["Column", "Row", "Text", "Button", "Image", "Select", "MultiSelect", "Checkbox", "Slider", "Divider", "Tabs"]
    },
    {
      "catalogId": "https://haliphax-openclaw.github.io/a2ui/1.0/built-in",
      "components": ["Column", "Row", "Text", "Button", "Image", "Stack", "Spacer", "Select", "MultiSelect", "Table", "Checkbox", "ProgressBar", "Slider", "Badge", "Divider", "Repeat", "Accordion", "Tabs"]
    },
    {
      "catalogId": "https://haliphax-openclaw.github.io/a2ui/1.0/all",
      "components": ["Column", "Row", "Text", "Button", "Image", "Stack", "Spacer", "Select", "MultiSelect", "Table", "Checkbox", "ProgressBar", "Slider", "Badge", "Divider", "Repeat", "Accordion", "Tabs", "BarChart", "LineChart", "PieChart"]
    }
  ]
}
```

---

## 4. Component Resolution

### 4.1 Current behavior (A2UINode.vue)

Currently, `A2UINode.vue` has a hardcoded `componentMap`:

```typescript
const componentMap: Record<string, ReturnType<typeof defineComponent>> = {
  Column: A2UIColumn,
  Row: A2UIRow,
  Text: A2UIText,
  // ... 18 total built-in components
}
```

Resolution is simple: look up `typeName` in `componentMap`.

### 4.2 New resolution: built-in + catalog

Replace the static `componentMap` with a two-tier lookup:

```typescript
// 1. Built-in components (always available, highest priority)
const builtinMap: Record<string, Component> = {
  Column: A2UIColumn,
  // ... all current built-ins
}

// 2. Catalog components (loaded from discovered packages)
// This is populated at build time via a Vite virtual module
import { catalogComponents } from 'virtual:openclaw-catalogs'
// catalogComponents: Record<string, { component: Component }>
// Server config determines which catalogs include which components

const resolvedComponent = computed(() => {
  const name = typeName.value
  if (!name) return null

  // Built-in always wins
  if (builtinMap[name]) return builtinMap[name]

  // Catalog lookup, filtered by surface catalogId via server-side catalog membership
  const catalogComp = catalogComponents[name]
  if (!catalogComp) return null

  // If surface has a catalogId restriction, check server-side catalog membership
  const surfaceCatalogId = surface.value?.catalogId
  if (surfaceCatalogId && !catalogMembership[surfaceCatalogId]?.includes(name)) {
    return null
  }

  return catalogComp.component
})
```

### 4.3 catalogId enforcement

The `createSurface` command already stores `catalogId` on the surface (from the v0.9 upgrade plan §5.2). The resolution logic uses it:

- `catalogId` omitted → defaults to `https://haliphax-openclaw.github.io/a2ui/1.0/built-in` (all built-in components)
- `catalogId` set to a specific URI → built-in basic components + components assigned to that catalog by server config
- `catalogId` set to `https://haliphax-openclaw.github.io/a2ui/1.0/all` → all installed components available (useful for development)

This is stored in Vuex on `A2UISurfaceState`:

```typescript
export interface A2UISurfaceState {
  components: Record<string, Record<string, unknown>>
  root: string | null
  dataModel: Record<string, unknown>
  sources: Record<string, DataSource>
  filters: Record<string, FieldFilter[]>
  catalogId?: string  // NEW — from createSurface
}
```

### 4.4 Name collision handling

If two catalogs define a component with the same name:
- Built-in always wins (cannot be overridden)
- Among catalogs, the first one discovered wins (alphabetical by package name)
- A warning is logged at startup
- The `catalogId` restriction on surfaces is the proper way to disambiguate

---

## 5. Build Pipeline

### 5.1 Vite virtual module approach

External components are bundled into the SPA at build time (or served in dev mode) via a Vite plugin that generates a virtual module.

New file: `src/build/vite-plugin-catalogs.ts`

```typescript
export function catalogPlugin(registry: CatalogRegistry): Plugin {
  return {
    name: 'openclaw-catalogs',
    resolveId(id) {
      if (id === 'virtual:openclaw-catalogs') return '\0virtual:openclaw-catalogs'
    },
    load(id) {
      if (id === '\0virtual:openclaw-catalogs') {
        // Generate import statements for each discovered catalog
        const imports: string[] = []
        const registrations: string[] = []
        for (const catalog of registry.allCatalogs()) {
          const varName = `catalog_${sanitize(catalog.packageName)}`
          imports.push(`import ${varName} from '${catalog.entry}'`)
          registrations.push(`...registerCatalog(${varName})`)
        }
        return `
          ${imports.join('\n')}
          function registerPackage(def) {
            const map = {}
            for (const c of def.components) {
              map[c.name] = { component: c.component }
            }
            return map
          }
          export const catalogComponents = { ${registrations.join(', ')} }
        `
      }
    }
  }
}
```

### 5.2 Dev mode

In dev mode, Vite's HMR handles catalog packages like any other dependency. The virtual module is regenerated when the server restarts (after `npm install` of a new catalog package). No rebuild needed for existing packages.

### 5.3 Production build

`npm run build` triggers Vite, which:
1. Runs the catalog discovery
2. Generates the virtual module with all catalog imports
3. Bundles everything into the SPA output

External catalog packages must ship pre-built ES modules (not raw `.vue` SFCs) to avoid requiring the consumer to have Vue SFC compilation in their build. The `entry` field in `package.json` points to the pre-built output.

### 5.4 No dynamic import at runtime

This is a deliberate architectural choice. Components are statically imported at build time, not dynamically loaded. This means:
- Adding a new catalog package requires `npm install` + server restart (dev) or rebuild (prod)
- No runtime code loading from untrusted sources
- Tree-shaking works normally
- No CORS, CSP, or sandboxing concerns

---

## 6. Component Contract

### 6.1 What external components must implement

A valid A2UI catalog component is a Vue 3 component that:

1. **Accepts standard props**: `def` (Object, required), `surfaceId` (String, required), `componentId` (String, required)
2. **Reads configuration from `def`**: All component-specific properties come from `def` (e.g., `def.text`, `def.children`, `def.dataSource`)
3. **Uses SDK composables for data**: `useDataSource(props)` for data binding, `useFilterBind(props)` for filter participation
4. **Uses theme tokens for styling**: References `var(--a2ui-*)` CSS custom properties, never hardcodes colors
5. **Sends events via SDK**: `wsClient.send({ type: 'a2ui.<event>', componentId })` for user interactions
6. **Declares its name**: The `name` field in `ComponentRegistration` matches the A2UI component type string

### 6.2 Minimal example

```vue
<!-- BarChart.vue -->
<template>
  <div class="a2ui-bar-chart">
    <div v-for="(bar, i) in bars" :key="i" class="bar"
         :style="{ height: bar.pct + '%', background: 'var(--a2ui-primary)' }">
      <span>{{ bar.label }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { useDataSource } from '@openclaw-canvas-web/sdk'

export default defineComponent({
  name: 'A2UIBarChart',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const { filteredRows } = useDataSource(props as any)
    const bars = computed(() => {
      const rows = filteredRows.value ?? []
      const field = (props.def as any).valueField ?? 'value'
      const labelField = (props.def as any).labelField ?? 'label'
      const max = Math.max(...rows.map((r: any) => Number(r[field]) || 0), 1)
      return rows.map((r: any) => ({
        label: r[labelField] ?? '',
        pct: ((Number(r[field]) || 0) / max) * 100,
      }))
    })
    return { bars }
  },
})
</script>

<style scoped>
.a2ui-bar-chart { display: flex; gap: 4px; align-items: flex-end; height: 200px; }
.bar { min-width: 24px; border-radius: 4px 4px 0 0; display: flex; align-items: flex-end; justify-content: center; }
.bar span { font-size: 0.7em; color: var(--a2ui-text); }
</style>
```

### 6.3 Catalog entry point

```typescript
// index.ts — the entry point referenced in package.json openclaw-canvas-web.entry
import type { PackageDefinition } from '@openclaw-canvas-web/sdk'
import BarChart from './BarChart.vue'
import LineChart from './LineChart.vue'

const pkg: PackageDefinition = {
  components: [
    { name: 'BarChart', component: BarChart },
    { name: 'LineChart', component: LineChart },
  ],
}

export default pkg
```

### 6.4 Data binding participation

External components participate in the reactive data system identically to built-in components:

- **Reading data**: `useDataSource(props)` returns `filteredRows`, `aggregatedValue`, `compoundAggregates`, `mappedProps` — all reactive, all filter-aware
- **Writing filters**: `useFilterBind(props)` returns `updateFilter(value)` — pushes filters to the Vuex store, affecting all components bound to the same source
- **Derived options**: `useOptionsFrom(props)` returns `derivedOptions` — unique values from a data source field
- **Sorting**: `useSortable(rows)` returns `sortedRows`, `cycleSort` — client-side sort state

### 6.5 Variant/theme participation

External components should:
- Read `def.variant` for semantic hints (if applicable to their component type)
- Use `var(--a2ui-primary)` for accent colors, `var(--a2ui-text)` for text, etc.
- Not hardcode colors — the theme system handles visual consistency

---

## 7. Vuex Store Changes

### 7.1 Surface metadata

Add `catalogId` to `A2UISurfaceState` (stored when `createSurface` is processed):

```typescript
export interface A2UISurfaceState {
  components: Record<string, Record<string, unknown>>
  root: string | null
  dataModel: Record<string, unknown>
  sources: Record<string, DataSource>
  filters: Record<string, FieldFilter[]>
  catalogId?: string   // NEW
  theme?: Record<string, unknown>  // from theme-support-plan
}
```

### 7.2 Mutation update

The `upsertSurface` mutation (or a new `createSurface` mutation) stores `catalogId`:

```typescript
createSurface(state, payload: { surfaceId: string; root?: string; catalogId?: string; theme?: Record<string, unknown> }) {
  if (!state.surfaces[payload.surfaceId]) {
    state.surfaces[payload.surfaceId] = makeSurface()
  }
  const s = state.surfaces[payload.surfaceId]
  if (payload.root) s.root = payload.root
  if (payload.catalogId) s.catalogId = payload.catalogId
  if (payload.theme) s.theme = payload.theme
}
```

---

## 8. Identifying Custom Components for Extraction Test

### 8.1 Current component inventory

All 18 components in `A2UINode.vue`'s `componentMap` map to the A2UI v0.9 basic catalog:

| Component | A2UI Basic Catalog? | Notes |
|---|---|---|
| Column | ✅ | Standard layout |
| Row | ✅ | Standard layout |
| Text | ✅ | Standard display |
| Button | ✅ | Standard interactive |
| Image | ✅ | Standard display |
| Stack | ❌ | **Not in basic catalog** — custom overlay/z-index layout |
| Spacer | ❌ | **Not in basic catalog** — flex spacer |
| Select / MultiSelect | ✅ (as ChoicePicker) | Maps to ChoicePicker in spec |
| Table | ❌ | **Not in basic catalog** — custom data table |
| Checkbox | ✅ | Standard interactive |
| ProgressBar | ❌ | **Not in basic catalog** — custom data-bound progress |
| Slider | ✅ | Standard interactive |
| Badge | ❌ | **Not in basic catalog** — custom status indicator |
| Divider | ✅ | Standard display |
| Repeat | ❌ | **Not in basic catalog** — custom data-driven repeater |
| Accordion | ❌ | **Not in basic catalog** — custom collapsible panels |
| Tabs | ✅ | Standard container |

### 8.2 First extraction candidates

The following components are custom extensions (not in the A2UI basic catalog) and would be good test cases for extraction into a separate catalog package:

1. **Repeat** — Most complex custom component. Uses `useDataSource`, `useSortable`, template resolution, and per-row rendering. Exercises the full data binding pipeline.
2. **Table** — Data-bound table with sorting, formatters, and column selection. Heavy use of `useDataSource` and `useSortable`.
3. **Badge** — Simple data-bound display component with variant support. Good minimal test case.
4. **ProgressBar** — Data-bound with template interpolation. Tests the aggregate/compound system.
5. **Accordion** — Container component with local state. Tests child rendering via `A2UINode`.

**Recommended first test**: Extract `Badge` as the simplest case, then `Table` as the most complex. If both work, the SDK contract is validated.

### 8.3 Note on DeepLinkConfirm.vue

`DeepLinkConfirm.vue` is not an A2UI component — it's a platform UI element (modal dialog for confirming deep link actions). It stays internal.

---

## 9. Implementation Steps

### Step 1: Create SDK package skeleton

Create `packages/sdk/` with `package.json`, `tsconfig.json`, and barrel exports. Copy types and composables from the main app. Set up TypeScript path aliases so the main app can import from `@openclaw-canvas-web/sdk` during development.

### Step 2: Migrate internal imports

Update all built-in components and composables to import from `@openclaw-canvas-web/sdk` instead of relative paths. Verify no behavior change.

### Step 3: Implement catalog discovery

Create `src/server/services/catalog-registry.ts`. Implement `node_modules` scanning for packages with the `openclaw-canvas-web` field. Add the `/api/catalogs` endpoint.

### Step 4: Implement Vite plugin

Create `src/build/vite-plugin-catalogs.ts`. Generate the `virtual:openclaw-catalogs` module from the registry. Wire it into `vite.config.ts`.

### Step 5: Update A2UINode.vue resolution

Replace the static `componentMap` with the two-tier lookup (built-in + catalog). Add `catalogId` filtering.

### Step 6: Store catalogId on surfaces

Add `catalogId` to `A2UISurfaceState`. Update `createSurface` handling in the server command processor and Vuex mutations.

### Step 7: Extract Badge as test catalog

Create a test package `packages/test-catalog/` that exports Badge as a component package using the SDK. Install it locally. Add it to a test catalog via server config. Verify it renders correctly when referenced from a surface with the matching `catalogId`.

### Step 8: Extract Table as complex test

Move Table to the test catalog. Verify data binding, sorting, and formatters work through the SDK.

### Step 9: Documentation

Write a `docs/creating-catalog-packages.md` guide covering:
- SDK installation
- Component contract
- Package.json convention
- Build requirements
- Theme token reference

---

## 10. Files Changed / Created

| File | Change |
|---|---|
| `packages/sdk/` | New — SDK package |
| `packages/sdk/package.json` | New |
| `packages/sdk/src/types.ts` | New — extracted from `store/a2ui.ts` + new `PackageDefinition` |
| `packages/sdk/src/composables/*.ts` | New — extracted from `src/client/composables/` |
| `packages/sdk/src/filters.ts` | New — extracted from `services/filter-engine.ts` |
| `packages/sdk/src/ws.ts` | New — thin event sender wrapper |
| `packages/sdk/src/theme.ts` | New — token constants |
| `src/server/services/catalog-registry.ts` | New — discovery mechanism |
| `src/build/vite-plugin-catalogs.ts` | New — Vite virtual module plugin |
| `vite.config.ts` | Modified — add catalog plugin |
| `src/client/components/A2UINode.vue` | Modified — two-tier resolution |
| `src/client/store/a2ui.ts` | Modified — add `catalogId` to surface state |
| `src/server/services/a2ui-commands.ts` | Modified — pass `catalogId` from `createSurface` |
| `src/server/services/a2ui-manager.ts` | Modified — store `catalogId` on surface |
| `src/client/composables/*.ts` | Modified — re-export from SDK |
| `src/client/services/filter-engine.ts` | Modified — re-export from SDK |
| `src/server/routes/catalogs.ts` | New — `/api/catalogs` endpoint |
| `packages/test-catalog/` | New — test extraction package |

---

## 11. Out of Scope

- Runtime dynamic loading of components from URLs (architectural decision: not doing this)
- Catalog negotiation protocol (A2UI spec's client↔server capability exchange) — our agents are local, not remote
- Inline catalogs from clients (spec feature, not needed for our use case)
- Validation loop (`VALIDATION_FAILED` error feedback) — separate effort per v0.9 upgrade spec §5.4
- `formatString` interpolation — separate effort per v0.9 upgrade spec §5.5
- Publishing `@openclaw-canvas-web/sdk` to npm (future — start with local monorepo)

---

## 12. Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| SDK extraction breaks internal components | Medium | Step 2 is a pure refactor — run full test suite before proceeding |
| External components break when SDK changes | Medium | Semver the SDK; peer dependency on `@openclaw-canvas-web/sdk` |
| Vite virtual module doesn't work with HMR | Low | Virtual modules are well-supported in Vite; fallback to static codegen |
| Component name collisions across catalogs | Low | Built-in always wins; `catalogId` restriction disambiguates; warn at startup |
| External components access Vuex directly instead of via SDK | Medium | Document the contract clearly; SDK composables are the supported API |
| Build time increases with many catalog packages | Low | Catalog packages ship pre-built; only import resolution, no compilation |
