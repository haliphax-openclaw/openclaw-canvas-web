# Theme Support Plan — openclaw-canvas-web

**Date:** 2026-03-19
**Depends on:** a2ui-v09-upgrade (Steps 1–9 complete — `theme` already stored in Vuex, `variant` rename done)

---

## 1. Summary

Implement A2UI v0.9 theme support so that `createSurface({ theme: { primaryColor: "#007bff" } })` activates a cohesive set of styles across all components on the surface. Components use `variant` to declare their semantic role; the theme determines how each variant looks visually. All component styles reference CSS custom properties (design tokens) rather than hardcoded colors.

### What the spec says

The A2UI v0.9 basic catalog defines three theme properties on `createSurface`:

| Property | Type | Description |
|---|---|---|
| `primaryColor` | String (hex) | Primary brand color for highlights, active borders, primary buttons. Renderer may generate lighter/darker variants. |
| `iconUrl` | URI | Logo/avatar identifying the agent or tool. |
| `agentDisplayName` | String | Display name for the agent/tool that created the surface. |

The spec's styling philosophy: agents describe *what* to show (components + `variant`), clients decide *how* it looks (colors, fonts, spacing). Agents must not set visual properties directly — only semantic hints via `variant`.

### What we already have

- `theme` object stored in Vuex on `A2UISurfaceState` (from v0.9 upgrade Step 7)
- `A2UIRenderer.vue` applies `--a2ui-primary` from `theme.primaryColor` on the surface container
- All components use hardcoded dark-theme hex colors (see audit below)
- `new.css` provides base HTML element styling via `--nc-*` CSS custom properties
- `variant` is already used by Text (h1–h6, body, label) and Badge (success, warning, error, info)

---

## 2. Design

### 2.1 Token Architecture

Define a set of CSS custom properties (tokens) on `.a2ui-renderer` that all components reference. These tokens have sensible defaults (matching the current dark theme) and can be overridden by the active theme.

**Token categories:**

| Token | Default | Used by |
|---|---|---|
| `--a2ui-primary` | `#4a6cf7` | Button, ProgressBar fill, Slider accent, Tab active, links |
| `--a2ui-primary-hover` | `#5d7df9` | Button hover, Tab hover |
| `--a2ui-text` | `#e0e0e0` | All text-bearing components |
| `--a2ui-text-muted` | `#999` | Inactive tabs, secondary text |
| `--a2ui-bg` | `#000000` | Surface background (inherits from page) |
| `--a2ui-bg-surface` | `#1a1a2e` | Select, Table header, elevated surfaces |
| `--a2ui-bg-raised` | `#2a2a2a` | Accordion header, hover states |
| `--a2ui-bg-raised-hover` | `#3a3a3a` | Accordion header hover |
| `--a2ui-bg-inset` | `#1e1e1e` | Accordion content, inset panels |
| `--a2ui-border` | `#444` | Divider, Table borders, Tab bars, Accordion panels, Select |
| `--a2ui-track` | `#333` | ProgressBar track |
| `--a2ui-badge-info-bg` | `#1e3a5f` | Badge info variant |
| `--a2ui-badge-info-fg` | `#7ec8e3` | Badge info variant |
| `--a2ui-badge-success-bg` | `#1b4332` | Badge success variant |
| `--a2ui-badge-success-fg` | `#74c69d` | Badge success variant |
| `--a2ui-badge-warning-bg` | `#5a3e00` | Badge warning variant |
| `--a2ui-badge-warning-fg` | `#ffd166` | Badge warning variant |
| `--a2ui-badge-error-bg` | `#5c1a1a` | Badge error variant |
| `--a2ui-badge-error-fg` | `#f28b82` | Badge error variant |

### 2.2 Theme Application

When `createSurface` includes a `theme` object, `A2UIRenderer.vue` maps theme properties to CSS custom properties on the surface container element. Components inherit these via normal CSS cascade.

**Mapping logic in `A2UIRenderer.vue`:**

```typescript
const themeStyle = computed(() => {
  const t = theme.value
  if (!t?.primaryColor) return {}
  return {
    '--a2ui-primary': t.primaryColor,
    '--a2ui-primary-hover': lighten(t.primaryColor, 15),
    // Badge variants derived from primary when no explicit overrides
    '--a2ui-badge-info-bg': darken(t.primaryColor, 40),
    '--a2ui-badge-info-fg': lighten(t.primaryColor, 30),
  }
})
```

A small `color-utils.ts` provides `lighten()` and `darken()` helpers (hex string manipulation, no dependencies).

### 2.3 Variant → Visual Mapping

`variant` is a semantic hint. The theme determines the visual output:

| Component | Variant values | Visual effect |
|---|---|---|
| Text | h1–h6, body, label, caption | HTML tag selection (already done) |
| Badge | success, warning, error, info | Background/foreground color pair from tokens |
| Button | primary, borderless, default | primary uses `--a2ui-primary`; borderless is transparent; default is neutral |
| Tabs | (none currently) | Active tab uses `--a2ui-primary` for border accent |

Button currently has no variant support — this plan adds it.

### 2.4 Relationship with new.css

`new.css` styles bare HTML elements (`<button>`, `<select>`, `<table>`, `<h1>`, etc.) using `--nc-*` variables defined in `index.html`. A2UI components render these same HTML elements, so they inherit new.css styles by default.

**Strategy: A2UI tokens override new.css where needed.**

- The `--nc-*` variables in `index.html` remain the page-level defaults (green-on-black terminal theme)
- `.a2ui-renderer` sets `--a2ui-*` tokens and uses them in scoped component styles
- A2UI component styles use `var(--a2ui-*)` instead of hardcoded hex, which takes precedence over new.css's element-level styles via specificity (scoped class selectors > element selectors)
- No changes to `index.html` or new.css configuration needed

### 2.5 Multiple Themes

The architecture supports multiple themes naturally:

1. **Default theme** — hardcoded token defaults in `.a2ui-renderer` CSS (current dark look)
2. **Agent-specified theme** — `createSurface({ theme: { primaryColor: "#00BFFF" } })` overrides tokens via inline style
3. **Multiple surfaces** — each surface has its own theme object in Vuex, applied independently to its `.a2ui-renderer` container
4. **Future: named themes** — could add a `themeName` field that selects from a preset map (e.g., "light", "dark", "high-contrast") before applying `primaryColor` overrides on top

Dark/light mode toggle is out of scope for this plan — the current renderer is dark-only. A future plan could add a `mode: "light"` theme property that swaps the base token values.

### 2.6 Identity & Attribution

The spec defines `iconUrl` and `agentDisplayName` as theme properties for identifying which agent created a surface. These are stored in Vuex already. This plan adds optional rendering of these in `A2UIRenderer.vue` as a small attribution bar above the surface content (icon + name), shown only when both are provided.

---

## 3. Component Audit — What Changes

Every hardcoded color in A2UI component `<style>` blocks must be replaced with a `var(--a2ui-*)` token reference.

| Component | Hardcoded colors | Token replacement |
|---|---|---|
| **A2UIRenderer.vue** | none (already applies `--a2ui-primary`) | Add all token defaults in `:host`/`.a2ui-renderer` |
| **A2UIBadge.vue** | 8 colors (4 bg + 4 fg for variants) | `var(--a2ui-badge-{variant}-bg/fg)` |
| **A2UITable.vue** | `#e0e0e0`, `#444`, `#16213e` | `--a2ui-text`, `--a2ui-border`, `--a2ui-bg-surface` |
| **A2UITabs.vue** | `#444`, `#999`, `#2a2a2a`, `#ccc`, `#e0e0e0`, `#16213e` | `--a2ui-border`, `--a2ui-text-muted`, `--a2ui-bg-raised`, `--a2ui-text`, `--a2ui-primary` |
| **A2UIAccordion.vue** | `#444`, `#2a2a2a`, `#e0e0e0`, `#3a3a3a`, `#1e1e1e` | `--a2ui-border`, `--a2ui-bg-raised`, `--a2ui-text`, `--a2ui-bg-raised-hover`, `--a2ui-bg-inset` |
| **A2UIProgressBar.vue** | `#e0e0e0`, `#333`, `#4a6cf7` | `--a2ui-text`, `--a2ui-track`, `--a2ui-primary` |
| **A2UISlider.vue** | `#e0e0e0`, `#4a6cf7` | `--a2ui-text`, `--a2ui-primary` |
| **A2UISelect.vue** | `#1a1a2e`, `#e0e0e0`, `#444` | `--a2ui-bg-surface`, `--a2ui-text`, `--a2ui-border` |
| **A2UICheckbox.vue** | `#e0e0e0` | `--a2ui-text` |
| **A2UIDivider.vue** | `#444` | `--a2ui-border` |
| **A2UIRepeat.vue** | `#1a1a2e`, `#e0e0e0`, `#444` | `--a2ui-bg-surface`, `--a2ui-text`, `--a2ui-border` |
| **A2UIButton.vue** | none (inherits from new.css `<button>`) | Add `variant` support: primary uses `--a2ui-primary` bg |
| **A2UIText.vue** | none (inherits from new.css) | No changes needed |
| **A2UIImage.vue** | none | No changes needed |
| **A2UIColumn.vue** | none | No changes needed |
| **A2UIRow.vue** | none | No changes needed |
| **A2UISpacer.vue** | none | No changes needed |
| **A2UIStack.vue** | none | No changes needed |

---

## 4. Implementation Steps

### Step 1: Create `color-utils.ts`

`src/client/utils/color-utils.ts` — pure functions to lighten/darken hex colors. ~20 lines, no dependencies.

### Step 2: Define token defaults in `A2UIRenderer.vue`

Add all `--a2ui-*` token defaults in the `.a2ui-renderer` CSS rule. Add the `themeStyle` computed that maps `theme.primaryColor` → token overrides (with derived variants via `lighten`/`darken`). Add optional attribution bar for `iconUrl`/`agentDisplayName`.

### Step 3: Replace hardcoded colors in components

Update each component's `<style>` block to use `var(--a2ui-*)` tokens. This is a mechanical find-and-replace per the audit table above. No logic changes.

Components to update (in order of most colors to fewest):
1. A2UIBadge.vue
2. A2UITabs.vue
3. A2UIAccordion.vue
4. A2UITable.vue
5. A2UIProgressBar.vue
6. A2UISelect.vue
7. A2UIRepeat.vue
8. A2UISlider.vue
9. A2UICheckbox.vue
10. A2UIDivider.vue

### Step 4: Add Button variant support

Update `A2UIButton.vue` to read `def.variant` and apply styles:
- `primary`: `background: var(--a2ui-primary); color: white`
- `borderless`: `background: transparent; border: none`
- default: inherit from new.css (no change)

### Step 5: Verify with existing JSONL

Load `dashboard-demo.jsonl` and verify the default theme renders identically to current behavior (no visual regression). Then test with a `createSurface` that includes `theme: { primaryColor: "#00BFFF" }` and verify the primary color propagates to all relevant components.

---

## 5. Files Changed

| File | Change type |
|---|---|
| `src/client/utils/color-utils.ts` | New |
| `src/client/components/A2UIRenderer.vue` | Modified (token defaults, theme mapping, attribution) |
| `src/client/components/A2UIBadge.vue` | Modified (tokens) |
| `src/client/components/A2UITabs.vue` | Modified (tokens) |
| `src/client/components/A2UIAccordion.vue` | Modified (tokens) |
| `src/client/components/A2UITable.vue` | Modified (tokens) |
| `src/client/components/A2UIProgressBar.vue` | Modified (tokens) |
| `src/client/components/A2UISelect.vue` | Modified (tokens) |
| `src/client/components/A2UIRepeat.vue` | Modified (tokens) |
| `src/client/components/A2UISlider.vue` | Modified (tokens) |
| `src/client/components/A2UICheckbox.vue` | Modified (tokens) |
| `src/client/components/A2UIDivider.vue` | Modified (tokens) |
| `src/client/components/A2UIButton.vue` | Modified (variant support + tokens) |

---

## 6. Out of Scope

- Light/dark mode toggle (future plan)
- Named theme presets (future — add a `themeName` field)
- `formatString` interpolation (separate effort, see upgrade spec §5.5)
- Custom fonts via theme (spec mentions it in guides but no schema property yet)
- Per-component style overrides from agents (spec explicitly forbids this)
